import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, test } from 'node:test';
import { inspectDevService } from './dev-services.mjs';

const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => close(server)));
});

test('reutiliza una instancia de Candeweb que ya responde en el puerto', async () => {
  const server = await listen((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"ok":true,"database":"ready"}');
  });

  const state = await inspectDevService({
    host: '127.0.0.1',
    port: server.address().port,
    url: `http://127.0.0.1:${server.address().port}/api/health`,
    matches: (body) => body.includes('"database":"ready"'),
  });

  assert.equal(state, 'running');
});

test('distingue un puerto ocupado por otra aplicación', async () => {
  const server = await listen((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('otra aplicación');
  });

  const state = await inspectDevService({
    host: '127.0.0.1',
    port: server.address().port,
    url: `http://127.0.0.1:${server.address().port}`,
    matches: (body) => body.includes('<app-root'),
  });

  assert.equal(state, 'conflict');
});

test('permite iniciar el servicio cuando el puerto está libre', async () => {
  const temporary = await listen((_request, response) => response.end());
  const port = temporary.address().port;
  await close(temporary);
  servers.splice(servers.indexOf(temporary), 1);

  const state = await inspectDevService({
    host: '127.0.0.1',
    port,
    url: `http://127.0.0.1:${port}`,
    matches: () => false,
  });

  assert.equal(state, 'available');
});

function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    servers.push(server);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server) {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
