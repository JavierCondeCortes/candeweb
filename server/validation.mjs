import { madridDateTimeToIso } from './timezone.mjs';

export class ApiError extends Error {
  constructor(status, code, message, fields = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function normalizeSlug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function validateMember(input, { publishing = false } = {}) {
  const fields = {};
  const name = cleanText(input.name, 80);
  const slug = normalizeSlug(input.slug || name);
  const photoUrl = optionalUrlOrPath(input.photoUrl, 'photoUrl', fields);
  const photoAlt = cleanOptionalText(input.photoAlt, 160);
  const photoConsentConfirmed = Boolean(input.photoConsentConfirmed);

  if (name.length < 2) fields.name = 'Escribe un nombre de entre 2 y 80 caracteres.';
  if (!slug) fields.slug = 'El slug no es válido.';
  if (publishing && !photoUrl) fields.photoUrl = 'Añade una fotografía antes de publicar.';
  if (photoUrl && !photoAlt) fields.photoAlt = 'Describe la fotografía antes de publicar.';
  if (publishing && photoUrl && !photoConsentConfirmed) {
    fields.photoConsentConfirmed = 'Confirma que Candemor puede publicar esta fotografía.';
  }

  const status = oneOf(input.status, ['draft', 'published', 'archived'], 'draft');
  const member = {
    slug,
    name,
    alias: cleanOptionalText(input.alias, 50),
    roleLabel: cleanOptionalText(input.roleLabel, 80),
    bio: cleanOptionalText(input.bio, 280),
    photoUrl,
    photoAlt,
    photoConsentConfirmed,
    twitchUrl: socialUrl(input.twitchUrl, 'twitch.tv', 'twitchUrl', fields),
    instagramUrl: socialUrl(input.instagramUrl, 'instagram.com', 'instagramUrl', fields),
    youtubeUrl: socialUrl(input.youtubeUrl, 'youtube.com', 'youtubeUrl', fields, ['youtu.be']),
    xUrl: socialUrl(input.xUrl, 'x.com', 'xUrl', fields, ['twitter.com']),
    websiteUrl: optionalHttpsUrl(input.websiteUrl, 'websiteUrl', fields),
    displayOrder: nonNegativeInteger(input.displayOrder, 'displayOrder', fields),
    isFeatured: Boolean(input.isFeatured),
    isDemo: Boolean(input.isDemo),
    status,
  };

  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return member;
}

export function validateSponsor(input, { publishing = false } = {}) {
  const fields = {};
  const name = cleanText(input.name, 100);
  const logoUrl = optionalUrlOrPath(input.logoUrl, 'logoUrl', fields);
  const logoAlt = cleanOptionalText(input.logoAlt, 160);

  if (name.length < 2) fields.name = 'Escribe un nombre de entre 2 y 100 caracteres.';
  if (publishing && !logoUrl) fields.logoUrl = 'Añade un logotipo antes de publicar.';
  if (logoUrl && !logoAlt) fields.logoAlt = 'Describe el logotipo antes de publicar.';

  const sponsor = {
    name,
    description: cleanOptionalText(input.description, 240),
    logoUrl,
    logoAlt,
    websiteUrl: optionalHttpsUrl(input.websiteUrl, 'websiteUrl', fields),
    displayOrder: nonNegativeInteger(input.displayOrder, 'displayOrder', fields),
    status: oneOf(input.status, ['draft', 'published', 'archived'], 'draft'),
  };

  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return sponsor;
}

export function validateSkin(input, { publishing = false } = {}) {
  const fields = {};
  const carName = cleanText(input.carName, 120);
  const imageUrl = optionalUrlOrPath(input.imageUrl, 'imageUrl', fields);
  const imageAlt = cleanOptionalText(input.imageAlt, 160);
  const targetUrl = optionalHttpsUrl(input.targetUrl, 'targetUrl', fields);
  if (carName.length < 2) fields.carName = 'Escribe el nombre del coche.';
  if (publishing && !imageUrl) fields.imageUrl = 'Añade una fotografía antes de publicar.';
  if (imageUrl && !imageAlt) fields.imageAlt = 'Describe la fotografía antes de publicar.';
  if (publishing && !targetUrl) fields.targetUrl = 'Añade una URL HTTPS antes de publicar.';
  const skin = {
    carName,
    imageUrl,
    imageAlt,
    targetUrl,
    displayOrder: nonNegativeInteger(input.displayOrder, 'displayOrder', fields),
    status: oneOf(input.status, ['draft', 'published', 'archived'], 'draft'),
  };
  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return skin;
}

export function validateChampionship(input, { publishing = false } = {}) {
  const fields = {};
  const name = cleanText(input.name, 100);
  const slug = normalizeSlug(input.slug || name);
  const startAt = optionalDate(input.startAt, 'startAt', fields);
  const endAt = optionalDate(input.endAt, 'endAt', fields);
  const coverUrl = optionalUrlOrPath(input.coverUrl, 'coverUrl', fields);
  const coverAlt = cleanOptionalText(input.coverAlt, 160);
  const backgroundVideoUrl = optionalUrlOrPath(
    input.backgroundVideoUrl,
    'backgroundVideoUrl',
    fields,
  );
  const backgroundVideoMimeType = backgroundVideoUrl
    ? videoMimeType(input.backgroundVideoMimeType, backgroundVideoUrl, fields)
    : null;

  if (name.length < 2) fields.name = 'Escribe un nombre de entre 2 y 100 caracteres.';
  if (!slug) fields.slug = 'El slug no es válido.';
  if (startAt && endAt && Date.parse(startAt) >= Date.parse(endAt)) {
    fields.endAt = 'La fecha final debe ser posterior a la fecha de inicio.';
  }
  if (publishing && !coverUrl) fields.coverUrl = 'Añade una portada antes de publicar.';
  if (coverUrl && !coverAlt) fields.coverAlt = 'Describe la portada antes de publicar.';

  const externalTournamentId = optionalPositiveInteger(
    input.externalTournamentId,
    'externalTournamentId',
    fields,
  );
  const status = oneOf(
    input.status,
    ['draft', 'registration', 'active', 'finished', 'archived'],
    'draft',
  );
  if (Boolean(input.isFeatured) && status === 'draft') {
    fields.isFeatured = 'Publica la edición antes de destacarla.';
  }

  const championship = {
    externalTournamentId,
    slug,
    name,
    editionNumber: optionalPositiveInteger(input.editionNumber, 'editionNumber', fields),
    subtitle: cleanOptionalText(input.subtitle, 100),
    season: cleanOptionalText(input.season, 30),
    summary: cleanOptionalText(input.summary, 320),
    summaryEn: cleanOptionalText(input.summaryEn, 320),
    description: cleanOptionalText(input.description, 5000),
    descriptionEn: cleanOptionalText(input.descriptionEn, 5000),
    coverUrl,
    coverAlt,
    coverAltEn: cleanOptionalText(input.coverAltEn, 160),
    backgroundVideoUrl,
    backgroundVideoMimeType,
    startAt,
    endAt,
    registrationUrl: optionalHttpsUrl(input.registrationUrl, 'registrationUrl', fields),
    rulesUrl: optionalUrlOrPath(input.rulesUrl, 'rulesUrl', fields),
    status,
    isFeatured: Boolean(input.isFeatured),
    displayOrder: nonNegativeInteger(input.displayOrder, 'displayOrder', fields),
  };

  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return championship;
}

export function validateSettings(input) {
  const fields = {};
  const twitchChannelLogin = cleanText(input.twitchChannelLogin, 80).toLowerCase();
  if (!/^[a-z0-9_]{3,25}$/.test(twitchChannelLogin)) {
    fields.twitchChannelLogin = 'El identificador de Twitch no es válido.';
  }

  const twitchChannelUrl = socialUrl(
    input.twitchChannelUrl,
    'twitch.tv',
    'twitchChannelUrl',
    fields,
  );

  const settings = {
    twitchChannelLogin,
    twitchChannelUrl,
    twitchChannels: validateTwitchChannels(
      input.twitchChannels,
      twitchChannelLogin,
      twitchChannelUrl,
      fields,
    ),
    featuredChampionshipId: nullableString(input.featuredChampionshipId, 100),
    contactEmail: optionalEmail(input.contactEmail, 'contactEmail', fields),
    discordUrl: socialUrl(input.discordUrl, 'discord.gg', 'discordUrl', fields, ['discord.com']),
    instagramUrl: socialUrl(input.instagramUrl, 'instagram.com', 'instagramUrl', fields),
    youtubeUrl: socialUrl(input.youtubeUrl, 'youtube.com', 'youtubeUrl', fields, ['youtu.be']),
  };

  if (!settings.twitchChannelUrl) {
    fields.twitchChannelUrl = 'Añade la URL oficial de Twitch.';
  }
  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return settings;
}

function validateTwitchChannels(input, primaryLogin, primaryUrl, fields) {
  const supplied = Array.isArray(input) ? input : [];
  if (supplied.length > 6) {
    fields.twitchChannels = 'Configura un máximo de seis canales de Twitch.';
  }

  const candidates = [{ login: primaryLogin, url: primaryUrl, isOfficial: true }, ...supplied];
  const channels = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const login = cleanText(candidate?.login, 25).toLowerCase();
    if (!login || seen.has(login)) continue;
    if (!/^[a-z0-9_]{3,25}$/.test(login)) {
      fields.twitchChannels = `El canal adicional «${login || 'vacío'}» no es válido.`;
      continue;
    }
    const url = socialUrl(
      candidate?.url || `https://www.twitch.tv/${login}`,
      'twitch.tv',
      'twitchChannels',
      fields,
    );
    if (!url) continue;
    seen.add(login);
    channels.push({
      login,
      url,
      isOfficial: login === primaryLogin,
      priority: channels.length,
    });
    if (channels.length === 6) break;
  }

  return channels;
}

export function validateAdminIdentity(input, { setup = false, requirePassword = true } = {}) {
  const fields = {};
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(input.password ?? '');
  const displayName = cleanText(input.displayName || email.split('@')[0], 80);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Introduce un correo válido.';
  if (requirePassword && password.length < 12) {
    fields.password = 'La contraseña debe tener al menos 12 caracteres.';
  }
  if (setup && displayName.length < 2) fields.displayName = 'Introduce un nombre visible.';

  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return { email, password, displayName };
}

export function validateAccessRequest(input) {
  const fields = {};
  const email = String(input.email ?? '')
    .trim()
    .toLowerCase();
  const displayName = cleanText(input.displayName, 80);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Introduce un correo válido.';
  if (displayName.length < 2) fields.displayName = 'Introduce tu nombre.';

  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return { email, displayName };
}

function cleanText(value, maxLength) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function cleanOptionalText(value, maxLength) {
  const cleaned = String(value ?? '')
    .trim()
    .slice(0, maxLength);
  return cleaned || null;
}

function nullableString(value, maxLength) {
  const cleaned = String(value ?? '')
    .trim()
    .slice(0, maxLength);
  return cleaned || null;
}

function oneOf(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function nonNegativeInteger(value, field, fields) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0) {
    fields[field] = 'Debe ser un número entero igual o mayor que cero.';
    return 0;
  }
  return number;
}

