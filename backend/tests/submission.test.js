import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSubmission, requestToDto } from '../src/models/request.model.js';
import { createRequestService } from '../src/services/request.service.js';

const values = {
  submissionKey: '780f0712-d890-4e6d-b9af-b2f58c7a31f2',
  date: '2026-11-03',
  odooPlotId: 5,
  hectares: 76,
  odooSupplierId: 6,
  applicationPeriodCode: 'Post-siembra',
  ratePerHectare: 400,
  treatment: '',
  priority: 'Normal',
  notes: '',
};
const existing = {
  id: 'id-prueba',
  number: '1',
  requested_date: new Date('2026-11-03T07:00:00Z'),
  odoo_plot_id: 5,
  hectares: '76.00',
  odoo_supplier_id: 6,
  application_period_code: 'Post-siembra',
  rate_per_hectare: '400.00',
  estimated_subtotal: '30400.00',
  treatment: '',
  priority: 'Normal',
  notes: '',
  requested_by: 'Solicitante',
};
test('un reintento de la misma captura devuelve el mismo folio sin crear otro registro', async () => {
  let created = false;
  const service = createRequestService(
    {
      findSubmission: async () => existing,
      create: async () => {
        created = true;
      },
    },
    async () => {
      throw new Error('No debe consultar Odoo otra vez para un reintento ya guardado');
    },
  );
  const result = await service.create(values, { name: 'Solicitante', role: 'solicitante' });
  assert.equal(result.folio, 'AA-00001');
  assert.equal(created, false);
});
test('una clave de captura no permite cambiar los datos ni consultar solicitudes ajenas', async () => {
  assert.equal(matchesSubmission(existing, { ...values, hectares: 10 }, 'Solicitante'), false);
  assert.equal(matchesSubmission(existing, values, 'Otra persona'), false);
  const service = createRequestService({ findSubmission: async () => existing });
  await assert.rejects(
    () => service.create(values, { name: 'Otra persona', role: 'solicitante' }),
    (error) => error.status === 409,
  );
});
test('cambiar proveedor, periodo o tarifa no reutiliza una clave de captura anterior', async () => {
  const service = createRequestService({ findSubmission: async () => existing });
  for (const change of [
    { odooSupplierId: 7 },
    { applicationPeriodCode: 'Pre-siembra' },
    { ratePerHectare: 401 },
  ]) {
    assert.equal(matchesSubmission(existing, { ...values, ...change }, 'Solicitante'), false);
    await assert.rejects(
      () => service.create({ ...values, ...change }, { name: 'Solicitante' }),
      (error) => error.status === 409,
    );
  }
});
test('el DTO convierte importes sin asignar ceros a las capturas históricas', () => {
  const current = requestToDto(existing);
  assert.equal(current.rate_per_hectare, 400);
  assert.equal(current.estimated_subtotal, 30400);
  const historical = requestToDto({ number: 2, hectares: '47.00' });
  assert.equal(historical.rate_per_hectare, null);
  assert.equal(historical.estimated_subtotal, null);
});
