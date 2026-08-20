import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createCandemorApp } from './app.mjs';
import { runSetupCleanup } from './setups.mjs';
import { generateTotpSecret, hashPassword, totpCode } from './security.mjs';

test('gestiona acceso, permisos, versiones privadas, descargas y caducidad de setups', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'candemor-setups-'));
  const browserDir = join(temporaryRoot, 'browser');
  const setupDir = join(temporaryRoot, 'data', 'setups');
  await mkdir(browserDir, { recursive: true });
  await writeFile(join(browserDir, 'index.html'), '<!doctype html><app-root></app-root>');
  const app = createCandemorApp({
    rootDir: temporaryRoot,
    databasePath: join(temporaryRoot, 'data', 'test.db'),
    uploadDir: join(temporaryRoot, 'data', 'uploads'),
    setupDir,
    browserDir,
    secureCookies: false,
  });
  await listen(app.server);
  const address = app.server.address();
  assert(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const ownerSetup = await jsonRequest(baseUrl, '/api/admin/setup', {
      method: 'POST',
      body: {
        email: 'owner@candemor.test',
        displayName: 'Owner Candemor',
        password: 'password-owner-123',
      },
    });
    assert.equal(ownerSetup.status, 201);
    const ownerCookie = sessionCookieFrom(ownerSetup.response);
    const ownerCsrf = ownerSetup.data.csrfToken;
    const ownerBeforeMfa = await jsonRequest(baseUrl, '/api/setup-access/session', {
      cookie: ownerCookie,
    });
    assert.equal(ownerBeforeMfa.status, 200);
    assert.equal(ownerBeforeMfa.data.authenticated, false);
    const blockedOwnerManagement = await jsonRequest(baseUrl, '/api/setup-access/users', {
      cookie: ownerCookie,
    });
    assert.equal(blockedOwnerManagement.status, 403);
    assert.equal(blockedOwnerManagement.data.error.code, 'MFA_SETUP_REQUIRED');
    const ownerMfa = await jsonRequest(baseUrl, '/api/admin/mfa/setup', {
      method: 'POST',
      cookie: ownerCookie,
      csrf: ownerCsrf,
      body: {},
    });
    assert.equal(ownerMfa.status, 200);
    const ownerMfaConfirm = await jsonRequest(baseUrl, '/api/admin/mfa/confirm', {
      method: 'POST',
      cookie: ownerCookie,
      csrf: ownerCsrf,
      body: { code: totpCode(ownerMfa.data.secret) },
    });
    assert.equal(ownerMfaConfirm.status, 200);
    const ownerManagement = await jsonRequest(baseUrl, '/api/setup-access/users', {
      cookie: ownerCookie,
    });
    assert.equal(ownerManagement.status, 200);

    const adminId = 'setup-admin';
    const adminSecret = generateTotpSecret();
    const timestamp = new Date().toISOString();
    app.db
      .prepare(
        `INSERT INTO admin_profiles
         (id, email, display_name, password_hash, role, is_owner, active, totp_secret,
          totp_enabled, email_verified_at, account_type, can_access_setups, can_upload_setups,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, 'admin', 0, 1, ?, 1, ?, 'administrator', 1, 1, ?, ?)`,
      )
      .run(
        adminId,
        'admin-setups@candemor.test',
        'Admin Setups',
        await hashPassword('password-admin-123'),
        adminSecret,
        timestamp,
        timestamp,
        timestamp,
      );
    const adminLogin = await jsonRequest(baseUrl, '/api/setup-access/login', {
      method: 'POST',
      body: {
        email: 'admin-setups@candemor.test',
        password: 'password-admin-123',
        mfaCode: totpCode(adminSecret),
      },
    });
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.data.account.role, 'admin');
    const adminCookie = sessionCookieFrom(adminLogin.response);
    const adminCsrf = adminLogin.data.csrfToken;

    const accessRequest = await jsonRequest(baseUrl, '/api/setup-access/requests', {
      method: 'POST',
      body: { displayName: 'Piloto Invitado', email: 'piloto@candemor.test' },
    });
    assert.equal(accessRequest.status, 202);
    const accessManagement = await jsonRequest(baseUrl, '/api/setup-access/users', {
      cookie: adminCookie,
    });
    assert.equal(accessManagement.status, 200);
    assert.equal(accessManagement.data.requests.length, 1);
    assert.equal(
      accessManagement.data.users.some((user) => user.role === 'owner'),
      true,
    );
    assert.equal(
      accessManagement.data.users.some((user) => user.role === 'admin'),
      true,
    );

    const approval = await jsonRequest(
      baseUrl,
      `/api/setup-access/requests/${accessManagement.data.requests[0].id}/approve`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(approval.status, 201);
    assert.match(approval.data.invitation.path, /^\/setups\/aceptar-invitacion\?token=/);
    const invitationToken = new URL(approval.data.invitation.path, baseUrl).searchParams.get(
      'token',
    );
    const verified = await jsonRequest(
      baseUrl,
      `/api/setup-access/invitations/verify?token=${encodeURIComponent(invitationToken)}`,
    );
    assert.equal(verified.status, 200);
    assert.equal(verified.data.invitation.email, 'piloto@candemor.test');

    const accepted = await jsonRequest(baseUrl, '/api/setup-access/invitations/accept', {
      method: 'POST',
      body: { token: invitationToken, password: 'password-piloto-123' },
    });
    assert.equal(accepted.status, 201);
    assert.equal(accepted.data.account.role, 'user');
    assert.equal(accepted.data.account.canUploadSetups, false);
    const userCookie = sessionCookieFrom(accepted.response);
    const userCsrf = accepted.data.csrfToken;

    const blockedAdmin = await jsonRequest(baseUrl, '/api/admin/dashboard', {
      cookie: userCookie,
    });
    assert.equal(blockedAdmin.status, 403);
    assert.equal(blockedAdmin.data.error.code, 'FORBIDDEN');
    const blockedCreate = await jsonRequest(baseUrl, '/api/setups', {
      method: 'POST',
      cookie: userCookie,
      csrf: userCsrf,
      body: setupInput('Setup bloqueado'),
    });
    assert.equal(blockedCreate.status, 403);
    assert.equal(blockedCreate.data.error.code, 'SETUP_UPLOAD_REQUIRED');

    const created = await jsonRequest(baseUrl, '/api/setups', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: setupInput('Mazda MX-5 · Spa'),
    });
    assert.equal(created.status, 201);
    const setupId = created.data.setup.id;
    const setupBytes = Buffer.from('[SPRINGS]\nfront=4\nrear=6\n');
    const uploaded = await binaryRequest(
      baseUrl,
      `/api/setups/${setupId}/files?fileName=mazda-spa.sto&notes=Versi%C3%B3n+estable&retentionDays=90`,
      {
        cookie: adminCookie,
        csrf: adminCsrf,
        contentType: 'application/octet-stream',
        body: setupBytes,
      },
    );
    assert.equal(uploaded.status, 201);
    assert.equal(uploaded.data.file.retentionDays, 90);
    assert.equal(existsSync(join(setupDir, setupId, `${uploaded.data.file.id}.sto`)), true);

    const updated = await jsonRequest(baseUrl, `/api/setups/${setupId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        ...setupInput('Mazda MX-5 · Spa actualizado'),
        description: 'Ajustado después de probar la primera versión.',
        updatedAt: uploaded.data.setup.updatedAt,
      },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.setup.title, 'Mazda MX-5 · Spa actualizado');

    const published = await jsonRequest(baseUrl, `/api/setups/${setupId}/publish`, {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {},
    });
    assert.equal(published.status, 200);
    assert.equal(published.data.setup.status, 'published');

    const archived = await jsonRequest(baseUrl, `/api/setups/${setupId}/archive`, {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {},
    });
    assert.equal(archived.status, 200);
    assert.equal(archived.data.setup.status, 'archived');
    const republished = await jsonRequest(baseUrl, `/api/setups/${setupId}/publish`, {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {},
    });
    assert.equal(republished.status, 200);

    const anonymousCatalog = await jsonRequest(baseUrl, '/api/setups');
    assert.equal(anonymousCatalog.status, 401);

    const userCatalog = await jsonRequest(baseUrl, '/api/setups', { cookie: userCookie });
    assert.equal(userCatalog.status, 200);
    assert.equal(userCatalog.data.setups.length, 1);
    assert.equal(userCatalog.data.setups[0].title, 'Mazda MX-5 · Spa actualizado');
    const downloaded = await rawRequest(
      baseUrl,
      `/api/setups/${setupId}/files/${uploaded.data.file.id}/download`,
      { cookie: userCookie },
    );
    assert.equal(downloaded.status, 200);
    assert.deepEqual(downloaded.body, setupBytes);
    assert.match(downloaded.response.headers.get('content-disposition'), /mazda-spa\.sto/);
    const anonymousDownload = await jsonRequest(
      baseUrl,
      `/api/setups/${setupId}/files/${uploaded.data.file.id}/download`,
    );
    assert.equal(anonymousDownload.status, 401);

    const managedUser = (
      await jsonRequest(baseUrl, '/api/setup-access/users', { cookie: adminCookie })
    ).data.users.find((user) => user.email === 'piloto@candemor.test');
    const contributor = await jsonRequest(baseUrl, `/api/setup-access/users/${managedUser.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: { canAccessSetups: true, canUploadSetups: true },
    });
    assert.equal(contributor.status, 200);
    assert.equal(contributor.data.user.canUploadSetups, true);

    const refreshedUserSession = await jsonRequest(baseUrl, '/api/setup-access/session', {
      cookie: userCookie,
    });
    assert.equal(refreshedUserSession.data.account.canUploadSetups, true);
    const contributorDraft = await jsonRequest(baseUrl, '/api/setups', {
      method: 'POST',
      cookie: userCookie,
      csrf: userCsrf,
      body: setupInput('Borrador del piloto'),
    });
    assert.equal(contributorDraft.status, 201);
    const contributorUpload = await binaryRequest(
      baseUrl,
      `/api/setups/${contributorDraft.data.setup.id}/files?fileName=pilot.sto&retentionDays=365`,
      { cookie: userCookie, csrf: userCsrf, body: Buffer.from('pilot setup') },
    );
    assert.equal(contributorUpload.status, 201);
    assert.equal(contributorUpload.data.file.retentionDays, null);
    const contributorPublish = await jsonRequest(
      baseUrl,
      `/api/setups/${contributorDraft.data.setup.id}/publish`,
      { method: 'POST', cookie: userCookie, csrf: userCsrf, body: {} },
    );
    assert.equal(contributorPublish.status, 403);

    const deletedContributorFile = await jsonRequest(
      baseUrl,
      `/api/setups/${contributorDraft.data.setup.id}/files/${contributorUpload.data.file.id}`,
      { method: 'DELETE', cookie: adminCookie, csrf: adminCsrf },
    );
    assert.equal(deletedContributorFile.status, 204);
    const deletedContributorSetup = await jsonRequest(
      baseUrl,
      `/api/setups/${contributorDraft.data.setup.id}`,
      { method: 'DELETE', cookie: adminCookie, csrf: adminCsrf },
    );
    assert.equal(deletedContributorSetup.status, 204);

    const filePath = join(setupDir, setupId, `${uploaded.data.file.id}.sto`);
    app.db
      .prepare('UPDATE setup_files SET expires_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 60_000).toISOString(), uploaded.data.file.id);
    const expiredDownload = await jsonRequest(
      baseUrl,
      `/api/setups/${setupId}/files/${uploaded.data.file.id}/download`,
      { cookie: userCookie },
    );
    assert.equal(expiredDownload.status, 410);
    assert.equal(await runSetupCleanup(app.db, setupDir), 1);
    assert.equal(existsSync(filePath), false);
    assert.equal(
      app.db.prepare('SELECT status FROM setups WHERE id = ?').get(setupId).status,
      'expired',
    );

    const revoked = await jsonRequest(baseUrl, `/api/setup-access/users/${managedUser.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: { canAccessSetups: false, canUploadSetups: false },
    });
    assert.equal(revoked.status, 200);
    const revokedSession = await jsonRequest(baseUrl, '/api/setup-access/session', {
      cookie: userCookie,
    });
    assert.equal(revokedSession.data.authenticated, false);
    const managementAfterRevoke = await jsonRequest(baseUrl, '/api/setup-access/users', {
      cookie: adminCookie,
    });
    assert.equal(
      managementAfterRevoke.data.users.some(
        (user) => user.email === 'piloto@candemor.test' && !user.canAccessSetups,
      ),
      true,
    );
  } finally {
    await app.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

function setupInput(title) {
  return {
    title,
    simulator: 'iRacing',
    car: 'Mazda MX-5',
    track: 'Spa-Francorchamps',
    configuration: 'Grand Prix',
    sessionType: 'race',
    description: 'Setup estable para carrera.',
    tags: ['baseline', 'race'],
  };
}

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
}

async function jsonRequest(baseUrl, path, options = {}) {
  const headers = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { response, status: response.status, data: text ? JSON.parse(text) : null };
}

async function binaryRequest(baseUrl, path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': options.contentType ?? 'application/octet-stream',
  };
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: options.body,
  });
  const text = await response.text();
  return { response, status: response.status, data: text ? JSON.parse(text) : null };
}

async function rawRequest(baseUrl, path, options = {}) {
  const headers = {};
  if (options.cookie) headers.Cookie = options.cookie;
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return { response, status: response.status, body: Buffer.from(await response.arrayBuffer()) };
}

function sessionCookieFrom(response) {
  const cookie = response.headers.get('set-cookie');
  assert(cookie);
  return cookie.split(';', 1)[0];
}
