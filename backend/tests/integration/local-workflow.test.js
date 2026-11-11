import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildCatalog } from '../../src/models/catalog.model.js';
import { createRequestRepository } from '../../src/repositories/request.repository.js';
import { createSupplierRepository } from '../../src/repositories/supplier.repository.js';
import { createPurchaseOrderRepository } from '../../src/repositories/purchase-order.repository.js';
import { createRequestService } from '../../src/services/request.service.js';
import { createSupplierService } from '../../src/services/supplier.service.js';
import { createCatalogService } from '../../src/services/catalog.service.js';
import { createPurchaseOrderService } from '../../src/services/purchase-order.service.js';
import { withIsolatedSchema } from './isolated-schema.js';

test('Docker: directorio, aprobación, auditoría y OCM idempotente en un esquema aislado', () =>
  withIsolatedSchema(async ({ client, db, applySchema }) => {
    const suppliersRows = async () => db.supplier.findMany({ orderBy: { odoo_partner_id: 'asc' } });
    const initial = await suppliersRows();
    await applySchema();
    assert.deepEqual(await suppliersRows(), initial, 'schema.sql es idempotente');
    assert.deepEqual(
      initial.map((row) => row.odoo_partner_id),
      [8647, 9305, 15537, 17305],
    );
    assert.equal(await db.supplierEvent.count(), 4);
    await db.supplier.update({ where: { odoo_partner_id: 9305 }, data: { authorized: false } });
    await applySchema();
    assert.equal(
      (await db.supplier.findUnique({ where: { odoo_partner_id: 9305 } })).authorized,
      false,
      'volver a aplicar el esquema no reautoriza',
    );
    await db.supplier.update({ where: { odoo_partner_id: 9305 }, data: { authorized: true } });

    const additional = {
      id: 90001,
      name: 'Proveedor de prueba aislada',
      vat: 'TST010101AB1',
      reference: 'TEST-1',
    };
    const raw = buildCatalog({
      zones: [{ id: 1, name: 'Zona de prueba' }],
      plots: [{ id: 2, name: 'Predio de prueba', zone_id: [1, 'Zona de prueba'] }],
      crops: [{ id: 3, name: 'Cultivo de prueba' }],
      cycles: [{ id: 4, name: 'Ciclo de prueba' }],
      fields: [
        {
          id: 5,
          name: 'Lote de prueba',
          has: 20,
          zone_id: [1],
          plot_name_id: [2],
          crop_id: [3],
          cycle_id: [4],
        },
      ],
      suppliers: [
        ...initial.map((row) => ({
          id: row.odoo_partner_id,
          name: row.name,
          vat: row.vat,
          ref: row.reference,
        })),
        { ...additional, ref: additional.reference },
      ].map((row) => ({ ...row, active: true, supplier_rank: 1 })),
      applicationPeriods: [{ code: 'Post-siembra', name: 'Post-siembra' }],
    });
    const requests = createRequestRepository(db);
    const directory = createSupplierRepository(db);
    const catalog = createCatalogService(directory, async () => raw);
    const service = createRequestService(requests, () => catalog.list());
    const suppliers = createSupplierService(directory, async () => raw);
    const requester = {
      name: 'Solicitante de prueba aislada',
      role: 'solicitante',
      identityVerified: false,
    };
    // Identidad simulada solo en este esquema: no se crea una sesión ni un usuario real.
    const approver = {
      name: 'Aprobador de prueba aislada',
      role: 'aprobador',
      identityVerified: true,
    };
    const admin = {
      name: 'Administración de prueba aislada',
      role: 'admin',
      identityVerified: true,
    };
    let writes = 0;
    const purchase = createPurchaseOrderService(
      requests,
      createPurchaseOrderRepository(db),
      {
        target: () => ({ url: 'https://gab-stag-123.dev.odoo.com', database: 'gab-stag-123' }),
        findExisting: async () => null,
        prepare: async () => ({}),
        createDraft: async () => {
          writes++;
          return { id: 123, name: 'OCM-SIMULADA', needsReview: false };
        },
      },
      () => ({ enabled: true }),
    );

    const input = {
      submissionKey: randomUUID(),
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      odooPlotId: 5,
      hectares: 12.5,
      odooSupplierId: 17305,
      applicationPeriodCode: 'Post-siembra',
      ratePerHectare: 400,
      priority: 'Normal',
      status: 'Aprobada',
    };
    assert.equal((await catalog.list()).suppliers.length, 4);
    await assert.rejects(
      () => service.create({ ...input, odooSupplierId: additional.id }, requester),
      (error) => error.status === 422,
    );
    const created = await service.create(input, requester);
    assert.equal(created.status, 'Solicitada');
    assert.equal(created.supplier_vat, 'AGR151101U56');
    assert.equal(created.estimated_subtotal, 5000);
    assert.equal(created.folio.startsWith('AA-'), true);
    assert.equal((await service.create(input, requester)).id, created.id);
    assert.equal(await db.request.count(), 1, 'la misma captura no se duplica');
    await assert.rejects(
      () => purchase.create(created.id, requester),
      (error) => error.status === 409,
    );
    assert.equal(writes, 0);
    assert.equal(await db.purchaseLink.count(), 0);
    await assert.rejects(
      () => service.changeStatus(created.id, 'Aprobada', requester),
      (error) => error.status === 403,
    );
    await assert.rejects(
      () => service.changeStatus(created.id, 'Aprobada', { ...approver, identityVerified: false }),
      (error) => error.status === 403,
    );
    await service.changeStatus(created.id, 'Aprobada', approver);
    assert.equal(writes, 0, 'Aprobar no genera la OCM');
    assert.equal(purchase.describe(await requests.find(created.id), requester).canCreate, true);
    const event = await db.event.findFirst({
      where: { request_id: created.id, description: 'Estado: Aprobada' },
    });
    assert.equal(event.actor, approver.name);
    assert.ok(event.created_at);
    assert.equal((await purchase.create(created.id, requester)).created, true);
    assert.equal((await purchase.create(created.id, requester)).created, false);
    assert.equal(writes, 1);
    const link = await db.purchaseLink.findUnique({ where: { request_id: created.id } });
    assert.equal(link.status, 'created');
    assert.equal(link.order_name, 'OCM-SIMULADA');
    await service.changeStatus(created.id, 'Cancelada', approver);
    assert.equal((await purchase.create(created.id, requester)).created, false);
    assert.equal(writes, 1);

    // Una OCM en proceso impide cancelar, y el intento no deja rastro.
    const second = await service.create({ ...input, submissionKey: randomUUID() }, requester);
    await service.changeStatus(second.id, 'Aprobada', approver);
    const purchases = createPurchaseOrderRepository(db);
    const reservation = await purchases.reserve(second.id, null, 'gab-stag-123');
    assert.equal(reservation.reserved, true);
    await assert.rejects(
      () => service.changeStatus(second.id, 'Cancelada', approver),
      (error) => error.status === 409,
    );
    assert.equal((await requests.find(second.id)).status, 'Aprobada');
    await purchases.release(second.id, reservation.link.attempt_key);
    assert.equal(await db.purchaseLink.count({ where: { request_id: second.id } }), 0);

    const registered = await suppliers.register({ odooPartnerId: additional.id }, admin);
    assert.equal(registered.isNew, true);
    assert.equal((await catalog.list()).suppliers.length, 5);
    const local = await db.supplier.findUnique({ where: { odoo_partner_id: additional.id } });
    assert.equal(local.registered_by, admin.name);
    assert.ok(local.registered_at);
    assert.equal(await db.supplierEvent.count(), 5);
    await assert.rejects(
      () => suppliers.register({ odooPartnerId: additional.id }, admin),
      (error) => error.status === 409,
    );
    await assert.rejects(
      () => directory.register({ ...additional, id: 90002 }, admin.name),
      (error) => error.status === 409,
    );
    await assert.rejects(
      () => directory.register({ ...additional, id: 90003, vat: 'TST010101AB2' }, admin.name),
      (error) => error.status === 409,
    );
    assert.equal(await db.supplierEvent.count(), 5, 'los rechazos no dejan evento');

    await db.supplier.update({ where: { odoo_partner_id: 17305 }, data: { authorized: false } });
    assert.equal(
      (await service.create(input, requester)).id,
      created.id,
      'El reintento conserva la solicitud aunque cambie la autorización',
    );
    await assert.rejects(
      () => service.create({ ...input, submissionKey: randomUUID() }, requester),
      (error) => error.status === 422,
    );
    await assert.rejects(
      () => requests.create(input, { supplier: { id: 17305 } }, requester.name),
      (error) => error.status === 422,
    );

    // El Excel sale de la misma base: ejecución y conteo de adjuntos.
    const report = await requests.report(null);
    assert.equal(report.length, 2);
    assert.equal(report[0].attachments, 0);
    assert.equal(report[0].hectares, '12.50');
    // pg (el `client`) ve lo mismo que Prisma en el esquema aislado.
    assert.equal(
      (await client.query('SELECT count(*)::int AS n FROM aerial_requests')).rows[0].n,
      2,
    );
  }));
