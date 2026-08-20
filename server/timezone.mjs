const MADRID_TIME_ZONE = 'Europe/Madrid';
const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;
const OFFSET_DATE_TIME = /(?:Z|[+-]\d{2}:\d{2})$/i;

const madridPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: MADRID_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function madridDateTimeToIso(value) {
  const input = String(value ?? '').trim();
  if (!input) return null;

  if (OFFSET_DATE_TIME.test(input)) {
    const parsed = Date.parse(input);
    if (Number.isNaN(parsed)) throw new RangeError('Invalid date time.');
    return new Date(parsed).toISOString();
  }

  const match = LOCAL_DATE_TIME.exec(input);
  if (!match) throw new RangeError('Invalid Madrid local date time.');
  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );
  const normalized = new Date(desiredAsUtc);
  if (
    normalized.getUTCFullYear() !== desired.year ||
    normalized.getUTCMonth() + 1 !== desired.month ||
    normalized.getUTCDate() !== desired.day ||
    normalized.getUTCHours() !== desired.hour ||
    normalized.getUTCMinutes() !== desired.minute ||
    normalized.getUTCSeconds() !== desired.second
  ) {
    throw new RangeError('Invalid calendar date.');
  }

  let candidate = desiredAsUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = madridParts(candidate);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const correction = desiredAsUtc - observedAsUtc;
    if (correction === 0) break;
    candidate += correction;
  }

  const verified = madridParts(candidate);
  if (Object.keys(desired).some((key) => verified[key] !== desired[key])) {
    throw new RangeError('The local time does not exist in Europe/Madrid.');
  }
  return new Date(candidate).toISOString();
}

function madridParts(timestamp) {
  const values = {};
  for (const part of madridPartsFormatter.formatToParts(new Date(timestamp))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return values;
}
