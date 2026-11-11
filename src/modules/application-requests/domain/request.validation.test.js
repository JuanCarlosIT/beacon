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
  treatment: 'Tratamiento de prueba',
  priority: 'Normal',
  notes: '',
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
test('permite superficie parcial y descripción opcional', () => {
  assert.deepEqual(validateRequestStep(2, values, { hectares: 20 }, '2026-10-31'), {});
  assert.equal(
    validateRequestStep(2, { ...values, treatment: ' ' }, { hectares: 20 }, '2026-10-31').treatment,
    undefined,
  );
});
