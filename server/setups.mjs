import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { ZipArchive } from 'archiver';
import { recordAudit } from './database.mjs';
import { sendAccessInvitation, sendAccessRequestNotification } from './email.mjs';
import {
  consumeRecoveryCode,
  createSession,
  destroySession,
  expiredSessionCookie,
  getSession,
  hashPassword,
  hashToken,
  requireCsrf,
  sessionCookie,
  verifyPassword,
  verifyTotp,
} from './security.mjs';
import { ApiError, validateAccessRequest, validateAdminIdentity } from './validation.mjs';

const JSON_LIMIT = 1024 * 1024;
const SETUP_FILE_LIMIT = 25 * 1024 * 1024;
const DEFAULT_SETUP_RETENTION_DAYS = 30;
const SESSION_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SETUP_EXTENSIONS = new Set([
  '.sto',
  '.svm',
  '.set',
  '.setup',
  '.ini',
  '.json',
  '.xml',
  '.zip',
]);
const SETUP_SESSION_TYPES = new Set([
  'race',
  'qualifying',
  'wet',
  'endurance',
  'endurance_safe',
  'qualifying_endurance',
  'qualifying_safe',
  'race_endurance',
  'race_safe',
  'other',
]);
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export async function routeSetupApi(context) {
  const { path, method } = context;

  if (method === 'GET' && path === '/api/access/session') {
    return accessSession(context);
  }
  if (method === 'POST' && path === '/api/access/login') {
    return loginToAccess(context);
  }
  if (method === 'POST' && path === '/api/access/logout') {
    return logoutFromSetups(context);
  }
  if (method === 'POST' && path === '/api/access/requests') {
    return requestSetupAccess(context);
  }
  if (method === 'GET' && path === '/api/access/invitations/verify') {
    return verifySetupInvitation(context);
  }
  if (method === 'POST' && path === '/api/access/invitations/accept') {
    return acceptSetupInvitation(context);
  }

  if (method === 'GET' && path === '/api/setup-access/session') {
    return setupSession(context);
  }
  if (method === 'POST' && path === '/api/setup-access/login') {
    return loginToSetups(context);
  }
  if (method === 'POST' && path === '/api/setup-access/logout') {
    return logoutFromSetups(context);
  }
  if (method === 'POST' && path === '/api/setup-access/requests') {
    return requestSetupAccess(context);
  }
  if (method === 'GET' && path === '/api/setup-access/invitations/verify') {
    return verifySetupInvitation(context);
  }
  if (method === 'POST' && path === '/api/setup-access/invitations/accept') {
    return acceptSetupInvitation(context);
  }

  const session = getSession(context.db, context.request);
  if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  if (!session.admin.mfaEnabled) {
    throw new ApiError(403, 'MFA_SETUP_REQUIRED', 'Configura TOTP antes de entrar.');
  }
  if (!SESSION_METHODS.has(method) && !requireCsrf(context.request, session)) {
    throw new ApiError(403, 'INVALID_CSRF', 'La sesión necesita renovarse antes de guardar.');
  }

  if (path.startsWith('/api/access/')) {
    requireSetupAdministrator(session);
    return routeSetupAccessManagement({ ...context, session });
  }

  if (path.startsWith('/api/setup-access/')) {
    requireSetupAdministrator(session);
    return routeSetupAccessManagement({ ...context, session });
  }

  if (!session.admin.canAccessSetups) {
    throw new ApiError(403, 'SETUP_ACCESS_REQUIRED', 'Tu cuenta no tiene acceso a los setups.');
  }
  return routeSetupLibrary({ ...context, session });
}

function setupSession(context) {
  const session = getSession(context.db, context.request);
  const authorized = Boolean(session?.admin.canAccessSetups && session.admin.mfaEnabled);
  return sendJson(context.response, 200, {
    authenticated: authorized,
    account: authorized ? setupAccount(session.admin) : null,
    csrfToken: authorized ? session.csrfToken : null,
  });
}

function accessSession(context) {
  const session = getSession(context.db, context.request);
  const authenticated = Boolean(session?.admin.mfaEnabled);
  return sendJson(context.response, 200, {
    authenticated,
    account: authenticated ? setupAccount(session.admin) : null,
    csrfToken: authenticated ? session.csrfToken : null,
  });
}

async function loginToAccess(context) {
  const { db, request, response, secureCookies, loginAttempts } = context;
  const input = await readJson(request);
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(input.password ?? '');
  const rememberMe = input.rememberMe === true;
  const attemptKey = `access:${request.socket.remoteAddress ?? 'local'}:${email}`;
  assertLoginAllowed(loginAttempts, attemptKey);
  const account = db
    .prepare('SELECT * FROM admin_profiles WHERE email = ? AND active = 1')
    .get(email);
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    registerFailedLogin(loginAttempts, attemptKey);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no son correctos.');
  }
  if (account.totp_enabled !== 1) {
    throw new ApiError(403, 'MFA_SETUP_REQUIRED', 'Completa la configuración de TOTP para entrar.');
  }
  const mfaCode = String(input.mfaCode ?? '').trim();
  if (!mfaCode) throw new ApiError(401, 'MFA_REQUIRED', 'Introduce tu código de segundo factor.');
  const remainingRecoveryCodes = consumeRecoveryCode(mfaCode, account.recovery_codes);
  if (!verifyTotp(mfaCode, account.totp_secret) && remainingRecoveryCodes === null) {
    registerFailedLogin(loginAttempts, attemptKey);
    throw new ApiError(401, 'INVALID_MFA_CODE', 'El código de segundo factor no es válido.');
  }
  if (remainingRecoveryCodes !== null) {
    db.prepare('UPDATE admin_profiles SET recovery_codes = ?, updated_at = ? WHERE id = ?').run(
      remainingRecoveryCodes,
      new Date().toISOString(),
      account.id,
    );
  }
  loginAttempts.delete(attemptKey);
  const session = createSession(db, account.id, { remember: rememberMe });
  response.setHeader(
    'Set-Cookie',
    sessionCookie(session.token, session.expiresAt, secureCookies, rememberMe),
  );
  recordAudit(db, account.id, 'access.login', 'account', account.id, { rememberMe });
  return sendJson(response, 200, {
    authenticated: true,
    account: setupAccountFromRow(account),
    csrfToken: session.csrfToken,
  });
}

