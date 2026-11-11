import test from 'node:test';
import assert from 'node:assert/strict';
import { createPurchaseOrderRepository } from '../src/repositories/purchase-order.repository.js';
import { createPurchaseOrderService } from '../src/services/purchase-order.service.js';
import { fakePrisma } from './helpers/fake-prisma.js';

// `status` = estado actual de la solicitud; `previous` = vínculo de OCM ya guardado.
function fixture(status, previous = null) {
  let link = previous;
  const f = fakePrisma({
    request: {
      findFirst: async () => ({ id: 'request' }),
      updateMany: async ({ where }) => ({ count: where.status === status ? 1 : 0 }),
    },
    purchaseLink: {
      findUnique: async () => link,
      createMany: async ({ data }) => {
        link = data[0];
        return { count: 1 };
      },
    },
  });
  return { repository: createPurchaseOrderRepository(f.db), ...f };
}

test('la reserva comprueba Aprobada bajo bloqueo antes de insertar, no solo en la interfaz', async () => {
  for (const status of ['Solicitada', 'Realizada', 'Cancelada']) {
    const f = fixture(status);
    await assert.rejects(
      () => f.repository.reserve('request', 'Solicitante', 'gab-stag-123'),
      (error) => error.status === 409,
    );
    assert.deepEqual(f.called('request', 'updateMany')[0].args.where, {
      id: 'request',
      status: 'Aprobada',
    });
    assert.equal(f.called('purchaseLink', 'createMany').length, 0);
  }
  const f = fixture('Aprobada');
  const reservation = await f.repository.reserve('request', 'Solicitante', 'gab-stag-123');
  assert.equal(reservation.reserved, true);
  assert.equal(reservation.link.status, 'creating');
  assert.deepEqual(f.called('request', 'findFirst')[0].args.where, {
    id: 'request',
    requested_by: 'Solicitante',
  });
});

test('un cambio de estado entre leer el detalle y reservar impide toda llamada a Odoo', async () => {
  const f = fixture('Cancelada');
  const odoo = {
    target: () => ({ database: 'gab-stag-123' }),
    findExisting: () => {
      throw new Error('No debe consultar Odoo');
    },
    createDraft: () => {
      throw new Error('No debe escribir Odoo');
    },
  };
  const service = createPurchaseOrderService(
    {
      find: async () => ({
        status: 'Aprobada',
        odoo_supplier_id: 6,
        application_period_code: 'Pre-siembra',
        rate_per_hectare: 400,
        odoo_catalog_snapshot: { supplier: { id: 6 } },
      }),
    },
    f.repository,
    odoo,
    () => ({ enabled: true }),
  );
  await assert.rejects(
    () => service.create('request', { name: 'Solicitante', role: 'solicitante' }),
    (error) => error.status === 409,
  );
});

test('un vínculo previo se puede recuperar sin reservar otra creación aunque ya no esté aprobada', async () => {
  const link = { status: 'uncertain', database_name: 'gab-stag-123' };
  const f = fixture('Cancelada', link);
  assert.deepEqual(await f.repository.reserve('request', null, 'gab-stag-123'), {
    reserved: false,
    link,
  });
  assert.equal(f.called('purchaseLink', 'createMany').length, 0);
  assert.equal(f.called('request', 'updateMany').length, 0);
});

test('un vínculo de otra base STAG se rechaza', async () => {
  const f = fixture('Aprobada', { status: 'created', database_name: 'otra-base' });
  await assert.rejects(
    () => f.repository.reserve('request', null, 'gab-stag-123'),
    (error) => error.status === 409 && /otra base STAG/.test(error.message),
  );
});
