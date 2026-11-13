import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupRemissions,
  purchaseOrderMessage,
  selectionTotal,
  toggleRemission,
} from './purchaseOrder.js';

const remission = (id, supplierId = 6, periodCode = 'Post', amount = 1000) => ({
  id,
  supplierId,
  periodCode,
  supplierName: `Proveedor ${supplierId}`,
  periodName: periodCode,
  amount,
});

test('el detalle explica en qué etapa va la solicitud rumbo a su OCM', () => {
  for (const [purchase, expected] of [
    [{ stage: 'approval' }, /autorizarse/],
    [{ stage: 'remission' }, /Sin remisión validada no se crea la OCM/],
    [{ stage: 'review' }, /revise y valide/],
    [{ stage: 'ready' }, /gestor ya puede/],
    [{ stage: 'uncertain' }, /no se generará otra/],
    [{ stage: 'created', reference: 'P001' }, /P001 creada en STAG/],
    [{ stage: 'created', reference: 'P001', needsReview: true }, /P001 vinculada/],
    [{ stage: 'otra' }, /Falta la remisión/],
  ])
    assert.match(purchaseOrderMessage(purchase), expected);
});

test('las remisiones se agrupan por proveedor y periodo', () => {
  const groups = groupRemissions([
    remission('a'),
    remission('b', 7),
    remission('c'),
    remission('d', 6, 'Pre'),
  ]);
  assert.deepEqual(
    groups.map((group) => group.remissions.map((item) => item.id)),
    [['a', 'c'], ['b'], ['d']],
  );
});

test('una selección nunca mezcla proveedores ni periodos', () => {
  const all = [remission('a'), remission('b', 7), remission('c', 6, 'Post', 250)];
  let selected = toggleRemission([], all[0], all);
  selected = toggleRemission(selected, all[2], all);
  assert.deepEqual(selected, ['a', 'c']);
  assert.equal(selectionTotal(selected, all), 1250);
  assert.deepEqual(toggleRemission(selected, all[1], all), ['b'], 'otro proveedor reinicia');
  assert.deepEqual(toggleRemission(selected, all[0], all), ['c'], 'desmarcar quita solo esa');
});
