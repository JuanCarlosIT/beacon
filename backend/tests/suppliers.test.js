import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizedSuppliers,
  canRegisterSupplier,
  supplierFromOdoo,
} from '../src/models/supplier.model.js';
import { createCatalogService } from '../src/services/catalog.service.js';
import { createSupplierService } from '../src/services/supplier.service.js';
import { createSupplierRepository } from '../src/repositories/supplier.repository.js';
import { demoUsers } from '../src/models/demoUsers.js';
import { fakePrisma } from './helpers/fake-prisma.js';

const admin = { name: 'Administración verificada', role: 'admin', identityVerified: true };
const supplier = { id: 6, name: 'Proveedor real', vat: 'ABC010101AB1', reference: 'PRV-1' };
const now = new Date('2026-11-03T12:00:00Z').getTime();
const registration = {
  odoo_partner_id: 6,
  authorized: true,
  registered_at: new Date(now).toISOString(),
  registration_source: 'manual',
};

test('normaliza RFC/referencia y conserva el ID solo como clave interna', () => {
  assert.deepEqual(
    supplierFromOdoo({ id: 6, name: ' Proveedor real ', vat: ' abc010101ab1 ', ref: ' prv-1 ' }),
    supplier,
  );
  assert.deepEqual(supplierFromOdoo({ id: 7, name: 'Sin referencia', vat: false, ref: false }), {
    id: 7,
    name: 'Sin referencia',
    vat: '',
    reference: '',
  });
});

test('solo el directorio local habilita proveedores; no se filtra por etiquetas de Odoo', async () => {
  const catalog = {
    records: [],
    suppliers: [supplier, { ...supplier, id: 7, name: 'No autorizado' }],
  };
  const registrations = [registration];
  const service = createCatalogService(
    { listAuthorized: async () => registrations },
    async () => catalog,
  );
  const result = await service.list({}, { role: 'solicitante' });
  assert.deepEqual(
    result.suppliers.map((row) => row.id),
    [6],
  );
  assert.equal(result.supplierPermissions.canRegister, false);
  assert.equal(catalog.suppliers.length, 2);
  registrations.push({ ...registration, odoo_partner_id: 7 });
  assert.equal((await service.list({}, admin)).suppliers.length, 2);
  assert.equal((await service.list({}, admin)).supplierPermissions.canRegister, true);
  registrations[0] = { ...registration, authorized: false };
  assert.deepEqual(
    (await service.list()).suppliers.map((row) => row.id),
    [7],
  );
});

test('Nuevo distingue altas manuales durante 30 días, no los cuatro proveedores iniciales', () => {
  const catalog = { suppliers: [supplier] };
  const view = (changes, time = now) =>
    authorizedSuppliers(catalog, [{ ...registration, ...changes }], time)[0];
  assert.equal(view({}).isNew, true);
  assert.equal(view({ registration_source: 'initial' }).isNew, false);
  assert.equal(view({}, now + 30 * 24 * 60 * 60 * 1000).isNew, false);
  assert.equal(view({}, now - 1).isNew, false);
  assert.equal(view({}).registeredAt, registration.registered_at);
  assert.deepEqual(authorizedSuppliers(catalog, []), []);
});

test('ningún perfil ficticio, solicitante, aprobador u operador registra proveedores', async () => {
  const service = createSupplierService({}, () => {
    throw new Error('No debe leer Odoo');
  });
  for (const user of [
    ...demoUsers,
    { role: 'solicitante', identityVerified: true },
    { role: 'aprobador', identityVerified: true },
    { role: 'operador', identityVerified: true },
  ]) {
    assert.equal(canRegisterSupplier(user), false);
    await assert.rejects(
      () => service.candidates('real', user),
      (error) => error.status === 403,
    );
    await assert.rejects(
      () => service.register({ odooPartnerId: 6 }, user),
      (error) => error.status === 403,
    );
  }
});

