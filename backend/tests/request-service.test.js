import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestService } from '../src/services/request.service.js';

test('el servicio limita al solicitante a su historial', async () => {
  let scope;
  const service = createRequestService({
    list: async (owner) => {
      scope = owner;
      return [];
    },
  });
  await service.list({ name: 'Solicitante de prueba', role: 'solicitante' });
  assert.equal(scope, 'Solicitante de prueba');
});
test('un solicitante no aprueba aunque intente llamar al servicio directamente', async () => {
  const service = createRequestService({ find: async () => ({ status: 'Solicitada' }) });
  await assert.rejects(
    () => service.changeStatus('id', 'Aprobada', { role: 'solicitante' }),
    (error) => error.status === 403,
  );
});
test('el servicio informa cambios concurrentes sin sobrescribir el estado', async () => {
  const service = createRequestService({
    find: async () => ({ status: 'Solicitada' }),
    changeStatus: async () => false,
  });
  await assert.rejects(
    () =>
      service.changeStatus('id', 'Aprobada', {
        role: 'aprobador',
        name: 'Aprobador',
        identityVerified: true,
      }),
    /La solicitud cambió/,
  );
});

test('los perfiles ficticios nunca pueden aprobar, cancelar ni registrar ejecución', async () => {
  let calls = 0;
  const service = createRequestService({
    find: async () => {
      calls++;
      return { status: 'Solicitada' };
    },
    changeStatus: async () => {
      calls++;
      return true;
    },
    registerExecution: async () => {
      calls++;
      return true;
    },
  });
  for (const role of ['admin', 'aprobador', 'solicitante', 'operador']) {
    for (const status of ['Aprobada', 'Cancelada'])
      await assert.rejects(
        () => service.changeStatus('id', status, { role, name: 'Demo' }),
        (error) => error.status === 403,
      );
    await assert.rejects(
      () => service.execute('id', {}, { role, name: 'Demo' }),
      (error) => error.status === 403,
    );
  }
  assert.equal(calls, 0);
});

test('aprobar solo cambia el estado y atribuye el cambio al aprobador verificado', async (t) => {
  const { purchaseOrderService } = await import('../src/services/purchase-order.service.js');
  t.mock.method(purchaseOrderService, 'create', () => {
    throw new Error('Aprobar no debe crear la OCM');
  });
  const changes = [];
  const service = createRequestService({
    find: async () => ({ status: 'Solicitada' }),
    changeStatus: async (...args) => {
      changes.push(args);
      return true;
    },
  });
  await service.changeStatus('id', 'Aprobada', {
    name: 'Responsable verificado',
    role: 'aprobador',
    identityVerified: true,
  });
  assert.deepEqual(changes, [['id', 'Solicitada', 'Aprobada', 'Responsable verificado']]);
  assert.equal(purchaseOrderService.create.mock.calls.length, 0);
});
test('el guardado valida las referencias de compra y nunca toma nombres del navegador', async () => {
  const catalog = {
    records: [{ id: 5, hectares: 20, zoneId: 1, plotNameId: 2, cropId: 3, cycleId: 4 }],
    zones: [{ id: 1, name: 'Zona real' }],
    plots: [{ id: 2, name: 'Predio real' }],
    crops: [{ id: 3, name: 'Cultivo real' }],
    cycles: [{ id: 4, name: 'Ciclo real' }],
    suppliers: [{ id: 6, name: 'Proveedor real' }],
    applicationPeriods: [{ code: 'Post-siembra', name: 'Post-siembra' }],
  };
  let saved;
  const service = createRequestService(
    {
      create: async (values, selected) => {
        saved = { values, selected };
        return { number: 1, hectares: values.hectares };
      },
    },
    async () => catalog,
  );
  const input = {
    date: new Intl.DateTimeFormat('en-CA').format(new Date()),
    odooPlotId: 5,
    hectares: 12.5,
    odooSupplierId: 6,
    applicationPeriodCode: 'Post-siembra',
    ratePerHectare: 400,
    priority: 'Normal',
    supplierName: 'Proveedor inventado',
    applicationPeriodName: 'Inventado',
    estimatedSubtotal: 1,
  };
  await service.create(input, { name: 'Solicitante' });
  assert.deepEqual(saved.selected.supplier, catalog.suppliers[0]);
  assert.deepEqual(saved.selected.applicationPeriod, catalog.applicationPeriods[0]);
  assert.equal(saved.values.supplierName, undefined);
  assert.equal(saved.values.estimatedSubtotal, undefined);
  for (const change of [{ odooSupplierId: 999 }, { applicationPeriodCode: 'Inventado' }]) {
    saved = null;
    await assert.rejects(
      () => service.create({ ...input, ...change }, { name: 'Solicitante' }),
      (error) => error.status === 422,
    );
    assert.equal(saved, null);
  }
});

