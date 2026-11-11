/**
 * Puerto de acceso a solicitudes. Los casos de uso no conocen fetch ni React.
 * @typedef {Object} RequestRepository
 * @property {() => Promise<{database: boolean}>} health
 * @property {() => Promise<{user: Object|null}>} currentUser
 * @property {() => Promise<Array>} list
 * @property {(id: string) => Promise<Object>} detail
 * @property {(input: Object) => Promise<Object>} create
 * @property {(id: string) => Promise<Object>} createPurchaseOrder
 * @property {(id: string, status: string) => Promise<Object>} changeStatus
 * @property {(id: string) => Promise<{folio: string, approvers: string[]}>} requestApproval
 * @property {(query: string) => Promise<Object>} supplierCandidates
 * @property {(input: Object) => Promise<Object>} registerSupplier
 * @property {(refresh: boolean) => Promise<Object>} catalogs
 * @property {() => Promise<{blob: Blob, fileName: string}>} exportReport
 */
export {};
