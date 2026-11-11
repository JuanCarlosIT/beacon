import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOdooPurchaseService,
  purchaseOrigin,
} from '../src/integrations/odoo/odooPurchase.service.js';

const row = {
  id: '780f0712-d890-4e6d-b9af-b2f58c7a31f2',
  number: 1,
  requested_date: '2026-11-03',
  hectares: '12.50',
  rate_per_hectare: '400.00',
  application_period_code: 'Post-siembra',
  treatment: '',
  notes: '',
  odoo_catalog_snapshot: {
    supplier: { id: 6, name: 'Proveedor real' },
    zone: { id: 1, name: 'Zona' },
    plot: { id: 2, name: 'Predio' },
    crop: { id: 3, name: 'Cultivo' },
    cycle: { id: 4, name: '26.27' },
  },
};
function fixture(changes = {}) {
  const models = {
    'res.partner': [{ id: 106, name: 'Proveedor real' }],
    'account.zone': [{ id: 101 }],
    'account.plot_name': [{ id: 102 }],
    'account.crop': [{ id: 103 }],
    'account.cycle': [{ id: 104 }],
    'account.plot': [{ id: 105, has: 20 }],
    'product.product': [{ id: 2277, uom_po_id: [11, 'Unidad STAG'] }],
    'res.currency': [{ id: 133, name: 'MXN' }],
    'purchase.order': [],
    ...changes,
  };
  const header = Object.fromEntries(
    [
      'gab_ocm_bool',
      'gab_ocm_purchase_type',
      'gab_ocm_reason',
      'gab_ocm_rq_user_id_to_use',
      'gab_ocm_zone_id',
    ].map((key) => [key, {}]),
  );
  header.application_period = { selection: [['Post-siembra', 'Post-siembra']] };
  const calls = [];
  const client = {
    target: () => ({ url: 'https://gab-stag-123.dev.odoo.com', database: 'gab-stag-123' }),
    authenticate: async () => 189,
    async read(model, method, args, kwargs) {
      calls.push({ model, method, args, kwargs });
      if (method === 'fields_get')
        return model === 'purchase.order'
          ? header
          : { plot_id: {}, cycle_id: {}, has_to_apply: {} };
      if (method === 'default_get') return { company_id: 10, picking_type_id: 1439 };
      return models[model];
    },
    createDraft: async () => {
      throw new Error('No debe escribir al preparar');
    },
  };
  return { client, calls, service: createOdooPurchaseService(client) };
}

test('resuelve todas las referencias en STAG sin copiar IDs de producción', async () => {
  const { service, calls } = fixture();
  const values = await service.prepare(row);
  assert.equal(values.partner_id, 106);
  assert.equal(values.gab_ocm_zone_id, 101);
  assert.equal(values.currency_id, 133);
  assert.equal(values.company_id, 10);
  assert.equal(values.picking_type_id, 1439);
  assert.equal(values.gab_ocm_rq_user_id_to_use, 189);
  assert.equal(values.application_period, row.application_period_code);
  assert.equal(values.origin, purchaseOrigin(row.id));
  assert.equal(values.gab_ocm_purchase_type, 'Solicitud');
  const line = values.order_line[0][2];
  assert.equal(line.product_id, 2277);
  assert.equal(line.product_uom, 11);
  assert.equal(line.plot_id, 105);
  assert.equal(line.cycle_id, 104);
  assert.equal(line.product_qty, 12.5);
  assert.equal(line.has_to_apply, 12.5);
  assert.equal(line.price_unit, 400);
  assert.match(line.name, /AA-00001/);
  assert.equal(line.taxes_id, undefined);
  assert.ok(
    calls.every((call) => ['search_read', 'fields_get', 'default_get'].includes(call.method)),
  );
  assert.ok(
    calls
      .find((call) => call.model === 'account.plot')
      .args[0].some((condition) => condition[0] === 'plot_name_id' && condition[2] === 102),
  );
});

test('proveedores ausentes o ambiguos y lotes incompatibles impiden crear una OCM', async () => {
  for (const changes of [
    { 'res.partner': [] },
    { 'res.partner': [{ id: 106 }, { id: 107 }] },
    { 'account.plot': [{ id: 105, has: 1 }] },
    { 'account.plot': [] },
  ])
    await assert.rejects(
      () => fixture(changes).service.prepare(row),
      (error) => error.status === 422,
    );
  await assert.rejects(
    () => fixture().service.prepare({ ...row, application_period_code: 'Inventado' }),
    (error) => error.status === 422,
  );
  await assert.rejects(
    () => fixture().service.prepare({ ...row, rate_per_hectare: null }),
    (error) => error.status === 422,
  );
});

