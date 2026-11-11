import test from 'node:test';
import assert from 'node:assert/strict';
import {
  noticeHtml,
  noticeText,
  phoneLast10,
  requestLink,
} from '../src/models/whatsapp-approval.model.js';
import {
  N8N_PATHS,
  createN8nApprovalClient,
  validateN8nConfig,
} from '../src/integrations/n8n/n8nApproval.client.js';
import { createWhatsappApprovalService } from '../src/services/whatsapp-approval.service.js';

const token = 'x'.repeat(40);
const sample = {
  id: 'f1b2c3d4-0000-4000-8000-000000000002',
  number: 2,
  status: 'Solicitada',
  lot: 'Lote 4',
  crop: 'Maíz',
  ranch: 'Zona Norte',
  hectares: '12.50',
  treatment: 'Fungicida <foliar>',
  priority: 'Alta',
  notes: '',
  supplier_name: 'AGRASAMA',
  supplier_vat: 'AGR010101AAA',
  application_period_name: 'Noviembre',
  rate_per_hectare: '400.00',
  estimated_subtotal: '5000.00',
  requested_date: new Date('2026-11-10T00:00:00Z'),
  created_at: new Date('2026-11-09T00:00:00Z'),
  requested_by: 'María',
  purchase_order_status: null,
};

test('el teléfono se compara por sus últimos 10 dígitos', () => {
  assert.equal(phoneLast10('5216681234567@s.whatsapp.net'), '6681234567');
  assert.equal(phoneLast10('+52 1 668 123 4567'), '6681234567');
  assert.equal(phoneLast10('63793954'), null);
  assert.equal(phoneLast10(undefined), null);
});

test('el aviso lleva el link a la solicitud y aclara que responder no aprueba', () => {
  const link = requestLink('http://127.0.0.1:5173/', sample.id);
  assert.equal(link, `http://127.0.0.1:5173/validar?solicitud=${sample.id}`);
  const text = noticeText({ request: sample, link });
  assert.match(text, /AA-00002/);
  assert.ok(text.includes(link));
  assert.match(text, /no aprueba nada/);
  assert.doesNotMatch(text, /\/aprobar/);
});

test('el PDF trae todo el detalle, el estado de la OCM y escapa el HTML', () => {
  const html = noticeHtml({
    request: sample,
    execution: null,
  });
  assert.ok(
    !html.includes('solicitud=') && !html.includes('http'),
    'el link va solo en el mensaje',
  );
  for (const expected of [
    'AA-00002',
    'Zona Norte',
    'AGRASAMA',
    'AGR010101AAA',
    '$400.00 MXN',
    '$5,000.00 MXN',
    'Sin OCM todavía',
    '10/11/2026',
  ])
    assert.ok(html.includes(expected), expected);
  assert.ok(html.includes('Fungicida &lt;foliar&gt;'));
  assert.ok(!html.includes('<foliar>'));
  const withOcm = noticeHtml({
    request: { ...sample, purchase_order_status: 'created', purchase_order_name: 'P20494' },
  });
  assert.ok(withOcm.includes('Creada en STAG') && withOcm.includes('P20494'));
});

test('la conexión con n8n exige HTTPS, origen sin ruta y token largo', () => {
  assert.deepEqual(validateN8nConfig({ url: 'https://n8n.example.com/', token }), {
    url: 'https://n8n.example.com',
    token,
  });
  for (const values of [
    { url: 'http://n8n.example.com', token },
    { url: 'https://n8n.example.com/webhook/x', token },
    { url: 'https://user:pass@n8n.example.com', token },
    { url: 'https://n8n.example.com/?a=1', token },
    { url: 'no es url', token },
    { url: 'https://n8n.example.com', token: 'corto' },
    { url: 'https://n8n.example.com', token: undefined },
  ])
    assert.throws(
      () => validateN8nConfig(values),
      (error) => error.status === 503,
    );
});

test('el cliente solo avisa: sin redirecciones, con token y hasta 90 s', async (t) => {
  assert.deepEqual(Object.keys(N8N_PATHS), ['notify']);
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (ms) => {
    timeouts.push(ms);
    return new AbortController().signal;
  });
  const calls = [];
  const client = createN8nApprovalClient({
    getConfig: () => ({ url: 'https://n8n.example.com', token }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, text: async () => '{"ok":true}' };
    },
  });
  await client.notify([{ folio: 'AA-00001' }]);
  assert.equal(calls[0].url, 'https://n8n.example.com/webhook/gab-aa-aprobacion/aviso');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers['X-GAB-Token'], token);
  assert.deepEqual(JSON.parse(calls[0].options.body), { messages: [{ folio: 'AA-00001' }] });
  assert.deepEqual(timeouts, [90000]);
  assert.equal('pending' in client || 'ack' in client, false);
});