async function loginToSetups(context) {
  const { db, request, response, secureCookies, loginAttempts } = context;
  const input = await readJson(request);
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(input.password ?? '');
  const attemptKey = `setups:${request.socket.remoteAddress ?? 'local'}:${email}`;
  assertLoginAllowed(loginAttempts, attemptKey);
  const account = db
    .prepare(
      `SELECT * FROM admin_profiles
       WHERE email = ? AND active = 1
         AND (account_type = 'administrator' OR can_access_setups = 1)`,
    )
    .get(email);
  if (!account || !(await verifyPassword(password, account.password_hash))) {
    registerFailedLogin(loginAttempts, attemptKey);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no son correctos.');
  }
  if (account.totp_enabled !== 1) {
    throw new ApiError(
      403,
      'MFA_SETUP_REQUIRED',
      'Completa la configuración de TOTP antes de entrar.',
    );
  }
  if (account.totp_enabled === 1) {
    const mfaCode = String(input.mfaCode ?? '').trim();
    if (!mfaCode) {
      throw new ApiError(401, 'MFA_REQUIRED', 'Introduce tu código de segundo factor.');
    }
    const remainingRecoveryCodes = consumeRecoveryCode(mfaCode, account.recovery_codes);
    if (!verifyTotp(mfaCode, account.totp_secret) && remainingRecoveryCodes === null) {
      registerFailedLogin(loginAttempts, attemptKey);
      throw new ApiError(401, 'INVALID_MFA_CODE', 'El código de segundo factor no es válido.');
    }
    if (remainingRecoveryCodes !== null) {
      db.prepare('UPDATE admin_profiles SET recovery_codes = ?, updated_at = ? WHERE id = ?').run(
        remainingRecoveryCodes,
        new Date().toISOString(),
        account.id,
      );
    }
  }
  loginAttempts.delete(attemptKey);
  db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(new Date().toISOString());
  const session = createSession(db, account.id);
  response.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt, secureCookies));
  recordAudit(db, account.id, 'setups.login', 'account', account.id);
  return sendJson(response, 200, {
    authenticated: true,
    account: setupAccountFromRow(account),
    csrfToken: session.csrfToken,
  });
}

function logoutFromSetups(context) {
  const session = getSession(context.db, context.request);
  if (session && !requireCsrf(context.request, session)) {
    throw new ApiError(403, 'INVALID_CSRF', 'La sesión necesita renovarse antes de salir.');
  }
  if (session) destroySession(context.db, session.token);
  context.response.setHeader('Set-Cookie', expiredSessionCookie(context.secureCookies));
  return sendEmpty(context.response, 204);
}

