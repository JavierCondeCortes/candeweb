import { ApiError } from './validation.mjs';

const DEFAULT_CACHE_TTL = 5 * 60 * 1000;
const GOOGLE_FORM_PATH = /^\/forms\/d\/e\/([^/]+)\/viewform\/?$/;

export function createGoogleFormsService(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL;
  const cache = new Map();

  async function getSchema(value) {
    const cacheKey = String(value ?? '');
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.schema;

    const { html, viewUrl, formId } = await fetchGoogleFormPage(value, fetchImpl);
    const schema = parseGoogleFormHtml(html, { viewUrl, formId });
    cache.set(cacheKey, { schema, expiresAt: Date.now() + cacheTtlMs });
    return schema;
  }

  async function submit({ url, answers }) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new ApiError(422, 'INVALID_GOOGLE_FORM_ANSWERS', 'Las respuestas no son válidas.');
    }

    const schema = await getSchema(url);
    if (!schema.supported) {
      throw new ApiError(
        422,
        'UNSUPPORTED_GOOGLE_FORM',
        'Este formulario contiene campos que deben completarse directamente en Google Forms.',
      );
    }

    const payload = new URLSearchParams();
    for (const field of schema.fields.filter((item) => item.kind !== 'section')) {
      appendAnswer(payload, field, answers[field.id]);
    }
    payload.set('fvv', '1');
    payload.set(
      'pageHistory',
      Array.from({ length: schema.pageCount }, (_, index) => index).join(','),
    );
    if (schema.fbzx) {
      payload.set('fbzx', schema.fbzx);
      payload.set('draftResponse', JSON.stringify([null, null, schema.fbzx]));
    }
    payload.set('submissionTimestamp', String(Date.now()));

    let result;
    try {
      result = await fetchImpl(schema.actionUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ApiError(
        502,
        'GOOGLE_FORM_UNAVAILABLE',
        'Google Forms no está disponible temporalmente.',
      );
    }
    if (!result.ok) {
      throw new ApiError(
        502,
        'GOOGLE_FORM_REJECTED',
        'Google Forms no ha aceptado la inscripción.',
      );
    }
    return { ok: true };
  }

  return { getSchema, submit };
}

export function parseGoogleFormHtml(html, { viewUrl, formId }) {
  const publicData = extractPublicLoadData(html);
  const form = publicData?.[1];
  const rawItems = Array.isArray(form?.[1]) ? form[1] : [];
  const fields = [];
  const unsupportedTypes = new Set();
  let pageCount = 1;

  for (const item of rawItems) {
    if (!Array.isArray(item)) continue;
    const itemType = Number(item[3]);
    const label = cleanText(item[1]);
    const description = cleanText(item[2]);
    const entries = Array.isArray(item[4]) ? item[4] : [];

    if (!entries.length) {
      if ((itemType === 6 || itemType === 8) && (label || description)) {
        fields.push({
          id: `section-${String(item[0])}`,
          kind: 'section',
          label,
          description,
        });
        if (itemType === 8) pageCount += 1;
      }
      continue;
    }

    for (const [entryIndex, entry] of entries.entries()) {
      if (!Array.isArray(entry) || !Number.isFinite(Number(entry[0]))) continue;
      const kind = fieldKind(itemType, entries.length);
      if (!kind) {
        unsupportedTypes.add(itemType);
        continue;
      }
      const rowLabel = entries.length > 1 ? cleanText(entry[3]) : '';
      const options = parseOptions(entry[1]);
      fields.push({
        id: String(entry[0]),
        itemId: String(item[0]),
        kind,
        label: rowLabel ? `${label} — ${rowLabel}` : label || `Pregunta ${entryIndex + 1}`,
        description: entryIndex === 0 ? description : '',
        required: Boolean(entry[2]),
        options: options.values,
        allowOther: options.allowOther,
      });
    }
  }

  return {
    title: cleanText(form?.[8] ?? publicData?.[3]) || 'Formulario de inscripción',
    description: cleanText(form?.[0]),
    viewUrl,
    actionUrl: `https://docs.google.com/forms/d/e/${encodeURIComponent(formId)}/formResponse`,
    fbzx: extractHiddenValue(html, 'fbzx'),
    pageCount,
    supported: unsupportedTypes.size === 0,
    unsupportedTypes: [...unsupportedTypes],
    fields,
  };
}

