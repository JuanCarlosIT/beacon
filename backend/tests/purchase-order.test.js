import test from 'node:test';
import assert from 'node:assert/strict';
import { createPurchaseOrderService } from '../src/services/purchase-order.service.js';
import { HttpError } from '../src/errors/HttpError.js';
import { StagingOdooError } from '../src/integrations/odoo/odooStaging.client.js';

const user = { name: 'Solicitante', role: 'solicitante' };
const target = { url: 'https://gab-stag-123.dev.odoo.com', database: 'gab-stag-123' };
const source = {
  id: '780f0712-d890-4e6d-b9af-b2f58c7a31f2',
  number: 1,
  requested_by: user.name,
  status: 'Aprobada',
  odoo_supplier_id: 6,
  application_period_code: 'Post-siembra',
  rate_per_hectare: '400.00',
  odoo_catalog_snapshot: { supplier: { id: 6 } },
};

function fixture(options = {}) {
  let link = options.link || null;
  let remote = null;
  const stats = { writes: 0, releases: 0, uncertain: 0, reserves: 0, completes: 0 };
  const requests = {
    find: async (id, owner) =>
      id === source.id && (!owner || owner === user.name) && !options.missing
        ? {
            ...source,
            ...options.row,
            purchase_order_status: link?.status,
            purchase_order_id: link?.order_id,
            purchase_order_name: link?.order_name,
            purchase_order_database: link?.database_name,
            purchase_order_review_required: link?.review_required,
          }
        : null,
  };
  const links = {
    async reserve(id, owner, database) {
      stats.reserves++;
      if (link) {
        if (link.database_name !== database) throw new HttpError(409, 'Otra base STAG');
        return { reserved: false, link: { ...link } };
      }
      link = { status: 'creating', attempt_key: 'reserva-prueba', database_name: database };
      return { reserved: true, link: { ...link } };
    },
    async release() {
      stats.releases++;
      link = null;
    },
    async markUncertain() {
      stats.uncertain++;
      link.status = 'uncertain';
    },
    async complete(id, database, order) {
      stats.completes++;
      if (options.completeError) {
        options.completeError = false;
        throw new Error('Base local no disponible');
      }
      link = {
        ...link,
        status: 'created',
        order_id: order.id,
        order_name: order.name,
        review_required: order.needsReview !== false,
      };
      return { ...link };
    },
  };
  const odoo = {
    target: () => target,
    findExisting: async () => options.found || remote,
    async prepare(row) {
      if (options.prepareError) throw options.prepareError;
      return { origin: row.id };
    },
    async createDraft() {
      stats.writes++;
      if (options.writeError) {
        if (options.remoteOnError) remote = { id: 123, name: 'P00123' };
        throw options.writeError;
      }
      remote = { id: 123, name: 'P00123', needsReview: false };
      return remote;
    },
  };
  return {
    options,
    stats,
    requests,
    links,
    odoo,
    getLink: () => link,
    service: createPurchaseOrderService(requests, links, odoo, () => ({
      enabled: options.enabled !== false,
    })),
  };
}

test('crea una OCM una sola vez, devuelve un enlace STAG y no cambia el estado local', async () => {
  const f = fixture();
  const result = await f.service.create(source.id, user);
  assert.equal(result.created, true);
  assert.equal(result.purchaseOrder.environment, 'staging');
  assert.equal(result.purchaseOrder.reference, 'P00123');
  const url = new URL(result.purchaseOrder.url);
  assert.equal(url.origin, target.url);
  assert.equal(url.pathname, '/web');
  assert.equal(url.searchParams.get('db'), target.database);
  const fragment = new URLSearchParams(url.hash.slice(1));
  assert.equal(fragment.get('id'), '123');
  assert.equal(fragment.get('model'), 'purchase.order');
  assert.equal(fragment.get('view_type'), 'form');
  assert.equal(result.purchaseOrder.canCreate, false);
  assert.equal(result.purchaseOrder.needsReview, false);
  assert.equal((await f.service.create(source.id, user)).created, false);
  assert.equal(f.stats.writes, 1);
  assert.equal(source.status, 'Aprobada');
});

test('permisos, propiedad, configuración e información incompleta bloquean la escritura', async () => {
  for (const [options, actor, status] of [
    [{}, { ...user, role: 'operador' }, 403],
    [{}, { ...user, name: 'Otra persona' }, 404],
    [{ missing: true }, user, 404],
    [{ enabled: false }, user, 503],
    [{ row: { rate_per_hectare: null } }, user, 422],
    [{ row: { status: 'Solicitada' } }, user, 409],
    [{ row: { status: 'Cancelada' } }, user, 409],
    [{ row: { status: 'Realizada' } }, user, 409],
  ]) {
    const f = fixture(options);
    await assert.rejects(
      () => f.service.create(source.id, actor),
      (error) => error.status === status,
    );
    assert.equal(f.stats.writes, 0);
    assert.equal(f.stats.reserves, 0);
  }
});

