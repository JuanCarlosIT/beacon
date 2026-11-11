import test from 'node:test';
import assert from 'node:assert/strict';
import { createExcelReport } from '../src/services/report.service.js';

const user = { role: 'solicitante', name: 'Solicitante de prueba' };
const row = {
  id: '067d0389-ebcb-4db1-8677-c21451e2027b',
  number: '1',
  requested_date: '2026-11-03',
  ranch: 'Zona de prueba',
  lot: 'L79',
  crop: 'PAPA',
  hectares: '76.00',
  treatment: '',
  priority: 'Normal',
  status: 'Solicitada',
  requested_by: user.name,
  execution_date: null,
  actual_hectares: null,
  provider: null,
  pilot: null,
  cost: null,
  attachments: '0',
  notes: '',
};
for (const cost of [null, '0.00', '1250.50']) {
  test(`Excel admite costo ${cost === null ? 'sin registrar' : cost}`, async () => {
    let scope;
    const buffer = await createExcelReport(user, {
      report: async (owner) => {
        scope = owner;
        return [{ ...row, cost }];
      },
    });
    assert.equal(scope, user.name);
    assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), 'PK');
    assert.ok(buffer.length > 3000);
  });
}
