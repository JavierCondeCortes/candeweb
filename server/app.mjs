import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { constants as zlibConstants, createBrotliCompress, createGzip } from 'node:zlib';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { createFatcatRoundResultsService } from './fatcat-round-results.mjs';
import { createGoogleFormsService } from './google-forms.mjs';
import {
  createFatcatStandingsService,
  reconcileStandingsWithDriverIds,
} from './fatcat-standings.mjs';
import { createTwitchStatusService } from './twitch.mjs';
import { routeSetupApi, runSetupCleanup } from './setups.mjs';
import {
  championshipFromRow,
  memberFromRow,
  openDatabase,
  recordAudit,
  settingsFromRow,
  skinFromRow,
  sponsorFromRow,
} from './database.mjs';
import {
  consumeRecoveryCode,
  createSession,
  createTotpUri,
  destroySession,
  expiredSessionCookie,
  generateRecoveryCodes,
  generateTotpSecret,
  getSession,
  hashRecoveryCode,
  hashPassword,
  hashToken,
  requireCsrf,
  sessionCookie,
  verifyTotp,
  verifyPassword,
} from './security.mjs';
import {
  ApiError,
  validateAccessRequest,
  validateAdminIdentity,
  validateChampionship,
  validateMember,
  validateSettings,
  validateSkin,
  validateSponsor,
} from './validation.mjs';

const JSON_LIMIT = 1024 * 1024;
const MEDIA_LIMIT = 110 * 1024 * 1024;
const SESSION_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PUBLIC_CHAMPIONSHIP_STATUSES = new Set(['registration', 'active', 'finished']);
const BASE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
const MEMBER_COLUMNS = `
  id, slug, name, alias, role_label, bio, photo_url, photo_alt, photo_consent_confirmed,
  twitch_url, instagram_url, youtube_url, x_url, discord_url, website_url, display_order, is_featured, is_demo, status,
  published_at, created_at, updated_at, updated_by_name, deleted_at
`;
const CHAMPIONSHIP_COLUMNS = `
  id, external_tournament_id, slug, name, edition_number, subtitle, season, summary, description,
  cover_url, cover_alt, background_video_url, background_video_mime_type, start_at, end_at,
  registration_url, rules_url, status, is_featured,
  display_order, published_at, last_synced_at, sync_status, sync_error, created_at, updated_at,
  updated_by_name, deleted_at
`;
const SPONSOR_COLUMNS = `
  id, name, description, logo_url, logo_alt, website_url, display_order, status,
  published_at, created_at, updated_at, updated_by_name, deleted_at
`;
const SKIN_COLUMNS = `
  id, car_name, image_url, image_alt, target_url, display_order, status,
  published_at, created_at, updated_at, updated_by_name, deleted_at
`;

export function createCandemorApp(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const databasePath = resolve(options.databasePath ?? join(rootDir, 'server/data/candemor.db'));
  const uploadDir = resolve(options.uploadDir ?? join(rootDir, 'server/data/uploads'));
  const setupDir = resolve(
    options.setupDir ?? process.env.SETUP_DIR ?? join(rootDir, 'server/data/setups'),
  );
  const browserDir = resolve(options.browserDir ?? join(rootDir, 'dist/candeweb/browser'));
  const secureCookies = options.secureCookies ?? process.env.NODE_ENV === 'production';
  const twitchStatusService = options.twitchStatusService ?? createTwitchStatusService();
  const roundResultsService = options.roundResultsService ?? createFatcatRoundResultsService();
  const standingsService = options.standingsService ?? createFatcatStandingsService();
  const googleFormsService = options.googleFormsService ?? createGoogleFormsService();
  const db = openDatabase(databasePath);
  const loginAttempts = new Map();
  const actionAttempts = new Map();
  mkdirSync(uploadDir, { recursive: true });
  mkdirSync(setupDir, { recursive: true });

  const cleanExpiredSetups = () =>
    runSetupCleanup(db, setupDir).catch((error) =>
      console.error('No se pudieron limpiar los setups caducados.', error),
    );
  void cleanExpiredSetups();
  const setupCleanupTimer = setInterval(cleanExpiredSetups, 60 * 60 * 1000);
  setupCleanupTimer.unref();

  const server = createServer(async (request, response) => {
    try {
      await routeRequest({
        request,
        response,
        db,
        uploadDir,
        setupDir,
        browserDir,
        secureCookies,
        loginAttempts,
        actionAttempts,
        twitchStatusService,
        roundResultsService,
        standingsService,
        googleFormsService,
      });
    } catch (error) {
      sendError(response, error);
    }
  });

  return {
    db,
    server,
    close() {
      clearInterval(setupCleanupTimer);
      return new Promise((resolveClose, rejectClose) => {
        server.close((error) => {
          db.close();
          if (error) rejectClose(error);
          else resolveClose();
        });
      });
    },
  };
}

