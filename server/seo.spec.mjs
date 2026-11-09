import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyRoute, renderIndexHtml, renderRobots, renderSitemap } from './seo.mjs';

const BASE = 'https://candemor.com';
const TEMPLATE = '<head><!--seo:start--><title>x</title><!--seo:end--></head>';

test('las rutas públicas se indexan con title, canonical y Open Graph propios', () => {
  const { html, status } = renderIndexHtml(TEMPLATE, '/candeonato', BASE);
  assert.equal(status, 200);
  assert.match(html, /<link rel="canonical" href="https:\/\/candemor\.com\/candeonato" \/>/);
  assert.match(html, /<meta name="robots" content="index, follow/);
  assert.match(html, /og:image" content="https:\/\/candemor\.com\/media\/og-cover\.jpg"/);
  assert.equal((html.match(/<title>/g) ?? []).length, 1);
});

test('solo la portada incluye datos estructurados y mencionan iRacing', () => {
  const home = renderIndexHtml(TEMPLATE, '/', BASE).html;
  assert.match(home, /application\/ld\+json/);
  assert.match(home, /iRacing/);
  assert.doesNotMatch(renderIndexHtml(TEMPLATE, '/candeonatos', BASE).html, /ld\+json/);
});

test('las zonas privadas no se indexan', () => {
  for (const path of ['/admin/login', '/setups/12', '/skins', '/acceso']) {
    const result = renderIndexHtml(TEMPLATE, path, BASE);
    assert.equal(result.status, 200, path);
    assert.equal(result.robots, 'noindex, nofollow', path);
    assert.match(result.html, /content="noindex, nofollow"/, path);
  }
});

test('las rutas desconocidas responden 404 con noindex', () => {
  const result = renderIndexHtml(TEMPLATE, '/no-existe', BASE);
  assert.equal(result.status, 404);
  assert.equal(result.robots, 'noindex, nofollow');
  assert.equal(classifyRoute('/candeonatos/new-era').kind, 'detail');
  assert.equal(classifyRoute('/candeonatos/').kind, 'public');
});

test('el HTML escapa valores y mantiene intacto un index sin marcadores', () => {
  assert.equal(renderIndexHtml('<head></head>', '/', BASE).html, '<head></head>');
});

test('sitemap incluye rutas públicas y ediciones publicadas, sin zonas privadas', () => {
  const xml = renderSitemap(BASE, [
    { slug: 'new-era', status: 'active', updatedAt: '2026-01-02T03:04:05Z' },
    { externalTournamentId: 42, status: 'finished' },
    {},
  ]);
  assert.match(xml, /<loc>https:\/\/candemor\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/candemor\.com\/candeonatos\/new-era<\/loc>/);
  assert.match(xml, /<loc>https:\/\/candemor\.com\/candeonatos\/42<\/loc>/);
  assert.match(xml, /<lastmod>2026-01-02T03:04:05\.000Z<\/lastmod>/);
  assert.doesNotMatch(xml, /admin|setups|skins/);
});

test('robots.txt bloquea zonas privadas pero no la API ni las imágenes', () => {
  const robots = renderRobots(BASE);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Sitemap: https:\/\/candemor\.com\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow: \/api|Disallow: \/uploads/);
});
