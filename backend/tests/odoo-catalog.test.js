import test from 'node:test';
import assert from 'node:assert/strict';
import { getOdooCatalog } from '../src/integrations/odoo/odooCatalog.service.js';

test('lee proveedores activos y periodos de los metadatos de Odoo, sin operaciones de escritura', async (t) => {
  const keys = ['ODOO_URL', 'ODOO_DB', 'ODOO_USER', 'ODOO_API_KEY'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    ODOO_URL: 'https://odoo.invalid',
    ODOO_DB: 'prueba',
    ODOO_USER: 'prueba',
    ODOO_API_KEY: 'clave-ficticia',
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://odoo.invalid/jsonrpc');
    const { params } = JSON.parse(options.body);
    let result;
    if (params.service === 'common') {
      assert.equal(params.method, 'authenticate');
      result = 1;
    } else {
      assert.equal(params.method, 'execute_kw');
      const [, , , model, method, args, kwargs] = params.args;
      assert.ok(
        ['search_read', 'fields_get'].includes(method),
        `Operacion no autorizada: ${method}`,
      );
      calls.push({ model, method, args, kwargs });
      if (model === 'res.partner')
        result = [
          {
            id: 6,
            name: 'Proveedor de prueba',
            vat: ' abc010101ab1 ',
            ref: ' prv-1 ',
            active: true,
            supplier_rank: 1,
          },
        ];
      else if (model === 'purchase.order')
        result = {
          application_period: {
            type: 'selection',
            selection: [['periodo-prueba', 'Periodo de prueba']],
          },
        };
      else result = [];
    }
    return Response.json({ jsonrpc: '2.0', result });
  });
  const catalog = await getOdooCatalog({ refresh: true });
  assert.deepEqual(catalog.suppliers, [
    { id: 6, name: 'Proveedor de prueba', vat: 'ABC010101AB1', reference: 'PRV-1' },
  ]);
  assert.ok(calls.find((call) => call.model === 'res.partner').kwargs.fields.includes('vat'));
  assert.ok(calls.find((call) => call.model === 'res.partner').kwargs.fields.includes('ref'));
  assert.deepEqual(catalog.applicationPeriods, [
    { code: 'periodo-prueba', name: 'Periodo de prueba' },
  ]);
  assert.deepEqual(calls.find((call) => call.model === 'res.partner').args[0], [
    ['active', '=', true],
    ['supplier_rank', '>', 0],
  ]);
  assert.equal(calls.find((call) => call.model === 'purchase.order').method, 'fields_get');
});