async function requestSetupAccess(context) {
  const { db, request, response, actionAttempts } = context;
  consumeActionLimit(
    actionAttempts,
    `setup-request:${request.socket.remoteAddress ?? 'local'}`,
    5,
    60 * 60 * 1000,
  );
  const identity = validateAccessRequest(await readJson(request));
  const timestamp = new Date().toISOString();
  const account = db.prepare('SELECT * FROM admin_profiles WHERE email = ?').get(identity.email);
  if (account) {
    throw new ApiError(
      409,
      'ACCOUNT_EXISTS',
      'Ya existe una cuenta para ese correo. Inicia sesión.',
    );
  }
  const existing = db
    .prepare('SELECT id, status FROM setup_access_requests WHERE email = ?')
    .get(identity.email);
  const requestId = existing?.id ?? randomUUID();
  let isNewRequest = false;
  if (!existing) {
    db.prepare(
      `INSERT INTO setup_access_requests
       (id, email, display_name, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    ).run(requestId, identity.email, identity.displayName, timestamp, timestamp);
    isNewRequest = true;
  } else if (existing.status === 'rejected' || existing.status === 'activated') {
    db.prepare(
      `UPDATE setup_access_requests
       SET display_name = ?, status = 'pending', updated_at = ?, reviewed_at = NULL,
           reviewed_by = NULL WHERE id = ?`,
    ).run(identity.displayName, timestamp, existing.id);
    isNewRequest = true;
  }
  if (isNewRequest) {
    const settings = db
      .prepare('SELECT notify_access_requests FROM site_settings WHERE id = 1')
      .get();
    if (settings?.notify_access_requests !== 0) {
      const recipients = db
        .prepare(
          `SELECT email FROM admin_profiles
           WHERE account_type = 'administrator' AND active = 1
           ORDER BY is_owner DESC, created_at ASC`,
        )
        .all()
        .map((administrator) => administrator.email);
      const delivery = await sendAccessRequestNotification({
        emailService: context.emailService,
        recipients,
        requesterName: identity.displayName,
        requesterEmail: identity.email,
        requestedAt: timestamp,
        publicAppUrl: context.publicAppUrl,
      });
      recordAudit(
        db,
        null,
        `access.request_notification_${delivery.status}`,
        'setup_access_request',
        requestId,
      );
    }
  }
  return sendJson(response, 202, { requested: true });
}

function verifySetupInvitation(context) {
  const invitation = findValidSetupInvitation(context.db, context.url.searchParams.get('token'));
  if (!invitation) {
    throw new ApiError(404, 'INVALID_INVITATION', 'La invitación no existe o ha caducado.');
  }
  return sendJson(context.response, 200, {
    invitation: {
      email: invitation.email,
      displayName: invitation.display_name,
      expiresAt: invitation.expires_at,
    },
  });
}

async function acceptSetupInvitation(context) {
  const { db, request, response, secureCookies, actionAttempts } = context;
  consumeActionLimit(
    actionAttempts,
    `setup-invitation:${request.socket.remoteAddress ?? 'local'}`,
    10,
    60 * 60 * 1000,
  );
  const input = await readJson(request);
  const invitation = findValidSetupInvitation(db, input.token);
  if (!invitation) {
    throw new ApiError(404, 'INVALID_INVITATION', 'La invitación no existe o ha caducado.');
  }
  const identity = validateAdminIdentity(
    {
      email: invitation.email,
      displayName: invitation.display_name,
      password: input.password,
    },
    { setup: true },
  );
  const timestamp = new Date().toISOString();
  const existingAccount = db
    .prepare('SELECT * FROM admin_profiles WHERE email = ?')
    .get(identity.email);
  if (
    existingAccount &&
    (existingAccount.account_type !== 'setup_user' || existingAccount.totp_enabled === 1)
  ) {
    throw new ApiError(409, 'ACCOUNT_EXISTS', 'Ya existe una cuenta para ese correo.');
  }
  const id = existingAccount?.id ?? randomUUID();
  const passwordHash = await hashPassword(identity.password);
  db.exec('BEGIN');
  try {
    if (existingAccount) {
      db.prepare(
        `UPDATE admin_profiles SET display_name = ?, password_hash = ?, active = 1,
         email_verified_at = COALESCE(email_verified_at, ?),
         can_access_setups = CASE WHEN ? = 1 THEN 1 ELSE can_access_setups END,
         updated_at = ? WHERE id = ?`,
      ).run(
        identity.displayName,
        passwordHash,
        timestamp,
        invitation.grants_setup_access === 1 ? 1 : 0,
        timestamp,
        id,
      );
      db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(id);
    } else {
      db.prepare(
        `INSERT INTO admin_profiles
         (id, email, display_name, password_hash, role, is_owner, active, email_verified_at,
          account_type, can_access_setups, can_upload_setups, can_access_skins, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'admin', 0, 1, ?, 'setup_user', ?, 0, 0, ?, ?)`,
      ).run(
        id,
        identity.email,
        identity.displayName,
        passwordHash,
        timestamp,
        invitation.grants_setup_access === 1 ? 1 : 0,
        timestamp,
        timestamp,
      );
    }
    recordAudit(db, id, 'access.invitation_started', 'account', id, {
      invitedBy: invitation.created_by,
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  const session = createSession(db, id);
  const account = db.prepare('SELECT * FROM admin_profiles WHERE id = ?').get(id);
  response.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt, secureCookies));
  return sendJson(response, existingAccount ? 200 : 201, {
    authenticated: true,
    account: setupAccountFromRow(account),
    csrfToken: session.csrfToken,
  });
}

function findValidSetupInvitation(db, token) {
  const normalized = String(token ?? '').trim();
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(normalized)) return null;
  return db
    .prepare(
      `SELECT * FROM setup_invitations
       WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > ?`,
    )
    .get(hashToken(normalized), new Date().toISOString());
}

async function routeSetupAccessManagement(context) {
  const { db, response, path, method, session } = context;
  if (method === 'GET' && (path === '/api/setup-access/users' || path === '/api/access/users')) {
    const users = db
      .prepare(
        `SELECT id, email, display_name, account_type, is_owner, active, can_access_setups,
                can_upload_setups, can_access_skins, totp_enabled, created_at, updated_at
         FROM admin_profiles
         WHERE account_type = 'administrator'
            OR (account_type = 'setup_user' AND totp_enabled = 1)
         ORDER BY account_type ASC, is_owner DESC, display_name ASC`,
      )
      .all()
      .map(setupManagedAccountFromRow);
    const requests = db
      .prepare(
        `SELECT id, email, display_name, status, created_at, updated_at, reviewed_at
         FROM setup_access_requests WHERE status IN ('pending', 'approved')
         ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,
                  created_at DESC LIMIT 100`,
      )
      .all()
      .map(accessRequestFromRow);
    const storage = db
      .prepare(
        `SELECT COALESCE(SUM(byte_size), 0) AS used_bytes,
                SUM(CASE WHEN expires_at IS NOT NULL AND expires_at <= datetime('now', '+7 days')
                         THEN 1 ELSE 0 END) AS expiring_files
         FROM setup_files WHERE deleted_at IS NULL`,
      )
      .get();
    return sendJson(response, 200, {
      users,
      requests,
      storage: {
        usedBytes: Number(storage.used_bytes ?? 0),
        expiringFiles: Number(storage.expiring_files ?? 0),
      },
    });
  }

  const approve = path.match(/^\/api\/(?:setup-access|access)\/requests\/([^/]+)\/approve$/);
  if (method === 'POST' && approve) {
    const centralized = path.startsWith('/api/access/');
    const accessRequest = db
      .prepare('SELECT * FROM setup_access_requests WHERE id = ?')
      .get(approve[1]);
    if (!accessRequest || accessRequest.status === 'activated') {
      throw new ApiError(404, 'NOT_FOUND', 'No existe esa solicitud pendiente.');
    }
    const existingAccount = db
      .prepare('SELECT * FROM admin_profiles WHERE email = ?')
      .get(accessRequest.email);
    const timestamp = new Date();
    if (
      existingAccount &&
      (existingAccount.account_type === 'administrator' || existingAccount.totp_enabled === 1)
    ) {
      db.prepare(
        `UPDATE admin_profiles SET can_access_setups = ?, active = 1, updated_at = ? WHERE id = ?`,
      ).run(
        centralized ? existingAccount.can_access_setups : 1,
        timestamp.toISOString(),
        existingAccount.id,
      );
      db.prepare(
        `UPDATE setup_access_requests SET status = 'activated', updated_at = ?, reviewed_at = ?,
         reviewed_by = ? WHERE id = ?`,
      ).run(timestamp.toISOString(), timestamp.toISOString(), session.admin.id, accessRequest.id);
      recordAudit(db, session.admin.id, 'setups.access_granted', 'account', existingAccount.id);
      return sendJson(response, 200, {
        activated: true,
        invitation: null,
        emailDelivery: { status: 'not_needed' },
      });
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM setup_invitations WHERE request_id = ? AND accepted_at IS NULL').run(
        accessRequest.id,
      );
      db.prepare(
        `INSERT INTO setup_invitations
         (id, request_id, email, display_name, token_hash, expires_at, created_by, created_at,
          grants_setup_access)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        accessRequest.id,
        accessRequest.email,
        accessRequest.display_name,
        hashToken(token),
        expiresAt.toISOString(),
        session.admin.id,
        timestamp.toISOString(),
        centralized ? 0 : 1,
      );
      db.prepare(
        `UPDATE setup_access_requests SET status = 'approved', updated_at = ?, reviewed_at = ?,
         reviewed_by = ? WHERE id = ?`,
      ).run(timestamp.toISOString(), timestamp.toISOString(), session.admin.id, accessRequest.id);
      recordAudit(
        db,
        session.admin.id,
        'setups.request_approved',
        'setup_access_request',
        accessRequest.id,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const invitationPath = `${centralized ? '/aceptar-invitacion' : '/setups/aceptar-invitacion'}?token=${encodeURIComponent(token)}`;
    const settings = db.prepare('SELECT contact_email FROM site_settings WHERE id = 1').get();
    const emailDelivery = await sendAccessInvitation({
      db,
      emailService: context.emailService,
      to: accessRequest.email,
      displayName: accessRequest.display_name,
      invitationPath,
      expiresAt,
      invitedByName: session.admin.displayName,
      publicAppUrl: context.publicAppUrl,
      supportEmail: settings?.contact_email,
    });
    recordAudit(
      db,
      session.admin.id,
      `access.invitation_email_${emailDelivery.status}`,
      'setup_access_request',
      accessRequest.id,
    );
    return sendJson(response, 201, {
      activated: false,
      invitation: {
        email: accessRequest.email,
        path: invitationPath,
        expiresAt: expiresAt.toISOString(),
      },
      emailDelivery,
    });
  }

  const reject = path.match(/^\/api\/(?:setup-access|access)\/requests\/([^/]+)\/reject$/);
  if (method === 'POST' && reject) {
    const accessRequest = db
      .prepare("SELECT * FROM setup_access_requests WHERE id = ? AND status != 'activated'")
      .get(reject[1]);
    if (!accessRequest) throw new ApiError(404, 'NOT_FOUND', 'No existe esa solicitud.');
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE setup_access_requests SET status = 'rejected', updated_at = ?, reviewed_at = ?,
       reviewed_by = ? WHERE id = ?`,
    ).run(timestamp, timestamp, session.admin.id, accessRequest.id);
    db.prepare('DELETE FROM setup_invitations WHERE request_id = ? AND accepted_at IS NULL').run(
      accessRequest.id,
    );
    recordAudit(
      db,
      session.admin.id,
      'setups.request_rejected',
      'setup_access_request',
      accessRequest.id,
    );
    return sendEmpty(response, 204);
  }

  const user = path.match(/^\/api\/(setup-access|access)\/users\/([^/]+)$/);
  if (method === 'PATCH' && user) {
    const target = db.prepare('SELECT * FROM admin_profiles WHERE id = ?').get(user[2]);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'No existe esa cuenta.');
    if (target.account_type === 'administrator') {
      throw new ApiError(422, 'ADMIN_PROTECTED', 'Los administradores conservan acceso completo.');
    }
    const input = await readJson(context.request);
    if (
      typeof input.canAccessSetups !== 'boolean' ||
      typeof input.canUploadSetups !== 'boolean' ||
      (user[1] === 'access' && typeof input.canAccessSkins !== 'boolean')
    ) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Indica todos los permisos de la cuenta.');
    }
    const canAccess = input.canAccessSetups;
    const canUpload = canAccess && input.canUploadSetups;
    const canAccessSkins =
      user[1] === 'access' ? input.canAccessSkins : target.can_access_skins === 1;
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE admin_profiles SET can_access_setups = ?, can_upload_setups = ?,
       can_access_skins = ?, updated_at = ?
       WHERE id = ?`,
    ).run(canAccess ? 1 : 0, canUpload ? 1 : 0, canAccessSkins ? 1 : 0, timestamp, target.id);
    recordAudit(db, session.admin.id, 'access.permissions_updated', 'account', target.id, {
      canAccessSetups: canAccess,
      canUploadSetups: canUpload,
      canAccessSkins,
    });
    return sendJson(response, 200, {
      user: setupManagedAccountFromRow(
        db.prepare('SELECT * FROM admin_profiles WHERE id = ?').get(target.id),
      ),
    });
  }

  const revoke = path.match(/^\/api\/access\/users\/([^/]+)\/(revoke|restore)$/);
  if (method === 'POST' && revoke) {
    const target = db.prepare('SELECT * FROM admin_profiles WHERE id = ?').get(revoke[1]);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'No existe esa cuenta.');
    if (target.account_type === 'administrator') {
      throw new ApiError(422, 'ADMIN_PROTECTED', 'Gestiona administradores desde su apartado.');
    }
    const active = revoke[2] === 'restore';
    const timestamp = new Date().toISOString();
    db.prepare('UPDATE admin_profiles SET active = ?, updated_at = ? WHERE id = ?').run(
      active ? 1 : 0,
      timestamp,
      target.id,
    );
    if (!active) db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(target.id);
    recordAudit(
      db,
      session.admin.id,
      `access.account_${active ? 'restored' : 'revoked'}`,
      'account',
      target.id,
    );
    return sendJson(response, 200, {
      user: setupManagedAccountFromRow(
        db.prepare('SELECT * FROM admin_profiles WHERE id = ?').get(target.id),
      ),
    });
  }

  if (method === 'DELETE' && user) {
    const target = db.prepare('SELECT * FROM admin_profiles WHERE id = ?').get(user[2]);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'No existe esa cuenta.');
    if (target.account_type === 'administrator') {
      throw new ApiError(422, 'ADMIN_PROTECTED', 'Gestiona administradores desde su apartado.');
    }
    if (target.id === session.admin.id) {
      throw new ApiError(422, 'SELF_ACTION', 'No puedes eliminar tu propia cuenta.');
    }

    db.exec('BEGIN');
    try {
      db.prepare('UPDATE setups SET created_by = ? WHERE created_by = ?').run(
        session.admin.id,
        target.id,
      );
      db.prepare('UPDATE setup_files SET uploaded_by = ? WHERE uploaded_by = ?').run(
        session.admin.id,
        target.id,
      );
      db.prepare('UPDATE media_assets SET uploaded_by = ? WHERE uploaded_by = ?').run(
        session.admin.id,
        target.id,
      );
      db.prepare('DELETE FROM setup_invitations WHERE email = ?').run(target.email);
      db.prepare('DELETE FROM setup_access_requests WHERE email = ?').run(target.email);
      db.prepare('DELETE FROM admin_profiles WHERE id = ?').run(target.id);
      recordAudit(db, session.admin.id, 'access.account_deleted', 'account', target.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return sendEmpty(response, 204);
  }

  throw new ApiError(404, 'NOT_FOUND', 'No existe ese recurso de accesos a setups.');
}

