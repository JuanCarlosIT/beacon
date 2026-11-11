import { createRequestPayload } from '../domain/request.js';

/** @param {import('./ports/requestRepository.port.js').RequestRepository} repository */
export function createRequestUseCases(repository) {
  return {
    async loadHistory() {
      const health = await repository.health();
      if (!health.database)
        return { connected: false, rows: [], error: 'Servicio no disponible. Intenta de nuevo.' };
      return { connected: true, rows: await repository.list(), error: '' };
    },
    currentUser: async () => (await repository.currentUser()).user,
    loadCatalogs: (refresh = false) => repository.catalogs(refresh),
    loadDetail: (id) => repository.detail(id),
    register: (input) => repository.create(createRequestPayload(input)),
    createPurchaseOrder: (id) => repository.createPurchaseOrder(id),
    changeStatus: (id, status) => repository.changeStatus(id, status),
    requestApproval: (id) => repository.requestApproval(id),
    supplierCandidates: (query) => repository.supplierCandidates(query.trim()),
    registerSupplier: (id) => repository.registerSupplier({ odooPartnerId: Number(id) }),
    exportReport: () => repository.exportReport(),
  };
}
