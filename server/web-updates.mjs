import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError } from './validation.mjs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const EVENT_TYPES = new Set(['setup.published', 'skin.published', 'championship.published']);

export function enqueueWebUpdateEvent(db, type, entityId, payload, options = {}) {
  if (!EVENT_TYPES.has(type)) throw new TypeError(`Tipo de evento no permitido: ${type}`);

  const createdAt = options.createdAt ?? new Date().toISOString();
  const dedupeKey = options.dedupeKey ?? `${type}:${entityId}:first-publication`;
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO web_update_events
       (event_id, event_type, entity_id, dedupe_key, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), type, entityId, dedupeKey, JSON.stringify(payload), createdAt);

  return result.changes === 1;
}

export function routeWebUpdatesApi(context) {
  const { method, path, request, response, db, webUpdatesToken, url } = context;
  if (path !== '/api/web-updates/events') return false;

  if (method !== 'GET') {
    response.setHeader('Allow', 'GET');
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Este recurso solo admite GET.');
  }
  requireWebUpdatesToken(request, webUpdatesToken);

  const after = parseNonNegativeInteger(url.searchParams.get('after'), 'after', 0);
  const requestedLimit = parseNonNegativeInteger(
    url.searchParams.get('limit'),
    'limit',
    DEFAULT_LIMIT,
  );
  if (requestedLimit === 0) {
    throw new ApiError(422, 'INVALID_PAGINATION', 'limit debe ser mayor que cero.');
  }
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const rows = db
    .prepare(
      `SELECT sequence, event_id, event_type, entity_id, payload, created_at
       FROM web_update_events WHERE sequence > ? ORDER BY sequence ASC LIMIT ?`,
    )
    .all(after, limit + 1);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const events = page.map(eventFromRow);
  const nextCursor = events.at(-1)?.sequence ?? after;

  sendJson(response, 200, { events, nextCursor, hasMore });
  return true;
}

function requireWebUpdatesToken(request, configuredToken) {
  if (!configuredToken) {
    throw new ApiError(
      503,
      'WEB_UPDATES_NOT_CONFIGURED',
      'El acceso para WebUpdates no está configurado.',
    );
  }
  const authorization = String(request.headers.authorization ?? '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !safeEqual(match[1], configuredToken)) {
    throw new ApiError(401, 'INVALID_WEB_UPDATES_TOKEN', 'El token de WebUpdates no es válido.');
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseNonNegativeInteger(value, name, fallback) {
  if (value === null || value === '') return fallback;
  if (!/^\d+$/.test(value)) {
    throw new ApiError(422, 'INVALID_PAGINATION', `${name} debe ser un entero no negativo.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiError(422, 'INVALID_PAGINATION', `${name} queda fuera del rango permitido.`);
  }
  return parsed;
}

function eventFromRow(row) {
  return {
    sequence: Number(row.sequence),
    id: row.event_id,
    type: row.event_type,
    entityId: row.entity_id,
    occurredAt: row.created_at,
    data: JSON.parse(row.payload),
  };
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'no-referrer',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}
