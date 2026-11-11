import { localToday, validateRequestStep } from './request.validation.js';

// Lógica pura del formulario de captura: borrador, selección en cascada y payload.

export const emptyDraft = () => ({
  cycleId: '',
  zoneId: '',
  plotNameId: '',
  cropId: '',
  recordId: '',
  date: localToday(),
  hectares: '',
  supplierId: '',
  applicationPeriodCode: '',
  ratePerHectare: '',
  treatment: '',
  priority: 'Normal',
  notes: '',
});

const EMPTY_CATALOG = {
  records: [],
  cycles: [],
  zones: [],
  plots: [],
  crops: [],
  suppliers: [],
  applicationPeriods: [],
};
export const withCatalogDefaults = (catalog) => ({ ...EMPTY_CATALOG, ...catalog });

// Ciclo → zona → predio → cultivo → registro → hectáreas: cambiar uno vacía los que siguen.
const LOCATION_CHAIN = ['cycleId', 'zoneId', 'plotNameId', 'cropId', 'recordId', 'hectares'];

export function dependentsOf(field) {
  const index = LOCATION_CHAIN.indexOf(field);
  return index < 0 ? [] : LOCATION_CHAIN.slice(index + 1);
}

export const applyChange = (draft, field, value) => ({
  ...draft,
  [field]: value,
  ...Object.fromEntries(dependentsOf(field).map((dependent) => [dependent, ''])),
});

export const omitKeys = (object, keys) =>
  Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));

// Los IDs del catálogo son números y los del borrador texto: se comparan como texto.
const whereKey = (key, value) => (item) => String(item[key]) === value;
const usedBy = (records, key) => (item) => records.some((record) => record[key] === item.id);
const onlyId = (items) => (items.length === 1 ? String(items[0].id) : '');

export function deriveSelection(list, draft) {
  const inCycle = list.records.filter(whereKey('cycleId', draft.cycleId));
  const inZone = inCycle.filter(whereKey('zoneId', draft.zoneId));
  const inPlot = inZone.filter(whereKey('plotNameId', draft.plotNameId));
  const cropOptions = list.crops.filter(usedBy(inPlot, 'cropId'));
  // Si el predio tiene un solo cultivo se toma solo.
  const cropId = draft.cropId || onlyId(cropOptions);
  const matching = inPlot.filter(whereKey('cropId', cropId));
  return {
    zoneOptions: list.zones.filter(usedBy(inCycle, 'zoneId')),
    plotOptions: list.plots.filter(usedBy(inZone, 'plotNameId')),
    cropOptions,
    cropId,
    matching,
    record: matching.length === 1 ? matching[0] : matching.find(whereKey('id', draft.recordId)),
    supplier: list.suppliers.find(whereKey('id', draft.supplierId)),
  };
}

export function estimateSubtotal({ hectares, ratePerHectare }) {
  const [area, rate] = [Number(hectares), Number(ratePerHectare)];
  return area > 0 && rate > 0 ? area * rate : null;
}

export const validateDraft = (draft, { cropId, record }, list) => {
  const values = { ...draft, cropId };
  return {
    ...validateRequestStep(1, values, record),
    ...validateRequestStep(2, values, record, undefined, list),
  };
};

export const toRequestPayload = (draft, record) => ({
  odooPlotId: record.id,
  date: draft.date,
  hectares: Number(draft.hectares),
  odooSupplierId: Number(draft.supplierId),
  applicationPeriodCode: draft.applicationPeriodCode,
  ratePerHectare: Number(draft.ratePerHectare),
  treatment: draft.treatment.trim(),
  priority: draft.priority,
  notes: draft.notes.trim(),
});

// Mismo payload = misma llave: reintentar un guardado que falló no duplica la solicitud.
export function submissionFor(previous, payload, newKey) {
  const fingerprint = JSON.stringify(payload);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: newKey() };
}

export const catalogIsComplete = (list) =>
  [list.records, list.suppliers, list.applicationPeriods].every((items) => items.length > 0);
