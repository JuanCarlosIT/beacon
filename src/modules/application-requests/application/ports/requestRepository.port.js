/**
 * Puerto de acceso a solicitudes. Los casos de uso no conocen fetch ni React.
 * @typedef {Object} RequestRepository
 * @property {() => Promise<{database: boolean}>} health
 * @property {() => Promise<{user: Object|null, accessRequired?: boolean}>} currentUser
 * @property {(key: string) => Promise<Object>} enterAccessKey
 * @property {() => Promise<Array>} list
 * @property {(id: string) => Promise<Object>} detail
 * @property {(input: Object) => Promise<Object>} create
 * @property {(id: string, decision: string) => Promise<Object>} decideRate
 * @property {(id: string, ratePerHectare: number) => Promise<Object>} correctRate
 * @property {(id: string, remission: Object) => Promise<Object>} uploadRemission
 * @property {(id: string, status: string) => Promise<Object>} reviewRemission
 * @property {() => Promise<Array>} productGroups
 * @property {(file: File) => Promise<Object>} uploadRecipeImage
 * @property {(id: string, fileName: string) => Promise<Object>} downloadRecipeImage
 * @property {() => Promise<Object>} cycleRates
 * @property {(cycleId: number, ratePerHectare: number) => Promise<Object>} saveCycleRate
 * @property {() => Promise<Object>} purchaseBoard
 * @property {(remissionIds: string[]) => Promise<Object>} createPurchaseOrder
 * @property {(id: string) => Promise<Object>} verifyPurchaseOrder
 * @property {(id: string, status: string) => Promise<Object>} changeStatus
 * @property {(id: string) => Promise<{folio: string, approvers: string[]}>} requestApproval
 * @property {(query: string) => Promise<Object>} supplierCandidates
 * @property {(input: Object) => Promise<Object>} registerSupplier
 * @property {(refresh: boolean) => Promise<Object>} catalogs
 * @property {() => Promise<{blob: Blob, fileName: string}>} exportReport
 */
export {};
