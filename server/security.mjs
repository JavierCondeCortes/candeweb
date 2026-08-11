import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'candemor_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('base64url')}:${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, saltValue, hashValue] = String(encoded).split(':');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;

  const expected = Buffer.from(hashValue, 'base64url');
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltValue, 'base64url'), 64));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(db, adminId) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_SECONDS * 1000);

  db.prepare(
    `INSERT INTO admin_sessions (token_hash, admin_id, csrf_token, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(hashToken(token), adminId, csrfToken, expiresAt.toISOString(), createdAt.toISOString());

  return { token, csrfToken, expiresAt };
}

export function destroySession(db, token) {
  if (!token) return;
  db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(token));
}

export function getSession(db, request) {
  const token = parseCookies(request.headers.cookie ?? '')[SESSION_COOKIE];
  if (!token) return null;

  const session = db
    .prepare(
      `SELECT
        s.token_hash, s.csrf_token, s.expires_at,
        a.id AS admin_id, a.email, a.display_name, a.role, a.active, a.totp_enabled,
        a.email_verified_at
       FROM admin_sessions s
       JOIN admin_profiles a ON a.id = s.admin_id
       WHERE s.token_hash = ? AND a.role = 'admin'
         AND a.id = (
           SELECT id FROM admin_profiles WHERE role = 'admin'
           ORDER BY created_at ASC, id ASC LIMIT 1
         )`,
    )
    .get(hashToken(token));

  if (!session || session.active !== 1 || Date.parse(session.expires_at) <= Date.now()) {
    destroySession(db, token);
    return null;
  }

  return {
    token,
    csrfToken: session.csrf_token,
    expiresAt: session.expires_at,
    admin: {
      id: session.admin_id,
      email: session.email,
      displayName: session.display_name,
      role: session.role,
      mfaEnabled: session.totp_enabled === 1,
      emailVerified: Boolean(session.email_verified_at),
    },
  };
}

export function sessionCookie(token, expiresAt, secure = false) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function expiredSessionCookie(secure = false) {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function requireCsrf(request, session) {
  const submitted = request.headers['x-csrf-token'];
  return typeof submitted === 'string' && timingSafeStringEqual(submitted, session.csrfToken);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function createTotpUri(secret, email, issuer = 'Candemor Admin') {
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(
    issuer,
  )}&algorithm=SHA1&digits=6&period=30`;
}

export function totpCode(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return String(value).padStart(6, '0');
}

export function verifyTotp(code, secret, timestamp = Date.now()) {
  const normalized = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized) || !secret) return false;
  return [-1, 0, 1].some((offset) =>
    timingSafeStringEqual(normalized, totpCode(secret, timestamp + offset * 30_000)),
  );
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const value = randomBytes(5).toString('hex').toUpperCase();
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
}

export function hashRecoveryCode(code) {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

export function consumeRecoveryCode(code, encodedCodes) {
  const submittedHash = hashRecoveryCode(code);
  const hashes = parseRecoveryCodes(encodedCodes);
  const index = hashes.findIndex((hash) => timingSafeStringEqual(hash, submittedHash));
  if (index < 0) return null;
  return JSON.stringify(hashes.filter((_, currentIndex) => currentIndex !== index));
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeRecoveryCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '');
}

function parseRecoveryCodes(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let accumulator = 0;
  const bytes = [];
  for (const character of String(value).toUpperCase().replace(/=+$/g, '')) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function parseCookies(value) {
  return Object.fromEntries(
    value
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        if (separator < 0) return [part, ''];
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}
