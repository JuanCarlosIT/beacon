import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { createRequestRepository } from '../src/repositories/request.repository.js';
import { fakePrisma } from './helpers/fake-prisma.js';

const values = {
  date: '2026-11-03',
  hectares: 12.5,
  treatment: '',
  priority: 'Normal',
  notes: '',
  submissionKey: '780f0712-d890-4e6d-b9af-b2f58c7a31f2',
  odooSupplierId: 6,
  applicationPeriodCode: 'Post-siembra',
  ratePerHectare: 400,
};
const selected = {
  zone: { id: 1, name: 'Zona' },
  plot: { id: 2, name: 'Predio' },
  crop: { id: 3, name: 'Cultivo' },
  cycle: { id: 4, name: 'Ciclo' },
  record: { id: 5 },
  supplier: { id: 6, name: 'Proveedor de Odoo' },
  applicationPeriod: { code: 'Post-siembra', name: 'Post-siembra' },
};

// Solicitud como la devuelve Prisma (Decimal, BigInt, Date y relaciones).
const prismaRequest = (overrides = {}) => ({
  id: 'solicitud',
  number: 7n,
  requested_date: new Date('2026-11-03T00:00:00Z'),
  hectares: new Prisma.Decimal('12.5'),
  rate_per_hectare: new Prisma.Decimal('400'),
  odoo_plot_id: 5,
  odoo_supplier_id: 6,
  application_period_code: 'Post-siembra',
  treatment: '',
  priority: 'Normal',
  notes: '',
  requested_by: 'Solicitante',
  odoo_catalog_snapshot: { supplier: { name: 'Proveedor de Odoo' } },
  supplier: { name: 'Nombre local', vat: 'AAA010101AA1', reference: 'REF' },
  period: { name: 'Post-siembra' },
  purchaseLink: null,
  ...overrides,
});

const authorized = { findFirst: async () => ({ odoo_partner_id: 6 }) };
const periods = { upsert: async () => ({}) };

test('guarda claves foráneas normalizadas y tarifa en una sola transacción', async () => {
  const f = fakePrisma({
    supplier: authorized,
    applicationPeriod: periods,
    request: { createMany: async () => ({ count: 1 }), findFirst: async () => prismaRequest() },
    event: { create: async () => ({}) },
  });
  const saved = await createRequestRepository(f.db).create(values, selected, 'Solicitante');

  assert.equal(f.transactions(), 1);
  assert.deepEqual(f.called('supplier', 'findFirst')[0].args.where, {
    odoo_partner_id: 6,
    authorized: true,
  });
  assert.deepEqual(f.called('applicationPeriod', 'upsert')[0].args.create, {
    code: 'Post-siembra',
    name: 'Post-siembra',
  });
  const { data, skipDuplicates } = f.called('request', 'createMany')[0].args;
  assert.equal(skipDuplicates, true);
  assert.equal(data[0].odoo_supplier_id, 6);
  assert.equal(data[0].application_period_code, 'Post-siembra');
  assert.equal(data[0].rate_per_hectare, 400);
  assert.deepEqual(data[0].odoo_catalog_snapshot.supplier, selected.supplier);
  assert.deepEqual(data[0].odoo_catalog_snapshot.applicationPeriod, selected.applicationPeriod);
  assert.equal(f.called('event', 'create')[0].args.data.description, 'Solicitud creada');

  // Misma forma de fila que antes: decimales y folio como texto, columnas calculadas planas.
  assert.equal(saved.number, '7');
  assert.equal(saved.hectares, '12.50');
  assert.equal(saved.estimated_subtotal, '5000.00');
  assert.equal(saved.supplier_name, 'Proveedor de Odoo', 'manda el snapshot de Odoo');
  assert.equal(saved.supplier_vat, 'AAA010101AA1', 'si el snapshot no lo trae, el directorio');
  assert.equal(saved.application_period_name, 'Post-siembra');
  assert.equal(saved.purchase_order_status, null);
  assert.equal(saved.supplier, undefined);
});

test('un conflicto de captura no duplica la solicitud ni el evento', async () => {
  const f = fakePrisma({
    supplier: authorized,
    applicationPeriod: periods,
    request: { createMany: async () => ({ count: 0 }), findFirst: async () => prismaRequest() },
  });
  const previous = await createRequestRepository(f.db).create(
    { ...values, odooPlotId: 5 },
    selected,
    'Solicitante',
  );
  assert.equal(previous.id, 'solicitud');
  assert.deepEqual(f.called('request', 'findFirst')[0].args.where, {
    submission_key: values.submissionKey,
  });
  assert.equal(f.called('event', 'create').length, 0);
});

test('guardar no autoriza proveedores automáticamente ni acepta un proveedor revocado', async () => {
  const f = fakePrisma({ supplier: { findFirst: async () => null } });
  await assert.rejects(
    () => createRequestRepository(f.db).create(values, selected, 'Solicitante'),
    (error) => error.status === 422,
  );
  assert.equal(f.calls.length, 1);
});

test('cancelar con una OCM en proceso falla dentro de la transacción y no deja evento', async () => {
  const f = fakePrisma({
    request: { updateMany: async () => ({ count: 1 }) },
    purchaseLink: { findFirst: async () => ({ request_id: 'id' }) },
  });
  await assert.rejects(
    () => createRequestRepository(f.db).changeStatus('id', 'Solicitada', 'Cancelada', 'Admin'),
    (error) => error.status === 409,
  );
  assert.equal(f.transactions(), 1, 'el error revierte el cambio de estado');
  assert.deepEqual(f.called('request', 'updateMany')[0].args, {
    where: { id: 'id', status: 'Solicitada' },
    data: { status: 'Cancelada' },
  });
  assert.equal(f.called('event', 'create').length, 0);
});

test('si otro usuario ya cambió el estado no se registra nada', async () => {
  const f = fakePrisma({ request: { updateMany: async () => ({ count: 0 }) } });
  assert.equal(
    await createRequestRepository(f.db).changeStatus('id', 'Solicitada', 'Aprobada', 'Admin'),
    false,
  );
  assert.equal(f.calls.length, 1);
});

test('el reporte trae la ejecución y cuenta adjuntos con la misma forma de fila', async () => {
  const f = fakePrisma({
    request: {
      findMany: async () => [
        prismaRequest({
          execution: {
            execution_date: new Date('2026-11-05T00:00:00Z'),
            hectares: new Prisma.Decimal('12'),
            provider: 'Proveedor',
            pilot: 'Piloto',
            cost: new Prisma.Decimal('4800'),
          },
          _count: { attachments: 2 },
        }),
      ],
    },
  });
  const [row] = await createRequestRepository(f.db).report(null);
  assert.deepEqual(f.called('request', 'findMany')[0].args.where, {});
  assert.equal(row.actual_hectares, '12.00');
  assert.equal(row.cost, '4800.00');
  assert.equal(row.attachments, 2);
  assert.equal(row.execution, undefined);
});
