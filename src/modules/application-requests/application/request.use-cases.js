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
    // true si esta vista pide clave y todavía no se ha escrito en esta sesión.
    accessRequired: async () => (await repository.currentUser()).accessRequired === true,
    enterAccessKey: (key) => repository.enterAccessKey(key.trim()),
    loadCatalogs: (refresh = false) => repository.catalogs(refresh),
    loadDetail: (id) => repository.detail(id),
    register: (input) => repository.create(createRequestPayload(input)),
    decideRate: (id, decision) => repository.decideRate(id, decision),
    correctRate: (id, rate) => repository.correctRate(id, Number(rate)),
    uploadRemission: (id, remission) => repository.uploadRemission(id, { file: remission.file }),
    reviewRemission: (id, status) => repository.reviewRemission(id, status),
    downloadRemission: (remission) =>
      repository.downloadRemission(remission.id, remission.original_name),
    // Catálogo de Odoo para la receta: [{ id, name: 'Fungicida', products: [...] }].
    loadProductGroups: () => repository.productGroups(),
    // Sube la imagen de la receta; regresa { id, name, text, readFailed } con el texto leído.
    uploadRecipeImage: (file) => repository.uploadRecipeImage(file),
    downloadRecipeImage: (file) => repository.downloadRecipeImage(file.id, file.original_name),
    loadCycleRates: () => repository.cycleRates(),
    saveCycleRate: (cycleId, rate) => repository.saveCycleRate(cycleId, Number(rate)),
    loadPurchaseBoard: () => repository.purchaseBoard(),
    createPurchaseOrder: (remissionIds) => repository.createPurchaseOrder(remissionIds),
    verifyPurchaseOrder: (id) => repository.verifyPurchaseOrder(id),
    changeStatus: (id, status) => repository.changeStatus(id, status),
    requestApproval: (id) => repository.requestApproval(id),
    supplierCandidates: (query) => repository.supplierCandidates(query.trim()),
    registerSupplier: (id) => repository.registerSupplier({ odooPartnerId: Number(id) }),
    exportReport: () => repository.exportReport(),
  };
}
