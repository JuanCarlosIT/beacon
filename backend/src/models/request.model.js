const optionalNumber = (value) => (value == null ? null : Number(value));
const asIs = (value) => value;

// Fecha de la base (Date o texto) como AAAA-MM-DD.
export const dateOnly = (value) =>
  value?.toISOString?.().slice(0, 10) || String(value).slice(0, 10);

export const requestFolio = (row) => `AA-${String(row.number).padStart(5, '0')}`;
export const requestToDto = (row) => ({
  ...row,
  folio: requestFolio(row),
  hectares: Number(row.hectares),
  rate_per_hectare: optionalNumber(row.rate_per_hectare),
  estimated_subtotal: optionalNumber(row.estimated_subtotal),
});
export const ownerScope = (user) => (user.role === 'solicitante' ? user.name : null);

// Campos que deben coincidir para tratar una captura repetida como la misma solicitud:
// [columna guardada, campo capturado, cómo leer la columna].
const SUBMISSION_FIELDS = [
  ['requested_date', 'date', dateOnly],
  ['odoo_plot_id', 'odooPlotId', Number],
  ['hectares', 'hectares', Number],
  ['odoo_supplier_id', 'odooSupplierId', Number],
  ['application_period_code', 'applicationPeriodCode', asIs],
  ['rate_per_hectare', 'ratePerHectare', Number],
  ['treatment', 'treatment', asIs],
  ['priority', 'priority', asIs],
  ['notes', 'notes', asIs],
];

export const matchesSubmission = (row, values, actor) =>
  row.requested_by === actor &&
  SUBMISSION_FIELDS.every(([column, field, read]) => read(row[column]) === values[field]);