async function routeSetupLibrary(context) {
  const { db, response, path, method, session } = context;
  const administrator = isSetupAdministrator(session);

  if (method === 'GET' && path === '/api/setups') {
    const q = String(context.url.searchParams.get('q') ?? '')
      .trim()
      .slice(0, 100);
    const simulator = String(context.url.searchParams.get('simulator') ?? '')
      .trim()
      .slice(0, 80);
    const rows = db
      .prepare(
        `SELECT s.*, a.display_name AS created_by_name,
                (SELECT COUNT(*) FROM setup_files f
                 WHERE f.setup_id = s.id AND f.deleted_at IS NULL
                   AND (f.expires_at IS NULL OR f.expires_at > ?)) AS active_file_count
         FROM setups s JOIN admin_profiles a ON a.id = s.created_by
         WHERE s.deleted_at IS NULL
           AND (s.status = 'published' OR ? = 1 OR (s.created_by = ? AND s.status = 'draft'))
           AND (? = '' OR s.simulator = ?)
           AND (? = '' OR s.title LIKE '%' || ? || '%' OR s.car LIKE '%' || ? || '%'
                OR s.track LIKE '%' || ? || '%')
         ORDER BY CASE s.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
                  s.updated_at DESC LIMIT 200`,
      )
      .all(
        new Date().toISOString(),
        administrator ? 1 : 0,
        session.admin.id,
        simulator,
        simulator,
        q,
        q,
        q,
        q,
      );
    return sendJson(response, 200, {
      setups: rows.map((row) => setupFromRow(row, session)),
      capabilities: setupCapabilities(session),
    });
  }

  if (method === 'POST' && path === '/api/setups') {
    requireSetupUploader(session);
    const setup = validateSetup(await readJson(context.request));
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    db.prepare(
      `INSERT INTO setups
       (id, title, simulator, car, track, configuration, season_number, week_number, season_year,
        description, tags_json, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    ).run(
      id,
      setup.title,
      setup.simulator,
      setup.car,
      setup.track,
      setup.configuration,
      setup.season,
      setup.week,
      setup.year,
      setup.description,
      JSON.stringify(setup.tags),
      session.admin.id,
      timestamp,
      timestamp,
    );
    recordAudit(db, session.admin.id, 'setups.created', 'setup', id);
    return sendJson(response, 201, { setup: findSetup(db, id, session) });
  }

  const upload = path.match(/^\/api\/setups\/([^/]+)\/files$/);
  if (method === 'POST' && upload) {
    requireSetupUploader(session);
    const row = requireEditableSetup(db, upload[1], session);
    const file = await saveSetupFile(context, row, session);
    return sendJson(response, 201, { file, setup: findSetup(db, row.id, session) });
  }

  const download = path.match(/^\/api\/setups\/([^/]+)\/files\/([^/]+)\/download$/);
  if (method === 'GET' && download) {
    return downloadSetupFile(context, download[1], download[2], session);
  }

  const packageDownload = path.match(/^\/api\/setups\/([^/]+)\/package\/download$/);
  if (method === 'GET' && packageDownload) {
    return downloadSetupPackage(context, packageDownload[1], session);
  }

  const retention = path.match(/^\/api\/setups\/([^/]+)\/files\/([^/]+)\/retention$/);
  if (method === 'PATCH' && retention) {
    const file = requireOwnedSetupFileAction(db, retention[1], retention[2], session);
    const input = await readJson(context.request);
    const retentionDays = validateRetentionDays(input.retentionDays);
    const expiresAt = retentionDays
      ? new Date(Date.parse(file.uploaded_at) + retentionDays * 86_400_000).toISOString()
      : null;
    db.prepare(`UPDATE setup_files SET retention_days = ?, expires_at = ? WHERE id = ?`).run(
      retentionDays,
      expiresAt,
      file.id,
    );
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      await runSetupCleanup(db, context.setupDir);
    }
    recordAudit(db, session.admin.id, 'setups.retention_updated', 'setup_file', file.id, {
      retentionDays,
      expiresAt,
    });
    return sendJson(response, 200, {
      file: setupFileFromRow(
        db.prepare('SELECT * FROM setup_files WHERE id = ?').get(file.id),
        session,
        file.setup_created_by,
      ),
    });
  }

  const deleteFile = path.match(/^\/api\/setups\/([^/]+)\/files\/([^/]+)$/);
  if (method === 'DELETE' && deleteFile) {
    const file = requireOwnedSetupFileAction(db, deleteFile[1], deleteFile[2], session);
    await unlink(file.storage_path).catch(() => undefined);
    const timestamp = new Date().toISOString();
    db.prepare('UPDATE setup_files SET deleted_at = ? WHERE id = ?').run(timestamp, file.id);
    archiveSetupWithoutFiles(db, file.setup_id, timestamp, administrator ? 'archived' : 'draft');
    recordAudit(db, session.admin.id, 'setups.file_deleted', 'setup_file', file.id);
    return sendEmpty(response, 204);
  }

  const publish = path.match(/^\/api\/setups\/([^/]+)\/publish$/);
  if (method === 'POST' && publish) {
    const setup = requireOwnedSetupAction(db, publish[1], session, { draftOnly: true });
    const file = db
      .prepare(
        `SELECT 1 FROM setup_files WHERE setup_id = ? AND deleted_at IS NULL
         AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`,
      )
      .get(setup.id, new Date().toISOString());
    if (!file)
      throw new ApiError(422, 'SETUP_FILE_REQUIRED', 'Sube un archivo activo antes de publicar.');
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE setups SET status = 'published', published_by = ?,
       published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?`,
    ).run(session.admin.id, timestamp, timestamp, setup.id);
    recordAudit(db, session.admin.id, 'setups.published', 'setup', setup.id);
    return sendJson(response, 200, { setup: findSetup(db, setup.id, session) });
  }

  const archive = path.match(/^\/api\/setups\/([^/]+)\/archive$/);
  if (method === 'POST' && archive) {
    requireSetupAdministrator(session);
    const setup = findSetupRow(db, archive[1]);
    if (!setup) throw new ApiError(404, 'NOT_FOUND', 'No existe ese setup.');
    const timestamp = new Date().toISOString();
    db.prepare("UPDATE setups SET status = 'archived', updated_at = ? WHERE id = ?").run(
      timestamp,
      setup.id,
    );
    recordAudit(db, session.admin.id, 'setups.archived', 'setup', setup.id);
    return sendJson(response, 200, { setup: findSetup(db, setup.id, session) });
  }

  const setupMatch = path.match(/^\/api\/setups\/([^/]+)$/);
  if (method === 'GET' && setupMatch) {
    const setup = findSetup(db, setupMatch[1], session);
    if (!setup || !canViewSetup(setup, session)) {
      throw new ApiError(404, 'NOT_FOUND', 'No existe ese setup.');
    }
    return sendJson(response, 200, { setup, capabilities: setupCapabilities(session) });
  }
  if (method === 'PATCH' && setupMatch) {
    const current = requireEditableSetup(db, setupMatch[1], session);
    const input = await readJson(context.request);
    if (input.updatedAt && input.updatedAt !== current.updated_at) {
      throw new ApiError(409, 'EDIT_CONFLICT', 'El setup cambió mientras lo editabas.');
    }
    const setup = validateSetup(input);
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE setups SET title = ?, simulator = ?, car = ?, track = ?, configuration = ?,
       season_number = ?, week_number = ?, season_year = ?, description = ?, tags_json = ?,
       updated_at = ? WHERE id = ?`,
    ).run(
      setup.title,
      setup.simulator,
      setup.car,
      setup.track,
      setup.configuration,
      setup.season,
      setup.week,
      setup.year,
      setup.description,
      JSON.stringify(setup.tags),
      timestamp,
      current.id,
    );
    recordAudit(db, session.admin.id, 'setups.updated', 'setup', current.id);
    return sendJson(response, 200, { setup: findSetup(db, current.id, session) });
  }
  if (method === 'DELETE' && setupMatch) {
    const setup = requireOwnedSetupAction(db, setupMatch[1], session);
    const files = db
      .prepare('SELECT id, storage_path FROM setup_files WHERE setup_id = ? AND deleted_at IS NULL')
      .all(setup.id);
    await Promise.all(files.map((file) => unlink(file.storage_path).catch(() => undefined)));
    const timestamp = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare(
        'UPDATE setup_files SET deleted_at = ? WHERE setup_id = ? AND deleted_at IS NULL',
      ).run(timestamp, setup.id);
      db.prepare('UPDATE setups SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
        timestamp,
        timestamp,
        setup.id,
      );
      recordAudit(db, session.admin.id, 'setups.deleted', 'setup', setup.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return sendEmpty(response, 204);
  }

  throw new ApiError(404, 'NOT_FOUND', 'No existe ese recurso de setups.');
}

async function saveSetupFile(context, setup, session) {
  const originalName = basename(String(context.url.searchParams.get('fileName') ?? 'setup'))
    .replace(/[\r\n]/g, '')
    .slice(0, 180);
  const extension = extname(originalName).toLowerCase();
  if (!SETUP_EXTENSIONS.has(extension)) {
    throw new ApiError(415, 'UNSUPPORTED_SETUP_FILE', 'El formato del setup no está permitido.');
  }
  const buffer = await readBuffer(context.request, SETUP_FILE_LIMIT);
  if (!buffer.length) throw new ApiError(422, 'EMPTY_FILE', 'El archivo está vacío.');
  if (
    extension === '.zip' &&
    !buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  ) {
    throw new ApiError(422, 'INVALID_SETUP_FILE', 'El ZIP no tiene una cabecera válida.');
  }
  const notes = cleanOptionalText(context.url.searchParams.get('notes'), 500);
  const sessionType = validateSetupFileSessionType(context.url.searchParams.get('sessionType'));
  const retentionDays = validateRetentionDays(
    context.url.searchParams.has('retentionDays')
      ? context.url.searchParams.get('retentionDays')
      : DEFAULT_SETUP_RETENTION_DAYS,
  );
  const uploadedAt = new Date();
  const expiresAt = retentionDays
    ? new Date(uploadedAt.getTime() + retentionDays * 86_400_000).toISOString()
    : null;
  const fileId = randomUUID();
  const directory = resolve(context.setupDir, setup.id);
  if (
    !directory.startsWith(
      `${resolve(context.setupDir)}${process.platform === 'win32' ? '\\' : '/'}`,
    )
  ) {
    throw new ApiError(422, 'INVALID_PATH', 'No se puede guardar el archivo.');
  }
  mkdirSync(directory, { recursive: true });
  const storagePath = join(directory, `${fileId}${extension}`);
  await writeFile(storagePath, buffer, { flag: 'wx' });
  const nextVersion = Number(
    context.db
      .prepare(
        'SELECT COALESCE(MAX(version_number), 0) + 1 AS version FROM setup_files WHERE setup_id = ?',
      )
      .get(setup.id).version,
  );
  try {
    context.db
      .prepare(
        `INSERT INTO setup_files
         (id, setup_id, version_number, original_name, storage_path, extension, mime_type,
          byte_size, checksum_sha256, session_type, notes, uploaded_by, uploaded_at, retention_days,
          expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fileId,
        setup.id,
        nextVersion,
        originalName,
        storagePath,
        extension,
        String(context.request.headers['content-type'] ?? 'application/octet-stream').slice(0, 100),
        buffer.length,
        createHash('sha256').update(buffer).digest('hex'),
        sessionType,
        notes,
        session.admin.id,
        uploadedAt.toISOString(),
        retentionDays,
        expiresAt,
      );
  } catch (error) {
    await unlink(storagePath).catch(() => undefined);
    throw error;
  }
  context.db
    .prepare('UPDATE setups SET updated_at = ? WHERE id = ?')
    .run(uploadedAt.toISOString(), setup.id);
  recordAudit(context.db, session.admin.id, 'setups.file_uploaded', 'setup_file', fileId, {
    setupId: setup.id,
    byteSize: buffer.length,
    sessionType,
    retentionDays,
  });
  return setupFileFromRow(
    context.db.prepare('SELECT * FROM setup_files WHERE id = ?').get(fileId),
    session,
    setup.created_by,
  );
}