test('el aprobador también puede generar la OCM; el operador no', () => {
  const f = fixture();
  const approver = f.service.describe(source, { name: 'Carlos', role: 'aprobador' });
  assert.equal(approver.canCreate, true);
  assert.equal(approver.roleAllowed, true);
  const operator = f.service.describe(source, { name: 'Op', role: 'operador' });
  assert.equal(operator.canCreate, false);
  assert.equal(operator.roleAllowed, false);
});

test('el detalle solo habilita crear OCM cuando la solicitud está Aprobada', () => {
  const f = fixture();
  for (const status of ['Solicitada', 'Aprobada', 'Realizada', 'Cancelada']) {
    const view = f.service.describe({ ...source, status }, user);
    assert.equal(view.canCreate, status === 'Aprobada', status);
    assert.equal(view.requiresApproval, status === 'Solicitada', status);
  }
});

test('la verificación de vínculos anteriores sigue disponible en cualquier estado y nunca crea otra OCM', async () => {
  for (const status of ['Solicitada', 'Aprobada', 'Realizada', 'Cancelada']) {
    for (const linkStatus of ['created', 'uncertain', 'creating']) {
      const f = fixture({
        row: { status },
        link: {
          status: linkStatus,
          database_name: target.database,
          order_id: linkStatus === 'created' ? 456 : null,
          order_name: 'P00456',
        },
        found: { id: 456, name: 'P00456' },
      });
      const result = await f.service.create(source.id, user);
      assert.equal(result.created, false);
      assert.equal(result.purchaseOrder.status, 'created');
      assert.equal(f.stats.writes, 0);
    }
  }
});

test('una respuesta perdida se verifica y recupera sin volver a crear la OCM', async () => {
  const f = fixture({
    writeError: new StagingOdooError('Respuesta perdida', true),
    remoteOnError: true,
  });
  await assert.rejects(() => f.service.create(source.id, user));
  assert.equal(f.getLink().status, 'uncertain');
  assert.equal(f.stats.releases, 0);
  assert.equal((await f.service.create(source.id, user)).purchaseOrder.reference, 'P00123');
  assert.equal(f.stats.writes, 1);
});

test('una reserva pendiente sin resultado nunca se reenvía automáticamente', async () => {
  for (const status of ['creating', 'uncertain']) {
    const f = fixture({ link: { status, attempt_key: 'reserva', database_name: target.database } });
    await assert.rejects(
      () => f.service.create(source.id, user),
      (error) => error.status === 409,
    );
    assert.equal(f.stats.writes, 0);
    assert.equal(f.stats.releases, 0);
    assert.equal(f.getLink().status, status);
  }
});

test('fallar antes de escribir o recibir un rechazo explícito libera solo la reserva propia', async () => {
  for (const options of [
    { prepareError: new HttpError(422, 'Proveedor ambiguo') },
    { writeError: new StagingOdooError('Validación rechazada', false, 422) },
  ]) {
    const f = fixture(options);
    await assert.rejects(
      () => f.service.create(source.id, user),
      (error) => error.status === 422,
    );
    assert.equal(f.stats.releases, 1);
    assert.equal(f.getLink(), null);
  }
});

test('si falla el vínculo local después de crear, la recuperación no duplica la OCM', async () => {
  const f = fixture({ completeError: true });
  await assert.rejects(
    () => f.service.create(source.id, user),
    (error) => error.status === 503,
  );
  assert.equal(f.getLink().status, 'uncertain');
  assert.equal((await f.service.create(source.id, user)).purchaseOrder.status, 'created');
  assert.equal(f.stats.writes, 1);
});

test('los envíos concurrentes comparten una reserva y producen como máximo una OCM', async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.service.create(source.id, user),
    f.service.create(source.id, user),
  ]);
  assert.ok(results.some((result) => result.status === 'fulfilled'));
  assert.equal(f.stats.writes, 1);
  assert.equal(f.getLink().status, 'created');
});

test('no permite cruzar el vínculo de una solicitud a otra rama STAG', async () => {
  const f = fixture({ link: { status: 'uncertain', database_name: 'otra-stag-456' } });
  await assert.rejects(
    () => f.service.create(source.id, user),
    (error) => error.status === 409,
  );
  assert.equal(f.stats.writes, 0);
});

test('una OCM preexistente se vincula sin creación adicional', async () => {
  const f = fixture({ found: { id: 456, name: 'P00456' } });
  const result = await f.service.create(source.id, user);
  assert.equal(result.created, false);
  assert.equal(result.purchaseOrder.reference, 'P00456');
  assert.equal(f.stats.writes, 0);
});
