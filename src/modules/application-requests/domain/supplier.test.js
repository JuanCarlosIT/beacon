import test from 'node:test';
import assert from 'node:assert/strict';
import { supplierIdentifier, supplierOptionLabel } from './supplier.js';

test('las opciones muestran nombre, RFC o referencia y Nuevo, no el ID técnico', () => {
  const supplier = {
    id: 17305,
    name: 'AGRASAMA',
    vat: 'AGR151101U56',
    reference: '',
    isNew: false,
  };
  assert.equal(supplierOptionLabel(supplier), 'AGRASAMA · RFC: AGR151101U56');
  assert.equal(
    supplierOptionLabel({ ...supplier, isNew: true }),
    'AGRASAMA · RFC: AGR151101U56 · Nuevo',
  );
  assert.equal(supplierIdentifier({ reference: 'PRV-1' }), 'Ref.: PRV-1');
  assert.equal(supplierIdentifier({}), 'Sin identificador');
  assert.ok(!supplierOptionLabel(supplier).includes('17305'));
});
