const DEFAULT_ORIGIN = 'https://fatcatrace.xyz';
const CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 20;
const MAX_HTML_SIZE = 2 * 1024 * 1024;

export function createFatcatStandingsService(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const origin = String(options.origin ?? process.env.FATCAT_ORIGIN ?? DEFAULT_ORIGIN).replace(
    /\/$/,
    '',
  );
  const cache = new Map();

  return {
    async getStandings(tournamentId) {
      const normalizedId = Number(tournamentId);
      if (!Number.isSafeInteger(normalizedId) || normalizedId <= 0) {
        throw new Error('El identificador del torneo no es válido.');
      }
      const cached = cache.get(normalizedId);
      if (cached && cached.expiresAt > now()) return cached.value;

      const response = await fetchImpl(`${origin}/resultados/ftct/drivers_unf/${normalizedId}`, {
        headers: {
          Accept: 'text/html',
          Referer: `${origin}/tournaments`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Fat Cat Race respondió ${response.status}.`);
      const html = await response.text();
      if (Buffer.byteLength(html) > MAX_HTML_SIZE) {
        throw new Error('La clasificación recibida es demasiado grande.');
      }
      const value = parseChampionshipStandings(html);
      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(normalizedId, { value, expiresAt: now() + CACHE_MS });
      return value;
    },
  };
}

export function parseChampionshipStandings(html) {
  const table = String(html).match(
    /<table\b[^>]*\bclass=["'][^"']*table-ranking[^"']*["'][^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  if (!table) throw new Error('La fuente no contiene una clasificación reconocible.');

  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) =>
      [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => text(cell[1])),
    )
    .filter((cells) => cells.length >= 11 && Number.isSafeInteger(Number(cells[0])))
    .slice(0, 500)
    .map((cells) => ({
      position: Number(cells[0]),
      driverName: cells[2],
      team: cells[3] || null,
      rounds: integer(cells[4]),
      laps: integer(cells[5]),
      wins: integer(cells[6]),
      podiums: integer(cells[7]),
      topFive: integer(cells[8]),
      incidents: integer(cells[9]),
      points: number(cells[10]),
    }));
}

export function reconcileStandingsWithDriverIds(driverStandings, namedStandings) {
  const driversBySignature = groupBySignature(driverStandings, driverStandingSignature);
  const namesBySignature = groupBySignature(namedStandings, namedStandingSignature);

  return namedStandings.map((standing) => {
    const signature = namedStandingSignature(standing);
    const driverMatches = signature ? (driversBySignature.get(signature) ?? []) : [];
    const nameMatches = signature ? (namesBySignature.get(signature) ?? []) : [];
    const match = driverMatches.length === 1 && nameMatches.length === 1 ? driverMatches[0] : null;
    const driverId = match && positiveInteger(match.piloto_id) ? Number(match.piloto_id) : null;

    return {
      ...standing,
      driverId,
      driverIdMatch: driverId === null ? null : 'exact-statistics',
    };
  });
}

function groupBySignature(values, signatureFor) {
  const groups = new Map();
  for (const value of Array.isArray(values) ? values : []) {
    const signature = signatureFor(value);
    if (!signature) continue;
    const group = groups.get(signature) ?? [];
    group.push(value);
    groups.set(signature, group);
  }
  return groups;
}

function driverStandingSignature(standing) {
  return statisticsSignature({
    points: standing?.puntos_totales,
    rounds: standing?.rondas,
    laps: standing?.total_laps,
    wins: standing?.victorias,
    podiums: standing?.podios,
    topFive: standing?.top_5,
    incidents: standing?.total_incidents,
  });
}

function namedStandingSignature(standing) {
  return statisticsSignature({
    points: standing?.points,
    rounds: standing?.rounds,
    laps: standing?.laps,
    wins: standing?.wins,
    podiums: standing?.podiums,
    topFive: standing?.topFive,
    incidents: standing?.incidents,
  });
}

function statisticsSignature(statistics) {
  const rawValues = [
    statistics.points,
    statistics.rounds,
    statistics.laps,
    statistics.wins,
    statistics.podiums,
    statistics.topFive,
    statistics.incidents,
  ];
  if (
    rawValues.some((value) => value === null || value === undefined || String(value).trim() === '')
  ) {
    return null;
  }
  const values = rawValues.map(Number);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  return values.map((value) => value.toFixed(4)).join('|');
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

function text(value) {
  return decodeEntities(String(value).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function integer(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
