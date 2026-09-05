import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import juice from 'juice';
import nodemailer from 'nodemailer';
import { ApiError } from './validation.mjs';

const TEMPLATE_KEY = 'access-invitation';
const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'email-templates', TEMPLATE_KEY);
const DEFAULT_SUBJECT = 'Tu acceso a {{brandName}} está preparado';
const DEFAULT_TEMPLATE = Object.freeze({
  templateKey: TEMPLATE_KEY,
  subjectTemplate: DEFAULT_SUBJECT,
  htmlTemplate: readFileSync(join(TEMPLATE_DIR, 'template.html'), 'utf8'),
  css: readFileSync(join(TEMPLATE_DIR, 'styles.css'), 'utf8'),
  textTemplate: readFileSync(join(TEMPLATE_DIR, 'template.txt'), 'utf8'),
});
const ALLOWED_VARIABLES = new Set([
  'brandName',
  'displayName',
  'confirmationUrl',
  'expiresAt',
  'invitedByName',
  'supportEmail',
  'websiteUrl',
]);
const REQUIRED_BODY_VARIABLES = ['displayName', 'confirmationUrl', 'expiresAt'];
const VARIABLE_PATTERN = /{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g;
const MAX_LENGTHS = {
  subjectTemplate: 180,
  htmlTemplate: 60_000,
  css: 30_000,
  textTemplate: 20_000,
};

export function createEmailService(options = {}) {
  const config = smtpConfig(options);
  let transporter = options.transporter ?? null;

  return {
    isConfigured: () => config.configured,
    configurationIssue: () => config.issue,
    async send(message) {
      if (!config.configured) return { status: 'disabled' };
      try {
        transporter ??= nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.user ? { user: config.user, pass: config.password } : undefined,
          connectionTimeout: config.connectionTimeout,
          greetingTimeout: config.connectionTimeout,
          socketTimeout: Math.max(config.connectionTimeout * 2, 10_000),
        });
        await transporter.sendMail({
          from: { name: config.fromName, address: config.fromEmail },
          replyTo: config.replyTo || undefined,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        return { status: 'sent', sentAt: new Date().toISOString() };
      } catch (error) {
        console.error('No se pudo entregar el correo SMTP.', safeMailError(error));
        return { status: 'failed' };
      }
    },
  };
}

export function getAccessInvitationTemplate(db) {
  const row = db
    .prepare(
      `SELECT template_key, subject_template, html_template, css, text_template,
              updated_by_name, updated_at
       FROM email_templates WHERE template_key = ?`,
    )
    .get(TEMPLATE_KEY);
  if (!row) {
    return {
      ...DEFAULT_TEMPLATE,
      isCustom: false,
      updatedAt: null,
      updatedByName: null,
    };
  }
  return {
    templateKey: row.template_key,
    subjectTemplate: row.subject_template,
    htmlTemplate: row.html_template,
    css: row.css,
    textTemplate: row.text_template,
    isCustom: true,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  };
}

export function saveAccessInvitationTemplate(db, input, actor) {
  const template = validateAccessInvitationTemplate(input);
  const timestamp = new Date().toISOString();
  db.prepare(
    `INSERT INTO email_templates
      (template_key, subject_template, html_template, css, text_template,
       updated_by, updated_by_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(template_key) DO UPDATE SET
       subject_template = excluded.subject_template,
       html_template = excluded.html_template,
       css = excluded.css,
       text_template = excluded.text_template,
       updated_by = excluded.updated_by,
       updated_by_name = excluded.updated_by_name,
       updated_at = excluded.updated_at`,
  ).run(
    TEMPLATE_KEY,
    template.subjectTemplate,
    template.htmlTemplate,
    template.css,
    template.textTemplate,
    actor.id,
    actor.displayName,
    timestamp,
  );
  return getAccessInvitationTemplate(db);
}

export function resetAccessInvitationTemplate(db) {
  db.prepare('DELETE FROM email_templates WHERE template_key = ?').run(TEMPLATE_KEY);
  return getAccessInvitationTemplate(db);
}

export function validateAccessInvitationTemplate(input) {
  const fields = {};
  const template = {
    templateKey: TEMPLATE_KEY,
    subjectTemplate: String(input?.subjectTemplate ?? '').trim(),
    htmlTemplate: String(input?.htmlTemplate ?? '').trim(),
    css: String(input?.css ?? '').trim(),
    textTemplate: String(input?.textTemplate ?? '').trim(),
  };

  for (const [field, maximum] of Object.entries(MAX_LENGTHS)) {
    if (!template[field]) fields[field] = 'Este campo es obligatorio.';
    else if (template[field].length > maximum) {
      fields[field] =
        `El contenido no puede superar ${maximum.toLocaleString('es-ES')} caracteres.`;
    }
  }

  for (const field of ['subjectTemplate', 'htmlTemplate', 'textTemplate']) {
    const unknown = [...template[field].matchAll(VARIABLE_PATTERN)]
      .map((match) => match[1])
      .filter((variable) => !ALLOWED_VARIABLES.has(variable));
    if (unknown.length) fields[field] = `Variable no permitida: {{${unknown[0]}}}.`;
  }

  for (const field of ['htmlTemplate', 'textTemplate']) {
    const missing = REQUIRED_BODY_VARIABLES.filter(
      (variable) => !new RegExp(`{{\\s*${variable}\\s*}}`).test(template[field]),
    );
    if (missing.length) {
      fields[field] =
        `Faltan variables obligatorias: ${missing.map((item) => `{{${item}}}`).join(', ')}.`;
    }
  }

  if (
    /<\s*(script|iframe|object|embed|form|input|button|link|base)\b/i.test(template.htmlTemplate)
  ) {
    fields.htmlTemplate = 'La plantilla contiene una etiqueta HTML no permitida.';
  } else if (
    /\son[a-z]+\s*=/i.test(template.htmlTemplate) ||
    /javascript\s*:/i.test(template.htmlTemplate)
  ) {
    fields.htmlTemplate = 'La plantilla contiene código activo no permitido.';
  } else if (/<img\b[^>]*\bsrc\s*=\s*["']?https?:/i.test(template.htmlTemplate)) {
    fields.htmlTemplate = 'No se permiten imágenes remotas porque podrían rastrear aperturas.';
  }
  if (/@import\b|expression\s*\(|javascript\s*:|url\s*\(\s*["']?https?:/i.test(template.css)) {
    fields.css = 'El CSS contiene recursos externos o expresiones no permitidas.';
  }

  if (Object.keys(fields).length) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Hay campos que necesitan revisión.', fields);
  }
  return template;
}

export function renderAccessInvitation(templateInput, values) {
  const template = validateAccessInvitationTemplate(templateInput);
  const normalized = {
    brandName: values.brandName || 'Candemor Racing Team',
    displayName: values.displayName || 'Piloto Candemor',
    confirmationUrl: values.confirmationUrl,
    expiresAt: values.expiresAt,
    invitedByName: values.invitedByName || 'El equipo de Candemor',
    supportEmail: values.supportEmail || 'candemorracingteam@gmail.com',
    websiteUrl: values.websiteUrl,
  };
  const subject = replaceVariables(template.subjectTemplate, normalized, escapePlainText);
  const html = replaceVariables(template.htmlTemplate, normalized, escapeHtml);
  const css = template.css;
  const text = replaceVariables(template.textTemplate, normalized, escapePlainText);
  return {
    subject,
    html: juice.inlineContent(html, css, {
      applyStyleTags: true,
      preserveMediaQueries: true,
      removeStyleTags: true,
    }),
    text,
  };
}

export async function sendAccessInvitation({
  db,
  emailService,
  to,
  displayName,
  invitationPath,
  expiresAt,
  invitedByName,
  publicAppUrl,
  supportEmail,
}) {
  if (!emailService?.isConfigured()) return { status: 'disabled' };
  try {
    const websiteUrl = normalizePublicUrl(publicAppUrl);
    const confirmationUrl = new URL(invitationPath, `${websiteUrl}/`).toString();
    const rendered = renderAccessInvitation(getAccessInvitationTemplate(db), {
      displayName,
      confirmationUrl,
      expiresAt: formatMadridDate(expiresAt),
      invitedByName,
      supportEmail,
      websiteUrl,
    });
    return emailService.send({ to, ...rendered });
  } catch (error) {
    console.error('No se pudo preparar el correo de invitación.', safeMailError(error));
    return { status: 'failed' };
  }
}

export function previewAccessInvitation(template, publicAppUrl) {
  const websiteUrl = normalizePublicUrl(publicAppUrl);
  return renderAccessInvitation(template, {
    displayName: 'Alex Racing',
    confirmationUrl: `${websiteUrl}/aceptar-invitacion?token=vista-previa`,
    expiresAt: formatMadridDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    invitedByName: 'Candemor Admin',
    supportEmail: 'hola@candemor.com',
    websiteUrl,
  });
}

function smtpConfig(options) {
  const enabled = booleanValue(options.enabled ?? process.env.SMTP_ENABLED);
  const host = cleanHeader(options.host ?? process.env.SMTP_HOST);
  const port = Number(options.port ?? process.env.SMTP_PORT ?? 587);
  const secure = booleanValue(options.secure ?? process.env.SMTP_SECURE);
  const user = cleanHeader(options.user ?? process.env.SMTP_USER);
  const password = String(options.password ?? process.env.SMTP_PASSWORD ?? '');
  const fromName =
    cleanHeader(options.fromName ?? process.env.SMTP_FROM_NAME) || 'Candemor Racing Team';
  const fromEmail = cleanHeader(options.fromEmail ?? process.env.SMTP_FROM_EMAIL);
  const replyTo = cleanHeader(options.replyTo ?? process.env.SMTP_REPLY_TO);
  const connectionTimeout = boundedNumber(
    options.connectionTimeout ?? process.env.SMTP_CONNECTION_TIMEOUT_MS,
    8_000,
    1_000,
    30_000,
  );
  const validPort = Number.isInteger(port) && port > 0 && port <= 65_535;
  const issue =
    enabled && (!host || !validPort || !fromEmail || (user && !password))
      ? 'La configuración SMTP está incompleta.'
      : null;
  return {
    enabled,
    configured: enabled && !issue,
    issue,
    host,
    port,
    secure,
    user,
    password,
    fromName,
    fromEmail,
    replyTo,
    connectionTimeout,
  };
}

function replaceVariables(template, values, escape) {
  return template.replace(VARIABLE_PATTERN, (_match, name) => escape(String(values[name] ?? '')));
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapePlainText(value) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function normalizePublicUrl(value) {
  const fallback = 'http://localhost:4200';
  try {
    const parsed = new URL(String(value || fallback));
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function formatMadridDate(value) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function booleanValue(value) {
  return value === true || String(value ?? '').toLowerCase() === 'true';
}

function cleanHeader(value) {
  return String(value ?? '')
    .replace(/[\r\n]/g, '')
    .trim();
}

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function safeMailError(error) {
  return {
    code: typeof error?.code === 'string' ? error.code : 'MAIL_ERROR',
    command: typeof error?.command === 'string' ? error.command : undefined,
  };
}