async function fetchGoogleFormPage(value, fetchImpl) {
  const requestedUrl = parseRequestedUrl(value);
  let result;
  try {
    result = await fetchImpl(requestedUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Candeweb/1.0' },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ApiError(
      502,
      'GOOGLE_FORM_UNAVAILABLE',
      'No se pudo abrir el formulario de inscripción.',
    );
  }
  if (!result.ok) {
    throw new ApiError(
      502,
      'GOOGLE_FORM_UNAVAILABLE',
      'No se pudo abrir el formulario de inscripción.',
    );
  }

  const resolvedUrl = new URL(result.url || requestedUrl);
  const match = validateCanonicalUrl(resolvedUrl);
  return {
    html: await result.text(),
    viewUrl: resolvedUrl.toString(),
    formId: match[1],
  };
}

function parseRequestedUrl(value) {
  let requestedUrl;
  try {
    requestedUrl = new URL(String(value ?? ''));
  } catch {
    throw new ApiError(422, 'INVALID_GOOGLE_FORM', 'El enlace de inscripción no es válido.');
  }
  if (requestedUrl.protocol !== 'https:') {
    throw new ApiError(422, 'INVALID_GOOGLE_FORM', 'El formulario debe utilizar HTTPS.');
  }
  if (requestedUrl.hostname === 'forms.gle') return requestedUrl;
  validateCanonicalUrl(requestedUrl);
  return requestedUrl;
}

function validateCanonicalUrl(url) {
  const match = url.pathname.match(GOOGLE_FORM_PATH);
  if (url.hostname !== 'docs.google.com' || !match) {
    throw new ApiError(
      422,
      'INVALID_GOOGLE_FORM',
      'La inscripción debe enlazar a un formulario público de Google Forms.',
    );
  }
  return match;
}

function extractPublicLoadData(html) {
  const marker = 'FB_PUBLIC_LOAD_DATA_';
  const markerIndex = html.indexOf(marker);
  const start = html.indexOf('[', markerIndex);
  if (markerIndex < 0 || start < 0) {
    throw new ApiError(
      502,
      'GOOGLE_FORM_FORMAT_CHANGED',
      'No se ha podido interpretar el formulario de inscripción.',
    );
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '[') depth += 1;
    else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, index + 1));
        } catch {
          break;
        }
      }
    }
  }
  throw new ApiError(
    502,
    'GOOGLE_FORM_FORMAT_CHANGED',
    'No se ha podido interpretar el formulario de inscripción.',
  );
}

function fieldKind(itemType, entryCount) {
  if (itemType === 0) return 'text';
  if (itemType === 1) return 'textarea';
  if (itemType === 2 || itemType === 5 || itemType === 7) return 'radio';
  if (itemType === 3) return 'select';
  if (itemType === 4 || (itemType === 8 && entryCount > 0)) return 'checkbox';
  if (itemType === 9) return 'date';
  if (itemType === 10) return 'time';
  return null;
}

function parseOptions(value) {
  if (!Array.isArray(value)) return { values: [], allowOther: false };
  const values = [];
  let allowOther = false;
  for (const option of value) {
    if (!Array.isArray(option)) continue;
    const label = cleanText(option[0]);
    if (label) values.push(label);
    if (option[4] === 1) allowOther = true;
  }
  return { values, allowOther };
}

function appendAnswer(payload, field, rawValue) {
  const values = Array.isArray(rawValue) ? rawValue.map(cleanText).filter(Boolean) : [];
  const value = Array.isArray(rawValue) ? '' : cleanText(rawValue);
  const hasAnswer = field.kind === 'checkbox' ? values.length > 0 : Boolean(value);
  if (field.required && !hasAnswer) {
    throw new ApiError(422, 'REQUIRED_GOOGLE_FORM_FIELD', 'Completa los campos obligatorios.', {
      [field.id]: 'Este campo es obligatorio.',
    });
  }
  if (!hasAnswer) return;

  if (field.kind === 'checkbox') {
    for (const item of values) payload.append(`entry.${field.id}`, item);
    return;
  }
  if (field.kind === 'date') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw invalidField(field.id);
    payload.set(`entry.${field.id}_year`, match[1]);
    payload.set(`entry.${field.id}_month`, String(Number(match[2])));
    payload.set(`entry.${field.id}_day`, String(Number(match[3])));
    return;
  }
  if (field.kind === 'time') {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) throw invalidField(field.id);
    payload.set(`entry.${field.id}_hour`, String(Number(match[1])));
    payload.set(`entry.${field.id}_minute`, String(Number(match[2])));
    return;
  }
  payload.set(`entry.${field.id}`, value);
}

function invalidField(id) {
  return new ApiError(422, 'INVALID_GOOGLE_FORM_FIELD', 'Revisa los campos indicados.', {
    [id]: 'El valor no es válido.',
  });
}

function extractHiddenValue(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(
    new RegExp(`name=["']${escapedName}["'][^>]*value=["']([^"']*)["']`, 'i'),
  );
  return match?.[1] ?? null;
}

function cleanText(value) {
  return typeof value === 'string'
    ? value
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}
