import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { recordAudit } from './database.mjs';
import { ApiError } from './validation.mjs';

// Aplicación de escritorio de Setups que administración sube y los usuarios con acceso descargan.
const APP_FILE_LIMIT = 300 * 1024 * 1024;
const APP_EXTENSIONS = new Set(['.exe', '.msi', '.zip']);
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function appPaths(setupDir) {
  const dir = join(setupDir, 'desktop-app');
  return { dir, meta: join(dir, 'meta.json') };
}

export async function readSetupsAppInfo(setupDir) {
  const { dir, meta } = appPaths(setupDir);
  if (!existsSync(meta)) return null;
  try {
    const info = JSON.parse(await readFile(meta, 'utf8'));
    return existsSync(join(dir, info.storedName)) ? info : null;
  } catch {
    return null;
  }
}

function publicInfo(info) {
  return info
    ? {
        fileName: info.fileName,
        byteSize: info.byteSize,
        sha256: info.sha256,
        uploadedAt: info.uploadedAt,
        uploadedByName: info.uploadedByName,
      }
    : null;
}

export async function getSetupsApp({ setupDir, response }) {
  return sendJson(response, 200, { app: publicInfo(await readSetupsAppInfo(setupDir)) });
}

export async function uploadSetupsApp({ db, request, response, setupDir, session, url }) {
  const fileName = basename(String(url.searchParams.get('fileName') ?? 'SetupsApp.exe'))
    .replace(/[\r\n"\/]/g, '')
    .slice(0, 120);
  const extension = extname(fileName).toLowerCase();
  if (!APP_EXTENSIONS.has(extension)) {
    throw new ApiError(415, 'UNSUPPORTED_APP_FILE', 'Sube un archivo .exe, .msi o .zip.');
  }
  const declaredSize = Number(request.headers['content-length'] ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > APP_FILE_LIMIT) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El archivo supera los 300 MB.');
  }
  const { dir, meta } = appPaths(setupDir);
  await mkdir(dir, { recursive: true });
  const temporaryPath = join(dir, `incoming-${Date.now()}.part`);
  const hash = createHash('sha256');
  let size = 0;
  const output = createWriteStream(temporaryPath);
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > APP_FILE_LIMIT) {
        throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El archivo supera los 300 MB.');
      }
      hash.update(chunk);
      if (!output.write(chunk)) {
        await new Promise((resolveDrain) => output.once('drain', resolveDrain));
      }
    }
    await new Promise((resolveEnd, rejectEnd) => {
      output.once('error', rejectEnd);
      output.end(resolveEnd);
    });
    if (!size) throw new ApiError(422, 'EMPTY_FILE', 'El archivo está vacío.');
    const previous = await readSetupsAppInfo(setupDir);
    const storedName = `app-${Date.now()}${extension}`;
    await rename(temporaryPath, join(dir, storedName));
    const info = {
      fileName,
      storedName,
      byteSize: size,
      sha256: hash.digest('hex'),
      uploadedAt: new Date().toISOString(),
      uploadedByName: session.admin.displayName,
    };
    await writeFile(meta, JSON.stringify(info));
    if (previous && previous.storedName !== storedName) {
      await rm(join(dir, previous.storedName), { force: true });
    }
    recordAudit(db, session.admin.id, 'setups.app_uploaded', 'setups_app', storedName, {
      fileName,
      byteSize: size,
    });
    return sendJson(response, 201, { app: publicInfo(info) });
  } catch (error) {
    output.destroy();
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function deleteSetupsApp({ db, response, setupDir, session }) {
  const { dir, meta } = appPaths(setupDir);
  const info = await readSetupsAppInfo(setupDir);
  if (info) {
    await rm(join(dir, info.storedName), { force: true });
    await rm(meta, { force: true });
    recordAudit(db, session.admin.id, 'setups.app_deleted', 'setups_app', info.storedName);
  }
  response.writeHead(204, SECURITY_HEADERS);
  response.end();
}

export async function downloadSetupsApp({ db, response, setupDir, session }) {
  const info = await readSetupsAppInfo(setupDir);
  if (!info) throw new ApiError(404, 'NOT_FOUND', 'Todavía no hay una aplicación publicada.');
  recordAudit(db, session.admin.id, 'setups.app_downloaded', 'setups_app', info.storedName);
  const encodedName = encodeURIComponent(info.fileName);
  response.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/octet-stream',
    'Content-Length': info.byteSize,
    'Content-Disposition': `attachment; filename="SetupsApp${extname(info.fileName)}"; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'private, no-store',
  });
  createReadStream(join(appPaths(setupDir).dir, info.storedName)).pipe(response);
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'private, no-cache',
  });
  response.end(body);
}
