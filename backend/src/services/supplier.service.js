import { z } from 'zod';
import { getOdooCatalog } from '../integrations/odoo/odooCatalog.service.js';
import { supplierRepository } from '../repositories/supplier.repository.js';
import { authorizedSuppliers, canRegisterSupplier } from '../models/supplier.model.js';
import { ensure, required } from '../errors/HttpError.js';

const MAX_RESULTS = 25;
const registrationSchema = z.object({ odooPartnerId: z.number().int().positive() }).strict();
const querySchema = z.string().trim().min(3, 'Escribe al menos 3 caracteres.').max(100);

const requireAdministration = (user) =>
  ensure(
    canRegisterSupplier(user),
    403,
    'Solo administración con identidad verificada puede registrar proveedores.',
  );

// Texto comparable: sin acentos y en minúsculas.
const searchable = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const hasIdentifier = (supplier) => Boolean(supplier.vat || supplier.reference);

const matchesQuery = (text) => (supplier) =>
  searchable(`${supplier.name} ${supplier.vat} ${supplier.reference}`).includes(searchable(text));

export function createSupplierService(
  directory = supplierRepository,
  readCatalog = getOdooCatalog,
) {
  return {
    async candidates(query, user) {
      requireAdministration(user);
      const text = querySchema.parse(query);
      const [catalog, registrations] = await Promise.all([
        readCatalog(),
        directory.listAuthorized(),
      ]);
      const registered = new Set(registrations.map((row) => row.odoo_partner_id));
      const matches = catalog.suppliers.filter(
        (supplier) =>
          !registered.has(supplier.id) && hasIdentifier(supplier) && matchesQuery(text)(supplier),
      );
      return { suppliers: matches.slice(0, MAX_RESULTS), hasMore: matches.length > MAX_RESULTS };
    },

    async register(body, user) {
      requireAdministration(user);
      const { odooPartnerId } = registrationSchema.parse(body);
      // Siempre releer antes del alta; el navegador solo elige el contacto, no su identidad.
      const catalog = await readCatalog({ refresh: true });
      const supplier = required(
        catalog.suppliers.find((item) => item.id === odooPartnerId),
        422,
        'El proveedor ya no está activo en Odoo. Actualiza la búsqueda.',
      );
      ensure(
        hasIdentifier(supplier),
        422,
        'El proveedor necesita un RFC o referencia en Odoo antes del alta.',
      );
      const saved = await directory.register(supplier, user.name);
      return authorizedSuppliers({ suppliers: [supplier] }, [saved])[0];
    },
  };
}

export const supplierService = createSupplierService();