async function routeRequest(context) {
  const { request, response, db } = context;
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  const method = request.method ?? 'GET';

  if (method === 'OPTIONS') return sendEmpty(response, 204);

  if (method === 'GET' && path === '/api/health') {
    return sendJson(response, 200, { ok: true, database: 'ready' });
  }

  if (method === 'GET' && path === '/api/public/google-form') {
    const schema = await context.googleFormsService.getSchema(url.searchParams.get('url'));
    const { actionUrl: _actionUrl, fbzx: _fbzx, pageCount: _pageCount, ...publicSchema } = schema;
    return sendJson(response, 200, publicSchema);
  }

  if (method === 'POST' && path === '/api/public/google-form-submit') {
    const body = await readJson(request);
    const result = await context.googleFormsService.submit({
      url: body.url,
      answers: body.answers,
    });
    return sendJson(response, 200, result);
  }

  if (method === 'GET' && path === '/api/public/site-settings') {
    const settings = settingsFromRow(db.prepare('SELECT * FROM site_settings WHERE id = 1').get());
    const featured = settings.featuredChampionshipId
      ? championshipFromDatabaseRow(
          db,
          db
            .prepare(
              `SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships
               WHERE id = ? AND deleted_at IS NULL
                 AND status IN ('registration', 'active', 'finished')`,
            )
            .get(settings.featuredChampionshipId),
        )
      : null;
    return sendJson(response, 200, {
      ...publicSettings(settings),
      featuredChampionshipId: featured?.id ?? null,
      featuredChampionship: publicChampionship(featured),
    });
  }

  if (method === 'GET' && path === '/api/public/stream-status') {
    const settings = settingsFromRow(db.prepare('SELECT * FROM site_settings WHERE id = 1').get());
    if (!context.twitchStatusService.isConfigured()) {
      throw new ApiError(
        503,
        'TWITCH_NOT_CONFIGURED',
        'El estado avanzado de Twitch todavía no está configurado.',
      );
    }
    try {
      const status = context.twitchStatusService.getBestStatus
        ? await context.twitchStatusService.getBestStatus({ channels: settings.twitchChannels })
        : await context.twitchStatusService.getStatus({
            channelLogin: settings.twitchChannelLogin,
            channelName: settings.twitchChannelLogin,
            channelUrl: settings.twitchChannelUrl,
          });
      return sendJson(response, 200, status);
    } catch {
      throw new ApiError(502, 'TWITCH_UNAVAILABLE', 'Twitch no está disponible temporalmente.');
    }
  }

  if (method === 'GET' && path === '/api/public/twitch-content') {
    const settings = settingsFromRow(db.prepare('SELECT * FROM site_settings WHERE id = 1').get());
    if (!context.twitchStatusService.isConfigured()) {
      throw new ApiError(
        503,
        'TWITCH_NOT_CONFIGURED',
        'El contenido de Twitch todavía no está configurado.',
      );
    }
    try {
      return sendJson(
        response,
        200,
        await context.twitchStatusService.getChannelContent({
          channelLogin: settings.twitchChannelLogin,
          channelUrl: settings.twitchChannelUrl,
        }),
      );
    } catch {
      throw new ApiError(502, 'TWITCH_UNAVAILABLE', 'Twitch no está disponible temporalmente.');
    }
  }

  const publicRoundResultsMatch = path.match(/^\/api\/public\/rounds\/(\d+)\/results$/);
  if (method === 'GET' && publicRoundResultsMatch) {
    try {
      return sendJson(
        response,
        200,
        await context.roundResultsService.getResults(Number(publicRoundResultsMatch[1])),
      );
    } catch {
      throw new ApiError(
        502,
        'ROUND_RESULTS_UNAVAILABLE',
        'Los resultados de esta sesión no están disponibles temporalmente.',
      );
    }
  }

  if (method === 'GET' && path === '/api/public/members') {
    const featuredOnly = url.searchParams.get('featured') === 'true';
    const rows = db
      .prepare(
        `SELECT ${MEMBER_COLUMNS} FROM team_members
         WHERE status = 'published' AND deleted_at IS NULL
           AND (? = 0 OR is_featured = 1)
         ORDER BY display_order ASC, name ASC
         LIMIT 100`,
      )
      .all(featuredOnly ? 1 : 0);
    return sendJson(response, 200, { members: rows.map(memberFromRow).map(publicMember) });
  }

  if (method === 'GET' && path === '/api/public/sponsors') {
    const rows = db
      .prepare(
        `SELECT ${SPONSOR_COLUMNS} FROM sponsors
         WHERE status = 'published' AND deleted_at IS NULL
         ORDER BY display_order ASC, name ASC
         LIMIT 100`,
      )
      .all();
    return sendJson(response, 200, { sponsors: rows.map(sponsorFromRow).map(publicSponsor) });
  }

  if (method === 'GET' && path === '/api/skins') {
    const session = getSession(db, request);
    if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    if (!session.admin.mfaEnabled) {
      throw new ApiError(403, 'MFA_SETUP_REQUIRED', 'Configura TOTP para entrar en Skins.');
    }
    if (!session.admin.canAccessSkins) {
      throw new ApiError(403, 'SKIN_ACCESS_REQUIRED', 'Tu cuenta no tiene acceso a las skins.');
    }
    const rows = db
      .prepare(
        `SELECT ${SKIN_COLUMNS} FROM skins
         WHERE status = 'published' AND deleted_at IS NULL
         ORDER BY display_order ASC, car_name ASC LIMIT 200`,
      )
      .all();
    return sendJson(response, 200, { skins: rows.map(skinFromRow) });
  }

  if (method === 'GET' && path === '/api/public/championships') {
    const rows = db
      .prepare(
        `SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships
         WHERE status IN ('registration', 'active', 'finished') AND deleted_at IS NULL
         ORDER BY is_featured DESC, display_order ASC, edition_number DESC, created_at DESC`,
      )
      .all();
    return sendJson(response, 200, {
      championships: rows
        .map((row) => championshipFromDatabaseRow(db, row))
        .map(publicChampionship),
    });
  }

  const publicChampionshipMatch = path.match(/^\/api\/public\/championships\/([^/]+)$/);
  if (method === 'GET' && publicChampionshipMatch) {
    const championship = findPublicChampionship(db, publicChampionshipMatch[1]);
    if (!championship) throw new ApiError(404, 'NOT_FOUND', 'No existe esa edición publicada.');
    return sendJson(response, 200, { championship: publicChampionship(championship) });
  }

  const publicSportsMatch = path.match(/^\/api\/public\/championships\/([^/]+)\/sports-data$/);
  if (method === 'GET' && publicSportsMatch) {
    const championship = findPublicChampionship(db, publicSportsMatch[1]);
    if (!championship) throw new ApiError(404, 'NOT_FOUND', 'No existe esa edición publicada.');
    const snapshot = db
      .prepare(
        `SELECT payload, synced_at, is_final FROM championship_snapshots
         WHERE championship_id = ? ORDER BY is_final DESC, synced_at DESC LIMIT 1`,
      )
      .get(championship.id);
    let payload;
    let syncedAt;
    let isFinal;
    if (snapshot) {
      payload = JSON.parse(snapshot.payload);
      syncedAt = snapshot.synced_at;
      isFinal = snapshot.is_final === 1;
    } else if (championship.externalTournamentId) {
      payload = await fetchTournament(championship.externalTournamentId);
      syncedAt = new Date().toISOString();
      isFinal = championship.status === 'finished' || championship.status === 'archived';
    } else {
      throw new ApiError(404, 'NO_SNAPSHOT', 'Todavía no hay datos sincronizados.');
    }
    let namedStandings = [];
    if (championship.externalTournamentId) {
      try {
        namedStandings = reconcileStandingsWithDriverIds(
          payload.pPd,
          await context.standingsService.getStandings(championship.externalTournamentId),
        );
      } catch {
        namedStandings = [];
      }
    }
    const corrections = db
      .prepare(
        `SELECT id, reason, note, created_by_name, created_at
         FROM sports_corrections WHERE championship_id = ? ORDER BY created_at DESC`,
      )
      .all(championship.id)
      .map(correctionFromRow);
    return sendJson(response, 200, {
      championship: publicChampionship(championship),
      data: { ...payload, namedStandings },
      syncedAt,
      isFinal,
      corrections,
    });
  }

  if (method === 'GET' && path === '/api/admin/session') {
    const needsSetup =
      Number(
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM admin_profiles WHERE account_type = 'administrator'",
          )
          .get().count,
      ) === 0;
    const session = getSession(db, request);
    const adminSession =
      session && ['owner', 'admin'].includes(session.admin.role) ? session : null;
    return sendJson(response, 200, {
      authenticated: Boolean(adminSession),
      needsSetup,
      admin: adminSession?.admin ?? null,
      csrfToken: adminSession?.csrfToken ?? null,
    });
  }

  if (method === 'POST' && path === '/api/admin/setup') {
    return setupFirstAdmin(context);
  }

  if (method === 'POST' && path === '/api/admin/access-requests') {
    return requestAdminAccess(context);
  }

  if (method === 'GET' && path === '/api/admin/invitations/verify') {
    return verifyAdminInvitation(context, url.searchParams.get('token'));
  }

  if (method === 'POST' && path === '/api/admin/invitations/accept') {
    return acceptAdminInvitation(context);
  }

  if (method === 'POST' && path === '/api/admin/login') {
    return login(context);
  }

  if (method === 'POST' && path === '/api/admin/logout') {
    const session = getSession(db, request);
    if (session && !requireCsrf(request, session)) {
      throw new ApiError(403, 'INVALID_CSRF', 'La sesión necesita renovarse antes de salir.');
    }
    if (session) destroySession(db, session.token);
    response.setHeader('Set-Cookie', expiredSessionCookie(context.secureCookies));
    return sendEmpty(response, 204);
  }

  if (path.startsWith('/api/access/mfa/')) {
    const session = getSession(db, request);
    if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    if (method !== 'POST' || !requireCsrf(request, session)) {
      throw new ApiError(403, 'INVALID_CSRF', 'La sesión necesita renovarse antes de guardar.');
    }
    if (path === '/api/access/mfa/setup') {
      const secret = generateTotpSecret();
      const otpauthUri = createTotpUri(secret, session.admin.email, 'Candemor Access');
      db.prepare(
        'UPDATE admin_profiles SET totp_pending_secret = ?, updated_at = ? WHERE id = ?',
      ).run(secret, new Date().toISOString(), session.admin.id);
      recordAudit(db, session.admin.id, 'access.mfa_setup_started', 'account', session.admin.id);
      return sendJson(response, 200, {
        secret,
        otpauthUri,
        qrCodeDataUrl: await QRCode.toDataURL(otpauthUri, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 320,
          color: { dark: '#050505', light: '#f5f5f2' },
        }),
      });
    }
    if (path === '/api/access/mfa/confirm') {
      const input = await readJson(request);
      const account = db.prepare('SELECT * FROM admin_profiles WHERE id = ?').get(session.admin.id);
      if (!account?.totp_pending_secret) {
        throw new ApiError(409, 'MFA_SETUP_MISSING', 'Inicia de nuevo la configuración de TOTP.');
      }
      if (!verifyTotp(input.code, account.totp_pending_secret)) {
        throw new ApiError(422, 'INVALID_MFA_CODE', 'El código de seis cifras no es válido.');
      }
      const recoveryCodes = generateRecoveryCodes();
      const encodedRecoveryCodes = JSON.stringify(recoveryCodes.map(hashRecoveryCode));
      db.prepare(
        `UPDATE admin_profiles SET totp_secret = totp_pending_secret, totp_pending_secret = NULL,
         totp_enabled = 1, recovery_codes = ?, updated_at = ? WHERE id = ?`,
      ).run(encodedRecoveryCodes, new Date().toISOString(), session.admin.id);
      recordAudit(db, session.admin.id, 'access.mfa_enabled', 'account', session.admin.id);
      return sendJson(response, 200, { recoveryCodes });
    }
    throw new ApiError(404, 'NOT_FOUND', 'No existe esa ruta de seguridad.');
  }

  if (
    path.startsWith('/api/access/') ||
    path.startsWith('/api/setup-access/') ||
    path === '/api/setups' ||
    path.startsWith('/api/setups/')
  ) {
    return routeSetupApi({ ...context, path, method, url });
  }

  if (path.startsWith('/api/admin/')) {
    const session = getSession(db, request);
    if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    requireAdministrator(session);
    if (!SESSION_METHODS.has(method) && !requireCsrf(request, session)) {
      throw new ApiError(403, 'INVALID_CSRF', 'La sesión necesita renovarse antes de guardar.');
    }
    const isMfaRoute = path.startsWith('/api/admin/mfa/');
    if (!session.admin.mfaEnabled && !isMfaRoute) {
      throw new ApiError(
        403,
        'MFA_SETUP_REQUIRED',
        'Configura el segundo factor antes de administrar contenido.',
      );
    }
    return routeAdmin({ ...context, path, method, url, session });
  }

  if (path.startsWith('/api/')) {
    throw new ApiError(404, 'NOT_FOUND', 'No existe esa ruta de la API.');
  }

  if (path.startsWith('/uploads/')) {
    return serveUpload(request, response, path, context.uploadDir);
  }

  return serveFrontend(request, response, path, context.browserDir);
}

