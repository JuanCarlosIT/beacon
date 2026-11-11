import { hasVerifiedRole } from './access.model.js';

export const canRegisterSupplier = (user) => hasVerifiedRole(user, 'admin');
export const normalizeSupplierIdentifier = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, '').toUpperCase() : '';

export const supplierFromOdoo = (row) => ({
  id: row.id,
  name: row.name.trim(),
  vat: normalizeSupplierIdentifier(row.vat),
  reference: typeof row.ref === 'string' ? row.ref.trim().toUpperCase() : '',
});

const NEW_SUPPLIER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// «Nuevo»: dado de alta a mano en los últimos 30 días (y no con fecha futura).
const isRecentManual = (local, now) => {
  const age = now - new Date(local.registered_at).getTime();
  return local.registration_source === 'manual' && age >= 0 && age < NEW_SUPPLIER_DAYS * DAY_MS;
};

const withRegistration = (supplier, local, now) => ({
  ...supplier,
  registeredAt: local.registered_at,
  registrationSource: local.registration_source,
  isNew: isRecentManual(local, now),
});

// Proveedores de Odoo que además están autorizados en el directorio local.
export function authorizedSuppliers(catalog, registrations, now = Date.now()) {
  const local = new Map(registrations.map((row) => [row.odoo_partner_id, row]));
  return catalog.suppliers
    .filter((supplier) => local.get(supplier.id)?.authorized)
    .map((supplier) => withRegistration(supplier, local.get(supplier.id), now));
}
