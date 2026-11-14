import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequestStep } from './request.validation.js';

const values = {
  cycleId: '1',
  zoneId: '2',
  plotNameId: '3',
  cropId: '4',
  date: '2026-11-01',
  hectares: '12.5',
  supplierId: '6',
  applicationPeriodCode: 'Post-siembra',
  ratePerHectare: '400.00',
  products: [{ id: 9, name: 'Producto', uom: 'L', dose: '1.5' }],
};
test('el asistente indica cada selección faltante', () => {
  assert.deepEqual(Object.keys(validateRequestStep(1, {}, null)), [
    'cycleId',
    'zoneId',
    'plotNameId',
    'cropId',
  ]);
  assert.deepEqual(validateRequestStep(1, values, { hectares: 20 }), {});
});
test('proveedor y periodo deben existir en las listas y la tarifa ser positiva', () => {
  const catalog = { suppliers: [{ id: 6 }], applicationPeriods: [{ code: 'Post-siembra' }] };
  const validate = (input) =>
    validateRequestStep(2, input, { hectares: 20 }, '2026-10-31', catalog);
  assert.deepEqual(validate(values), {});
  for (const change of [
    { supplierId: '' },
    { supplierId: '999' },
    { applicationPeriodCode: '' },
    { applicationPeriodCode: 'Libre' },
  ]) {
    assert.equal(Object.keys(validate({ ...values, ...change })).length, 1);
  }
  for (const rate of ['', '0', '-1', '400.005', 'no-numero', 'Infinity', '100000001']) {
    assert.ok(validate({ ...values, ratePerHectare: rate }).ratePerHectare, rate);
  }
  assert.equal(validate({ ...values, ratePerHectare: '355.55' }).ratePerHectare, undefined);
  assert.ok(validate({ ...values, hectares: '12.345' }).hectares);
});
test('el asistente impide una fecha pasada y superficies excesivas', () => {
  const errors = validateRequestStep(
    2,
    { ...values, date: '2026-10-01', hectares: '21' },
    { hectares: 20 },
    '2026-10-31',
  );
  assert.ok(errors.date);
  assert.ok(errors.hectares);
});
test('permite superficie parcial', () => {
  assert.deepEqual(validateRequestStep(2, values, { hectares: 20 }, '2026-10-31'), {});
});

test('la receta vale anotada, con imagen o con productos; cada producto lleva su dosis', () => {
  const validate = (recipe) =>
    validateRequestStep(2, { ...values, products: [], ...recipe }, { hectares: 20 }, '2026-10-31')
      .products;
  assert.match(validate({}), /anótalo, sube una imagen o agrega los productos/);
  assert.match(validate({ recipeText: '   ' }), /anótalo/);
  assert.equal(validate({ recipeText: '1 litro de adhesivo' }), undefined);
  assert.equal(validate({ recipeFile: { id: 'x', name: 'receta.png' } }), undefined);
  assert.match(validate({ products: [{ id: 9, dose: '' }] }), /dosis/);
  assert.match(validate({ recipeText: 'nota', products: [{ id: 9, dose: '0' }] }), /dosis/);
  assert.equal(validate({ products: [{ id: 9, dose: '0.25' }] }), undefined);
  assert.match(validate({ recipeText: 'x'.repeat(4001) }), /4,000/);
});

test('la dosis de un producto es opcional solo si la receta anotada o la imagen la traen', () => {
  const validate = (recipe) =>
    validateRequestStep(2, { ...values, ...recipe }, { hectares: 20 }, '2026-10-31').products;
  const noDose = [{ id: 9, dose: '' }];
  assert.match(validate({ products: noDose }), /Pon la dosis/);
  assert.equal(validate({ products: noDose, recipeText: '2 L/ha' }), undefined);
  assert.equal(validate({ products: noDose, recipeFile: { id: 'x', name: 'r.png' } }), undefined);
  assert.match(validate({ products: [{ id: 9, dose: '-1' }], recipeText: '2 L/ha' }), /dosis/);
});

test('un tipo detectado sin producto hay que resolverlo antes de guardar', () => {
  const products = [{ id: 'tipo-5', pending: true, typeId: 5, type: 'Adherente', dose: '1' }];
  const error = validateRequestStep(
    2,
    { ...values, products, recipeText: '1 litro de adherente' },
    { hectares: 20 },
    '2026-10-31',
  ).products;
  assert.match(error, /Escoge el producto de «Adherente»/);
});