test('el cliente de n8n informa fallas de red sin exponer detalles', async () => {
  const client = createN8nApprovalClient({
    getConfig: () => ({ url: 'https://n8n.example.com', token }),
    fetchImpl: async () => {
      throw new Error(`fallo con ${token}`);
    },
  });
  await assert.rejects(
    () => client.notify([]),
    (error) => error.status === 503 && !error.message.includes(token),
  );
});

const service = (overrides = {}) => {
  const calls = { notify: [], events: [] };
  const instance = createWhatsappApprovalService({
    repository: {
      activeApprovers: async () => [{ id: 1, name: 'Aprobador', phone_last10: '6681234567' }],
      recordNotice: async (...args) => calls.events.push(args),
      ...overrides.repository,
    },
    requests: {
      find: async () => sample,
      details: async () => ({ execution: null, attachments: [] }),
      ...overrides.requests,
    },
    client: {
      enabled: () => true,
      notify: async (messages) => calls.notify.push(messages),
      ...overrides.client,
    },
    appUrl: () => 'http://127.0.0.1:5173',
  });
  return { instance, calls };
};
const admin = { name: 'Admin', role: 'admin' };

test('sin habilitar n8n no se manda nada', async () => {
  const { instance, calls } = service({ client: { enabled: () => false } });
  await assert.rejects(
    () => instance.sendNotice('id', admin),
    (error) => error.status === 503,
  );
  assert.equal(calls.notify.length, 0);
});

test('el solicitante solo avisa de sus propias solicitudes', async () => {
  let scope;
  const { instance, calls } = service({
    requests: {
      find: async (id, owner) => {
        scope = owner;
        return null;
      },
    },
  });
  await assert.rejects(
    () => instance.sendNotice('id', { name: 'María', role: 'solicitante' }),
    (error) => error.status === 404,
  );
  assert.equal(scope, 'María');
  assert.equal(calls.notify.length, 0);
});

test('solo se avisa de solicitudes en Solicitada y con aprobador registrado', async () => {
  const approved = service({ requests: { find: async () => ({ ...sample, status: 'Aprobada' }) } });
  await assert.rejects(
    () => approved.instance.sendNotice('id', admin),
    (error) => error.status === 409,
  );
  const nobody = service({ repository: { activeApprovers: async () => [] } });
  await assert.rejects(
    () => nobody.instance.sendNotice('id', admin),
    (error) => error.status === 503,
  );
  assert.equal(approved.calls.notify.length + nobody.calls.notify.length, 0);
});

test('el aviso manda texto con link, el PDF con diseño y el HTML de respaldo a cada aprobador, y lo registra', async () => {
  const { instance, calls } = service();
  const result = await instance.sendNotice(sample.id, admin);
  assert.deepEqual(result, { folio: 'AA-00002', approvers: ['Aprobador'] });
  const [message] = calls.notify[0];
  assert.equal(message.phone, '5216681234567');
  assert.equal(message.pdfName, 'Solicitud_AA-00002.pdf');
  assert.ok(message.text.includes(`http://127.0.0.1:5173/validar?solicitud=${sample.id}`));
  assert.match(message.html, /<table>/);
  assert.ok(!message.html.includes('solicitud='));
  assert.ok(Buffer.from(message.pdfBase64, 'base64').subarray(0, 5).toString() === '%PDF-');
  assert.deepEqual(calls.events, [[sample.id, 'Admin', ['Aprobador']]]);
});

test('si n8n falla no se registra el aviso', async () => {
  const { instance, calls } = service({
    client: {
      notify: async () => {
        throw Object.assign(new Error('n8n'), { status: 503 });
      },
    },
  });
  await assert.rejects(() => instance.sendNotice(sample.id, admin));
  assert.equal(calls.events.length, 0);
});

test('el aviso automático no bloquea ni rompe el guardado si WhatsApp falla', async () => {
  const warnings = [];
  const log = { warn: (...args) => warnings.push(args) };
  const off = service({ client: { enabled: () => false } });
  assert.equal(off.instance.notifyInBackground('id', admin, log), false);
  const failing = service({
    client: {
      notify: async () => {
        throw Object.assign(new Error('n8n respondió 500.'), { status: 503 });
      },
    },
  });
  assert.equal(failing.instance.notifyInBackground(sample.id, admin, log), true);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(warnings.length, 1);
  assert.equal(failing.calls.events.length, 0);
});
