import { httpRequest, httpDownload } from '../../../shared/http/httpClient.js';

export const requestApiRepository = {
  health: () => httpRequest('/health'),
  currentUser: () => httpRequest('/auth/me'),
  list: () => httpRequest('/requests'),
  detail: (id) => httpRequest(`/requests/${encodeURIComponent(id)}`),
  create: (input) => httpRequest('/requests', { method: 'POST', body: JSON.stringify(input) }),
  createPurchaseOrder: (id) =>
    httpRequest(`/requests/${encodeURIComponent(id)}/purchase-order`, { method: 'POST' }),
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