async function routeAdmin(context) {
  const { db, response, path, method, session } = context;
  requireAdministrator(session);

  if (path.startsWith('/api/admin/users') || path.startsWith('/api/admin/access-requests/')) {
    return routeAdminUsers(context);
  }

  if (method === 'POST' && path === '/api/admin/mfa/setup') {
    requireAdministrator(session);
    const secret = generateTotpSecret();
    const otpauthUri = createTotpUri(secret, session.admin.email);
    db.prepare(
      'UPDATE admin_profiles SET totp_pending_secret = ?, updated_at = ? WHERE id = ?',
    ).run(secret, new Date().toISOString(), session.admin.id);
    recordAudit(db, session.admin.id, 'admin.mfa_setup_started', 'admin_profile', session.admin.id);
    return sendJson(response, 200, {
      secret,
      otpauthUri,
      qrCodeDataUrl: await QRCode.toDataURL(otpauthUri, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: { dark: '#050505', light: '#f5f5f2' },
      }),
    });
  }

  if (method === 'POST' && path === '/api/admin/mfa/confirm') {
    requireAdministrator(session);
    const input = await readJson(context.request);
    const admin = db.prepare('SELECT * FROM admin_profiles WHERE id = ?').get(session.admin.id);
    if (!admin?.totp_pending_secret) {
      throw new ApiError(
        409,
        'MFA_SETUP_MISSING',
        'Inicia de nuevo la configuración del segundo factor.',
      );
    }
    if (!verifyTotp(input.code, admin.totp_pending_secret)) {
      throw new ApiError(422, 'INVALID_MFA_CODE', 'El código de seis cifras no es válido.');
    }
    const recoveryCodes = generateRecoveryCodes();
    const encodedRecoveryCodes = JSON.stringify(recoveryCodes.map(hashRecoveryCode));
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE admin_profiles SET totp_secret = totp_pending_secret, totp_pending_secret = NULL,
       totp_enabled = 1, recovery_codes = ?, updated_at = ? WHERE id = ?`,
    ).run(encodedRecoveryCodes, timestamp, session.admin.id);
    db.prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND token_hash != ?').run(
      session.admin.id,
      hashToken(session.token),
    );
    recordAudit(db, session.admin.id, 'admin.mfa_enabled', 'admin_profile', session.admin.id);
    return sendJson(response, 200, { recoveryCodes });
  }

  if (method === 'GET' && path === '/api/admin/dashboard') {
    const members = db
      .prepare(
        `SELECT COUNT(*) AS total,
          SUM(status = 'published') AS published,
          SUM(status = 'draft') AS drafts,
          SUM(status = 'published' AND is_featured = 1) AS featured
         FROM team_members WHERE deleted_at IS NULL`,
      )
      .get();
    const championships = db
      .prepare(
        `SELECT COUNT(*) AS total,
          SUM(status = 'draft') AS drafts,
          SUM(sync_status = 'error') AS sync_errors
         FROM championships WHERE deleted_at IS NULL`,
      )
      .get();
    const sponsors = db
      .prepare(
        `SELECT COUNT(*) AS total,
          SUM(status = 'published') AS published,
          SUM(status = 'draft') AS drafts
         FROM sponsors WHERE deleted_at IS NULL`,
      )
      .get();
    const featured = championshipFromDatabaseRow(
      db,
      db
        .prepare(
          `SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships
           WHERE is_featured = 1 AND deleted_at IS NULL LIMIT 1`,
        )
        .get(),
    );
    return sendJson(response, 200, {
      members: numberValues(members),
      championships: numberValues(championships),
      sponsors: numberValues(sponsors),
      featuredChampionship: featured,
    });
  }

  if (method === 'GET' && path === '/api/admin/members') {
    const rows = db
      .prepare(
        `SELECT ${MEMBER_COLUMNS} FROM team_members
         WHERE deleted_at IS NULL ORDER BY display_order ASC, name ASC`,
      )
      .all();
    return sendJson(response, 200, { members: rows.map(memberFromRow) });
  }

  if (method === 'GET' && path === '/api/admin/skins') {
    const rows = db
      .prepare(
        `SELECT ${SKIN_COLUMNS} FROM skins
         WHERE deleted_at IS NULL ORDER BY display_order ASC, car_name ASC`,
      )
      .all();
    return sendJson(response, 200, { skins: rows.map(skinFromRow) });
  }

  if (method === 'POST' && path === '/api/admin/skins') {
    const input = await readJson(context.request);
    const skin = validateSkin(input, { publishing: input.status === 'published' });
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    db.prepare(
      `INSERT INTO skins
       (id, car_name, image_url, image_alt, target_url, display_order, status, published_at,
        created_at, updated_at, updated_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      skin.carName,
      skin.imageUrl,
      skin.imageAlt,
      skin.targetUrl,
      skin.displayOrder,
      skin.status,
      skin.status === 'published' ? timestamp : null,
      timestamp,
      timestamp,
      session.admin.displayName,
    );
    recordAudit(db, session.admin.id, 'skin.created', 'skin', id, { status: skin.status });
    return sendJson(response, 201, { skin: findSkin(db, id) });
  }

  const skinMatch = path.match(/^\/api\/admin\/skins\/([^/]+)$/);
  if (skinMatch && method === 'GET') {
    const skin = findSkin(db, skinMatch[1]);
    if (!skin) throw new ApiError(404, 'NOT_FOUND', 'No existe esa skin.');
    return sendJson(response, 200, { skin });
  }
  if (skinMatch && method === 'PATCH') {
    const current = findSkin(db, skinMatch[1]);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'No existe esa skin.');
    const input = await readJson(context.request);
    if (input.updatedAt && input.updatedAt !== current.updatedAt) {
      throw new ApiError(409, 'EDIT_CONFLICT', 'Otra persona modificó esta skin. Recarga antes de guardar.');
    }
    const skin = validateSkin(input, { publishing: input.status === 'published' });
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE skins SET car_name = ?, image_url = ?, image_alt = ?, target_url = ?,
       display_order = ?, status = ?,
       published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
       updated_at = ?, updated_by_name = ? WHERE id = ?`,
    ).run(
      skin.carName,
      skin.imageUrl,
      skin.imageAlt,
      skin.targetUrl,
      skin.displayOrder,
      skin.status,
      skin.status,
      timestamp,
      timestamp,
      session.admin.displayName,
      current.id,
    );
    recordAudit(db, session.admin.id, 'skin.updated', 'skin', current.id, { status: skin.status });
    return sendJson(response, 200, { skin: findSkin(db, current.id) });
  }
  if (skinMatch && method === 'DELETE') {
    const skin = findSkin(db, skinMatch[1]);
    if (!skin) throw new ApiError(404, 'NOT_FOUND', 'No existe esa skin.');
    const timestamp = new Date().toISOString();
    db.prepare(
      'UPDATE skins SET deleted_at = ?, updated_at = ?, updated_by_name = ? WHERE id = ?',
    ).run(timestamp, timestamp, session.admin.displayName, skin.id);
    recordAudit(db, session.admin.id, 'skin.deleted', 'skin', skin.id, { carName: skin.carName });
    return sendEmpty(response, 204);
  }

  const skinAction = path.match(/^\/api\/admin\/skins\/([^/]+)\/(publish|archive)$/);
  if (skinAction && method === 'POST') {
    const skin = findSkin(db, skinAction[1]);
    if (!skin) throw new ApiError(404, 'NOT_FOUND', 'No existe esa skin.');
    const action = skinAction[2];
    if (action === 'publish') validateSkin(skin, { publishing: true });
    const timestamp = new Date().toISOString();
    const status = action === 'publish' ? 'published' : 'archived';
    db.prepare(
      `UPDATE skins SET status = ?, published_at = COALESCE(published_at, ?),
       updated_at = ?, updated_by_name = ? WHERE id = ?`,
    ).run(status, timestamp, timestamp, session.admin.displayName, skin.id);
    recordAudit(db, session.admin.id, `skin.${action === 'publish' ? 'published' : 'archived'}`, 'skin', skin.id);
    return sendJson(response, 200, { skin: findSkin(db, skin.id) });
  }

  if (method === 'POST' && path === '/api/admin/members') {
    const input = await readJson(context.request);
    const member = validateMember(input, { publishing: input.status === 'published' });
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    runMemberInsert(db, id, member, timestamp, session.admin.displayName);
    linkMediaAsset(db, member.photoUrl, member.photoAlt, 'team_member', id);
    recordAudit(db, session.admin.id, 'member.created', 'team_member', id, {
      status: member.status,
    });
    return sendJson(response, 201, { member: findMember(db, id) });
  }

  if (method === 'PATCH' && path === '/api/admin/members/order') {
    requireAdministrator(session);
    const input = await readJson(context.request);
    if (!Array.isArray(input.ids) || input.ids.some((id) => typeof id !== 'string')) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'El orden enviado no es válido.');
    }
    db.exec('BEGIN');
    try {
      const update = db.prepare(
        `UPDATE team_members SET display_order = ?, updated_at = ?, updated_by_name = ?
         WHERE id = ?`,
      );
      const timestamp = new Date().toISOString();
      input.ids.forEach((id, index) => update.run(index, timestamp, session.admin.displayName, id));
      recordAudit(db, session.admin.id, 'members.reordered', 'team_member', null, {
        ids: input.ids,
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return sendEmpty(response, 204);
  }

  const memberMatch = path.match(/^\/api\/admin\/members\/([^/]+)$/);
  if (memberMatch && method === 'GET') {
    const member = findMember(db, memberMatch[1]);
    if (!member) throw new ApiError(404, 'NOT_FOUND', 'No existe ese miembro.');
    return sendJson(response, 200, { member });
  }
  if (memberMatch && method === 'PATCH') {
    const current = findMember(db, memberMatch[1]);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'No existe ese miembro.');
    const input = await readJson(context.request);
    if (input.updatedAt && input.updatedAt !== current.updatedAt) {
      throw new ApiError(
        409,
        'EDIT_CONFLICT',
        'Otra persona modificó este miembro. Recarga antes de guardar.',
      );
    }
    const member = validateMember(input, { publishing: input.status === 'published' });
    runMemberUpdate(db, memberMatch[1], member, session.admin.displayName);
    linkMediaAsset(db, member.photoUrl, member.photoAlt, 'team_member', memberMatch[1]);
    recordAudit(db, session.admin.id, 'member.updated', 'team_member', memberMatch[1], {
      status: member.status,
    });
    return sendJson(response, 200, { member: findMember(db, memberMatch[1]) });
  }
  if (memberMatch && method === 'DELETE') {
    requireAdministrator(session);
    const member = findMember(db, memberMatch[1]);
    if (!member) throw new ApiError(404, 'NOT_FOUND', 'No existe ese miembro.');
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE team_members SET deleted_at = ?, updated_at = ?, updated_by_name = ? WHERE id = ?`,
    ).run(timestamp, timestamp, session.admin.displayName, member.id);
    recordAudit(db, session.admin.id, 'member.deleted', 'team_member', member.id, {
      name: member.name,
    });
    return sendEmpty(response, 204);
  }

  const memberAction = path.match(/^\/api\/admin\/members\/([^/]+)\/(publish|archive)$/);
  if (memberAction && method === 'POST') {
    requireAdministrator(session);
    const member = findMember(db, memberAction[1]);
    if (!member) throw new ApiError(404, 'NOT_FOUND', 'No existe ese miembro.');
    const action = memberAction[2];
    if (action === 'publish') validateMember(member, { publishing: true });
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE team_members SET status = ?, published_at = COALESCE(published_at, ?),
       updated_at = ?, updated_by_name = ? WHERE id = ?`,
    ).run(
      action === 'publish' ? 'published' : 'archived',
      timestamp,
      timestamp,
      session.admin.displayName,
      member.id,
    );
    recordAudit(
      db,
      session.admin.id,
      action === 'publish' ? 'member.published' : 'member.archived',
      'team_member',
      member.id,
    );
    return sendJson(response, 200, { member: findMember(db, member.id) });
  }

  if (method === 'GET' && path === '/api/admin/sponsors') {
    const rows = db
      .prepare(
        `SELECT ${SPONSOR_COLUMNS} FROM sponsors
         WHERE deleted_at IS NULL ORDER BY display_order ASC, name ASC`,
      )
      .all();
    return sendJson(response, 200, { sponsors: rows.map(sponsorFromRow) });
  }

  if (method === 'POST' && path === '/api/admin/sponsors') {
    const input = await readJson(context.request);
    const sponsor = validateSponsor(input, { publishing: input.status === 'published' });
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    db.prepare(
      `INSERT INTO sponsors (
        id, name, description, logo_url, logo_alt, website_url, display_order, status,
        published_at, created_at, updated_at, updated_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      sponsor.name,
      sponsor.description,
      sponsor.logoUrl,
      sponsor.logoAlt,
      sponsor.websiteUrl,
      sponsor.displayOrder,
      sponsor.status,
      sponsor.status === 'published' ? timestamp : null,
      timestamp,
      timestamp,
      session.admin.displayName,
    );
    recordAudit(db, session.admin.id, 'sponsor.created', 'sponsor', id, {
      status: sponsor.status,
    });
    return sendJson(response, 201, { sponsor: findSponsor(db, id) });
  }

  const sponsorMatch = path.match(/^\/api\/admin\/sponsors\/([^/]+)$/);
  if (sponsorMatch && method === 'GET') {
    const sponsor = findSponsor(db, sponsorMatch[1]);
    if (!sponsor) throw new ApiError(404, 'NOT_FOUND', 'No existe ese sponsor.');
    return sendJson(response, 200, { sponsor });
  }
  if (sponsorMatch && method === 'PATCH') {
    const current = findSponsor(db, sponsorMatch[1]);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'No existe ese sponsor.');
    const input = await readJson(context.request);
    if (input.updatedAt && input.updatedAt !== current.updatedAt) {
      throw new ApiError(
        409,
        'EDIT_CONFLICT',
        'Otra persona modificó este sponsor. Recarga antes de guardar.',
      );
    }
    const sponsor = validateSponsor(input, { publishing: input.status === 'published' });
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE sponsors SET name = ?, description = ?, logo_url = ?, logo_alt = ?,
       website_url = ?, display_order = ?, status = ?,
       published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
       updated_at = ?, updated_by_name = ? WHERE id = ?`,
    ).run(
      sponsor.name,
      sponsor.description,
      sponsor.logoUrl,
      sponsor.logoAlt,
      sponsor.websiteUrl,
      sponsor.displayOrder,
      sponsor.status,
      sponsor.status,
      timestamp,
      timestamp,
      session.admin.displayName,
      current.id,
    );
    recordAudit(db, session.admin.id, 'sponsor.updated', 'sponsor', current.id, {
      status: sponsor.status,
    });
    return sendJson(response, 200, { sponsor: findSponsor(db, current.id) });
  }
  if (sponsorMatch && method === 'DELETE') {
    requireAdministrator(session);
    const sponsor = findSponsor(db, sponsorMatch[1]);
    if (!sponsor) throw new ApiError(404, 'NOT_FOUND', 'No existe ese sponsor.');
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE sponsors SET deleted_at = ?, updated_at = ?, updated_by_name = ? WHERE id = ?`,
    ).run(timestamp, timestamp, session.admin.displayName, sponsor.id);
    recordAudit(db, session.admin.id, 'sponsor.deleted', 'sponsor', sponsor.id, {
      name: sponsor.name,
    });
    return sendEmpty(response, 204);
  }

  const sponsorAction = path.match(/^\/api\/admin\/sponsors\/([^/]+)\/(publish|archive)$/);
  if (sponsorAction && method === 'POST') {
    requireAdministrator(session);
    const sponsor = findSponsor(db, sponsorAction[1]);
    if (!sponsor) throw new ApiError(404, 'NOT_FOUND', 'No existe ese sponsor.');
    const action = sponsorAction[2];
    if (action === 'publish') validateSponsor(sponsor, { publishing: true });
    const timestamp = new Date().toISOString();
    db.prepare(
      `UPDATE sponsors SET status = ?, published_at = COALESCE(published_at, ?),
       updated_at = ?, updated_by_name = ? WHERE id = ?`,
    ).run(
      action === 'publish' ? 'published' : 'archived',
      timestamp,
      timestamp,
      session.admin.displayName,
      sponsor.id,
    );
    recordAudit(
      db,
      session.admin.id,
      action === 'publish' ? 'sponsor.published' : 'sponsor.archived',
      'sponsor',
      sponsor.id,
    );
    return sendJson(response, 200, { sponsor: findSponsor(db, sponsor.id) });
  }

  if (method === 'GET' && path === '/api/admin/championships') {
    const rows = db
      .prepare(
        `SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships
         WHERE deleted_at IS NULL
         ORDER BY is_featured DESC, display_order ASC, edition_number DESC, created_at DESC`,
      )
      .all();
    return sendJson(response, 200, {
      championships: rows.map((row) => championshipFromDatabaseRow(db, row)),
    });
  }

  if (method === 'POST' && path === '/api/admin/championships/validate-source') {
    consumeActionLimit(context.actionAttempts, `source:${session.admin.id}`, 20, 10 * 60 * 1000);
    const input = await readJson(context.request);
    const externalTournamentId = Number(input.externalTournamentId);
    if (!Number.isInteger(externalTournamentId) || externalTournamentId <= 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', {
        externalTournamentId: 'Introduce un ID de torneo válido.',
      });
    }
    const payload = await fetchTournament(externalTournamentId);
    return sendJson(response, 200, {
      tournament: {
        id: Number(payload.torneo.id ?? externalTournamentId),
        name: String(payload.torneo.nombre ?? `Torneo ${externalTournamentId}`),
        rounds: payload.rondas.length,
        drivers: payload.pPd.length,
      },
    });
  }

  if (method === 'POST' && path === '/api/admin/championships') {
    const input = await readJson(context.request);
    const championship = validateChampionship(input, { publishing: input.status !== 'draft' });
    assertChampionshipIsUnique(db, championship);
    if (championship.externalTournamentId) {
      await fetchTournament(championship.externalTournamentId);
    }
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    if (championship.isFeatured) requireAdministrator(session);
    runChampionshipInsert(db, id, championship, timestamp, session.admin.displayName);
    linkMediaAsset(db, championship.coverUrl, championship.coverAlt, 'championship', id);
    linkMediaAsset(db, championship.backgroundVideoUrl, null, 'championship', id);
    if (championship.status !== 'draft' && championship.status !== 'archived') {
      featureChampionship(db, id, timestamp, session.admin.displayName);
    }
    recordAudit(db, session.admin.id, 'championship.created', 'championship', id, {
      externalTournamentId: championship.externalTournamentId,
    });
    return sendJson(response, 201, { championship: findChampionship(db, id) });
  }

  const championshipMatch = path.match(/^\/api\/admin\/championships\/([^/]+)$/);
  if (championshipMatch && method === 'GET') {
    const championship = findChampionship(db, championshipMatch[1]);
    if (!championship) throw new ApiError(404, 'NOT_FOUND', 'No existe ese Candeonato.');
    return sendJson(response, 200, { championship });
  }
  if (championshipMatch && method === 'PATCH') {
    const current = findChampionship(db, championshipMatch[1]);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'No existe ese Candeonato.');
    const input = await readJson(context.request);
    if (input.updatedAt && input.updatedAt !== current.updatedAt) {
      throw new ApiError(
        409,
        'EDIT_CONFLICT',
        'Otra persona modificó este Candeonato. Recarga antes de guardar.',
      );
    }
    const championship = validateChampionship(input, { publishing: input.status !== 'draft' });
    assertChampionshipIsUnique(db, championship, current.id);
    if (
      championship.externalTournamentId &&
      championship.externalTournamentId !== current.externalTournamentId
    ) {
      await fetchTournament(championship.externalTournamentId);
    }
    if (championship.isFeatured) requireAdministrator(session);
    runChampionshipUpdate(db, current.id, championship, session.admin.displayName);
    linkMediaAsset(db, championship.coverUrl, championship.coverAlt, 'championship', current.id);
    linkMediaAsset(db, championship.backgroundVideoUrl, null, 'championship', current.id);
    if (!isPublicChampionshipStatus(championship.status)) {
      unfeatureChampionship(
        db,
        current.id,
        new Date().toISOString(),
        session.admin.displayName,
      );
    } else if (championship.isFeatured) {
      featureChampionship(db, current.id, new Date().toISOString(), session.admin.displayName);
    }
    recordAudit(db, session.admin.id, 'championship.updated', 'championship', current.id, {
      status: championship.status,
    });
    return sendJson(response, 200, { championship: findChampionship(db, current.id) });
  }

  const correctionMatch = path.match(/^\/api\/admin\/championships\/([^/]+)\/corrections$/);
  if (correctionMatch && method === 'GET') {
    const championship = findChampionship(db, correctionMatch[1]);
    if (!championship) throw new ApiError(404, 'NOT_FOUND', 'No existe ese Candeonato.');
    const corrections = db
      .prepare(
        `SELECT id, reason, note, created_by_name, created_at
         FROM sports_corrections WHERE championship_id = ? ORDER BY created_at DESC`,
      )
      .all(championship.id)
      .map(correctionFromRow);
    return sendJson(response, 200, { corrections });
  }
  if (correctionMatch && method === 'POST') {
    requireAdministrator(session);
    const championship = findChampionship(db, correctionMatch[1]);
    if (!championship) throw new ApiError(404, 'NOT_FOUND', 'No existe ese Candeonato.');
    const input = await readJson(context.request);
    const reason = String(input.reason ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 200);
    const note = String(input.note ?? '')
      .trim()
      .slice(0, 1200);
    const fields = {};
    if (reason.length < 5) fields.reason = 'Explica brevemente el motivo de la corrección.';
    if (note.length < 5) fields.note = 'Describe la incidencia y la interpretación correcta.';
    if (Object.keys(fields).length) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO sports_corrections
       (id, championship_id, reason, note, created_by, created_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      championship.id,
      reason,
      note,
      session.admin.id,
      session.admin.displayName,
      createdAt,
    );
    recordAudit(db, session.admin.id, 'championship.correction_created', 'sports_correction', id, {
      championshipId: championship.id,
      reason,
    });
    return sendJson(response, 201, {
      correction: correctionFromRow(
        db
          .prepare(
            `SELECT id, reason, note, created_by_name, created_at
             FROM sports_corrections WHERE id = ?`,
          )
          .get(id),
      ),
    });
  }

  const championshipAction = path.match(
    /^\/api\/admin\/championships\/([^/]+)\/(publish|archive|feature|sync)$/,
  );
  if (championshipAction && method === 'POST') {
    requireAdministrator(session);
    const championship = findChampionship(db, championshipAction[1]);
    if (!championship) throw new ApiError(404, 'NOT_FOUND', 'No existe ese Candeonato.');
    const action = championshipAction[2];
    if (action === 'sync') {
      consumeActionLimit(context.actionAttempts, `sync:${session.admin.id}`, 10, 15 * 60 * 1000);
      const result = await syncChampionship(db, championship, session.admin.id);
      return sendJson(response, 200, result);
    }
    if (action === 'feature') {
      if (!isPublicChampionshipStatus(championship.status)) {
        throw new ApiError(422, 'NOT_PUBLISHED', 'Publica la edición antes de destacarla.');
      }
      featureChampionship(db, championship.id, new Date().toISOString(), session.admin.displayName);
    } else {
      const status = action === 'publish' ? 'registration' : 'archived';
      const timestamp = new Date().toISOString();
      if (action === 'publish') validateChampionship(championship, { publishing: true });
      db.prepare(
        `UPDATE championships SET status = ?, published_at = COALESCE(published_at, ?),
         is_featured = CASE WHEN ? = 'archived' THEN 0 ELSE is_featured END,
         updated_at = ?, updated_by_name = ? WHERE id = ?`,
      ).run(status, timestamp, status, timestamp, session.admin.displayName, championship.id);
      if (action === 'publish') {
        featureChampionship(db, championship.id, timestamp, session.admin.displayName);
      } else {
        unfeatureChampionship(db, championship.id, timestamp, session.admin.displayName);
      }
    }
    const auditAction =
      action === 'publish'
        ? 'championship.published'
        : action === 'archive'
          ? 'championship.archived'
          : 'championship.featured';
    recordAudit(db, session.admin.id, auditAction, 'championship', championship.id);
    return sendJson(response, 200, { championship: findChampionship(db, championship.id) });
  }

  if (method === 'GET' && path === '/api/admin/settings') {
    return sendJson(response, 200, {
      settings: settingsFromRow(db.prepare('SELECT * FROM site_settings WHERE id = 1').get()),
    });
  }

  if (method === 'PATCH' && path === '/api/admin/settings') {
    requireAdministrator(session);
    const input = await readJson(context.request);
    const currentSettings = settingsFromRow(
      db.prepare('SELECT * FROM site_settings WHERE id = 1').get(),
    );
    if (input.updatedAt && input.updatedAt !== currentSettings.updatedAt) {
      throw new ApiError(
        409,
        'EDIT_CONFLICT',
        'Otra persona modificó los ajustes. Recarga antes de guardar.',
      );
    }
    const settings = validateSettings(input);
    if (settings.featuredChampionshipId) {
      const featured = findChampionship(db, settings.featuredChampionshipId);
      if (!featured || !isPublicChampionshipStatus(featured.status)) {
        throw new ApiError(422, 'INVALID_FEATURED', 'La edición destacada debe estar publicada.');
      }
    }
    const timestamp = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare(
        `UPDATE championships SET is_featured = 0, updated_at = ?, updated_by_name = ?
         WHERE is_featured = 1`,
      ).run(timestamp, session.admin.displayName);
      if (settings.featuredChampionshipId) {
        db.prepare(
          `UPDATE championships SET is_featured = 1, updated_at = ?, updated_by_name = ?
           WHERE id = ?`,
        ).run(timestamp, session.admin.displayName, settings.featuredChampionshipId);
      }
      db.prepare(
        `UPDATE site_settings SET twitch_channel_login = ?, twitch_channel_url = ?,
         twitch_channels_json = ?, featured_championship_id = ?, contact_email = ?,
         discord_url = ?, instagram_url = ?, youtube_url = ?, updated_at = ?,
         updated_by_name = ? WHERE id = 1`,
      ).run(
        settings.twitchChannelLogin,
        settings.twitchChannelUrl,
        JSON.stringify(settings.twitchChannels),
        settings.featuredChampionshipId,
        settings.contactEmail,
        settings.discordUrl,
        settings.instagramUrl,
        settings.youtubeUrl,
        timestamp,
        session.admin.displayName,
      );
      recordAudit(db, session.admin.id, 'settings.updated', 'site_settings', '1');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return sendJson(response, 200, {
      settings: settingsFromRow(db.prepare('SELECT * FROM site_settings WHERE id = 1').get()),
    });
  }

  if (method === 'POST' && path === '/api/admin/media') {
    consumeActionLimit(context.actionAttempts, `media:${session.admin.id}`, 20, 10 * 60 * 1000);
    const requestContentType = String(context.request.headers['content-type'] ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    const input =
      requestContentType === 'application/json'
        ? await readJson(context.request, MEDIA_LIMIT)
        : {
            fileName: context.url.searchParams.get('fileName'),
            mimeType: requestContentType,
            kind: context.url.searchParams.get('kind'),
            altText: context.url.searchParams.get('altText'),
            buffer: await readBuffer(context.request, MEDIA_LIMIT),
          };
    const asset = await saveMedia(context, input);
    return sendJson(response, 201, { asset });
  }

  if (method === 'GET' && path === '/api/admin/audit') {
    requireAdministrator(session);
    const rows = db
      .prepare(
        `SELECT l.id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
                a.display_name AS actor_name, a.email AS actor_email
         FROM audit_log l LEFT JOIN admin_profiles a ON a.id = l.actor_id
         ORDER BY l.created_at DESC LIMIT 200`,
      )
      .all();
    return sendJson(response, 200, {
      entries: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        details: row.details ? JSON.parse(row.details) : null,
        createdAt: row.created_at,
        actorName: row.actor_name,
        actorEmail: row.actor_email,
      })),
    });
  }

  throw new ApiError(404, 'NOT_FOUND', 'No existe ese recurso administrativo.');
}

