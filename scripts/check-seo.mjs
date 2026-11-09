// Comprueba, sobre el build en dist/, que la SEO esencial no se rompe:
// index.html con marcadores, imagen Open Graph y llms.txt coherente con las rutas públicas.
// Las respuestas por ruta (canonical, noindex, 404, sitemap) se prueban en server/seo.spec.mjs.
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const browser = fileURLToPath(new URL('../dist/candeweb/browser/', import.meta.url));
const errors = [];

async function read(file) {
  try {
    return await readFile(browser + file, 'utf8');
  } catch {
    errors.push(`Falta ${file} en el build.`);
    return '';
  }
}

const index = await read('index.html');
for (const [needle, message] of [
  ['<!--seo:start-->', 'index.html perdió el marcador seo:start (la inyección por ruta dejaría de funcionar).'],
  ['<!--seo:end-->', 'index.html perdió el marcador seo:end.'],
  ['name="description"', 'index.html no tiene meta description.'],
  ['property="og:image"', 'index.html no tiene og:image.'],
  ['<app-root', 'index.html no contiene <app-root>.'],
]) {
  if (!index.includes(needle)) errors.push(message);
}
if (/noindex/i.test(index)) errors.push('index.html contiene noindex: la web no se indexaría.');

try {
  await access(browser + 'media/og-cover.jpg');
} catch {
  errors.push('Falta media/og-cover.jpg (npm run seo:og-image).');
}

const llms = await read('llms.txt');
for (const route of ['/candeonato', '/candeonatos']) {
  if (!llms.includes(`](${route})`)) errors.push(`llms.txt no enlaza ${route}.`);
}

if (errors.length) {
  console.error(errors.map((error) => `✖ ${error}`).join('\n'));
  process.exit(1);
}
console.log('SEO: build correcto.');
