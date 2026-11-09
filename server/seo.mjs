// SEO del servidor: metadatos por ruta inyectados en el HTML inicial, sitemap.xml y robots.txt.
// La web es una SPA; los rastreadores sociales (Discord, X, WhatsApp) y los buscadores leen
// primero este HTML, por lo que title, description, canonical y Open Graph deben estar ya aquí.

export const SITE_NAME = 'Candemor Racing Team';
export const OG_IMAGE_PATH = '/media/og-cover.jpg';

const PUBLIC_ROUTES = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: '1.0',
    title: 'Candemor Racing Team · Equipo de iRacing y simracing en español',
    description:
      'Candemor Racing Team es un equipo de iRacing y simracing con directos en Twitch, comunidad en Discord y el Candeonato, nuestro campeonato de carreras online.',
  },
  {
    path: '/candeonato',
    changefreq: 'weekly',
    priority: '0.9',
    title: 'Candeonato · Campeonato de simracing y iRacing | Candemor Racing Team',
    description:
      'Candeonato: campeonato de simracing organizado por Candemor Racing Team. Consulta requisitos, normas, calendario e inscríbete a la edición actual.',
  },
  {
    path: '/candeonatos',
    changefreq: 'weekly',
    priority: '0.8',
    title: 'Historial del Candeonato · Clasificaciones y carreras | Candemor Racing Team',
    description:
      'Historial de ediciones del Candeonato con clasificaciones de pilotos y equipos, resultados por carrera y estadísticas del campeonato de simracing.',
  },
  {
    path: '/chiquito-spotter',
    changefreq: 'monthly',
    priority: '0.5',
    title: 'Chiquito Spotter · Spotter de voz para simracing | Candemor Racing Team',
    description:
      'Chiquito Spotter: avisos de voz para tus carreras de simracing e iRacing, creados por la comunidad de Candemor Racing Team.',
  },
];

// Rutas privadas o de sesión: se sirve la SPA, pero nunca se indexan.
const PRIVATE_PREFIXES = [
  '/admin',
  '/setups',
  '/skins',
  '/acceso',
  '/solicitar-acceso',
  '/aceptar-invitacion',
];

const DETAIL_ROUTE = /^\/candeonatos\/[^/]+$/;
const PRIVATE_ROUTE = new RegExp(`^(?:${PRIVATE_PREFIXES.join('|')})(?:/|$)`);

export const NOINDEX_HEADER = 'noindex, nofollow';

/** Normaliza la ruta (sin barra final, salvo la raíz). */
function normalizePath(path) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/**
 * Clasifica una ruta de la SPA.
 * @returns {{ kind: 'public'|'detail'|'private'|'unknown', route?: object }}
 */
export function classifyRoute(rawPath) {
  const path = normalizePath(rawPath);
  const route = PUBLIC_ROUTES.find((candidate) => candidate.path === path);
  if (route) return { kind: 'public', route };
  if (DETAIL_ROUTE.test(path)) return { kind: 'detail' };
  if (PRIVATE_ROUTE.test(path)) return { kind: 'private' };
  return { kind: 'unknown' };
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

function absoluteUrl(baseUrl, path) {
  return new URL(path, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

function organizationJsonLd(baseUrl) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SportsTeam',
        '@id': `${absoluteUrl(baseUrl, '/')}#team`,
        name: SITE_NAME,
        sport: 'Simracing',
        url: absoluteUrl(baseUrl, '/'),
        logo: absoluteUrl(baseUrl, '/media/candemoricon.png'),
        description: PUBLIC_ROUTES[0].description,
        sameAs: ['https://discord.gg/j22XuDEfMk'],
      },
      {
        '@type': 'WebSite',
        '@id': `${absoluteUrl(baseUrl, '/')}#website`,
        url: absoluteUrl(baseUrl, '/'),
        name: SITE_NAME,
        inLanguage: ['es', 'en'],
        publisher: { '@id': `${absoluteUrl(baseUrl, '/')}#team` },
      },
    ],
  };
}

function buildHead({ title, description, canonical, image, robots, baseUrl, includeJsonLd }) {
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    '<meta property="og:locale" content="es_ES" />',
    '<meta property="og:locale:alternate" content="en_US" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ];
  if (includeJsonLd) {
    const json = JSON.stringify(organizationJsonLd(baseUrl)).replace(/</g, '\\u003c');
    lines.push(`<script type="application/ld+json">${json}</script>`);
  }
  return lines.map((line) => `    ${line}`).join('\n');
}

/**
 * Sustituye los metadatos estáticos del index.html por los de la ruta solicitada.
 * @returns {{ html: string, status: number, robots: string }}
 */
export function renderIndexHtml(html, rawPath, baseUrl) {
  const path = normalizePath(rawPath);
  const { kind, route } = classifyRoute(path);
  const image = absoluteUrl(baseUrl, OG_IMAGE_PATH);
  let meta;
  let status = 200;
  let robots = 'index, follow, max-image-preview:large';

  if (kind === 'public') {
    meta = { title: route.title, description: route.description };
  } else if (kind === 'detail') {
    meta = {
      title: 'Edición del Candeonato · Clasificación y carreras | Candemor Racing Team',
      description:
        'Clasificación, carreras y estadísticas de una edición del Candeonato, el campeonato de simracing de Candemor Racing Team.',
    };
  } else if (kind === 'private') {
    robots = NOINDEX_HEADER;
    meta = { title: `Zona privada · ${SITE_NAME}`, description: PUBLIC_ROUTES[0].description };
  } else {
    robots = NOINDEX_HEADER;
    status = 404;
    meta = { title: `Página no encontrada · ${SITE_NAME}`, description: PUBLIC_ROUTES[0].description };
  }

  const canonicalPath = kind === 'public' || kind === 'detail' ? path : '/';
  const head = buildHead({
    ...meta,
    canonical: absoluteUrl(baseUrl, canonicalPath),
    image,
    robots,
    baseUrl,
    includeJsonLd: kind === 'public' && path === '/',
  });

  const rendered = html.includes('<!--seo:start-->')
    ? html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->\n${head}\n    <!--seo:end-->`)
    : html;
  return { html: rendered, status, robots };
}

/** sitemap.xml con las rutas públicas y las ediciones publicadas del Candeonato. */
export function renderSitemap(baseUrl, championships = []) {
  const entries = PUBLIC_ROUTES.map((route) => ({
    loc: absoluteUrl(baseUrl, route.path),
    changefreq: route.changefreq,
    priority: route.priority,
  }));
  for (const championship of championships) {
    const key = championship.slug || championship.externalTournamentId;
    if (!key) continue;
    entries.push({
      loc: absoluteUrl(baseUrl, `/candeonatos/${encodeURIComponent(key)}`),
      lastmod: championship.updatedAt ? new Date(championship.updatedAt).toISOString() : undefined,
      changefreq: championship.status === 'finished' ? 'yearly' : 'weekly',
      priority: championship.status === 'finished' ? '0.6' : '0.8',
    });
  }
  const urls = entries
    .map((entry) =>
      [
        '  <url>',
        `    <loc>${escapeHtml(entry.loc)}</loc>`,
        entry.lastmod && !Number.isNaN(Date.parse(entry.lastmod))
          ? `    <lastmod>${entry.lastmod}</lastmod>`
          : null,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots(baseUrl) {
  const disallow = PRIVATE_PREFIXES.map((path) => `Disallow: ${path}/`);
  return [
    'User-agent: *',
    'Allow: /',
    ...disallow,
    '',
    `Sitemap: ${absoluteUrl(baseUrl, '/sitemap.xml')}`,
    '',
  ].join('\n');
}
