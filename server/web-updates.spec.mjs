import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { enqueueWebUpdateEvent, routeWebUpdatesApi } from './web-updates.mjs';

test('crea un único evento al publicar cada tipo de contenido', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'candemor-web-updates-triggers-'));
  const db = openDatabase(join(temporaryRoot, 'test.db'));
  const timestamp = '2026-08-21T10:00:00.000Z';

  try {
    assert.equal(eventCount(db), 0, 'los datos editoriales de sistema no generan avisos');

    db.prepare(
      `INSERT INTO admin_profiles
       (id, email, display_name, password_hash, role, is_owner, active, created_at, updated_at)
       VALUES ('admin-web-updates', 'bot-test@candemor.test', 'Pruebas', 'hash', 'admin', 1, 1, ?, ?)`,
    ).run(timestamp, timestamp);
    db.prepare(
      `INSERT INTO setups
       (id, title, simulator, car, track, status, created_by, created_at, updated_at)
       VALUES ('setup-event', 'Setup de carrera', 'iRacing', 'Mazda MX-5', 'Spa', 'draft',
               'admin-web-updates', ?, ?)`,
    ).run(timestamp, timestamp);
    db.prepare(
      `UPDATE setups SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`,
    ).run(timestamp, timestamp, 'setup-event');

    db.prepare(
      `INSERT INTO skins
       (id, car_name, image_url, image_alt, target_url, status, published_at,
        created_at, updated_at, updated_by_name)
       VALUES ('skin-event', 'Porsche 911', '/media/skin.webp', 'Porsche con skin Candemor',
               'https://example.com/skin', 'published', ?, ?, ?, 'Pruebas')`,
    ).run(timestamp, timestamp, timestamp);

    db.prepare(
      `INSERT INTO championships
       (id, slug, name, status, created_at, updated_at, updated_by_name)
       VALUES ('championship-event', 'candeonato-pruebas', 'Candeonato de pruebas', 'draft',
               ?, ?, 'Pruebas')`,
    ).run(timestamp, timestamp);
    db.prepare(
      `UPDATE championships SET status = 'registration', published_at = ?, updated_at = ?
       WHERE id = 'championship-event'`,
    ).run(timestamp, timestamp);

    const events = db
      .prepare('SELECT event_type, entity_id, payload FROM web_update_events ORDER BY sequence')
      .all();
    assert.deepEqual(
      events.map(({ event_type, entity_id }) => [event_type, entity_id]),
      [
        ['setup.published', 'setup-event'],
        ['skin.published', 'skin-event'],
        ['championship.published', 'championship-event'],
      ],
    );
    assert.equal(JSON.parse(events[0].payload).car, 'Mazda MX-5');
    assert.equal(JSON.parse(events[1].payload).catalogUrl, '/skins');
    assert.equal(JSON.parse(events[2].payload).url, '/candeonatos/candeonato-pruebas');

    db.prepare("UPDATE setups SET status = 'archived' WHERE id = 'setup-event'").run();
    db.prepare("UPDATE setups SET status = 'published' WHERE id = 'setup-event'").run();
    assert.equal(eventCount(db), 3, 'republicar no duplica el aviso inicial');
  } finally {
    db.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('expone el feed paginado únicamente con el Bearer token del bot', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'candemor-web-updates-api-'));
  const db = openDatabase(join(temporaryRoot, 'test.db'));

  try {
    enqueueWebUpdateEvent(db, 'skin.published', 'skin-1', { carName: 'Mazda' });
    enqueueWebUpdateEvent(db, 'setup.published', 'setup-1', { title: 'Spa' });

    assert.throws(
      () => routeForTest(db, 'http://localhost/api/web-updates/events').run(),
      (error) => error.status === 401 && error.code === 'INVALID_WEB_UPDATES_TOKEN',
    );

    const firstResponse = routeForTest(
      db,
      'http://localhost/api/web-updates/events?after=0&limit=1',
      'Bearer token-de-pruebas-largo',
    );
    firstResponse.run();
    assert.equal(firstResponse.status, 200);
    assert.equal(firstResponse.headers['Cache-Control'], 'no-store');
    const firstPayload = JSON.parse(firstResponse.body);
    assert.equal(firstPayload.events.length, 1);
    assert.equal(firstPayload.events[0].type, 'skin.published');
    assert.equal(firstPayload.hasMore, true);

    const secondResponse = routeForTest(
      db,
      `http://localhost/api/web-updates/events?after=${firstPayload.nextCursor}&limit=10`,
      'Bearer token-de-pruebas-largo',
    );
    secondResponse.run();
    const secondPayload = JSON.parse(secondResponse.body);
    assert.equal(secondPayload.events.length, 1);
    assert.equal(secondPayload.events[0].type, 'setup.published');
    assert.equal(secondPayload.hasMore, false);
  } finally {
    db.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

function eventCount(db) {
  return Number(db.prepare('SELECT COUNT(*) AS count FROM web_update_events').get().count);
}

function routeForTest(db, href, authorization = '') {
  const url = new URL(href);
  const result = { status: null, headers: {}, body: '' };
  const response = {
    setHeader(name, value) {
      result.headers[name] = value;
    },
    writeHead(status, headers) {
      result.status = status;
      Object.assign(result.headers, headers);
    },
    end(body = '') {
      result.body = body;
    },
  };
  result.run = () =>
    routeWebUpdatesApi({
      db,
      method: 'GET',
      path: url.pathname,
      request: { headers: { authorization } },
      response,
      url,
      webUpdatesToken: 'token-de-pruebas-largo',
    });
  return result;
}
