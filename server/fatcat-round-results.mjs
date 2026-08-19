const DEFAULT_BASE_URL = 'https://fatcatrace.xyz/ronda';
const CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const MAX_HTML_SIZE = 2 * 1024 * 1024;

export function createFatcatRoundResultsService(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const baseUrl = String(
    options.baseUrl ?? process.env.FATCAT_ROUND_BASE_URL ?? DEFAULT_BASE_URL,
  ).replace(/\/$/, '');
  const cache = new Map();

  return {
    async getResults(sessionId) {
      const normalizedId = Number(sessionId);
      if (!Number.isSafeInteger(normalizedId) || normalizedId <= 0) {
        throw new Error('El identificador de la sesión no es válido.');
      }
      const cached = cache.get(normalizedId);
      if (cached && cached.expiresAt > now()) return cached.value;

      const sourceUrl = `${baseUrl}/${normalizedId}`;
      const response = await fetchImpl(sourceUrl, {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Fat Cat Race respondió ${response.status}.`);
      const html = await response.text();
      if (Buffer.byteLength(html) > MAX_HTML_SIZE) {
        throw new Error('La respuesta de resultados es demasiado grande.');
      }
      const value = {
        sessionId: normalizedId,
        results: parseRoundResults(html),
        sourceUrl,
        fetchedAt: new Date(now()).toISOString(),
      };
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(normalizedId, { value, expiresAt: now() + CACHE_MS });
      return value;
    },
  };
}

export function parseRoundResults(html) {
  const table = String(html).match(
    /<table\b[^>]*\bid=["']myTable["'][^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  if (!table) throw new Error('La fuente no contiene una tabla de resultados reconocible.');

  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) =>
      [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => text(cell[1])),
    )
    .filter((cells) => cells.length >= 7 && Number.isSafeInteger(Number(cells[0])))
    .slice(0, 200)
    .map((cells) => ({
      position: Number(cells[0]),
      driverName: cells[1],
      team: cells[2] || null,
      laps: nullableInteger(cells[3]),
      totalTime: cells[4] || null,
      averageLap: cells[5] || null,
      incidents: nullableInteger(cells[6]),
    }));
}

function text(value) {
  return decodeEntities(String(value).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const point =
      code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
    try {
      return Number.isSafeInteger(point) ? String.fromCodePoint(point) : entity;
    } catch {
      return entity;
    }
  });
}

function nullableInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
