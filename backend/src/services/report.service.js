import writeExcelFile from 'write-excel-file/node';
import { requestRepository } from '../repositories/request.repository.js';
import { dateOnly, ownerScope, requestFolio } from '../models/request.model.js';

// Columnas del Excel: [encabezado, campo, ancho].
const COLUMNS = [
  ['Folio', 'folio', 16],
  ['Fecha solicitada', 'requested_date', 20],
  ['Zona / ubicación histórica', 'ranch', 24],
  ['Lote', 'lot', 16],
  ['Cultivo', 'crop', 18],
  ['Ciclo', 'cycle_name', 16],
  ['Ha solicitadas', 'hectares', 18],
  ['Proveedor solicitado', 'supplier_name', 32],
  ['Periodo de aplicación', 'application_period_name', 24],
  ['Tarifa MXN/ha', 'rate_per_hectare', 18],
  ['Subtotal estimado MXN (sin impuestos)', 'estimated_subtotal', 28],
  ['Tratamiento', 'treatment', 35],
  ['Prioridad', 'priority', 14],
  ['Estado', 'status', 16],
  ['Solicitante', 'requested_by', 28],
  ['Fecha realizada', 'execution_date', 20],
  ['Ha realizadas', 'actual_hectares', 18],
  ['Proveedor realizado', 'provider', 24],
  ['Piloto', 'pilot', 24],
  ['Costo MXN', 'cost', 18],
  ['Notas solicitud', 'notes', 35],
];
const MONEY_FIELDS = new Set(['cost', 'rate_per_hectare', 'estimated_subtotal']);
const HEADER_STYLE = { fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#233E56' };

const reportDate = (value) => (value ? dateOnly(value) : null);
const optionalNumber = (value) => (value == null ? null : Number(value));

const toReportRow = (row) => ({
  ...row,
  folio: requestFolio(row),
  requested_date: reportDate(row.requested_date),
  execution_date: reportDate(row.execution_date),
  hectares: Number(row.hectares),
  actual_hectares: optionalNumber(row.actual_hectares),
  cost: optionalNumber(row.cost),
  rate_per_hectare: optionalNumber(row.rate_per_hectare),
  estimated_subtotal: optionalNumber(row.estimated_subtotal),
});

const moneyFormat = (key, value) =>
  MONEY_FIELDS.has(key) && value != null ? { type: Number, format: '#,##0.00' } : {};

const toColumn = ([header, key, width]) => ({
  header: { value: header, ...HEADER_STYLE },
  width,
  cell: (row) => ({ value: row[key] ?? null, ...moneyFormat(key, row[key]) }),
});

export async function createExcelReport(user, repository = requestRepository) {
  const rows = (await repository.report(ownerScope(user))).map(toReportRow);
  return writeExcelFile(rows, {
    columns: COLUMNS.map(toColumn),
    sheet: 'Aplicaciones',
    stickyRowsCount: 1,
  }).toBuffer();
}
