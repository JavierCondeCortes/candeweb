import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmailService,
  getAccessInvitationTemplate,
  previewAccessInvitation,
  renderAccessInvitation,
  validateAccessInvitationTemplate,
} from './email.mjs';

const noCustomTemplateDatabase = {
  prepare() {
    return { get: () => undefined };
  },
};

test('renderiza la plantilla predeterminada con CSS inline y valores escapados', () => {
  const template = getAccessInvitationTemplate(noCustomTemplateDatabase);
  const rendered = renderAccessInvitation(template, {
    displayName: '<Piloto & copiloto>',
    confirmationUrl: 'https://candemor.test/aceptar-invitacion?token=abc&source=test',
    expiresAt: '4 de septiembre de 2026, 20:00 CEST',
    invitedByName: 'Owner Candemor',
    supportEmail: 'hola@candemor.test',
    websiteUrl: 'https://candemor.test',
  });

  assert.match(rendered.subject, /Candemor Racing Team/);
  assert.match(rendered.html, /&lt;Piloto &amp; copiloto&gt;/);
  assert.match(rendered.html, /style="[^"]+"/);
  assert.match(rendered.text, /https:\/\/candemor\.test\/aceptar-invitacion/);
});

test('rechaza variables desconocidas, campos obligatorios y contenido activo', () => {
  const template = getAccessInvitationTemplate(noCustomTemplateDatabase);
  assert.throws(
    () =>
      validateAccessInvitationTemplate({ ...template, htmlTemplate: '<script>alert(1)</script>' }),
    (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.fields.htmlTemplate),
  );
  assert.throws(
    () => validateAccessInvitationTemplate({ ...template, textTemplate: '{{unknownVariable}}' }),
    (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.fields.textTemplate),
  );
});

test('el servicio SMTP distingue entre desactivado y enviado', async () => {
  const disabled = createEmailService({ enabled: false });
  assert.deepEqual(await disabled.send({}), { status: 'disabled' });

  const messages = [];
  const enabled = createEmailService({
    enabled: true,
    host: 'smtp.candemor.test',
    port: 587,
    fromEmail: 'no-reply@candemor.test',
    transporter: {
      async sendMail(message) {
        messages.push(message);
      },
    },
  });
  const preview = previewAccessInvitation(
    getAccessInvitationTemplate(noCustomTemplateDatabase),
    'https://candemor.test',
  );
  const delivery = await enabled.send({ to: 'owner@candemor.test', ...preview });
  assert.equal(delivery.status, 'sent');
  assert.equal(messages[0].from.address, 'no-reply@candemor.test');
  assert.equal(messages[0].to, 'owner@candemor.test');
});
