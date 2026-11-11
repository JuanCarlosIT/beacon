import { supplierFromOdoo } from './supplier.model.js';

export class CatalogError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'CatalogError';
    this.status = status;
  }
}

const relationId = (value) => (Array.isArray(value) ? value[0] : null);
const indexById = (rows) => new Map(rows.map((row) => [row.id, row]));
const idName = ({ id, name }) => ({ id, name });

// Un lote por ciclo de Odoo pasado a la forma que usa la app.
const toRecord = (row) => ({
  id: row.id,
  name: row.name,
  zoneId: relationId(row.zone_id),
  plotNameId: relationId(row.plot_name_id),
  cropId: relationId(row.crop_id),
  cycleId: relationId(row.cycle_id),
  hectares: Number(row.has),
});

// Solo se aceptan lotes con zona, predio, cultivo y ciclo conocidos, superficie positiva
// y, si el predio tiene zona, que sea la misma del lote.
const isUsableRecord = (indexes) => (record) => {
  const plot = indexes.plots.get(record.plotNameId);
  const plotZone = relationId(plot?.zone_id);
  return (
    indexes.zones.has(record.zoneId) &&
    Boolean(plot) &&
    indexes.crops.has(record.cropId) &&
    indexes.cycles.has(record.cycleId) &&
    record.hectares > 0 &&
    (!plotZone || plotZone === record.zoneId)
  );
};

const usedIds = (records, key) => new Set(records.map((record) => record[key]));
const onlyUsed = (rows, ids) => rows.filter((row) => ids.has(row.id));

const toCycle = (row) => ({
  id: row.id,
  name: row.name,
  startDate: row.start_date || null,
  endDate: row.end_date || null,
});

const isActiveSupplier = (row) =>
  row.active && row.supplier_rank > 0 && row.id > 0 && row.name?.trim();
const byName = (a, b) => a.name.localeCompare(b.name, 'es');

export function buildCatalog(
  { zones, plots, crops, cycles, fields, suppliers = [], applicationPeriods = [] },
  syncedAt = new Date().toISOString(),
) {
  const indexes = {
    zones: indexById(zones),
    plots: indexById(plots),
    crops: indexById(crops),
    cycles: indexById(cycles),
  };
  const records = fields.map(toRecord).filter(isUsableRecord(indexes));
  const select = (rows, key, shape = idName) => onlyUsed(rows, usedIds(records, key)).map(shape);
  return {
    source: 'odoo',
    syncedAt,
    zones: select(zones, 'zoneId'),
    plots: select(plots, 'plotNameId'),
    crops: select(crops, 'cropId'),
    cycles: select(cycles, 'cycleId', toCycle),
    records,
    suppliers: suppliers.filter(isActiveSupplier).map(supplierFromOdoo).sort(byName),
    applicationPeriods: applicationPeriods.map(({ code, name }) => ({ code, name })),
    excludedRecords: fields.length - records.length,
  };
}

const invalid = (message) => new CatalogError(message, 422);

export function resolvePurchaseSelection(catalog, supplierId, applicationPeriodCode) {
  const supplier = catalog.suppliers.find((item) => item.id === supplierId);
  if (!supplier)
    throw invalid(
      'Elige un proveedor activo y autorizado de la lista. Actualiza las opciones si falta.',
    );
  const applicationPeriod = catalog.applicationPeriods.find(
    (item) => item.code === applicationPeriodCode,
  );
  if (!applicationPeriod) throw invalid('Elige un periodo de aplicación de la lista.');
  return { supplier, applicationPeriod };
}

const isValidArea = (hectares, max) => Number.isFinite(hectares) && hectares > 0 && hectares <= max;
const findById = (rows, id) => rows.find((item) => item.id === id);

export function resolveCatalogSelection(catalog, id, hectares) {
  const record = findById(catalog.records, id);
  if (!record)
    throw invalid(
      'Ese lote por ciclo ya no está disponible en Odoo. Actualiza los catálogos y vuelve a seleccionarlo.',
    );
  if (!isValidArea(hectares, record.hectares))
    throw invalid(
      `La superficie debe ser mayor a cero y no superar las ${record.hectares} ha registradas en Odoo.`,
    );
  return {
    record,
    zone: findById(catalog.zones, record.zoneId),
    plot: findById(catalog.plots, record.plotNameId),
    crop: findById(catalog.crops, record.cropId),
    cycle: findById(catalog.cycles, record.cycleId),
  };
}