test('pedir aprobación por WhatsApp solo se ofrece habilitado y en Solicitada', async (t) => {
  const { purchaseOrderService } = await import('../src/services/purchase-order.service.js');
  t.mock.method(purchaseOrderService, 'describe', () => null);
  const detailFor = async (status, role, enabled) =>
    (
      await createRequestService(
        {
          find: async () => ({ status, number: 1 }),
          details: async () => ({ execution: null, attachments: [] }),
        },
        undefined,
        () => enabled,
      ).detail('id', { name: 'Usuario', role })
    ).permissions.canRequestApproval;
  assert.equal(await detailFor('Solicitada', 'solicitante', true), true);
  assert.equal(await detailFor('Solicitada', 'admin', true), true);
  assert.equal(await detailFor('Solicitada', 'solicitante', false), false);
  assert.equal(await detailFor('Aprobada', 'solicitante', true), false);
  assert.equal(await detailFor('Solicitada', 'operador', true), false);
});

test('el aviso automático solo corre para una solicitud nueva, no al repetir la captura', async () => {
  const catalog = {
    records: [{ id: 5, hectares: 20, zoneId: 1, plotNameId: 2, cropId: 3, cycleId: 4 }],
    zones: [{ id: 1, name: 'Zona' }],
    plots: [{ id: 2, name: 'Predio' }],
    crops: [{ id: 3, name: 'Cultivo' }],
    cycles: [{ id: 4, name: 'Ciclo' }],
    suppliers: [{ id: 6, name: 'Proveedor' }],
    applicationPeriods: [{ code: 'Post-siembra', name: 'Post-siembra' }],
  };
  const existing = { id: 'existente', number: 7, hectares: 1 };
  const service = createRequestService(
    {
      findSubmission: async (key) =>
        key === '11111111-1111-4111-8111-111111111111' ? existing : null,
      create: async () => ({ id: 'nueva', number: 8, hectares: 1 }),
    },
    async () => catalog,
  );
  const notified = [];
  const onCreated = (request) => notified.push(request.id);
  const input = {
    date: new Intl.DateTimeFormat('en-CA').format(new Date()),
    odooPlotId: 5,
    hectares: 1,
    odooSupplierId: 6,
    applicationPeriodCode: 'Post-siembra',
    ratePerHectare: 400,
    priority: 'Normal',
  };
  await service.create(
    { ...input, submissionKey: '22222222-2222-4222-8222-222222222222' },
    { name: 'S' },
    { onCreated },
  );
  assert.deepEqual(notified, ['nueva']);
  // Captura repetida (aquí con datos cambiados): nunca vuelve a avisar.
  await assert.rejects(() =>
    service.create(
      { ...input, submissionKey: '11111111-1111-4111-8111-111111111111', hectares: 2 },
      { name: 'S' },
      { onCreated },
    ),
  );
  assert.deepEqual(notified, ['nueva']);
});

test('DEMO_APROBAR: solo el aprobador de prueba decide, solo con el interruptor y marcado «(prueba)»', async (t) => {
  const { purchaseOrderService } = await import('../src/services/purchase-order.service.js');
  t.mock.method(purchaseOrderService, 'describe', () => null);
  const changes = [];
  const build = (demoOn) =>
    createRequestService(
      {
        find: async () => ({ status: 'Solicitada', number: 1 }),
        details: async () => ({ execution: null, attachments: [] }),
        changeStatus: async (...args) => {
          changes.push(args);
          return true;
        },
      },
      undefined,
      () => false,
      () => demoOn,
    );
  const demoApprover = {
    name: 'Carlos · Supervisión',
    role: 'aprobador',
    identityVerified: false,
    demo: true,
  };
  const demoRequester = { ...demoApprover, name: 'María · Campo', role: 'solicitante' };
  const notDemoApprover = { ...demoApprover, demo: false };

  for (const [demoOn, user] of [
    [false, demoApprover],
    [true, demoRequester],
    [true, notDemoApprover],
  ])
    await assert.rejects(
      () => build(demoOn).changeStatus('id', 'Aprobada', user),
      (error) => error.status === 403,
    );
  assert.equal(changes.length, 0);

  const on = build(true);
  const permissions = (await on.detail('id', demoApprover)).permissions;
  assert.equal(permissions.canApprove, true);
  assert.equal(permissions.canCancel, true);
  assert.equal((await build(false).detail('id', demoApprover)).permissions.canApprove, false);
  await on.changeStatus('id', 'Aprobada', demoApprover);
  assert.deepEqual(changes, [['id', 'Solicitada', 'Aprobada', 'Carlos · Supervisión (prueba)']]);
  assert.equal(demoApprover.identityVerified, false);
});