function downloadSetupFile(context, setupId, fileId, session) {
  const row = context.db
    .prepare(
      `SELECT f.*, s.status AS setup_status, s.created_by
       FROM setup_files f JOIN setups s ON s.id = f.setup_id
       WHERE f.id = ? AND f.setup_id = ? AND f.deleted_at IS NULL AND s.deleted_at IS NULL`,
    )
    .get(fileId, setupId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'No existe ese archivo.');
  const canViewDraft = isSetupAdministrator(session) || row.created_by === session.admin.id;
  if (row.setup_status !== 'published' && !canViewDraft) {
    throw new ApiError(404, 'NOT_FOUND', 'No existe ese archivo.');
  }
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
    throw new ApiError(410, 'SETUP_EXPIRED', 'El archivo ha caducado.');
  }
  if (!existsSync(row.storage_path)) {
    throw new ApiError(410, 'SETUP_FILE_MISSING', 'El archivo ya no está disponible.');
  }
  context.db.exec('BEGIN');
  try {
    context.db
      .prepare('UPDATE setup_files SET download_count = download_count + 1 WHERE id = ?')
      .run(row.id);
    context.db
      .prepare(
        'INSERT INTO setup_downloads (id, file_id, account_id, downloaded_at) VALUES (?, ?, ?, ?)',
      )
      .run(randomUUID(), row.id, session.admin.id, new Date().toISOString());
    recordAudit(context.db, session.admin.id, 'setups.downloaded', 'setup_file', row.id);
    context.db.exec('COMMIT');
  } catch (error) {
    context.db.exec('ROLLBACK');
    throw error;
  }
  const encodedName = encodeURIComponent(row.original_name).replace(
    /['()]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  context.response.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/octet-stream',
    'Content-Length': row.byte_size,
    'Content-Disposition': `attachment; filename="setup${row.extension}"; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'private, no-store',
  });
  createReadStream(row.storage_path).pipe(context.response);
}

async function downloadSetupPackage(context, setupId, session) {
  const setup = context.db
    .prepare('SELECT * FROM setups WHERE id = ? AND deleted_at IS NULL')
    .get(setupId);
  if (!setup) throw new ApiError(404, 'NOT_FOUND', 'No existe ese setup.');

  const canViewDraft = isSetupAdministrator(session) || setup.created_by === session.admin.id;
  if (setup.status !== 'published' && !canViewDraft) {
    throw new ApiError(404, 'NOT_FOUND', 'No existe ese setup.');
  }

  const now = new Date().toISOString();
  const files = context.db
    .prepare(
      `SELECT * FROM setup_files
       WHERE setup_id = ? AND deleted_at IS NULL
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY version_number ASC`,
    )
    .all(setup.id, now);
  if (!files.length) {
    throw new ApiError(410, 'SETUP_FILES_MISSING', 'Este setup no tiene archivos disponibles.');
  }
  if (files.some((file) => !existsSync(file.storage_path))) {
    throw new ApiError(
      410,
      'SETUP_FILE_MISSING',
      'El paquete está incompleto y no se puede descargar.',
    );
  }

  context.db.exec('BEGIN');
  try {
    const increment = context.db.prepare(
      'UPDATE setup_files SET download_count = download_count + 1 WHERE id = ?',
    );
    const insertDownload = context.db.prepare(
      'INSERT INTO setup_downloads (id, file_id, account_id, downloaded_at) VALUES (?, ?, ?, ?)',
    );
    for (const file of files) {
      increment.run(file.id);
      insertDownload.run(randomUUID(), file.id, session.admin.id, now);
    }
    recordAudit(context.db, session.admin.id, 'setups.package_downloaded', 'setup', setup.id, {
      fileCount: files.length,
      fileIds: files.map((file) => file.id),
    });
    context.db.exec('COMMIT');
  } catch (error) {
    context.db.exec('ROLLBACK');
    throw error;
  }

  const archiveName = `${safeArchiveName(setup.title)}.zip`;
  const encodedName = encodeURIComponent(archiveName).replace(
    /['()]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  context.response.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${archiveName}"; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'private, no-store',
  });

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const usedNames = new Set();
  archive.pipe(context.response);
  for (const file of files) {
    archive.file(file.storage_path, { name: uniqueArchiveEntryName(file, usedNames) });
  }

  await new Promise((resolvePromise, rejectPromise) => {
    archive.once('error', rejectPromise);
    context.response.once('finish', resolvePromise);
    context.response.once('error', rejectPromise);
    archive.finalize().catch(rejectPromise);
  });
}

function safeArchiveName(value) {
  const normalized = String(value ?? 'setup')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'setup';
}

function uniqueArchiveEntryName(file, usedNames) {
  const original = basename(String(file.original_name ?? `setup${file.extension ?? ''}`))
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 180);
  const fallback = `setup-v${file.version_number}${file.extension ?? ''}`;
  const preferred = original || fallback;
  let candidate = preferred;
  let duplicate = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const extension = extname(preferred);
    const stem = basename(preferred, extension).slice(0, 150);
    candidate = `${stem}-${duplicate}${extension}`;
    duplicate += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export async function runSetupCleanup(db, setupDir, timestamp = new Date()) {
  const expired = db
    .prepare(
      `SELECT id, setup_id, storage_path FROM setup_files
       WHERE deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?`,
    )
    .all(timestamp.toISOString());
  for (const file of expired) {
    const resolved = resolve(file.storage_path);
    if (resolved.startsWith(`${resolve(setupDir)}${process.platform === 'win32' ? '\\' : '/'}`)) {
      await unlink(resolved).catch(() => undefined);
    }
    db.prepare('UPDATE setup_files SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(
      timestamp.toISOString(),
      file.id,
    );
    archiveSetupWithoutFiles(db, file.setup_id, timestamp.toISOString(), 'expired');
    recordAudit(db, null, 'setups.file_expired', 'setup_file', file.id, {
      setupId: file.setup_id,
    });
  }
  return expired.length;
}

function archiveSetupWithoutFiles(db, setupId, timestamp, emptyStatus = 'archived') {
  const active = db
    .prepare('SELECT 1 FROM setup_files WHERE setup_id = ? AND deleted_at IS NULL LIMIT 1')
    .get(setupId);
  if (!active) {
    db.prepare(
      'UPDATE setups SET status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    ).run(emptyStatus, timestamp, setupId);
  }
}

function findSetup(db, id, session) {
  const row = db
    .prepare(
      `SELECT s.*, a.display_name AS created_by_name,
              (SELECT COUNT(*) FROM setup_files f WHERE f.setup_id = s.id AND f.deleted_at IS NULL)
                AS active_file_count
       FROM setups s JOIN admin_profiles a ON a.id = s.created_by
       WHERE s.id = ? AND s.deleted_at IS NULL`,
    )
    .get(id);
  if (!row) return null;
  const setup = setupFromRow(row, session);
  setup.files = db
    .prepare(
      `SELECT f.*, a.display_name AS uploaded_by_name
       FROM setup_files f JOIN admin_profiles a ON a.id = f.uploaded_by
       WHERE f.setup_id = ? AND f.deleted_at IS NULL ORDER BY f.version_number DESC`,
    )
    .all(id)
    .map((file) => setupFileFromRow(file, session, row.created_by));
  return setup;
}

function findSetupRow(db, id) {
  return db.prepare('SELECT * FROM setups WHERE id = ? AND deleted_at IS NULL').get(id);
}

function requireEditableSetup(db, id, session) {
  const setup = findSetupRow(db, id);
  if (!setup) throw new ApiError(404, 'NOT_FOUND', 'No existe ese setup.');
  if (isSetupAdministrator(session)) return setup;
  if (
    !session.admin.canUploadSetups ||
    setup.created_by !== session.admin.id ||
    setup.status !== 'draft'
  ) {
    throw new ApiError(403, 'FORBIDDEN', 'No puedes modificar este setup.');
  }
  return setup;
}

function requireOwnedSetupAction(db, id, session, { draftOnly = false } = {}) {
  const setup = findSetupRow(db, id);
  if (!setup) throw new ApiError(404, 'NOT_FOUND', 'No existe ese setup.');
  if (isSetupAdministrator(session)) return setup;
  if (!session.admin.canUploadSetups || setup.created_by !== session.admin.id) {
    throw new ApiError(403, 'FORBIDDEN', 'Solo puedes gestionar los setups que has creado.');
  }
  if (draftOnly && setup.status !== 'draft') {
    throw new ApiError(409, 'INVALID_SETUP_STATE', 'Solo puedes publicar un borrador propio.');
  }
  return setup;
}

function requireOwnedSetupFileAction(db, setupId, fileId, session) {
  const file = db
    .prepare(
      `SELECT f.*, s.created_by AS setup_created_by
       FROM setup_files f JOIN setups s ON s.id = f.setup_id
       WHERE f.id = ? AND f.setup_id = ? AND f.deleted_at IS NULL AND s.deleted_at IS NULL`,
    )
    .get(fileId, setupId);
  if (!file) throw new ApiError(404, 'NOT_FOUND', 'No existe ese archivo.');
  if (isSetupAdministrator(session)) return file;
  if (
    !session.admin.canUploadSetups ||
    file.setup_created_by !== session.admin.id ||
    file.uploaded_by !== session.admin.id
  ) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Solo puedes gestionar las versiones que has subido a tus propios setups.',
    );
  }
  return file;
}

function canViewSetup(setup, session) {
  return (
    setup.status === 'published' ||
    isSetupAdministrator(session) ||
    (setup.createdBy === session.admin.id && setup.status === 'draft')
  );
}

function setupFromRow(row, session) {
  return {
    id: row.id,
    title: row.title,
    simulator: row.simulator,
    car: row.car,
    track: row.track,
    configuration: row.configuration,
    season: row.season_number,
    week: row.week_number,
    year: row.season_year,
    description: row.description,
    tags: parseJsonArray(row.tags_json),
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeFileCount: Number(row.active_file_count ?? 0),
    canEdit:
      isSetupAdministrator(session) ||
      (session.admin.canUploadSetups &&
        row.created_by === session.admin.id &&
        row.status === 'draft'),
    canPublish:
      isSetupAdministrator(session) ||
      (session.admin.canUploadSetups &&
        row.created_by === session.admin.id &&
        row.status === 'draft'),
    canDelete:
      isSetupAdministrator(session) ||
      (session.admin.canUploadSetups && row.created_by === session.admin.id),
    canManage: isSetupAdministrator(session),
  };
}

function setupFileFromRow(row, session, setupCreatedBy) {
  const administrator = isSetupAdministrator(session);
  const canManageVersion =
    administrator ||
    (session.admin.canUploadSetups &&
      setupCreatedBy === session.admin.id &&
      row.uploaded_by === session.admin.id);
  return {
    id: row.id,
    setupId: row.setup_id,
    versionNumber: row.version_number,
    originalName: row.original_name,
    extension: row.extension,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    sessionType: SETUP_SESSION_TYPES.has(row.session_type) ? row.session_type : 'other',
    notes: row.notes,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name ?? null,
    uploadedAt: row.uploaded_at,
    retentionDays: canManageVersion ? row.retention_days : null,
    expiresAt: row.expires_at,
    downloadCount: administrator ? row.download_count : null,
    canUpdateRetention: canManageVersion,
    canDelete: canManageVersion,
  };
}

function validateSetup(input) {
  const fields = {};
  const title = cleanText(input.title, 120);
  const simulator = cleanText(input.simulator, 80);
  const car = cleanText(input.car, 100);
  const track = cleanText(input.track, 100);
  if (title.length < 3) fields.title = 'Escribe un título de al menos 3 caracteres.';
  if (simulator.length < 2) fields.simulator = 'Indica el simulador.';
  if (car.length < 2) fields.car = 'Indica el coche.';
  if (track.length < 2) fields.track = 'Indica el circuito.';
  const season = positiveIntegerInRange(input.season, 1, 99, 'season', fields);
  const week = positiveIntegerInRange(input.week, 1, 99, 'week', fields);
  const year = positiveIntegerInRange(input.year, 2000, 2100, 'year', fields);
  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.map((tag) => cleanText(tag, 30)).filter(Boolean))].slice(0, 10)
    : String(input.tags ?? '')
        .split(',')
        .map((tag) => cleanText(tag, 30))
        .filter(Boolean)
        .slice(0, 10);
  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return {
    title,
    simulator,
    car,
    track,
    configuration: cleanOptionalText(input.configuration, 100),
    season,
    week,
    year,
    description: cleanOptionalText(input.description, 1000),
    tags,
  };
}

function validateSetupFileSessionType(value) {
  const sessionType = String(value ?? '').trim();
  if (!SETUP_SESSION_TYPES.has(sessionType)) {
    throw new ApiError(
      422,
      'INVALID_SESSION_TYPE',
      'Selecciona el tipo de sesión correspondiente a esta versión.',
    );
  }
  return sessionType;
}

function positiveIntegerInRange(value, minimum, maximum, field, fields) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    fields[field] = `Introduce un número entre ${minimum} y ${maximum}.`;
    return null;
  }
  return parsed;
}

function validateRetentionDays(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
    throw new ApiError(422, 'INVALID_RETENTION', 'La retención debe estar entre 1 y 3650 días.');
  }
  return parsed;
}

function requireSetupUploader(session) {
  if (!session.admin.canUploadSetups) {
    throw new ApiError(403, 'SETUP_UPLOAD_REQUIRED', 'Tu cuenta no puede subir setups.');
  }
}

function requireSetupAdministrator(session) {
  if (!isSetupAdministrator(session)) {
    throw new ApiError(403, 'ADMIN_REQUIRED', 'Esta acción requiere permisos de administración.');
  }
  if (!session.admin.mfaEnabled) {
    throw new ApiError(403, 'MFA_SETUP_REQUIRED', 'Configura TOTP antes de administrar setups.');
  }
}

function isSetupAdministrator(session) {
  return ['owner', 'admin'].includes(session.admin.role);
}

function setupCapabilities(session) {
  return {
    canAccess: Boolean(session.admin.canAccessSetups),
    canUpload: Boolean(session.admin.canUploadSetups),
    canManage: isSetupAdministrator(session),
  };
}

function setupAccount(account) {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    canAccessSetups: Boolean(account.canAccessSetups),
    canUploadSetups: Boolean(account.canUploadSetups),
    canAccessSkins: Boolean(account.canAccessSkins),
    mfaEnabled: Boolean(account.mfaEnabled),
  };
}

function setupAccountFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.account_type === 'setup_user' ? 'user' : row.is_owner === 1 ? 'owner' : 'admin',
    canAccessSetups: row.account_type === 'administrator' || row.can_access_setups === 1,
    canUploadSetups: row.account_type === 'administrator' || row.can_upload_setups === 1,
    canAccessSkins: row.account_type === 'administrator' || row.can_access_skins === 1,
    mfaEnabled: row.totp_enabled === 1,
  };
}

function setupManagedAccountFromRow(row) {
  return {
    ...setupAccountFromRow(row),
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function accessRequestFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
  };
}

function cleanText(value, maximum) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function cleanOptionalText(value, maximum) {
  return cleanText(value, maximum) || null;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function assertLoginAllowed(attempts, key) {
  const entry = attempts.get(key);
  if (!entry) return;
  if (entry.resetAt <= Date.now()) {
    attempts.delete(key);
    return;
  }
  if (entry.count >= 5) {
    throw new ApiError(429, 'RATE_LIMITED', 'Espera unos minutos antes de volver a intentarlo.');
  }
}

function registerFailedLogin(attempts, key) {
  const current = attempts.get(key);
  attempts.set(key, {
    count: (current?.count ?? 0) + 1,
    resetAt: current?.resetAt ?? Date.now() + 15 * 60 * 1000,
  });
}

function consumeActionLimit(attempts, key, maximum, windowMilliseconds) {
  const current = attempts.get(key);
  const timestamp = Date.now();
  if (!current || current.resetAt <= timestamp) {
    attempts.set(key, { count: 1, resetAt: timestamp + windowMilliseconds });
    return;
  }
  if (current.count >= maximum) {
    throw new ApiError(429, 'RATE_LIMITED', 'Espera unos minutos antes de volver a intentarlo.');
  }
  current.count += 1;
}

async function readJson(request, limit = JSON_LIMIT) {
  const contentType = String(request.headers['content-type'] ?? '');
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envía los datos como JSON.');
  }
  const buffer = await readBuffer(request, limit);
  try {
    return JSON.parse(buffer.toString('utf8') || '{}');
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'El cuerpo JSON no es válido.');
  }
}

async function readBuffer(request, limit) {
  const declaredSize = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > limit) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': status >= 400 ? 'no-store' : 'private, no-cache',
  });
  response.end(body);
}

function sendEmpty(response, status) {
  response.writeHead(status, { ...SECURITY_HEADERS, 'Cache-Control': 'no-store' });
  response.end();
}