function optionalPositiveInteger(value, field, fields) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    fields[field] = 'Debe ser un número entero mayor que cero.';
    return null;
  }
  return number;
}

function optionalDate(value, field, fields) {
  if (!value) return null;
  try {
    return madridDateTimeToIso(value);
  } catch {
    fields[field] = 'Introduce una fecha válida.';
    return null;
  }
}

function optionalEmail(value, field, fields) {
  if (!value) return null;
  const email = String(value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields[field] = 'Introduce un correo válido.';
    return null;
  }
  return email;
}

function optionalUrlOrPath(value, field, fields) {
  if (!value) return null;
  const cleaned = String(value).trim();
  if (cleaned.startsWith('/') && !cleaned.startsWith('//')) return cleaned;
  return optionalHttpsUrl(cleaned, field, fields);
}

function videoMimeType(value, url, fields) {
  const supplied = cleanOptionalText(value, 40)?.toLowerCase();
  const inferred = String(url).toLowerCase().split(/[?#]/)[0].endsWith('.webm')
    ? 'video/webm'
    : String(url).toLowerCase().split(/[?#]/)[0].endsWith('.mp4')
      ? 'video/mp4'
      : null;
  const mimeType = supplied || inferred;
  if (!['video/mp4', 'video/webm'].includes(mimeType)) {
    fields.backgroundVideoMimeType = 'Selecciona un vídeo MP4 o WebM.';
    return null;
  }
  return mimeType;
}

function optionalHttpsUrl(value, field, fields) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:') throw new Error('invalid protocol');
    return url.toString();
  } catch {
    fields[field] = 'Introduce una URL HTTPS válida.';
    return null;
  }
}

function socialUrl(value, domain, field, fields, alternativeDomains = []) {
  const normalized = optionalHttpsUrl(value, field, fields);
  if (!normalized) return null;
  const hostname = new URL(normalized).hostname.replace(/^www\./, '');
  if (
    hostname !== domain &&
    !hostname.endsWith(`.${domain}`) &&
    !alternativeDomains.includes(hostname)
  ) {
    fields[field] = `La URL debe pertenecer a ${domain}.`;
    return null;
  }
  return normalized;
}