async function setupFirstAdmin(context) {
  const { db, request, response, secureCookies } = context;
  const adminCount = Number(
    db
      .prepare("SELECT COUNT(*) AS count FROM admin_profiles WHERE account_type = 'administrator'")
      .get().count,
  );
  if (adminCount > 0)
    throw new ApiError(409, 'SETUP_COMPLETE', 'La administración ya está configurada.');

  const input = await readJson(request);
  if (process.env.NODE_ENV === 'production') {
    const expectedToken = process.env.ADMIN_SETUP_TOKEN;
    if (!expectedToken) {
      throw new ApiError(503, 'SETUP_DISABLED', 'Configura ADMIN_SETUP_TOKEN en el servidor.');
    }
    if (input.setupToken !== expectedToken) {
      throw new ApiError(403, 'INVALID_SETUP_TOKEN', 'El token de configuración no es válido.');
    }
  }
  const identity = validateAdminIdentity(input, { setup: true });
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const passwordHash = await hashPassword(identity.password);
  const inserted = db
    .prepare(
      `INSERT INTO admin_profiles
     (id, email, display_name, password_hash, role, is_owner, active, email_verified_at, created_at, updated_at)
     SELECT ?, ?, ?, ?, 'admin', 1, 1, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM admin_profiles WHERE account_type = 'administrator'
     )`,
    )
    .run(id, identity.email, identity.displayName, passwordHash, timestamp, timestamp, timestamp);
  if (inserted.changes === 0) {
    throw new ApiError(409, 'SETUP_COMPLETE', 'La administración ya está configurada.');
  }
  recordAudit(db, id, 'admin.setup', 'admin_profile', id);
  const session = createSession(db, id);
  response.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt, secureCookies));
  return sendJson(response, 201, {
    authenticated: true,
    needsSetup: false,
    admin: {
      id,
      email: identity.email,
      displayName: identity.displayName,
      role: 'owner',
      mfaEnabled: false,
      emailVerified: true,
    },
    csrfToken: session.csrfToken,
  });
}

