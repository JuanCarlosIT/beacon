import { prisma } from '../config/prisma.js';
import { ensure } from '../errors/HttpError.js';
import { withUniqueConflict } from './query.helpers.js';

const ALREADY_AUTHORIZED = 'Este proveedor ya está autorizado en la aplicación.';

const registration = (supplier, actor) => ({
  name: supplier.name,
  vat: supplier.vat,
  reference: supplier.reference,
  authorized: true,
  registered_at: new Date(),
  registered_by: actor,
  registration_source: 'manual',
});

// Reactiva un proveedor que existía sin autorizar; si otro lo autorizó antes, no lo toca.
async function reactivate(tx, supplier, actor) {
  const { count } = await tx.supplier.updateMany({
    where: { odoo_partner_id: supplier.id, authorized: false },
    data: registration(supplier, actor),
  });
  ensure(count, 409, ALREADY_AUTHORIZED);
  return tx.supplier.findUnique({ where: { odoo_partner_id: supplier.id } });
}

const createNew = (tx, supplier, actor) =>
  tx.supplier.create({ data: { odoo_partner_id: supplier.id, ...registration(supplier, actor) } });

// Alta (o reactivación) manual con su evento de auditoría, todo en una transacción.
async function registerIn(tx, supplier, actor) {
  const current = await tx.supplier.findUnique({ where: { odoo_partner_id: supplier.id } });
  ensure(!current?.authorized, 409, ALREADY_AUTHORIZED);
  const saved = current
    ? await reactivate(tx, supplier, actor)
    : await createNew(tx, supplier, actor);
  await tx.supplierEvent.create({
    data: {
      odoo_partner_id: supplier.id,
      actor,
      description: 'Proveedor autorizado en el directorio local',
    },
  });
  return saved;
}

export function createSupplierRepository(db = prisma) {
  return {
    listAuthorized: () =>
      db.supplier.findMany({
        where: { authorized: true },
        orderBy: [{ name: 'asc' }, { odoo_partner_id: 'asc' }],
      }),

    register: (supplier, actor) =>
      withUniqueConflict(
        () => db.$transaction((tx) => registerIn(tx, supplier, actor)),
        'Ya existe un proveedor autorizado con ese RFC o referencia.',
      ),
  };
}

export const supplierRepository = createSupplierRepository();