test('con dos lotes iguales usa el que se eligió al capturar; sin elección es ambiguo', async () => {
  const twins = {
    'account.plot': [
      { id: 1449, has: 60 },
      { id: 1466, has: 29 },
    ],
  };
  const chosen = await fixture(twins).service.prepare({ ...row, odoo_plot_id: 1466 });
  assert.equal(chosen.order_line[0][2].plot_id, 1466);
  for (const odoo_plot_id of [undefined, 9999])
    await assert.rejects(
      () => fixture(twins).service.prepare({ ...row, odoo_plot_id }),
      (error) => error.status === 422,
    );
});

test('identifica proveedores por RFC o referencia en STAG; el nombre solo sirve para capturas antiguas', async () => {
  for (const [identity, expected] of [
    [{ vat: 'ABC010101AB1', reference: 'PRV-1' }, ['vat', '=', 'ABC010101AB1']],
    [{ reference: 'PRV-1' }, ['ref', '=', 'PRV-1']],
    [{}, ['name', '=', 'Proveedor real']],
  ]) {
    const f = fixture();
    await f.service.prepare({
      ...row,
      odoo_catalog_snapshot: {
        ...row.odoo_catalog_snapshot,
        supplier: { ...row.odoo_catalog_snapshot.supplier, ...identity },
      },
    });
    assert.deepEqual(f.calls.find((call) => call.model === 'res.partner').args[0][0], expected);
  }
});

test('la búsqueda de recuperación usa una referencia estable y rechaza duplicados', async () => {
  const { service, calls } = fixture({ 'purchase.order': [{ id: 123, name: 'P00123' }] });
  assert.equal((await service.findExisting(row.id)).id, 123);
  assert.deepEqual(calls[0].args[0], [
    ['origin', '=', purchaseOrigin(row.id)],
    ['gab_ocm_bool', '=', true],
  ]);
  assert.equal(calls[0].kwargs.limit, 2);
  await assert.rejects(
    () => fixture({ 'purchase.order': [{ id: 123 }, { id: 124 }] }).service.findExisting(row.id),
    (error) => error.status === 409,
  );
});

test('si se conoce el ID creado, perder la lectura del folio no dispara otra escritura', async () => {
  const { client } = fixture();
  let writes = 0;
  client.createDraft = async () => {
    writes++;
    return 123;
  };
  client.read = async () => {
    throw new Error('Lectura interrumpida');
  };
  assert.deepEqual(await createOdooPurchaseService(client).createDraft({}), {
    id: 123,
    name: null,
    needsReview: true,
  });
  assert.equal(writes, 1);
  client.createDraft = async () => false;
  await assert.rejects(
    () => createOdooPurchaseService(client).createDraft({}),
    (error) => error.uncertain === true,
  );
});

test('relee cabecera y líneas y señala cualquier discrepancia sin crear una segunda OCM', async () => {
  for (const change of [
    {},
    { header: { partner_id: [999, 'Otro proveedor'] } },
    { header: { state: 'purchase' } },
    { header: { application_period: 'Pre-siembra' } },
    { header: { gab_ocm_bool: false } },
    { line: { price_unit: 999 } },
    { line: { product_qty: 1 } },
    { line: { plot_id: [999, 'Otro lote'] } },
    { line: { cycle_id: [999, 'Otro ciclo'] } },
    { line: { product_uom: [999, 'Otra unidad'] } },
  ]) {
    const { client, service } = fixture();
    const values = await service.prepare(row);
    const expected = values.order_line[0][2];
    let writes = 0;
    client.createDraft = async () => {
      writes++;
      return 123;
    };
    client.read = async (model) =>
      model === 'purchase.order'
        ? [
            {
              id: 123,
              name: 'P00123',
              state: 'draft',
              gab_ocm_bool: true,
              origin: values.origin,
              partner_id: [values.partner_id, 'Proveedor'],
              company_id: [values.company_id, 'Empresa'],
              currency_id: [values.currency_id, 'MXN'],
              application_period: values.application_period,
              order_line: [500],
              ...change.header,
            },
          ]
        : [
            {
              product_id: [expected.product_id, 'OCM'],
              product_uom: [expected.product_uom, 'Unidad'],
              plot_id: [expected.plot_id, 'Lote'],
              cycle_id: [expected.cycle_id, 'Ciclo'],
              product_qty: expected.product_qty,
              price_unit: expected.price_unit,
              has_to_apply: expected.has_to_apply,
              display_type: false,
              ...change.line,
            },
          ];
    const result = await service.createDraft(values);
    assert.equal(result.id, 123);
    assert.equal(result.name, 'P00123');
    assert.equal(result.needsReview, Object.keys(change).length > 0);
    assert.equal(writes, 1);
  }
});
