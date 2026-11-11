import { getOdooCatalog } from '../integrations/odoo/odooCatalog.service.js';
import { supplierRepository } from '../repositories/supplier.repository.js';
import { authorizedSuppliers, canRegisterSupplier } from '../models/supplier.model.js';

export function createCatalogService(directory = supplierRepository, readCatalog = getOdooCatalog) {
  return {
    async list(options = {}, user = null) {
      const [catalog, registrations] = await Promise.all([
        readCatalog(options),
        directory.listAuthorized(),
      ]);
      return {
        ...catalog,
        suppliers: authorizedSuppliers(catalog, registrations),
        supplierPermissions: { canRegister: canRegisterSupplier(user) },
      };
    },
  };
}

export const catalogService = createCatalogService();
