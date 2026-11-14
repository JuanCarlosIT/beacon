import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestUseCases } from './request.use-cases.js';

test('el caso de uso elimina etiquetas enviadas por el navegador y mantiene aplicación opcional', async () => {
  let body;
  const cases = createRequestUseCases({
    create: async (input) => {
      body = input;
      return { folio: 'AA-00001' };
    },
  });
  await cases.register({
    odooPlotId: '5',
    hectares: '12.5',
    odooSupplierId: '6',
    applicationPeriodCode: 'Post-siembra',
    ratePerHectare: '400.50',
    date: '2026-11-01',
    ranch: 'Texto no confiable',
    crop: 'Inventado',
    supplierName: 'Proveedor inventado',
    applicationPeriodName: 'Periodo inventado',
    estimatedSubtotal: 1,
  });
  assert.equal(body.odooPlotId, 5);
  assert.equal(body.hectares, 12.5);
  assert.equal(body.treatment, undefined);
  assert.equal(body.ranch, undefined);
  assert.equal(body.crop, undefined);
  assert.equal(body.odooSupplierId, 6);
  assert.equal(body.applicationPeriodCode, 'Post-siembra');
  assert.equal(body.ratePerHectare, 400.5);
  assert.equal(body.supplierName, undefined);
  assert.equal(body.applicationPeriodName, undefined);
  assert.equal(body.estimatedSubtotal, undefined);
});
test('no consulta historial cuando el servicio está indisponible', async () => {
  let consulted = false;
  const cases = createRequestUseCases({
    health: async () => ({ database: false }),
    list: async () => {
      consulted = true;
      return [];
    },
  });
  const result = await cases.loadHistory();
  assert.equal(result.connected, false);
  assert.equal(consulted, false);
  assert.equal(result.error, 'Servicio no disponible. Intenta de nuevo.');
});
test('generar OCM envía solo el identificador de la solicitud, sin valores de compra editables', async () => {
  let forwarded;
  const cases = createRequestUseCases({
    createPurchaseOrder: async (...args) => {
      forwarded = args;
      return { purchaseOrder: { environment: 'staging' } };
    },
  });
  assert.equal((await cases.createPurchaseOrder('solicitud')).purchaseOrder.environment, 'staging');
  assert.deepEqual(forwarded, ['solicitud']);
});

test('el alta solo envía la clave del contacto de Odoo', async () => {
  let body;
  const cases = createRequestUseCases({
    registerSupplier: async (input) => {
      body = input;
      return input;
    },
  });
  await cases.registerSupplier('17305');
  assert.deepEqual(body, { odooPartnerId: 17305 });
});

test('aprobar usa el endpoint de estado, sin generar una OCM automáticamente', async () => {
  const calls = [];
  const cases = createRequestUseCases({
    changeStatus: async (...args) => calls.push(args),
    createPurchaseOrder: async () => {
      throw new Error('No debe crear una OCM al aprobar');
    },
  });
  await cases.changeStatus('solicitud', 'Aprobada');
  assert.deepEqual(calls, [['solicitud', 'Aprobada']]);
});

test('pedir aprobación por WhatsApp solo envía el identificador y no cambia el estado', async () => {
  const calls = [];
  const cases = createRequestUseCases({
    requestApproval: async (...args) => {
      calls.push(args);
      return { folio: 'AA-00002', approvers: ['Aprobador'] };
    },
    changeStatus: async () => {
      throw new Error('Pedir aviso no debe aprobar');
    },
  });
  assert.equal((await cases.requestApproval('solicitud')).folio, 'AA-00002');
  assert.deepEqual(calls, [['solicitud']]);
});