async function requestAdminAccess(context) {
  const { db, request, response, actionAttempts } = context;
  consumeActionLimit(
    actionAttempts,
    `access-request:${request.socket.remoteAddress ?? 'local'}`,
    5,
    60 * 60 * 1000,
  );
  const identity = validateAccessRequest(await readJson(request));
  const timestamp = new Date().toISOString();
  const existingAdmin = db
    .prepare('SELECT 1 FROM admin_profiles WHERE email = ? LIMIT 1')
    .get(identity.email);
  if (!existingAdmin) {
    const existingRequest = db
      .prepare('SELECT id, status FROM admin_access_requests WHERE email = ?')
      .get(identity.email);
    if (!existingRequest) {
      db.prepare(
        `INSERT INTO admin_access_requests
         (id, email, display_name, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
      ).run(randomUUID(), identity.email, identity.displayName, timestamp, timestamp);
    } else if (existingRequest.status === 'rejected') {
      db.prepare(
        `UPDATE admin_access_requests
         SET display_name = ?, status = 'pending', updated_at = ?, reviewed_at = NULL,
             reviewed_by = NULL WHERE id = ?`,
      ).run(identity.displayName, timestamp, existingRequest.id);
    }
  }
  return sendJson(response, 202, { requested: true });
}

function verifyAdminInvitation(context, token) {
  const invitation = findValidInvitation(context.db, token);
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

async function acceptAdminInvitation(context) {
  const { db, request, response, secureCookies, actionAttempts } = context;
  consumeActionLimit(
    actionAttempts,
    `accept-invitation:${request.socket.remoteAddress ?? 'local'}`,
    10,
    60 * 60 * 1000,
  );
  const input = await readJson(request);
  const invitation = findValidInvitation(db, input.token);
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
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const passwordHash = await hashPassword(identity.password);

  db.exec('BEGIN');
  try {
    const inserted = db
      .prepare(
        `INSERT INTO admin_profiles
         (id, email, display_name, password_hash, role, is_owner, active, email_verified_at,
          created_at, updated_at)
         SELECT ?, ?, ?, ?, 'admin', 0, 1, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM admin_profiles WHERE email = ?)`,
      )
      .run(
        id,
        identity.email,
        identity.displayName,
        passwordHash,
        timestamp,
        timestamp,
        timestamp,
        identity.email,
      );
    if (inserted.changes === 0) {
      throw new ApiError(409, 'ACCOUNT_EXISTS', 'Ya existe una cuenta para ese correo.');
    }
    db.prepare('UPDATE admin_invitations SET accepted_at = ? WHERE id = ?').run(
      timestamp,
      invitation.id,
    );
    if (invitation.request_id) {
      db.prepare(
        `UPDATE admin_access_requests
         SET status = 'activated', updated_at = ? WHERE id = ?`,
      ).run(timestamp, invitation.request_id);
    }
    recordAudit(db, id, 'admin.invitation_accepted', 'admin_profile', id, {
      invitedBy: invitation.created_by,
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const session = createSession(db, id);
  response.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt, secureCookies));
  return sendJson(response, 201, {
    authenticated: true,
    needsSetup: false,
    admin: {
      id,
      email: identity.email,
      displayName: identity.displayName,
      role: 'admin',
      mfaEnabled: false,
      emailVerified: true,
    },
    csrfToken: session.csrfToken,
  });
}

function findValidInvitation(db, token) {
  const normalized = String(token ?? '').trim();
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(normalized)) return null;
  return db
    .prepare(
      `SELECT * FROM admin_invitations
       WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > ?`,
    )
    .get(hashToken(normalized), new Date().toISOString());
}

async function routeAdminUsers(context) {
  const { db, response, path, method, session } = context;
  requireOwner(session);

  if (method === 'GET' && path === '/api/admin/users') {
    const users = db
      .prepare(
        `SELECT id, email, display_name, is_owner, active, totp_enabled,
                email_verified_at, created_at, updated_at
         FROM admin_profiles WHERE account_type = 'administrator'
         ORDER BY is_owner DESC, created_at ASC`,
      )
      .all()
      .map(adminAccountFromRow);
    const requests = db
      .prepare(
        `SELECT id, email, display_name, status, created_at, updated_at, reviewed_at
         FROM admin_access_requests
         WHERE status != 'activated'
         ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                  created_at DESC LIMIT 100`,
      )
      .all()
      .map(accessRequestFromRow);
    return sendJson(response, 200, { users, requests });
  }

  const approveMatch = path.match(/^\/api\/admin\/access-requests\/([^/]+)\/approve$/);
  if (method === 'POST' && approveMatch) {
    const requestId = approveMatch[1];
    const accessRequest = db
      .prepare('SELECT * FROM admin_access_requests WHERE id = ?')
      .get(requestId);
    if (!accessRequest || accessRequest.status === 'activated') {
      throw new ApiError(404, 'NOT_FOUND', 'No existe esa solicitud pendiente.');
    }
    if (accessRequest.status === 'rejected') {
      throw new ApiError(409, 'REQUEST_REJECTED', 'La solicitud está rechazada.');
    }
    if (db.prepare('SELECT 1 FROM admin_profiles WHERE email = ?').get(accessRequest.email)) {
      throw new ApiError(409, 'ACCOUNT_EXISTS', 'Ya existe una cuenta para ese correo.');
    }

    const token = randomBytes(32).toString('base64url');
    const timestamp = new Date();
    const expiresAt = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM admin_invitations WHERE request_id = ? AND accepted_at IS NULL').run(
        requestId,
      );
      db.prepare(
        `INSERT INTO admin_invitations
         (id, request_id, email, display_name, token_hash, expires_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        requestId,
        accessRequest.email,
        accessRequest.display_name,
        hashToken(token),
        expiresAt.toISOString(),
        session.admin.id,
        timestamp.toISOString(),
      );
      db.prepare(
        `UPDATE admin_access_requests
         SET status = 'approved', updated_at = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
      ).run(timestamp.toISOString(), timestamp.toISOString(), session.admin.id, requestId);
      recordAudit(
        db,
        session.admin.id,
        'admin.request_approved',
        'admin_access_request',
        requestId,
        {
          email: accessRequest.email,
        },
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return sendJson(response, 201, {
      invitation: {
        email: accessRequest.email,
        path: `/admin/aceptar-invitacion?token=${encodeURIComponent(token)}`,
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  const rejectMatch = path.match(/^\/api\/admin\/access-requests\/([^/]+)\/reject$/);
  if (method === 'POST' && rejectMatch) {
    const requestId = rejectMatch[1];
    const accessRequest = db
      .prepare("SELECT * FROM admin_access_requests WHERE id = ? AND status != 'activated'")
      .get(requestId);
    if (!accessRequest) throw new ApiError(404, 'NOT_FOUND', 'No existe esa solicitud.');
    const timestamp = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM admin_invitations WHERE request_id = ? AND accepted_at IS NULL').run(
        requestId,
      );
      db.prepare(
        `UPDATE admin_access_requests
         SET status = 'rejected', updated_at = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
      ).run(timestamp, timestamp, session.admin.id, requestId);
      recordAudit(
        db,
        session.admin.id,
        'admin.request_rejected',
        'admin_access_request',
        requestId,
        {
          email: accessRequest.email,
        },
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return sendEmpty(response, 204);
  }

  const revokeMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/revoke-sessions$/);
  if (method === 'POST' && revokeMatch) {
    const target = findAdminAccount(db, revokeMatch[1]);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'No existe esa cuenta.');
    if (target.id === session.admin.id) {
      throw new ApiError(422, 'SELF_ACTION', 'Cierra tu sesión desde la cabecera del panel.');
    }
    db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(target.id);
    recordAudit(db, session.admin.id, 'admin.sessions_revoked', 'admin_profile', target.id);
    return sendEmpty(response, 204);
  }

  const userMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (method === 'PATCH' && userMatch) {
    const target = findAdminAccount(db, userMatch[1]);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'No existe esa cuenta.');
    if (target.is_owner === 1) {
      throw new ApiError(422, 'OWNER_PROTECTED', 'La cuenta propietaria no se puede desactivar.');
    }
    const input = await readJson(context.request);
    if (typeof input.active !== 'boolean') {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Indica si la cuenta debe estar activa.');
    }
    const timestamp = new Date().toISOString();
    db.prepare('UPDATE admin_profiles SET active = ?, updated_at = ? WHERE id = ?').run(
      input.active ? 1 : 0,
      timestamp,
      target.id,
    );
    if (!input.active) db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(target.id);
    recordAudit(
      db,
      session.admin.id,
      input.active ? 'admin.activated' : 'admin.deactivated',
      'admin_profile',
      target.id,
    );
    return sendJson(response, 200, { user: adminAccountFromRow(findAdminAccount(db, target.id)) });
  }

  throw new ApiError(404, 'NOT_FOUND', 'No existe ese recurso de administradores.');
}

