import {
  httpRequest,
  httpDownload,
  httpFile,
  httpUpload,
} from '../../../shared/http/httpClient.js';

const json = (method, body) => ({ method, body: JSON.stringify(body) });
// Basta el archivo: el número y las hectáreas de la remisión los pone el servidor.
const remissionForm = ({ file }) => {
  const form = new FormData();
  form.append('file', file);
  return form;
};

export const requestApiRepository = {
  health: () => httpRequest('/health'),
  currentUser: () => httpRequest('/auth/me'),
  enterAccessKey: (key) => httpRequest('/auth/access', json('POST', { key })),
  list: () => httpRequest('/requests'),
  detail: (id) => httpRequest(`/requests/${encodeURIComponent(id)}`),
  create: (input) => httpRequest('/requests', { method: 'POST', body: JSON.stringify(input) }),
  decideRate: (id, decision) =>
    httpRequest(`/requests/${encodeURIComponent(id)}/rate`, json('PATCH', { decision })),
  correctRate: (id, ratePerHectare) =>
    httpRequest(`/requests/${encodeURIComponent(id)}/rate`, json('PUT', { ratePerHectare })),
  uploadRemission: (id, remission) =>
    httpUpload(`/requests/${encodeURIComponent(id)}/attachments`, remissionForm(remission)),
  downloadRemission: (id, fileName) => httpFile(`/attachments/${encodeURIComponent(id)}`, fileName),
  reviewRemission: (id, status) =>
    httpRequest(`/attachments/${encodeURIComponent(id)}/review`, json('PATCH', { status })),
  uploadRecipeImage: (file) => {
    const form = new FormData();
    form.append('file', file);
    return httpUpload('/recipe-files', form);
  },
  downloadRecipeImage: (id, fileName) =>
    httpFile(`/recipe-files/${encodeURIComponent(id)}`, fileName),
  productGroups: () => httpRequest('/catalogs/product-groups'),
  cycleRates: () => httpRequest('/cycle-rates'),
  saveCycleRate: (cycleId, ratePerHectare) =>
    httpRequest(`/cycle-rates/${encodeURIComponent(cycleId)}`, json('PUT', { ratePerHectare })),
  purchaseBoard: () => httpRequest('/purchase-orders'),
  createPurchaseOrder: (remissionIds) =>
    httpRequest('/purchase-orders', json('POST', { remissionIds })),
  verifyPurchaseOrder: (id) =>
    httpRequest(`/purchase-orders/${encodeURIComponent(id)}/verify`, { method: 'POST' }),
  requestApproval: (id) =>
    httpRequest(`/requests/${encodeURIComponent(id)}/approval-notice`, { method: 'POST' }),
  changeStatus: (id, status) =>
    httpRequest(`/requests/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  supplierCandidates: (query) =>
    httpRequest(`/suppliers/candidates?q=${encodeURIComponent(query)}`),
  registerSupplier: (input) =>
    httpRequest('/suppliers', { method: 'POST', body: JSON.stringify(input) }),
  catalogs: (refresh) => httpRequest(`/catalogs${refresh ? '?refresh=1' : ''}`),
  exportReport: () => httpDownload('/reports/excel', 'aplicaciones-aereas.xlsx'),
};