test('la búsqueda requiere una consulta explícita y solo devuelve contactos elegibles no registrados', async () => {
  const catalog = {
    suppliers: [supplier, { ...supplier, id: 7 }, { ...supplier, id: 8, vat: '', reference: '' }],
  };
  const service = createSupplierService(
    { listAuthorized: async () => [registration] },
    async () => catalog,
  );
  assert.deepEqual(
    (await service.candidates('ABC010101', admin)).suppliers.map((row) => row.id),
    [7],
  );
  await assert.rejects(() => service.candidates('ab', admin));
});

test('el alta relee Odoo y solo acepta su ID, nunca nombres ni RFC enviados por el navegador', async () => {
  let saved;
  let refreshed;
  const service = createSupplierService(
    {
      register: async (row, actor) => {
        saved = { row, actor };
        return registration;
      },
    },
    async (options) => {
      refreshed = options;
      return { suppliers: [supplier] };
    },
  );
  const result = await service.register({ odooPartnerId: 6 }, admin);
  assert.deepEqual(saved, { row: supplier, actor: admin.name });
  assert.deepEqual(refreshed, { refresh: true });
  assert.equal(result.vat, supplier.vat);
  assert.equal(result.registrationSource, 'manual');
  await assert.rejects(() => service.register({ odooPartnerId: 6, name: 'Inventado' }, admin));
  await assert.rejects(
    () => service.register({ odooPartnerId: 99 }, admin),
    (error) => error.status === 422,
  );
  const noIdentifier = createSupplierService({}, async () => ({
    suppliers: [{ ...supplier, vat: '', reference: '' }],
  }));
  await assert.rejects(
    () => noIdentifier.register({ odooPartnerId: 6 }, admin),
    (error) => error.status === 422,
  );
});

test('el repositorio registra autorización y auditoría en la misma transacción y traduce duplicados', async () => {
  const fresh = fakePrisma({
    supplier: { findUnique: async () => null, create: async () => registration },
    supplierEvent: { create: async () => ({}) },
  });
  assert.equal(
    await createSupplierRepository(fresh.db).register(supplier, admin.name),
    registration,
  );
  assert.equal(fresh.transactions(), 1);
  const { data } = fresh.called('supplier', 'create')[0].args;
  assert.deepEqual(
    [data.odoo_partner_id, data.name, data.vat, data.reference, data.registered_by],
    [6, supplier.name, supplier.vat, supplier.reference, admin.name],
  );
  assert.equal(data.authorized, true);
  assert.equal(fresh.called('supplierEvent', 'create')[0].args.data.odoo_partner_id, 6);

  // Uno que existía sin autorizar se reactiva solo si sigue sin autorizar.
  const revoked = fakePrisma({
    supplier: {
      findUnique: async () => ({ ...registration, authorized: false }),
      updateMany: async () => ({ count: 1 }),
    },
    supplierEvent: { create: async () => ({}) },
  });
  await createSupplierRepository(revoked.db).register(supplier, admin.name);
  assert.deepEqual(revoked.called('supplier', 'updateMany')[0].args.where, {
    odoo_partner_id: 6,
    authorized: false,
  });

  const duplicateId = fakePrisma({ supplier: { findUnique: async () => registration } });
  await assert.rejects(
    () => createSupplierRepository(duplicateId.db).register(supplier, admin.name),
    (error) => error.status === 409,
  );
  assert.equal(duplicateId.called('supplierEvent', 'create').length, 0);
  const duplicateVat = fakePrisma({
    supplier: {
      findUnique: async () => null,
      create: async () => {
        throw Object.assign(new Error('Duplicado'), { code: 'P2002' });
      },
    },
  }).db;
  await assert.rejects(
    () => createSupplierRepository(duplicateVat).register(supplier, admin.name),
    (error) => error.status === 409 && /RFC o referencia/.test(error.message),
  );
});