function findAdminAccount(db, id) {
  return db
    .prepare(
      `SELECT id, email, display_name, is_owner, active, totp_enabled,
              email_verified_at, created_at, updated_at
       FROM admin_profiles WHERE id = ? AND account_type = 'administrator'`,
    )
    .get(id);
}

function adminAccountFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.is_owner === 1 ? 'owner' : 'admin',
    active: row.active === 1,
    mfaEnabled: row.totp_enabled === 1,
    emailVerified: Boolean(row.email_verified_at),
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

async function login(context) {
  const { db, request, response, secureCookies, loginAttempts } = context;
  const input = await readJson(request);
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(input.password ?? '');
  const attemptKey = `${request.socket.remoteAddress ?? 'local'}:${email}`;
  assertLoginAllowed(loginAttempts, attemptKey);

  const admin = db
    .prepare(
      `SELECT * FROM admin_profiles
       WHERE email = ? AND active = 1 AND role = 'admin' AND account_type = 'administrator'`,
    )
    .get(email);
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    registerFailedLogin(loginAttempts, attemptKey);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no son correctos.');
  }

  if (admin.totp_enabled === 1) {
    const mfaCode = String(input.mfaCode ?? '').trim();
    if (!mfaCode) {
      throw new ApiError(
        401,
        'MFA_REQUIRED',
        'Introduce el código de tu aplicación autenticadora.',
      );
    }
    const remainingRecoveryCodes = consumeRecoveryCode(mfaCode, admin.recovery_codes);
    if (!verifyTotp(mfaCode, admin.totp_secret) && remainingRecoveryCodes === null) {
      registerFailedLogin(loginAttempts, attemptKey);
      throw new ApiError(401, 'INVALID_MFA_CODE', 'El código de segundo factor no es válido.');
    }
    if (remainingRecoveryCodes !== null) {
      db.prepare('UPDATE admin_profiles SET recovery_codes = ?, updated_at = ? WHERE id = ?').run(
        remainingRecoveryCodes,
        new Date().toISOString(),
        admin.id,
      );
      recordAudit(db, admin.id, 'admin.recovery_code_used', 'admin_profile', admin.id);
    }
  }

  loginAttempts.delete(attemptKey);
  db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(new Date().toISOString());
  const session = createSession(db, admin.id);
  response.setHeader('Set-Cookie', sessionCookie(session.token, session.expiresAt, secureCookies));
  recordAudit(db, admin.id, 'admin.login', 'admin_profile', admin.id);
  return sendJson(response, 200, {
    authenticated: true,
    needsSetup: false,
    admin: adminFromRow(admin),
    csrfToken: session.csrfToken,
  });
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

