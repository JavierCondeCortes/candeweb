import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { inspectDevService } from './dev-services.mjs';

const node = process.execPath;
const angularCli = join('node_modules', '@angular', 'cli', 'bin', 'ng.js');
const apiPort = Number(process.env.API_PORT ?? 3000);
const apiHost = process.env.API_HOST ?? '127.0.0.1';
const probeHost = apiHost === '0.0.0.0' ? '127.0.0.1' : apiHost;

const [apiState, webState] = await Promise.all([
  inspectDevService({
    host: apiHost,
    port: apiPort,
    url: `http://${probeHost}:${apiPort}/api/health`,
    matches: (body) => body.includes('"database":"ready"'),
  }),
  inspectDevService({
    host: ['127.0.0.1', '::1'],
    port: 4200,
    url: ['http://localhost:4200', 'http://127.0.0.1:4200', 'http://[::1]:4200'],
    matches: (body) => body.includes('<app-root'),
  }),
]);

const conflicts = [];
if (apiState === 'conflict') conflicts.push(`API (${apiHost}:${apiPort})`);
if (webState === 'conflict') conflicts.push('web (127.0.0.1:4200)');

if (conflicts.length) {
  console.error(
    `No se puede iniciar Candeweb: ${conflicts.join(' y ')} ya pertenece a otra aplicación.`,
  );
  console.error('Libera ese puerto y vuelve a ejecutar npm start.');
  process.exitCode = 1;
} else {
  if (apiState === 'running') {
    console.log(
      `La API de Candeweb ya está activa en http://${probeHost}:${apiPort}; se reutiliza.`,
    );
  }
  if (webState === 'running') {
    console.log('La web de Candeweb ya está activa en http://localhost:4200; se reutiliza.');
  }

  const children = [];
  if (apiState === 'available') {
    children.push(spawn(node, ['server/server.mjs'], { stdio: 'inherit', env: process.env }));
  }
  if (webState === 'available') {
    children.push(spawn(node, [angularCli, 'serve'], { stdio: 'inherit', env: process.env }));
  }

  let closing = false;

  function shutdown(signal = 'SIGTERM') {
    if (closing) return;
    closing = true;
    children.forEach((child) => {
      if (!child.killed) child.kill(signal);
    });
  }

  children.forEach((child) => {
    child.once('exit', (code) => {
      if (!closing) {
        shutdown();
        process.exitCode = code ?? 1;
      }
    });
  });

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}
