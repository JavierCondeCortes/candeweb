import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleFormsService, parseGoogleFormHtml } from './google-forms.mjs';

const publicData = [
  null,
  [
    'Descripción oficial',
    [
      [1, 'Datos del piloto', 'Información básica', 6],
      [2, 'Nombre de piloto', 'El nombre exacto de iRacing', 0, [[101, null, 1]]],
      [
        3,
        'Estado pre-carrera',
        null,
        2,
        [
          [
            102,
            [
              ['Con ganas', null, null, null, 0],
              ['Con nervios', null, null, null, 0],
            ],
            1,
          ],
        ],
      ],
      [4, 'Disponibilidad', null, 4, [[103, [['Viernes'], ['Sábado']], 0]]],
    ],
    null,
    null,
    null,
    null,
    null,
    null,
    'Inscripción Candeonato',
  ],
];

const formHtml = `<!doctype html><script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(
  publicData,
)};</script><input type="hidden" name="fbzx" value="token-123">`;

test('convierte la definición pública de Google Forms en campos nativos', () => {
  const schema = parseGoogleFormHtml(formHtml, {
    viewUrl: 'https://docs.google.com/forms/d/e/form-id/viewform',
    formId: 'form-id',
  });

  assert.equal(schema.title, 'Inscripción Candeonato');
  assert.equal(schema.description, 'Descripción oficial');
  assert.equal(schema.supported, true);
  assert.deepEqual(
    schema.fields.map(({ id, kind, required }) => ({ id, kind, required })),
    [
      { id: 'section-1', kind: 'section', required: undefined },
      { id: '101', kind: 'text', required: true },
      { id: '102', kind: 'radio', required: true },
      { id: '103', kind: 'checkbox', required: false },
    ],
  );
  assert.deepEqual(schema.fields[2].options, ['Con ganas', 'Con nervios']);
});

test('envía las respuestas nativas a los entry de Google Forms', async () => {
  let submission;
  const fetchImpl = async (url, options = {}) => {
    if (options.method === 'POST') {
      submission = { url, body: new URLSearchParams(options.body) };
      return new Response('<html>Gracias</html>', { status: 200 });
    }
    return new Response(formHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  };
  Object.defineProperty(fetchImpl, 'name', { value: 'fetchImpl' });
  const originalFetch = fetchImpl;
  const service = createGoogleFormsService({
    fetchImpl: async (url, options) => {
      const response = await originalFetch(url, options);
      Object.defineProperty(response, 'url', {
        value: 'https://docs.google.com/forms/d/e/form-id/viewform',
      });
      return response;
    },
  });

  const result = await service.submit({
    url: 'https://docs.google.com/forms/d/e/form-id/viewform',
    answers: { 101: 'Andrea Real', 102: 'Con ganas', 103: ['Viernes', 'Sábado'] },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(submission.url, 'https://docs.google.com/forms/d/e/form-id/formResponse');
  assert.equal(submission.body.get('entry.101'), 'Andrea Real');
  assert.deepEqual(submission.body.getAll('entry.103'), ['Viernes', 'Sábado']);
  assert.equal(submission.body.get('fbzx'), 'token-123');
});

test('rechaza el envío cuando falta una respuesta obligatoria', async () => {
  const service = createGoogleFormsService({
    fetchImpl: async () => {
      const response = new Response(formHtml, { status: 200 });
      Object.defineProperty(response, 'url', {
        value: 'https://docs.google.com/forms/d/e/form-id/viewform',
      });
      return response;
    },
  });

  await assert.rejects(
    service.submit({
      url: 'https://docs.google.com/forms/d/e/form-id/viewform',
      answers: { 102: 'Con ganas' },
    }),
    (error) => Boolean(error.code === 'REQUIRED_GOOGLE_FORM_FIELD' && error.fields['101']),
  );
});