function requireAdministrator(session) {
  if (!['owner', 'admin'].includes(session.admin.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Esta acción requiere permisos de administrador.');
  }
}

function requireOwner(session) {
  if (session.admin.role !== 'owner') {
    throw new ApiError(
      403,
      'OWNER_REQUIRED',
      'Esta acción solo está disponible para el propietario.',
    );
  }
}

function findMember(db, id) {
  return memberFromRow(
    db
      .prepare(`SELECT ${MEMBER_COLUMNS} FROM team_members WHERE id = ? AND deleted_at IS NULL`)
      .get(id),
  );
}

function findSponsor(db, id) {
  return sponsorFromRow(
    db
      .prepare(`SELECT ${SPONSOR_COLUMNS} FROM sponsors WHERE id = ? AND deleted_at IS NULL`)
      .get(id),
  );
}

function findSkin(db, id) {
  return skinFromRow(
    db.prepare(`SELECT ${SKIN_COLUMNS} FROM skins WHERE id = ? AND deleted_at IS NULL`).get(id),
  );
}

function findChampionship(db, id) {
  return championshipFromDatabaseRow(
    db,
    db
      .prepare(
        `SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships WHERE id = ? AND deleted_at IS NULL`,
      )
      .get(id),
  );
}

function findPublicChampionship(db, key) {
  const numericKey = /^\d+$/.test(key) ? Number(key) : null;
  return championshipFromDatabaseRow(
    db,
    db
      .prepare(
        `SELECT ${CHAMPIONSHIP_COLUMNS} FROM championships
         WHERE deleted_at IS NULL AND status IN ('registration', 'active', 'finished')
           AND (slug = ? OR external_tournament_id = ?)
         LIMIT 1`,
      )
      .get(key, numericKey),
  );
}

function championshipFromDatabaseRow(db, row) {
  const championship = championshipFromRow(row);
  if (!championship) return null;
  const english = db
    .prepare(
      `SELECT summary, description, cover_alt
       FROM championship_translations WHERE championship_id = ? AND locale = 'en'`,
    )
    .get(championship.id);
  const translatedChampionship = {
    ...championship,
    summaryEn: english?.summary ?? null,
    descriptionEn: english?.description ?? null,
    coverAltEn: english?.cover_alt ?? null,
  };
  if (
    translatedChampionship.coverMobileUrl ||
    !translatedChampionship.coverUrl?.startsWith('/uploads/')
  ) {
    return translatedChampionship;
  }
  const media = db
    .prepare('SELECT mobile_public_url FROM media_assets WHERE public_url = ? LIMIT 1')
    .get(translatedChampionship.coverUrl);
  return { ...translatedChampionship, coverMobileUrl: media?.mobile_public_url ?? null };
}

function runMemberInsert(db, id, member, timestamp, actorName) {
  db.prepare(
    `INSERT INTO team_members (
      id, slug, name, alias, role_label, bio, photo_url, photo_alt, photo_consent_confirmed,
      twitch_url, instagram_url, youtube_url, x_url, discord_url, website_url, display_order, is_featured,
      is_demo, status, published_at, created_at, updated_at, updated_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    member.slug,
    member.name,
    member.alias,
    member.roleLabel,
    member.bio,
    member.photoUrl,
    member.photoAlt,
    member.photoConsentConfirmed ? 1 : 0,
    member.twitchUrl,
    member.instagramUrl,
    member.youtubeUrl,
    member.xUrl,
    member.discordUrl,
    member.websiteUrl,
    member.displayOrder,
    member.isFeatured ? 1 : 0,
    member.isDemo ? 1 : 0,
    member.status,
    member.status === 'published' ? timestamp : null,
    timestamp,
    timestamp,
    actorName,
  );
}

function runMemberUpdate(db, id, member, actorName) {
  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE team_members SET
      slug = ?, name = ?, alias = ?, role_label = ?, bio = ?, photo_url = ?, photo_alt = ?,
      photo_consent_confirmed = ?, twitch_url = ?, instagram_url = ?, youtube_url = ?, x_url = ?,
      discord_url = ?, website_url = ?, display_order = ?, is_featured = ?, is_demo = ?, status = ?,
      published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
      updated_at = ?, updated_by_name = ? WHERE id = ?`,
  ).run(
    member.slug,
    member.name,
    member.alias,
    member.roleLabel,
    member.bio,
    member.photoUrl,
    member.photoAlt,
    member.photoConsentConfirmed ? 1 : 0,
    member.twitchUrl,
    member.instagramUrl,
    member.youtubeUrl,
    member.xUrl,
    member.discordUrl,
    member.websiteUrl,
    member.displayOrder,
    member.isFeatured ? 1 : 0,
    member.isDemo ? 1 : 0,
    member.status,
    member.status,
    timestamp,
    timestamp,
    actorName,
    id,
  );
}

function runChampionshipInsert(db, id, championship, timestamp, actorName) {
  db.prepare(
    `INSERT INTO championships (
      id, external_tournament_id, slug, name, edition_number, subtitle, season, summary,
      description, cover_url, cover_alt, background_video_url, background_video_mime_type,
      start_at, end_at, registration_url, rules_url, status, is_featured, display_order,
      published_at, created_at, updated_at, updated_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    championship.externalTournamentId,
    championship.slug,
    championship.name,
    championship.editionNumber,
    championship.subtitle,
    championship.season,
    championship.summary,
    championship.description,
    championship.coverUrl,
    championship.coverAlt,
    championship.backgroundVideoUrl,
    championship.backgroundVideoMimeType,
    championship.startAt,
    championship.endAt,
    championship.registrationUrl,
    championship.rulesUrl,
    championship.status,
    0,
    championship.displayOrder,
    championship.status !== 'draft' ? timestamp : null,
    timestamp,
    timestamp,
    actorName,
  );
  saveChampionshipTranslations(db, id, championship);
}

function runChampionshipUpdate(db, id, championship, actorName) {
  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE championships SET
      external_tournament_id = ?, slug = ?, name = ?, edition_number = ?, subtitle = ?, season = ?,
      summary = ?, description = ?, cover_url = ?, cover_alt = ?, background_video_url = ?,
      background_video_mime_type = ?, start_at = ?, end_at = ?, registration_url = ?,
      rules_url = ?, status = ?, display_order = ?,
      published_at = CASE WHEN ? != 'draft' THEN COALESCE(published_at, ?) ELSE published_at END,
      updated_at = ?, updated_by_name = ? WHERE id = ?`,
  ).run(
    championship.externalTournamentId,
    championship.slug,
    championship.name,
    championship.editionNumber,
    championship.subtitle,
    championship.season,
    championship.summary,
    championship.description,
    championship.coverUrl,
    championship.coverAlt,
    championship.backgroundVideoUrl,
    championship.backgroundVideoMimeType,
    championship.startAt,
    championship.endAt,
    championship.registrationUrl,
    championship.rulesUrl,
    championship.status,
    championship.displayOrder,
    championship.status,
    timestamp,
    timestamp,
    actorName,
    id,
  );
  saveChampionshipTranslations(db, id, championship);
}

function saveChampionshipTranslations(db, id, championship) {
  const hasEnglish = Boolean(
    championship.summaryEn || championship.descriptionEn || championship.coverAltEn,
  );
  if (!hasEnglish) {
    db.prepare(
      `DELETE FROM championship_translations WHERE championship_id = ? AND locale = 'en'`,
    ).run(id);
    return;
  }
  db.prepare(
    `INSERT INTO championship_translations
     (championship_id, locale, summary, description, cover_alt)
     VALUES (?, 'en', ?, ?, ?)
     ON CONFLICT(championship_id, locale) DO UPDATE SET
       summary = excluded.summary,
       description = excluded.description,
       cover_alt = excluded.cover_alt`,
  ).run(id, championship.summaryEn, championship.descriptionEn, championship.coverAltEn);
}

function featureChampionship(db, id, timestamp, actorName) {
  const championship = findChampionship(db, id);
  if (!championship || !isPublicChampionshipStatus(championship.status)) {
    throw new ApiError(422, 'INVALID_FEATURED', 'La edición destacada debe estar publicada.');
  }
  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE championships SET is_featured = 0, updated_at = ?, updated_by_name = ?
       WHERE is_featured = 1`,
    ).run(timestamp, actorName);
    db.prepare(
      `UPDATE championships SET is_featured = 1, updated_at = ?, updated_by_name = ?
       WHERE id = ?`,
    ).run(timestamp, actorName, id);
    db.prepare(
      'UPDATE site_settings SET featured_championship_id = ?, updated_at = ? WHERE id = 1',
    ).run(id, timestamp);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function unfeatureChampionship(db, id, timestamp, actorName) {
  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE championships SET is_featured = 0, updated_at = ?, updated_by_name = ?
       WHERE id = ?`,
    ).run(timestamp, actorName, id);
    db.prepare(
      `UPDATE site_settings SET featured_championship_id = NULL, updated_at = ?
       WHERE id = 1 AND featured_championship_id = ?`,
    ).run(timestamp, id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function isPublicChampionshipStatus(status) {
  return PUBLIC_CHAMPIONSHIP_STATUSES.has(status);
}

function assertChampionshipIsUnique(db, championship, excludedId = null) {
  const duplicate = db
    .prepare(
      `SELECT id, name, slug, external_tournament_id
       FROM championships
       WHERE deleted_at IS NULL
         AND id != COALESCE(?, '')
         AND (slug = ? OR (? IS NOT NULL AND external_tournament_id = ?))
       LIMIT 1`,
    )
    .get(
      excludedId,
      championship.slug,
      championship.externalTournamentId,
      championship.externalTournamentId,
    );
  if (!duplicate) return;

  const fields = {};
  if (duplicate.slug === championship.slug) {
    fields.slug = `El slug ya pertenece a «${duplicate.name}».`;
  }
  if (
    championship.externalTournamentId &&
    duplicate.external_tournament_id === championship.externalTournamentId
  ) {
    fields.externalTournamentId = `El torneo ${championship.externalTournamentId} ya pertenece a «${duplicate.name}». Edítalo desde el listado.`;
  }
  throw new ApiError(
    409,
    'DUPLICATE_CHAMPIONSHIP',
    `Ya existe el Candeonato «${duplicate.name}» con esos datos.`,
    fields,
  );
}

async function syncChampionship(db, championship, actorId) {
  if (!championship.externalTournamentId) {
    throw new ApiError(422, 'MISSING_EXTERNAL_ID', 'Añade un ID externo antes de sincronizar.');
  }
  const timestamp = new Date().toISOString();
  db.prepare(
    `UPDATE championships SET sync_status = 'syncing', sync_error = NULL, updated_at = ? WHERE id = ?`,
  ).run(timestamp, championship.id);
  try {
    const payload = await fetchTournament(championship.externalTournamentId);
    const serialized = JSON.stringify(payload);
    const checksum = createHash('sha256').update(serialized).digest('hex');
    const syncedAt = new Date().toISOString();
    db.prepare(
      `INSERT OR IGNORE INTO championship_snapshots
       (id, championship_id, payload, checksum, source_at, synced_at, is_final)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    ).run(
      randomUUID(),
      championship.id,
      serialized,
      checksum,
      syncedAt,
      championship.status === 'finished' || championship.status === 'archived' ? 1 : 0,
    );
    db.prepare(
      `UPDATE championships SET sync_status = 'success', sync_error = NULL,
       last_synced_at = ?, updated_at = ? WHERE id = ?`,
    ).run(syncedAt, syncedAt, championship.id);
    recordAudit(db, actorId, 'championship.synced', 'championship', championship.id, {
      checksum,
      externalTournamentId: championship.externalTournamentId,
    });
    return { championship: findChampionship(db, championship.id), syncedAt, data: payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    db.prepare(
      `UPDATE championships SET sync_status = 'error', sync_error = ?, updated_at = ? WHERE id = ?`,
    ).run(message.slice(0, 500), new Date().toISOString(), championship.id);
    recordAudit(db, actorId, 'championship.sync_failed', 'championship', championship.id, {
      message,
    });
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'SYNC_FAILED', 'No se pudo sincronizar la edición con Fat Cat Race.');
  }
}

async function fetchTournament(externalTournamentId) {
  let response;
  try {
    const baseUrl = process.env.FATCAT_API_BASE_URL ?? 'https://fatcatrace.xyz/api/torneo';
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/${externalTournamentId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(502, 'EXTERNAL_UNAVAILABLE', 'La API deportiva no está disponible.');
  }
  if (!response.ok) {
    throw new ApiError(422, 'INVALID_TOURNAMENT', 'Fat Cat Race no reconoce ese torneo.');
  }
  const payload = await response.json();
  if (!payload?.torneo || !Array.isArray(payload.rondas) || !Array.isArray(payload.pPd)) {
    throw new ApiError(
      502,
      'INVALID_EXTERNAL_RESPONSE',
      'La respuesta deportiva no tiene el formato esperado.',
    );
  }
  return payload;
}

async function saveMedia(context, input) {
  const { db, uploadDir, session } = context;
  const mimeType = String(input.mimeType ?? '').toLowerCase();
  const originalName = String(input.fileName ?? 'archivo').slice(0, 180);
  const buffer = Buffer.isBuffer(input.buffer)
    ? input.buffer
    : Buffer.from(String(input.dataBase64 ?? '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (input.kind === 'championship-video') {
    return saveVideoMedia({ db, uploadDir, session, mimeType, originalName, buffer });
  }
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) {
    throw new ApiError(422, 'INVALID_MEDIA_SIZE', 'La imagen debe pesar entre 1 byte y 12 MB.');
  }
  const extension = detectImageExtension(buffer, mimeType);
  if (!extension) {
    throw new ApiError(
      422,
      'INVALID_MEDIA_TYPE',
      'Solo se aceptan imágenes JPEG, PNG, WebP o AVIF.',
    );
  }
  const id = randomUUID();
  const kind =
    input.kind === 'championship'
      ? 'championship'
      : input.kind === 'sponsor'
        ? 'sponsor'
        : input.kind === 'skin'
          ? 'skin'
          : 'member';
  const altText =
    String(input.altText ?? '')
      .trim()
      .slice(0, 160) || null;
  const originalsDir = join(dirname(uploadDir), 'originals');
  mkdirSync(originalsDir, { recursive: true });
  const originalStoragePath = join(originalsDir, `${id}.${extension}`);
  let processed;
  let mobileProcessed = null;
  try {
    const metadata = await sharp(buffer).metadata();
    const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
    const sourceWidth = swapsDimensions ? metadata.height : metadata.width;
    const sourceHeight = swapsDimensions ? metadata.width : metadata.height;
    const width = sourceWidth ?? 0;
    const height = sourceHeight ?? 0;
    const validChampionshipCover =
      (width >= 1200 && height >= 675) ||
      (width >= 900 && height >= 1200) ||
      (width >= 900 && height >= 900);
    const validMemberPhoto = width >= 720 && height >= 900;
    const validSponsorLogo = width >= 100 && height >= 100;
    const validSkinImage = width >= 600 && height >= 400;
    const mediaIsTooSmall =
      kind === 'championship'
        ? !validChampionshipCover
        : kind === 'sponsor'
          ? !validSponsorLogo
          : kind === 'skin'
            ? !validSkinImage
          : !validMemberPhoto;
    if (mediaIsTooSmall) {
      throw new ApiError(
        422,
        'MEDIA_TOO_SMALL',
        kind === 'championship'
          ? 'Usa un cartel de al menos 1200 × 675 px en horizontal, 900 × 1200 px en vertical o 900 × 900 px en formato cuadrado.'
          : kind === 'sponsor'
            ? 'El logotipo debe medir al menos 100 × 100 píxeles. Se admiten formatos verticales, cuadrados y horizontales.'
            : kind === 'skin'
              ? 'La imagen de la skin debe medir al menos 600 × 400 píxeles.'
            : 'La fotografía debe medir al menos 720 × 900 píxeles.',
      );
    }
    await writeFile(originalStoragePath, buffer, { flag: 'wx' });
    const mainResize =
      kind === 'championship'
        ? {
            width: 1600,
            height: 1600,
            fit: 'inside',
            withoutEnlargement: true,
          }
        : kind === 'sponsor'
          ? {
              width: 1200,
              height: 600,
              fit: 'inside',
              withoutEnlargement: true,
            }
          : kind === 'skin'
            ? {
                width: 1600,
                height: 1200,
                fit: 'inside',
                withoutEnlargement: true,
              }
          : {
              width: 720,
              height: 900,
              fit: 'cover',
              position: 'attention',
              withoutEnlargement: true,
            };
    const mainTask = sharp(buffer)
      .rotate()
      .resize(mainResize)
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const mobileTask =
      kind === 'championship'
        ? sharp(buffer)
            .rotate()
            .resize({
              width: 900,
              height: 900,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 80 })
            .toBuffer({ resolveWithObject: true })
        : Promise.resolve(null);
    [processed, mobileProcessed] = await Promise.all([mainTask, mobileTask]);
  } catch (error) {
    await unlink(originalStoragePath).catch(() => undefined);
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, 'INVALID_MEDIA_DATA', 'No se pudo procesar la imagen enviada.');
  }
  const fileName = `${id}.webp`;
  const storagePath = join(uploadDir, fileName);
  const publicUrl = `/uploads/${fileName}`;
  const mobileFileName = mobileProcessed ? `${id}-mobile.webp` : null;
  const mobileStoragePath = mobileFileName ? join(uploadDir, mobileFileName) : null;
  const mobilePublicUrl = mobileFileName ? `/uploads/${mobileFileName}` : null;
  try {
    await writeFile(storagePath, processed.data, { flag: 'wx' });
    if (mobileProcessed && mobileStoragePath) {
      await writeFile(mobileStoragePath, mobileProcessed.data, { flag: 'wx' });
    }
  } catch (error) {
    await Promise.all([
      unlink(originalStoragePath).catch(() => undefined),
      unlink(storagePath).catch(() => undefined),
      mobileStoragePath ? unlink(mobileStoragePath).catch(() => undefined) : Promise.resolve(),
    ]);
    throw error;
  }
  const createdAt = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO media_assets
       (id, public_url, storage_path, mobile_public_url, mobile_storage_path, original_storage_path,
        original_name, mime_type, width, height, byte_size, alt_text, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'image/webp', ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      publicUrl,
      storagePath,
      mobilePublicUrl,
      mobileStoragePath,
      originalStoragePath,
      originalName,
      processed.info.width,
      processed.info.height,
      processed.data.length,
      altText,
      session.admin.id,
      createdAt,
    );
  } catch (error) {
    await Promise.all([
      unlink(originalStoragePath).catch(() => undefined),
      unlink(storagePath).catch(() => undefined),
      mobileStoragePath ? unlink(mobileStoragePath).catch(() => undefined) : Promise.resolve(),
    ]);
    throw error;
  }
  recordAudit(db, session.admin.id, 'media.uploaded', 'media_asset', id, {
    publicUrl,
    byteSize: processed.data.length,
    originalByteSize: buffer.length,
    kind,
    mobilePublicUrl,
  });
  return {
    id,
    publicUrl,
    mobilePublicUrl,
    originalName,
    mimeType: 'image/webp',
    width: processed.info.width,
    height: processed.info.height,
    byteSize: processed.data.length,
    createdAt,
  };
}

async function saveVideoMedia({ db, uploadDir, session, mimeType, originalName, buffer }) {
  if (!buffer.length || buffer.length > 80 * 1024 * 1024) {
    throw new ApiError(422, 'INVALID_MEDIA_SIZE', 'El vídeo debe pesar entre 1 byte y 80 MB.');
  }
  const extension = detectVideoExtension(buffer, mimeType);
  if (!extension) {
    throw new ApiError(422, 'INVALID_MEDIA_TYPE', 'Solo se aceptan vídeos MP4 o WebM.');
  }
  const id = randomUUID();
  const storagePath = join(uploadDir, `${id}.${extension}`);
  const publicUrl = `/uploads/${id}.${extension}`;
  const normalizedMimeType = extension === 'webm' ? 'video/webm' : 'video/mp4';
  await writeFile(storagePath, buffer, { flag: 'wx' });
  const createdAt = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO media_assets
       (id, public_url, storage_path, original_name, mime_type, byte_size, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      publicUrl,
      storagePath,
      originalName,
      normalizedMimeType,
      buffer.length,
      session.admin.id,
      createdAt,
    );
  } catch (error) {
    await unlink(storagePath).catch(() => undefined);
    throw error;
  }
  recordAudit(db, session.admin.id, 'media.video_uploaded', 'media_asset', id, {
    publicUrl,
    byteSize: buffer.length,
    kind: 'championship-video',
  });
  return {
    id,
    publicUrl,
    mobilePublicUrl: null,
    originalName,
    mimeType: normalizedMimeType,
    width: null,
    height: null,
    byteSize: buffer.length,
    createdAt,
  };
}

function linkMediaAsset(db, publicUrl, altText, entityType, entityId) {
  if (!publicUrl?.startsWith('/uploads/')) return;
  db.prepare(
    `UPDATE media_assets SET alt_text = ?, entity_type = ?, entity_id = ? WHERE public_url = ?`,
  ).run(altText, entityType, entityId, publicUrl);
}

function detectImageExtension(buffer, mimeType) {
  if (mimeType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    mimeType === 'image/png' &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'png';
  }
  if (
    mimeType === 'image/webp' &&
    buffer.subarray(0, 4).toString() === 'RIFF' &&
    buffer.subarray(8, 12).toString() === 'WEBP'
  ) {
    return 'webp';
  }
  if (
    mimeType === 'image/avif' &&
    buffer.subarray(4, 8).toString() === 'ftyp' &&
    ['avif', 'avis'].includes(buffer.subarray(8, 12).toString())
  ) {
    return 'avif';
  }
  return null;
}

function detectVideoExtension(buffer, mimeType) {
  if (mimeType === 'video/mp4' && buffer.subarray(4, 8).toString() === 'ftyp') return 'mp4';
  if (
    mimeType === 'video/webm' &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  ) {
    return 'webm';
  }
  return null;
}

async function readJson(request, limit = JSON_LIMIT) {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envía los datos como JSON.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit)
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
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

function serveUpload(request, response, path, uploadDir) {
  const fileName = normalize(path.slice('/uploads/'.length)).replace(/^([.][.][/\\])+/, '');
  const filePath = resolve(uploadDir, fileName);
  if (!filePath.startsWith(`${resolve(uploadDir)}${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new ApiError(400, 'INVALID_PATH', 'La ruta solicitada no es válida.');
  }
  if (!existsSync(filePath)) throw new ApiError(404, 'NOT_FOUND', 'No existe ese recurso.');
  const size = statSync(filePath).size;
  const headers = {
    ...BASE_SECURITY_HEADERS,
    'Content-Type': mimeFromExtension(extname(filePath)),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  };
  const range = parseByteRange(request.headers.range, size);
  if (request.headers.range && !range) {
    response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
    response.end();
    return;
  }
  if (range) {
    response.writeHead(206, {
      ...headers,
      'Content-Length': range.end - range.start + 1,
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath, range).pipe(response);
    return;
  }
  response.writeHead(200, { ...headers, 'Content-Length': size });
  if (request.method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
}

function serveFrontend(request, response, path, browserDir) {
  if (!existsSync(browserDir)) throw new ApiError(404, 'NOT_FOUND', 'No existe ese recurso.');
  const relative = path === '/' ? 'index.html' : normalize(path).replace(/^[/\\]+/, '');
  let filePath = resolve(browserDir, relative);
  if (!filePath.startsWith(resolve(browserDir)) || !existsSync(filePath)) {
    filePath = join(browserDir, 'index.html');
  }
  const size = statSync(filePath).size;
  const headers = {
    ...BASE_SECURITY_HEADERS,
    'Content-Type': mimeFromExtension(extname(filePath)),
    'Cache-Control': frontendCacheControl(filePath),
    'Accept-Ranges': 'bytes',
  };
  const compression = request.headers.range
    ? null
    : frontendCompression(request.headers['accept-encoding'], filePath, size);
  if (compression) {
    headers['Content-Encoding'] = compression;
    headers.Vary = 'Accept-Encoding';
  }
  const range = parseByteRange(request.headers.range, size);
  if (request.headers.range && !range) {
    response.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
    response.end();
    return;
  }
  if (range) {
    const contentLength = range.end - range.start + 1;
    response.writeHead(206, {
      ...headers,
      'Content-Length': contentLength,
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filePath, range).pipe(response);
    return;
  }
  response.writeHead(200, compression ? headers : { ...headers, 'Content-Length': size });
  if (request.method === 'HEAD') response.end();
  else if (compression === 'br') {
    createReadStream(filePath)
      .pipe(
        createBrotliCompress({
          params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
        }),
      )
      .pipe(response);
  } else if (compression === 'gzip') {
    createReadStream(filePath)
      .pipe(createGzip({ level: 6 }))
      .pipe(response);
  } else {
    createReadStream(filePath).pipe(response);
  }
}

function frontendCompression(acceptEncoding, filePath, size) {
  if (size < 1024 || !/\.(?:css|html|js|json|svg|txt)$/i.test(filePath)) return null;
  const accepted = String(acceptEncoding ?? '')
    .toLowerCase()
    .split(',')
    .map((entry) => {
      const [name, ...parameters] = entry.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
      return { name, quality: Number.isFinite(quality) ? quality : 0 };
    });
  const wildcardQuality = accepted.find((entry) => entry.name === '*')?.quality ?? 0;
  const quality = (name) =>
    accepted.find((entry) => entry.name === name)?.quality ?? wildcardQuality;
  const brotliQuality = quality('br');
  const gzipQuality = quality('gzip');
  if (brotliQuality > 0 && brotliQuality >= gzipQuality) return 'br';
  if (gzipQuality > 0) return 'gzip';
  return null;
}

function parseByteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

function frontendCacheControl(filePath) {
  const fileName = filePath.split(/[\\/]/).pop() ?? '';
  if (fileName === 'index.html') return 'no-cache';
  if (/-(?:[A-Z0-9]{8})\.(?:css|js)$/i.test(fileName)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=86400';
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    ...BASE_SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': status >= 400 ? 'no-store' : 'private, no-cache',
  });
  response.end(body);
}

function sendEmpty(response, status) {
  response.writeHead(status, { ...BASE_SECURITY_HEADERS, 'Cache-Control': 'no-store' });
  response.end();
}

function sendError(response, error) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  if (error instanceof ApiError) {
    return sendJson(response, error.status, {
      error: { code: error.code, message: error.message, fields: error.fields },
    });
  }
  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.errcode === 2067) {
    return sendJson(response, 409, {
      error: {
        code: 'DUPLICATE',
        message: 'Ya existe un registro con ese slug, correo o ID externo.',
      },
    });
  }
  console.error(error);
  return sendJson(response, 500, {
    error: { code: 'INTERNAL_ERROR', message: 'Se ha producido un error interno.' },
  });
}

function adminFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.is_owner === 1 ? 'owner' : 'admin',
    mfaEnabled: row.totp_enabled === 1,
    emailVerified: Boolean(row.email_verified_at),
  };
}

function correctionFromRow(row) {
  return {
    id: row.id,
    reason: row.reason,
    note: row.note,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

function publicMember(member) {
  if (!member) return null;
  const { photoConsentConfirmed: _consent, updatedByName: _updatedBy, ...publicFields } = member;
  return publicFields;
}

function publicSponsor(sponsor) {
  if (!sponsor) return null;
  const {
    updatedByName: _updatedBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...publicFields
  } = sponsor;
  return publicFields;
}

function publicChampionship(championship) {
  if (!championship) return null;
  const { updatedByName: _updatedBy, ...publicFields } = championship;
  return publicFields;
}

function publicSettings(settings) {
  const { updatedByName: _updatedBy, ...publicFields } = settings;
  return publicFields;
}

function numberValues(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value ?? 0)]));
}

function mimeFromExtension(extension) {
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.woff2': 'font/woff2',
      '.otf': 'font/otf',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    }[extension.toLowerCase()] ?? 'application/octet-stream'
  );
}
