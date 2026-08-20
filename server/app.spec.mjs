import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createCandemorApp } from './app.mjs';
import { openDatabase } from './database.mjs';
import { totpCode } from './security.mjs';

test('las migraciones respetan los cambios editoriales al volver a abrir la base de datos', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'candemor-migrations-'));
  const databasePath = join(temporaryRoot, 'data', 'test.db');
  const timestamp = new Date().toISOString();
  try {
    const db = openDatabase(databasePath);
    db.prepare(
      `UPDATE championships
       SET external_tournament_id = NULL, name = 'New Era editado por administración'
       WHERE slug = 'candeonato-new-era'`,
    ).run();
    db.prepare(
      `INSERT INTO championships
       (id, external_tournament_id, slug, name, status, created_at, updated_at)
       VALUES ('draft-42', 42, 'candeonato-bandido', 'Candeonato Bandido', 'draft', ?, ?)`,
    ).run(timestamp, timestamp);
    db.close();

    const reopened = openDatabase(databasePath);
    const edited = reopened
      .prepare(`SELECT name, external_tournament_id FROM championships WHERE slug = ?`)
      .get('candeonato-new-era');
    assert.equal(edited.name, 'New Era editado por administración');
    assert.equal(edited.external_tournament_id, null);
    assert.equal(
      reopened.prepare('SELECT name FROM championships WHERE external_tournament_id = 42').get()
        .name,
      'Candeonato Bandido',
    );
    reopened.close();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('las migraciones conservan activas varias cuentas después de reiniciar', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'candemor-multi-admin-migrations-'));
  const databasePath = join(temporaryRoot, 'data', 'test.db');
  const timestamp = new Date().toISOString();
  try {
    const db = openDatabase(databasePath);
    const insert = db.prepare(
      `INSERT INTO admin_profiles
       (id, email, display_name, password_hash, role, is_owner, active, email_verified_at,
        created_at, updated_at)
       VALUES (?, ?, ?, 'scrypt:test:test', 'admin', ?, 1, ?, ?, ?)`,
    );
    insert.run('owner', 'owner@candemor.test', 'Propietario', 1, timestamp, timestamp, timestamp);
    insert.run(
      'admin',
      'admin@candemor.test',
      'Administración',
      0,
      timestamp,
      timestamp,
      timestamp,
    );
    db.close();

    const reopened = openDatabase(databasePath);
    assert.equal(
      reopened.prepare('SELECT COUNT(*) AS count FROM admin_profiles WHERE active = 1').get().count,
      2,
    );
    assert.equal(
      reopened
        .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = ?")
        .get('admin_one_active').count,
      0,
    );
    reopened.close();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('administra contenidos y cuentas con propietario, invitación y TOTP independiente', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'candemor-admin-'));
  const sportsServer = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        torneo: { id: 42, nombre: 'Candeonato Bandido' },
        rondas: [],
        pPd: [],
      }),
    );
  });
  await listen(sportsServer);
  const sportsAddress = sportsServer.address();
  assert(sportsAddress && typeof sportsAddress !== 'string');
  process.env.FATCAT_API_BASE_URL = `http://127.0.0.1:${sportsAddress.port}`;

  const browserDir = join(temporaryRoot, 'browser');
  await mkdir(browserDir, { recursive: true });
  await writeFile(join(browserDir, 'index.html'), '<!doctype html><title>Candemor</title>');
  await writeFile(join(browserDir, 'robots.txt'), 'User-agent: *\nDisallow: /admin/\n');
  const javascript = 'console.log("Candemor");'.repeat(100);
  await writeFile(join(browserDir, 'main-ABCDEFGH.js'), javascript);
  await writeFile(join(browserDir, 'sample.mp4'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
  let receivedTwitchChannels = [];

  const app = createCandemorApp({
    rootDir: temporaryRoot,
    databasePath: join(temporaryRoot, 'data', 'test.db'),
    uploadDir: join(temporaryRoot, 'uploads'),
    browserDir,
    secureCookies: false,
    twitchStatusService: {
      isConfigured: () => true,
      getBestStatus: async ({ channels }) => {
        receivedTwitchChannels = channels;
        return {
          live: true,
          channelName: channels[0].login,
          channelUrl: channels[0].url,
          title: 'Candeonato en directo',
          category: 'iRacing',
          viewers: 42,
        };
      },
      getStatus: async ({ channelLogin, channelUrl }) => ({
        live: true,
        channelName: channelLogin,
        channelUrl,
        title: 'Candeonato en directo',
        category: 'iRacing',
        viewers: 42,
      }),
      getChannelContent: async ({ channelLogin, channelUrl }) => ({
        channel: {
          id: '1234',
          login: channelLogin,
          displayName: 'CandemorRacingTeam',
          description: 'Simracing y comunidad',
          profileImageUrl: 'https://static-cdn.jtvnw.net/profile.png',
          offlineImageUrl: 'https://static-cdn.jtvnw.net/offline.jpg',
          url: channelUrl,
        },
        clips: [
          {
            id: 'clip-id',
            url: 'https://clips.twitch.tv/clip-id',
            embedUrl: 'https://clips.twitch.tv/embed?clip=clip-id',
            title: 'Final del Candeonato',
            creatorName: 'CandemorFan',
            thumbnailUrl: 'https://clips-media-assets2.twitch.tv/preview.jpg',
            viewCount: 120,
            createdAt: '2026-08-01T20:00:00Z',
            durationSeconds: 28.4,
          },
        ],
        fetchedAt: '2026-08-11T12:00:00.000Z',
      }),
    },
    roundResultsService: {
      getResults: async (sessionId) => ({
        sessionId,
        results: [
          {
            position: 1,
            driverName: 'Andrea Real',
            team: 'Candemor',
            laps: 7,
            totalTime: '00:15:06.58',
            averageLap: '02:09.51',
            incidents: 1,
          },
        ],
        sourceUrl: `https://fatcatrace.xyz/ronda/${sessionId}`,
        fetchedAt: '2026-08-11T12:00:00.000Z',
      }),
    },
    standingsService: {
      getStandings: async () => [
        {
          position: 1,
          driverName: 'Pablo Cabrera',
          team: 'Candemor',
          rounds: 6,
          laps: 54,
          wins: 1,
          podiums: 4,
          topFive: 5,
          incidents: 33,
          points: 165,
        },
      ],
    },
    googleFormsService: {
      getSchema: async (url) => ({
        title: 'Inscripción de prueba',
        description: 'Formulario dinámico',
        viewUrl: url,
        supported: true,
        fields: [
          {
            id: '123456',
            kind: 'text',
            label: 'Nombre de piloto',
            description: '',
            required: true,
            options: [],
          },
        ],
      }),
      submit: async ({ answers }) => ({ ok: answers['123456'] === 'Andrea Real' }),
    },
  });
  await listen(app.server);
  const address = app.server.address();
  assert(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('cache-control'), 'no-cache');

    const robots = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robots.status, 200);
    assert.equal(robots.headers.get('content-type'), 'text/plain; charset=utf-8');

    const hashedAsset = await fetch(`${baseUrl}/main-ABCDEFGH.js`);
    assert.equal(hashedAsset.status, 200);
    assert.match(hashedAsset.headers.get('cache-control'), /immutable/);

    const compressedAsset = await fetch(`${baseUrl}/main-ABCDEFGH.js`, {
      headers: { 'Accept-Encoding': 'br, gzip' },
    });
    assert.equal(compressedAsset.status, 200);
    assert.equal(compressedAsset.headers.get('content-encoding'), 'br');
    assert.equal(compressedAsset.headers.get('vary'), 'Accept-Encoding');
    assert.equal(await compressedAsset.text(), javascript);

    const videoRange = await fetch(`${baseUrl}/sample.mp4`, {
      headers: { Range: 'bytes=2-5' },
    });
    assert.equal(videoRange.status, 206);
    assert.equal(videoRange.headers.get('content-encoding'), null);
    assert.equal(videoRange.headers.get('content-range'), 'bytes 2-5/8');
    assert.deepEqual(new Uint8Array(await videoRange.arrayBuffer()), new Uint8Array([2, 3, 4, 5]));

    const streamStatus = await jsonRequest(baseUrl, '/api/public/stream-status');
    assert.equal(streamStatus.status, 200);
    assert.equal(streamStatus.data.live, true);
    assert.equal(streamStatus.data.viewers, 42);

    const twitchContent = await jsonRequest(baseUrl, '/api/public/twitch-content');
    assert.equal(twitchContent.status, 200);
    assert.equal(twitchContent.data.channel.displayName, 'CandemorRacingTeam');
    assert.equal(twitchContent.data.clips[0].title, 'Final del Candeonato');

    const publicChampionships = await jsonRequest(baseUrl, '/api/public/championships');
    assert.equal(publicChampionships.status, 200);
    assert.deepEqual(
      new Set(
        publicChampionships.data.championships.map(
          (championship) => championship.externalTournamentId,
        ),
      ),
      new Set([46, 42, 38, 36, 35, 34]),
    );
    const publicNewEra = publicChampionships.data.championships.find(
      (championship) => championship.externalTournamentId === 42,
    );
    assert.equal(publicNewEra.status, 'finished');
    assert.equal(publicNewEra.name, 'Candeonato New Era');
    assert.equal(publicNewEra.subtitle, 'New Era Edition');
    assert.equal(publicNewEra.backgroundVideoUrl, '/media/hero-optimized.mp4');

    const roundResults = await jsonRequest(baseUrl, '/api/public/rounds/82043333/results');
    assert.equal(roundResults.status, 200);
    assert.equal(roundResults.data.results[0].driverName, 'Andrea Real');

    const invalidPublicRoute = await jsonRequest(
      baseUrl,
      '/api/public/rounds/not-a-number/results',
    );
    assert.equal(invalidPublicRoute.status, 404);
    assert.equal(invalidPublicRoute.data.error.code, 'NOT_FOUND');

    const googleFormUrl = 'https://forms.gle/example';
    const googleFormSchema = await jsonRequest(
      baseUrl,
      `/api/public/google-form?url=${encodeURIComponent(googleFormUrl)}`,
    );
    assert.equal(googleFormSchema.status, 200);
    assert.equal(googleFormSchema.data.title, 'Inscripción de prueba');
    assert.equal(googleFormSchema.data.fields[0].id, '123456');
    const googleFormSubmission = await jsonRequest(baseUrl, '/api/public/google-form-submit', {
      method: 'POST',
      body: { url: googleFormUrl, answers: { 123456: 'Andrea Real' } },
    });
    assert.equal(googleFormSubmission.status, 200);
    assert.equal(googleFormSubmission.data.ok, true);

    const initialSession = await jsonRequest(baseUrl, '/api/admin/session');
    assert.equal(initialSession.status, 200);
    assert.equal(initialSession.data.needsSetup, true);

    const setup = await jsonRequest(baseUrl, '/api/admin/setup', {
      method: 'POST',
      body: {
        email: 'admin@candemor.test',
        displayName: 'Administración Candemor',
        password: 'password-segura-123',
      },
    });
    assert.equal(setup.status, 201);
    assert.equal(setup.data.admin.role, 'owner');
    const adminCookie = sessionCookieFrom(setup.response);
    const adminCsrf = setup.data.csrfToken;

    const initialOwnerMfaSetup = await jsonRequest(baseUrl, '/api/admin/mfa/setup', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {},
    });
    assert.equal(initialOwnerMfaSetup.status, 200);
    assert.match(initialOwnerMfaSetup.data.qrCodeDataUrl, /^data:image\/png;base64,/);
    const initialOwnerMfaConfirm = await jsonRequest(baseUrl, '/api/admin/mfa/confirm', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: { code: totpCode(initialOwnerMfaSetup.data.secret) },
    });
    assert.equal(initialOwnerMfaConfirm.status, 200);

    const initialSettings = await jsonRequest(baseUrl, '/api/admin/settings', {
      cookie: adminCookie,
    });
    assert.equal(initialSettings.data.settings.twitchChannels.length, 1);
    assert.equal(initialSettings.data.settings.discordUrl, 'https://discord.gg/j22XuDEfMk');
    const updatedSettings = await jsonRequest(baseUrl, '/api/admin/settings', {
      method: 'PATCH',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        ...initialSettings.data.settings,
        twitchChannels: [
          ...initialSettings.data.settings.twitchChannels,
          {
            login: 'piloto_candemor',
            url: 'https://www.twitch.tv/piloto_candemor',
            isOfficial: false,
            priority: 1,
          },
        ],
      },
    });
    assert.equal(updatedSettings.status, 200);
    assert.deepEqual(
      updatedSettings.data.settings.twitchChannels.map((channel) => channel.login),
      ['candemorracingteam', 'piloto_candemor'],
    );
    await jsonRequest(baseUrl, '/api/public/stream-status');
    assert.deepEqual(
      receivedTwitchChannels.map((channel) => channel.login),
      ['candemorracingteam', 'piloto_candemor'],
    );

    const rejectedWithoutCsrf = await jsonRequest(baseUrl, '/api/admin/members', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: 'Sin CSRF' },
    });
    assert.equal(rejectedWithoutCsrf.status, 403);

    const created = await jsonRequest(baseUrl, '/api/admin/members', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        name: 'Andrea Real',
        slug: 'andrea-real',
        roleLabel: 'Piloto',
        bio: 'Miembro real del equipo.',
        displayOrder: 6,
        isFeatured: true,
        status: 'draft',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.member.status, 'draft');

    const rejectedPublish = await jsonRequest(
      baseUrl,
      `/api/admin/members/${created.data.member.id}/publish`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(rejectedPublish.status, 422);
    assert.equal(rejectedPublish.data.error.fields.photoUrl.length > 0, true);

    const updated = await jsonRequest(baseUrl, `/api/admin/members/${created.data.member.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        ...created.data.member,
        photoUrl: '/media/team/member-alex.webp',
        photoAlt: 'Andrea en el paddock del equipo',
        photoConsentConfirmed: false,
        twitchUrl: 'https://www.twitch.tv/candemorracingteam',
        discordUrl: 'https://discord.gg/j22XuDEfMk',
        websiteUrl: 'https://example.com/andrea',
      },
    });
    assert.equal(updated.status, 200);

    const rejectedWithoutConsent = await jsonRequest(
      baseUrl,
      `/api/admin/members/${created.data.member.id}/publish`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(rejectedWithoutConsent.status, 422);
    assert.match(rejectedWithoutConsent.data.error.fields.photoConsentConfirmed, /publicar/i);

    const consented = await jsonRequest(baseUrl, `/api/admin/members/${created.data.member.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: { ...updated.data.member, photoConsentConfirmed: true },
    });
    assert.equal(consented.status, 200);

    const published = await jsonRequest(
      baseUrl,
      `/api/admin/members/${created.data.member.id}/publish`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(published.status, 200);
    assert.equal(published.data.member.status, 'published');
    assert.equal(published.data.member.photoConsentConfirmed, true);
    assert.equal(published.data.member.updatedByName, 'Administración Candemor');

    const publicMembers = await jsonRequest(baseUrl, '/api/public/members?featured=true');
    assert.equal(publicMembers.status, 200);
    assert.equal(
      publicMembers.data.members.some((member) => member.name === 'Andrea Real'),
      true,
    );
    const publicAndrea = publicMembers.data.members.find((member) => member.name === 'Andrea Real');
    assert.equal(publicAndrea.discordUrl, 'https://discord.gg/j22XuDEfMk');
    assert.equal(publicAndrea.websiteUrl, 'https://example.com/andrea');
    assert.equal('photoConsentConfirmed' in publicAndrea, false);
    assert.equal('updatedByName' in publicAndrea, false);

    const sponsorDraft = await jsonRequest(baseUrl, '/api/admin/sponsors', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        name: 'Partner Racing',
        description: 'Colaborador técnico de la comunidad.',
        websiteUrl: 'https://example.com',
        displayOrder: 1,
        status: 'draft',
      },
    });
    assert.equal(sponsorDraft.status, 201);
    assert.equal(sponsorDraft.data.sponsor.status, 'draft');

    const rejectedSponsorPublish = await jsonRequest(
      baseUrl,
      `/api/admin/sponsors/${sponsorDraft.data.sponsor.id}/publish`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(rejectedSponsorPublish.status, 422);
    assert.match(rejectedSponsorPublish.data.error.fields.logoUrl, /logotipo/i);

    const completedSponsor = await jsonRequest(
      baseUrl,
      `/api/admin/sponsors/${sponsorDraft.data.sponsor.id}`,
      {
        method: 'PATCH',
        cookie: adminCookie,
        csrf: adminCsrf,
        body: {
          ...sponsorDraft.data.sponsor,
          logoUrl: '/media/hero-poster.webp',
          logoAlt: 'Logotipo de Partner Racing',
        },
      },
    );
    assert.equal(completedSponsor.status, 200);

    const publishedSponsor = await jsonRequest(
      baseUrl,
      `/api/admin/sponsors/${sponsorDraft.data.sponsor.id}/publish`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(publishedSponsor.status, 200);
    const publicSponsors = await jsonRequest(baseUrl, '/api/public/sponsors');
    assert.equal(publicSponsors.status, 200);
    assert.equal(publicSponsors.data.sponsors[0].name, 'Partner Racing');
    assert.equal('updatedByName' in publicSponsors.data.sponsors[0], false);

    const championships = await jsonRequest(baseUrl, '/api/admin/championships', {
      cookie: adminCookie,
    });
    const seededChampionship = championships.data.championships[0];
    assert.equal(seededChampionship.status, 'finished');
    assert.equal(seededChampionship.name, 'Candeonato New Era');
    assert.equal(seededChampionship.backgroundVideoMimeType, 'video/mp4');
    assert.match(seededChampionship.descriptionEn, /simracing competition/i);
    assert.match(seededChampionship.coverAltEn, /Mazda MX-5/i);
    const sourceValidation = await jsonRequest(
      baseUrl,
      '/api/admin/championships/validate-source',
      {
        method: 'POST',
        cookie: adminCookie,
        csrf: adminCsrf,
        body: { externalTournamentId: 42 },
      },
    );
    assert.equal(sourceValidation.status, 200);
    assert.equal(sourceValidation.data.tournament.name, 'Candeonato Bandido');

    const duplicateNewEra = await jsonRequest(baseUrl, '/api/admin/championships', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        name: 'Otra copia de New Era',
        slug: 'otra-copia-new-era',
        externalTournamentId: 42,
        coverUrl: '/media/hero-poster.webp',
        coverAlt: 'Portada de la copia',
        status: 'finished',
        isFeatured: true,
        displayOrder: 0,
      },
    });
    assert.equal(duplicateNewEra.status, 409);
    assert.equal(duplicateNewEra.data.error.code, 'DUPLICATE_CHAMPIONSHIP');
    assert.match(duplicateNewEra.data.error.fields.externalTournamentId, /New Era/);

    const nextChampionship = await jsonRequest(baseUrl, '/api/admin/championships', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        name: 'Candeonato siguiente',
        slug: 'candeonato-siguiente',
        summary: 'Edición utilizada para comprobar el cambio de edición actual.',
        summaryEn: 'Edition used to verify the current edition switch.',
        descriptionEn: 'English editorial description for the next Candeonato.',
        coverUrl: '/media/hero-poster.webp',
        coverAlt: 'Portada del Candeonato siguiente',
        coverAltEn: 'Cover art for the next Candeonato',
        status: 'finished',
        isFeatured: true,
        displayOrder: 1,
      },
    });
    assert.equal(nextChampionship.status, 201);
    assert.equal(nextChampionship.data.championship.isFeatured, true);
    assert.equal(
      nextChampionship.data.championship.descriptionEn,
      'English editorial description for the next Candeonato.',
    );
    assert.equal(
      nextChampionship.data.championship.coverAltEn,
      'Cover art for the next Candeonato',
    );
    const settingsWithNextChampionship = await jsonRequest(baseUrl, '/api/public/site-settings');
    assert.equal(
      settingsWithNextChampionship.data.featuredChampionshipId,
      nextChampionship.data.championship.id,
    );
    const archivedNextChampionship = await jsonRequest(
      baseUrl,
      `/api/admin/championships/${nextChampionship.data.championship.id}/archive`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(archivedNextChampionship.status, 200);
    assert.equal(archivedNextChampionship.data.championship.status, 'archived');
    assert.equal(archivedNextChampionship.data.championship.isFeatured, false);

    const championshipsAfterArchive = await jsonRequest(baseUrl, '/api/public/championships');
    assert.equal(
      championshipsAfterArchive.data.championships.some(
        (championship) => championship.id === nextChampionship.data.championship.id,
      ),
      false,
    );
    const archivedPublicDetail = await jsonRequest(
      baseUrl,
      `/api/public/championships/${nextChampionship.data.championship.slug}`,
    );
    assert.equal(archivedPublicDetail.status, 404);
    const settingsAfterArchive = await jsonRequest(baseUrl, '/api/public/site-settings');
    assert.equal(settingsAfterArchive.data.featuredChampionshipId, null);
    assert.equal(settingsAfterArchive.data.featuredChampionship, null);

    const restoredNewEra = await jsonRequest(
      baseUrl,
      `/api/admin/championships/${seededChampionship.id}/feature`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(restoredNewEra.status, 200);
    assert.equal(restoredNewEra.data.championship.isFeatured, true);

    const synced = await jsonRequest(
      baseUrl,
      `/api/admin/championships/${seededChampionship.id}/sync`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(synced.status, 200);
    assert.equal(synced.data.championship.syncStatus, 'success');

    const correction = await jsonRequest(
      baseUrl,
      `/api/admin/championships/${seededChampionship.id}/corrections`,
      {
        method: 'POST',
        cookie: adminCookie,
        csrf: adminCsrf,
        body: {
          reason: 'Incidencia en la ronda final',
          note: 'La organización confirma que el payload se conserva y esta nota aporta contexto.',
        },
      },
    );
    assert.equal(correction.status, 201);
    assert.equal(correction.data.correction.createdByName, 'Administración Candemor');

    const snapshot = await jsonRequest(
      baseUrl,
      `/api/public/championships/${seededChampionship.slug}/sports-data`,
    );
    assert.equal(snapshot.status, 200);
    assert.equal(snapshot.data.data.torneo.id, 42);
    assert.equal(snapshot.data.data.namedStandings[0].driverName, 'Pablo Cabrera');
    assert.equal(snapshot.data.corrections.length, 1);
    assert.equal(snapshot.data.corrections[0].reason, 'Incidencia en la ronda final');

    const smallImage = await readFile(
      new URL('../public/media/team/member-alex.webp', import.meta.url),
    );
    const rejectedSmallImage = await jsonRequest(baseUrl, '/api/admin/media', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        fileName: 'small-member.webp',
        mimeType: 'image/webp',
        kind: 'member',
        dataBase64: smallImage.toString('base64'),
      },
    });
    assert.equal(rejectedSmallImage.status, 422);
    assert.equal(rejectedSmallImage.data.error.code, 'MEDIA_TOO_SMALL');

    const sampleImage = await sharp({
      create: { width: 720, height: 900, channels: 3, background: '#d82bd1' },
    })
      .webp()
      .toBuffer();
    const upload = await jsonRequest(baseUrl, '/api/admin/media', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        fileName: 'member.webp',
        mimeType: 'image/webp',
        kind: 'member',
        altText: 'Retrato procesado de Andrea',
        dataBase64: sampleImage.toString('base64'),
      },
    });
    assert.equal(upload.status, 201);
    const uploadedImage = await fetch(`${baseUrl}${upload.data.asset.publicUrl}`);
    assert.equal(uploadedImage.status, 200);
    assert.equal(uploadedImage.headers.get('content-type'), 'image/webp');
    await uploadedImage.arrayBuffer();
    assert.equal(upload.data.asset.width, 720);
    assert.equal(upload.data.asset.height, 900);

    const sponsorLogo = await sharp({
      create: { width: 800, height: 200, channels: 4, background: '#00000000' },
    })
      .png()
      .toBuffer();
    const sponsorLogoUpload = await jsonRequest(baseUrl, '/api/admin/media', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        fileName: 'partner-logo.png',
        mimeType: 'image/png',
        kind: 'sponsor',
        altText: 'Logotipo de Partner Racing',
        dataBase64: sponsorLogo.toString('base64'),
      },
    });
    assert.equal(sponsorLogoUpload.status, 201);
    assert.equal(sponsorLogoUpload.data.asset.width, 800);
    assert.equal(sponsorLogoUpload.data.asset.height, 200);
    assert.equal(sponsorLogoUpload.data.asset.mobilePublicUrl, null);

    for (const sample of [
      { name: 'vertical-logo.png', width: 100, height: 300 },
      { name: 'square-logo.png', width: 128, height: 128 },
    ]) {
      const image = await sharp({
        create: {
          width: sample.width,
          height: sample.height,
          channels: 4,
          background: '#00000000',
        },
      })
        .png()
        .toBuffer();
      const response = await jsonRequest(baseUrl, '/api/admin/media', {
        method: 'POST',
        cookie: adminCookie,
        csrf: adminCsrf,
        body: {
          fileName: sample.name,
          mimeType: 'image/png',
          kind: 'sponsor',
          altText: 'Logotipo de prueba',
          dataBase64: image.toString('base64'),
        },
      });

      assert.equal(response.status, 201);
      assert.equal(response.data.asset.width, sample.width);
      assert.equal(response.data.asset.height, sample.height);
    }

    const linkedMedia = await jsonRequest(baseUrl, `/api/admin/members/${created.data.member.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        ...published.data.member,
        photoUrl: upload.data.asset.publicUrl,
        photoAlt: 'Retrato procesado de Andrea',
      },
    });
    assert.equal(linkedMedia.status, 200);
    const mediaRecord = app.db
      .prepare('SELECT alt_text, entity_type, entity_id FROM media_assets WHERE id = ?')
      .get(upload.data.asset.id);
    assert.equal(mediaRecord.alt_text, 'Retrato procesado de Andrea');
    assert.equal(mediaRecord.entity_type, 'team_member');
    assert.equal(mediaRecord.entity_id, created.data.member.id);

    const coverImage = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: '#111111' },
    })
      .webp()
      .toBuffer();
    const coverUpload = await jsonRequest(baseUrl, '/api/admin/media', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        fileName: 'cover.webp',
        mimeType: 'image/webp',
        kind: 'championship',
        altText: 'Parrilla del Candeonato',
        dataBase64: coverImage.toString('base64'),
      },
    });
    assert.equal(coverUpload.status, 201);
    assert.match(coverUpload.data.asset.mobilePublicUrl, /-mobile\.webp$/);
    const mobileCover = await fetch(`${baseUrl}${coverUpload.data.asset.mobilePublicUrl}`);
    assert.equal(mobileCover.status, 200);
    await mobileCover.arrayBuffer();
    const coverMediaRecord = app.db
      .prepare('SELECT mobile_public_url, mobile_storage_path FROM media_assets WHERE id = ?')
      .get(coverUpload.data.asset.id);
    assert.equal(coverMediaRecord.mobile_public_url, coverUpload.data.asset.mobilePublicUrl);
    assert.match(coverMediaRecord.mobile_storage_path, /-mobile\.webp$/);

    const verticalPoster = await sharp({
      create: { width: 1080, height: 1350, channels: 3, background: '#ff2bd6' },
    })
      .avif()
      .toBuffer();
    const verticalPosterUpload = await jsonRequest(baseUrl, '/api/admin/media', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {
        fileName: 'vertical-poster.avif',
        mimeType: 'image/avif',
        kind: 'championship',
        altText: 'Cartel vertical del Candeonato',
        dataBase64: verticalPoster.toString('base64'),
      },
    });
    assert.equal(verticalPosterUpload.status, 201);
    assert.equal(verticalPosterUpload.data.asset.mimeType, 'image/webp');
    assert.equal(verticalPosterUpload.data.asset.width, 1080);
    assert.equal(verticalPosterUpload.data.asset.height, 1350);
    assert.match(verticalPosterUpload.data.asset.mobilePublicUrl, /-mobile\.webp$/);
    const verticalPosterMobileResponse = await fetch(
      `${baseUrl}${verticalPosterUpload.data.asset.mobilePublicUrl}`,
    );
    assert.equal(verticalPosterMobileResponse.status, 200);
    const verticalPosterMobileMetadata = await sharp(
      Buffer.from(await verticalPosterMobileResponse.arrayBuffer()),
    ).metadata();
    assert.equal(verticalPosterMobileMetadata.width, 720);
    assert.equal(verticalPosterMobileMetadata.height, 900);

    const sampleVideo = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00,
      0x00,
    ]);
    const videoUpload = await binaryRequest(
      baseUrl,
      '/api/admin/media?fileName=new-era.mp4&kind=championship-video',
      {
        method: 'POST',
        cookie: adminCookie,
        csrf: adminCsrf,
        contentType: 'video/mp4',
        body: sampleVideo,
      },
    );
    assert.equal(videoUpload.status, 201);
    assert.equal(videoUpload.data.asset.mimeType, 'video/mp4');
    const videoRangeUpload = await fetch(`${baseUrl}${videoUpload.data.asset.publicUrl}`, {
      headers: { Range: 'bytes=4-7' },
    });
    assert.equal(videoRangeUpload.status, 206);
    assert.equal(videoRangeUpload.headers.get('content-type'), 'video/mp4');
    assert.equal(videoRangeUpload.headers.get('content-range'), 'bytes 4-7/16');
    assert.equal(Buffer.from(await videoRangeUpload.arrayBuffer()).toString(), 'ftyp');

    const championshipWithVideo = await jsonRequest(
      baseUrl,
      `/api/admin/championships/${seededChampionship.id}`,
      {
        method: 'PATCH',
        cookie: adminCookie,
        csrf: adminCsrf,
        body: {
          ...synced.data.championship,
          backgroundVideoUrl: videoUpload.data.asset.publicUrl,
          backgroundVideoMimeType: 'video/mp4',
        },
      },
    );
    assert.equal(championshipWithVideo.status, 200);
    assert.equal(
      championshipWithVideo.data.championship.backgroundVideoUrl,
      videoUpload.data.asset.publicUrl,
    );
    const videoMediaRecord = app.db
      .prepare('SELECT entity_type, entity_id FROM media_assets WHERE id = ?')
      .get(videoUpload.data.asset.id);
    assert.equal(videoMediaRecord.entity_type, 'championship');
    assert.equal(videoMediaRecord.entity_id, seededChampionship.id);

    const deletedMember = await jsonRequest(
      baseUrl,
      `/api/admin/members/${created.data.member.id}`,
      { method: 'DELETE', cookie: adminCookie, csrf: adminCsrf },
    );
    assert.equal(deletedMember.status, 204);
    const membersAfterDelete = await jsonRequest(baseUrl, '/api/admin/members', {
      cookie: adminCookie,
    });
    assert.equal(
      membersAfterDelete.data.members.some((member) => member.id === created.data.member.id),
      false,
    );

    const accessRequest = await jsonRequest(baseUrl, '/api/admin/access-requests', {
      method: 'POST',
      body: { displayName: 'Segunda Administración', email: 'segunda@candemor.test' },
    });
    assert.equal(accessRequest.status, 202);

    const usersEndpoint = await jsonRequest(baseUrl, '/api/admin/users', { cookie: adminCookie });
    assert.equal(usersEndpoint.status, 200);
    assert.equal(usersEndpoint.data.users[0].role, 'owner');
    assert.equal(usersEndpoint.data.requests[0].status, 'pending');

    const approved = await jsonRequest(
      baseUrl,
      `/api/admin/access-requests/${usersEndpoint.data.requests[0].id}/approve`,
      { method: 'POST', cookie: adminCookie, csrf: adminCsrf, body: {} },
    );
    assert.equal(approved.status, 201);
    const invitationToken = new URL(approved.data.invitation.path, baseUrl).searchParams.get(
      'token',
    );
    assert(invitationToken);
    const verifiedInvitation = await jsonRequest(
      baseUrl,
      `/api/admin/invitations/verify?token=${encodeURIComponent(invitationToken)}`,
    );
    assert.equal(verifiedInvitation.status, 200);
    assert.equal(verifiedInvitation.data.invitation.email, 'segunda@candemor.test');

    const accepted = await jsonRequest(baseUrl, '/api/admin/invitations/accept', {
      method: 'POST',
      body: { token: invitationToken, password: 'password-segunda-cuenta-123' },
    });
    assert.equal(accepted.status, 201);
    assert.equal(accepted.data.admin.role, 'admin');
    const secondCookie = sessionCookieFrom(accepted.response);
    const secondCsrf = accepted.data.csrfToken;
    const blockedSecondAdmin = await jsonRequest(baseUrl, '/api/admin/dashboard', {
      cookie: secondCookie,
    });
    assert.equal(blockedSecondAdmin.status, 403);
    assert.equal(blockedSecondAdmin.data.error.code, 'MFA_SETUP_REQUIRED');

    const secondMfaSetup = await jsonRequest(baseUrl, '/api/admin/mfa/setup', {
      method: 'POST',
      cookie: secondCookie,
      csrf: secondCsrf,
      body: {},
    });
    assert.notEqual(secondMfaSetup.data.secret, initialOwnerMfaSetup.data.secret);
    assert.match(secondMfaSetup.data.qrCodeDataUrl, /^data:image\/png;base64,/);
    const secondMfaConfirm = await jsonRequest(baseUrl, '/api/admin/mfa/confirm', {
      method: 'POST',
      cookie: secondCookie,
      csrf: secondCsrf,
      body: { code: totpCode(secondMfaSetup.data.secret) },
    });
    assert.equal(secondMfaConfirm.status, 200);
    const ownerOnlyEndpoint = await jsonRequest(baseUrl, '/api/admin/users', {
      cookie: secondCookie,
    });
    assert.equal(ownerOnlyEndpoint.status, 403);
    assert.equal(ownerOnlyEndpoint.data.error.code, 'OWNER_REQUIRED');

    const accountsAfterInvitation = await jsonRequest(baseUrl, '/api/admin/users', {
      cookie: adminCookie,
    });
    const secondAccount = accountsAfterInvitation.data.users.find(
      (user) => user.email === 'segunda@candemor.test',
    );
    assert(secondAccount);
    assert.equal(secondAccount.mfaEnabled, true);
    const deactivated = await jsonRequest(baseUrl, `/api/admin/users/${secondAccount.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: { active: false },
    });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.data.user.active, false);
    const revokedSecondSession = await jsonRequest(baseUrl, '/api/admin/dashboard', {
      cookie: secondCookie,
    });
    assert.equal(revokedSecondSession.status, 401);

    const secondSetup = await jsonRequest(baseUrl, '/api/admin/setup', {
      method: 'POST',
      body: {
        email: 'otra-cuenta@candemor.test',
        displayName: 'Otra cuenta',
        password: 'password-otra-cuenta-123',
      },
    });
    assert.equal(secondSetup.status, 409);

    const audit = await jsonRequest(baseUrl, '/api/admin/audit', { cookie: adminCookie });
    assert.equal(audit.status, 200);
    assert.equal(
      audit.data.entries.some((entry) => entry.action === 'championship.synced'),
      true,
    );
    assert.equal(
      audit.data.entries.some((entry) => entry.action === 'member.deleted'),
      true,
    );
    assert.equal(
      audit.data.entries.some((entry) => entry.action === 'sponsor.published'),
      true,
    );

    const mfaSetup = await jsonRequest(baseUrl, '/api/admin/mfa/setup', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {},
    });
    assert.equal(mfaSetup.status, 200);
    assert.match(mfaSetup.data.otpauthUri, /^otpauth:\/\/totp\//);
    assert.match(mfaSetup.data.qrCodeDataUrl, /^data:image\/png;base64,/);

    const mfaConfirm = await jsonRequest(baseUrl, '/api/admin/mfa/confirm', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: { code: totpCode(mfaSetup.data.secret) },
    });
    assert.equal(mfaConfirm.status, 200);
    assert.equal(mfaConfirm.data.recoveryCodes.length, 8);

    const mfaSession = await jsonRequest(baseUrl, '/api/admin/session', {
      cookie: adminCookie,
    });
    assert.equal(mfaSession.data.admin.mfaEnabled, true);

    const rejectedLogout = await jsonRequest(baseUrl, '/api/admin/logout', {
      method: 'POST',
      cookie: adminCookie,
      body: {},
    });
    assert.equal(rejectedLogout.status, 403);

    const logout = await jsonRequest(baseUrl, '/api/admin/logout', {
      method: 'POST',
      cookie: adminCookie,
      csrf: adminCsrf,
      body: {},
    });
    assert.equal(logout.status, 204);

    const loginNeedsMfa = await jsonRequest(baseUrl, '/api/admin/login', {
      method: 'POST',
      body: { email: 'admin@candemor.test', password: 'password-segura-123' },
    });
    assert.equal(loginNeedsMfa.status, 401);
    assert.equal(loginNeedsMfa.data.error.code, 'MFA_REQUIRED');

    const loginWithMfa = await jsonRequest(baseUrl, '/api/admin/login', {
      method: 'POST',
      body: {
        email: 'admin@candemor.test',
        password: 'password-segura-123',
        mfaCode: totpCode(mfaSetup.data.secret),
      },
    });
    assert.equal(loginWithMfa.status, 200);

    const privateAfterLogout = await jsonRequest(baseUrl, '/api/admin/dashboard', {
      cookie: adminCookie,
    });
    assert.equal(privateAfterLogout.status, 401);
  } finally {
    delete process.env.FATCAT_API_BASE_URL;
    await app.close();
    await closeServer(sportsServer);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('exige configurar TOTP al primer administrador en producción', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'candemor-production-'));
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSetupToken = process.env.ADMIN_SETUP_TOKEN;
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_SETUP_TOKEN = 'setup-test-token';
  const app = createCandemorApp({
    rootDir: temporaryRoot,
    databasePath: join(temporaryRoot, 'data', 'test.db'),
    uploadDir: join(temporaryRoot, 'uploads'),
    browserDir: join(temporaryRoot, 'browser'),
    secureCookies: false,
  });
  await listen(app.server);
  const address = app.server.address();
  assert(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const setup = await jsonRequest(baseUrl, '/api/admin/setup', {
      method: 'POST',
      body: {
        email: 'production@candemor.test',
        displayName: 'Administración Producción',
        password: 'password-produccion-123',
        setupToken: 'setup-test-token',
      },
    });
    assert.equal(setup.status, 201);
    const cookie = sessionCookieFrom(setup.response);

    const blockedDashboard = await jsonRequest(baseUrl, '/api/admin/dashboard', { cookie });
    assert.equal(blockedDashboard.status, 403);
    assert.equal(blockedDashboard.data.error.code, 'MFA_SETUP_REQUIRED');

    const allowedMfaSetup = await jsonRequest(baseUrl, '/api/admin/mfa/setup', {
      method: 'POST',
      cookie,
      csrf: setup.data.csrfToken,
      body: {},
    });
    assert.equal(allowedMfaSetup.status, 200);

    const enabledMfa = await jsonRequest(baseUrl, '/api/admin/mfa/confirm', {
      method: 'POST',
      cookie,
      csrf: setup.data.csrfToken,
      body: { code: totpCode(allowedMfaSetup.data.secret) },
    });
    assert.equal(enabledMfa.status, 200);

    const dashboard = await jsonRequest(baseUrl, '/api/admin/dashboard', { cookie });
    assert.equal(dashboard.status, 200);

    const usersEndpoint = await jsonRequest(baseUrl, '/api/admin/users', { cookie });
    assert.equal(usersEndpoint.status, 200);
    assert.equal(usersEndpoint.data.users[0].role, 'owner');
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousSetupToken === undefined) delete process.env.ADMIN_SETUP_TOKEN;
    else process.env.ADMIN_SETUP_TOKEN = previousSetupToken;
    await app.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

function listen(server) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
}

function closeServer(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
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
    method: options.method ?? 'POST',
    headers,
    body: options.body,
  });
  const text = await response.text();
  return { response, status: response.status, data: text ? JSON.parse(text) : null };
}

function sessionCookieFrom(response) {
  const cookie = response.headers.get('set-cookie');
  assert(cookie);
  return cookie.split(';', 1)[0];
}
