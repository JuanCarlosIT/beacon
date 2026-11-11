import test from 'node:test';
import assert from 'node:assert/strict';
import { requestSchema, executionSchema, canTransition } from '../src/models/request.validation.js';

const input = {
  date: '2026-10-31',
  odooPlotId: 5,
  hectares: 20,
  odooSupplierId: 6,
  applicationPeriodCode: 'Pre-siembra',
  ratePerHectare: 400,
  treatment: 'Control preventivo',
  priority: 'Normal',
};
test('acepta solicitudes y rechaza hectáreas inválidas', () => {
  assert.equal(requestSchema.parse(input).hectares, 20);
  assert.equal(requestSchema.safeParse({ ...input, hectares: -1 }).success, false);
});
test('proveedor, periodo y tarifa son obligatorios en las capturas nuevas', () => {
  for (const field of ['odooSupplierId', 'applicationPeriodCode', 'ratePerHectare']) {
    const incomplete = { ...input };
    delete incomplete[field];
    assert.equal(requestSchema.safeParse(incomplete).success, false, field);
    assert.equal(requestSchema.safeParse({ ...input, [field]: '' }).success, false, field);
  }
  assert.equal(requestSchema.safeParse({ ...input, odooSupplierId: -1 }).success, false);
});
test('tarifa y hectáreas no se redondean silenciosamente al guardar', () => {
  for (const rate of [0, -1, 0.001, 400.005, Infinity, NaN, 100000001, '1,000.00']) {
    assert.equal(
      requestSchema.safeParse({ ...input, ratePerHectare: rate }).success,
      false,
      String(rate),
    );
  }
  for (const rate of [0.01, 355.55, 400, '400.50']) {
    assert.equal(
      requestSchema.parse({ ...input, ratePerHectare: rate }).ratePerHectare,
      Number(rate),
    );
  }
  assert.equal(requestSchema.safeParse({ ...input, hectares: 12.345 }).success, false);
});
test('rechaza fechas inexistentes', () => {
  assert.equal(requestSchema.safeParse({ ...input, date: '2026-02-30' }).success, false);
});
test('exige un ID de Odoo y no acepta identificadores vacíos', () => {
  assert.equal(requestSchema.safeParse({ ...input, odooPlotId: '' }).success, false);
  assert.equal(requestSchema.safeParse({ ...input, odooPlotId: -2 }).success, false);
});
test('el motivo de la aplicación es opcional y admite texto vacío', () => {
  assert.equal(requestSchema.parse({ ...input, treatment: '' }).treatment, '');
  const { treatment, ...withoutTreatment } = input;
  assert.equal(requestSchema.parse(withoutTreatment).treatment, '');
});
test('solo un aprobador puede aprobar una solicitud pendiente', () => {
  assert.equal(canTransition('solicitante', 'Solicitada', 'Aprobada'), false);
  assert.equal(canTransition('aprobador', 'Solicitada', 'Aprobada'), true);
  assert.equal(canTransition('admin', 'Realizada', 'Cancelada'), false);
});
test('ejecución exige proveedor, piloto y costo no negativo', () => {
  assert.equal(
    executionSchema.safeParse({
      date: '2026-10-31',
      hectares: 4,
      provider: 'Proveedor',
      pilot: 'Piloto',
      cost: -3,
    }).success,
    false,
  );
});
