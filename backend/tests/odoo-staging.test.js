import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStagingConfig,
  buildStagingPurchaseUrl,
} from '../src/integrations/odoo/odooStaging.config.js';
import { createStagingOdooClient } from '../src/integrations/odoo/odooStaging.client.js';

const config = {
  url: 'https://gab-stag-123.dev.odoo.com',
  database: 'gab-stag-123',
  username: 'usuario-prueba',
  apiKey: 'secreto-ficticio',
};
const values = {
  partner_id: 6,
  company_id: 1,
  currency_id: 33,
  picking_type_id: 439,
  origin: 'GAB-AA:solicitud-prueba',
  gab_ocm_bool: true,
  gab_ocm_purchase_type: 'Solicitud',
  order_line: [[0, 0, { product_id: 1277, product_uom: 1, product_qty: 12.5, price_unit: 400 }]],
};

test('el enlace identifica la base y OCM exactas y no admite producción ni IDs alterados', () => {
  const url = new URL(buildStagingPurchaseUrl(config, 321));
  assert.equal(url.origin, config.url);
  assert.equal(url.pathname, '/web');
  assert.equal(url.searchParams.get('db'), config.database);
  const fragment = new URLSearchParams(url.hash.slice(1));
  assert.equal(fragment.get('id'), '321');
  assert.equal(fragment.get('model'), 'purchase.order');
  assert.equal(fragment.get('view_type'), 'form');
  assert.equal(url.href.includes(config.apiKey), false);
  for (const id of [0, -1, 1.5, '321', '321&model=account.payment'])
    assert.throws(() => buildStagingPurchaseUrl(config, id));
  assert.throws(() =>
    buildStagingPurchaseUrl({ ...config, url: 'https://grupo-gab.odoo.com' }, 321),
  );
});

test('el destino STAG rechaza producción, bases cruzadas y URLs alteradas antes de conectar', async () => {
  assert.equal(validateStagingConfig(config).url, config.url);
  for (const change of [
    { url: 'https://grupo-gab.odoo.com', database: 'grupo-gab-prod-123' },
    { database: 'otra-stag-123' },
    { url: 'http://gab-stag-123.dev.odoo.com' },
    { url: 'https://gab-stag-123.dev.odoo.com.ejemplo.test' },
    { url: config.url + '/otra-ruta' },
    { url: config.url + '?destino=produccion' },
    { url: config.url + '#otra-base' },
    { url: 'https://usuario:clave@gab-stag-123.dev.odoo.com' },
    { url: 'https://gab-prod-123.dev.odoo.com', database: 'gab-prod-123' },
    { apiKey: '' },
  ]) {
    let called = false;
    const client = createStagingOdooClient({
      getConfig: () => ({ ...config, ...change }),
      fetchImpl: async () => {
        called = true;
      },
    });
    await assert.rejects(
      () => client.authenticate(),
      (error) => error.status === 503,
    );
    assert.equal(called, false);
  }
});

test('la única escritura permitida es crear una OCM draft en la base STAG', async () => {
  const calls = [];
  const client = createStagingOdooClient({
    getConfig: () => config,
    fetchImpl: async (url, options) => {
      assert.equal(url, config.url + '/jsonrpc');
      assert.equal(options.redirect, 'error');
      const { params } = JSON.parse(options.body);
      assert.equal(params.args[0], config.database);
      calls.push(params);
      if (params.service === 'common') return Response.json({ result: 89 });
      const [, , , model, method, args, kwargs] = params.args;
      assert.equal(model, 'purchase.order');
      assert.equal(method, 'create');
      assert.equal(args[0].state, 'draft');
      assert.equal(args[0].gab_ocm_bool, true);
      assert.equal(args[0].gab_ocm_purchase_type, 'Solicitud');
      assert.deepEqual(args[0].order_line, values.order_line);
      assert.equal(kwargs.context.tracking_disable, true);
      assert.equal(kwargs.context.mail_create_nosubscribe, true);
      assert.equal(kwargs.context.mail_notify_force_send, false);
      assert.deepEqual(kwargs.context.allowed_company_ids, [1]);
      return Response.json({ result: 123 });
    },
  });
  assert.equal(await client.createDraft(values), 123);
  assert.equal(calls.length, 2);
  assert.throws(() => client.read('purchase.order', 'button_confirm', [[123]]), /no permitida/);
  assert.throws(() => client.read('purchase.order', 'create', [values]), /no permitida/);
  assert.throws(() => client.read('account.payment', 'search_read', [[]]), /no permitida/);
  for (const change of [
    { state: 'purchase' },
    { gab_ocm_bool: false },
    { gab_ocm_purchase_type: 'Compra ya hecha' },
    { gab_ocm_dg_bool: true },
    { origin: 'Otra referencia' },
    { order_line: [[1, 1, {}]] },
    { order_line: [null] },
    { order_line: [[0, 0, { gab_ocm_rq_bool: true }]] },
  ])
    assert.throws(() => client.createDraft({ ...values, ...change }), /borrador/);
  assert.equal(calls.length, 2);
});

test('una respuesta perdida se marca incierta y nunca reintenta el POST automáticamente', async () => {
  let writes = 0;
  const client = createStagingOdooClient({
    getConfig: () => config,
    fetchImpl: async (url, options) => {
      const { params } = JSON.parse(options.body);
      if (params.service === 'common') return Response.json({ result: 89 });
      writes++;
      throw new Error('Respuesta perdida');
    },
  });
  await assert.rejects(
    () => client.createDraft(values),
    (error) => error.uncertain === true && error.status === 503,
  );
  assert.equal(writes, 1);
});

test('un rechazo explícito de Odoo es seguro para corregir y oculta credenciales y debug', async () => {
  const client = createStagingOdooClient({
    getConfig: () => config,
    fetchImpl: async (url, options) => {
      const { params } = JSON.parse(options.body);
      return Response.json(
        params.service === 'common'
          ? { result: 89 }
          : {
              error: {
                data: {
                  name: 'odoo.exceptions.ValidationError',
                  message: config.apiKey,
                  debug: 'traza privada',
                },
              },
            },
      );
    },
  });
  await assert.rejects(
    () => client.createDraft(values),
    (error) => {
      assert.equal(error.uncertain, false);
      assert.equal(error.status, 422);
      assert.equal(error.message.includes(config.apiKey), false);
      assert.equal(error.message.includes('traza privada'), false);
      return true;
    },
  );
});

test('las lecturas paralelas comparten una autenticación sin volver a exponer la clave', async () => {
  let auth = 0;
  const client = createStagingOdooClient({
    getConfig: () => config,
    fetchImpl: async (url, options) => {
      const { params } = JSON.parse(options.body);
      if (params.service === 'common') {
        auth++;
        return Response.json({ result: 89 });
      }
      return Response.json({ result: [] });
    },
  });
  await Promise.all([
    client.authenticate(),
    client.read('res.partner', 'search_read', [[]]),
    client.read('purchase.order', 'fields_get'),
  ]);
  assert.equal(auth, 1);
  assert.deepEqual(client.target(), { url: config.url, database: config.database });
});
