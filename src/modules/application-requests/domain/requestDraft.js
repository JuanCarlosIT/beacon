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
  // Receta: anotada a mano, en una imagen ({ id, name }) y/o con productos del catálogo de Odoo
  // ([{ id, name, uom, dose }]). Basta una de las tres.
  recipeText: '',
  recipeFile: null,
  products: [],
});

const EMPTY_CATALOG = {
  records: [],
  cycles: [],
  zones: [],
  plots: [],
  crops: [],
  suppliers: [],
  applicationPeriods: [],
  cycleRates: [],
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
    authorizedRate: authorizedRateOf(list, draft.cycleId),
  };
}

// Tarifa autorizada del ciclo (null si el ciclo no tiene).
export const authorizedRateOf = (list, cycleId) =>
  list.cycleRates.find(whereKey('cycleId', String(cycleId)))?.ratePerHectare ?? null;

// Capturar igual o menos que la autorizada es libre; más (o un ciclo sin tarifa) pide autorización.
export function rateNeedsAuthorization(ratePerHectare, authorizedRate) {
  const rate = Number(ratePerHectare);
  if (!(rate > 0)) return false;
  return authorizedRate == null || rate > authorizedRate;
}

// --- Receta ---------------------------------------------------------------------------

// El texto leído de la imagen se agrega debajo de lo que ya estaba anotado.
export const appendRecipeText = (current, read) =>
  [current.trim(), String(read ?? '').trim()].filter(Boolean).join('\n');

export const MAX_PRODUCTS = 20;

export const addProduct = (products, product) =>
  products.some((item) => item.id === product.id) || products.length >= MAX_PRODUCTS
    ? products
    : [
        ...products,
        { id: product.id, name: product.name, uom: product.uom, typeId: product.typeId, dose: '' },
      ];

export const removeProduct = (products, id) => products.filter((item) => item.id !== id);

export const setProductDose = (products, id, dose) =>
  products.map((item) => (item.id === id ? { ...item, dose } : item));

// Total a llevar de un producto: dosis por hectárea × superficie.
export function productTotal(dose, hectares) {
  const total = Number(dose) * Number(hectares);
  return total > 0 ? Math.round(total * 10000) / 10000 : null;
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
  recipeText: draft.recipeText.trim(),
  ...(draft.recipeFile ? { recipeFileId: draft.recipeFile.id } : {}),
  products: draft.products.map((product) => ({
    odooProductId: product.id,
    dosePerHectare: product.dose === '' ? null : Number(product.dose),
  })),
});

// Mismo payload = misma llave: reintentar un guardado que falló no duplica la solicitud.
export function submissionFor(previous, payload, newKey) {
  const fingerprint = JSON.stringify(payload);
  return previous?.fingerprint === fingerprint ? previous : { fingerprint, key: newKey() };
}

export const catalogIsComplete = (list) =>
  [list.records, list.suppliers, list.applicationPeriods].every((items) => items.length > 0);

// --- Catálogo de productos por tipo ---------------------------------------------------------

// Sin acentos ni mayúsculas, para que «fungic» encuentre «Fungicida» y «acido» encuentre «ÁCIDO».
const plainText = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Productos a mostrar: los del tipo elegido (o de todos si no se eligió) que coincidan con el
// texto. Cada uno lleva el nombre de su tipo.
export function filterProducts(groups, { typeId = null, text = '' } = {}) {
  const wanted = plainText(text.trim());
  return groups
    .filter((group) => typeId == null || group.id === typeId)
    .flatMap((group) =>
      group.products.map((product) => ({ ...product, type: group.name, typeId: group.id })),
    )
    .filter((product) => !wanted || plainText(product.name).includes(wanted));
}

// --- Productos detectados en un texto ---------------------------------------------------------

const MIN_NAME = 3;
const MAX_DOSE = 100000;
const NUMBER = /\d+(?:[.,]\d+)?/g;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toDose = (match) => {
  const value = Number(String(match).replace(',', '.'));
  return value > 0 && value <= MAX_DOSE ? String(value) : '';
};

// Otras formas de decir un tipo en una receta (sin acentos y en minúsculas).
const TYPE_WORDS = {
  adherente: ['adhesivo', 'coadyuvante', 'surfactante'],
  estimulante: ['bioestimulante'],
};

// Renglón de la receta para un tipo detectado sin producto («1 litro de adherente»): trae la
// dosis y espera a que quien captura escoja el producto de ese tipo.
export const pendingId = (typeId) => `tipo-${typeId}`;
export const isPending = (product) => product.pending === true;
const pendingRow = (group) => ({
  id: pendingId(group.id),
  pending: true,
  typeId: group.id,
  type: group.name,
  name: '',
  uom: group.products[0]?.uom ?? '',
});

// Todo lo que se busca en el texto: los productos por su nombre y los tipos por su nombre o sus
// sinónimos (también en plural). Los nombres largos van primero: «AGRY GENT PLUS 5000» no se
// confunde con «AGRY GENT».
function searchTerms(groups) {
  const products = groups.flatMap((group) =>
    group.products.map((product) => ({
      source: { ...product, typeId: group.id },
      plain: plainText(product.name).trim(),
      plural: '',
    })),
  );
  const types = groups.flatMap((group) => {
    const name = plainText(group.name).trim();
    return [name, ...(TYPE_WORDS[name] ?? [])].map((plain) => ({
      source: pendingRow(group),
      plain,
      plural: '(?:es|s)?',
    }));
  });
  return [...products, ...types]
    .filter((term) => term.plain.length >= MIN_NAME)
    .sort((a, b) => b.plain.length - a.plain.length);
}

// Dónde aparece cada término en un renglón, sin encimarse.
function findInLine(line, terms) {
  let rest = line;
  const found = [];
  for (const term of terms) {
    const pattern = new RegExp(
      `(^|[^a-z0-9])(${escapeRegExp(term.plain)}${term.plural})(?![a-z0-9])`,
    );
    const match = pattern.exec(rest);
    if (!match) continue;
    const start = match.index + match[1].length;
    const end = start + match[2].length;
    found.push({ source: term.source, start, end });
    // Se tapa lo encontrado para que ni otro nombre ni la dosis lo vuelvan a tomar.
    rest = rest.slice(0, start) + ' '.repeat(end - start) + rest.slice(end);
  }
  return { found: withoutNamedTypes(found, rest).sort((a, b) => a.start - b.start), rest };
}

// «1 lt de adherente ACIMAX»: el tipo sobra si va pegado a un producto de ese mismo tipo (sin
// otra dosis en medio). «2 de fungicida y 1.5 de fungired» sí son dos renglones distintos.
const sameLine = (rest, a, b) =>
  !/\d/.test(rest.slice(Math.min(a.end, b.end), Math.max(a.start, b.start)));
const withoutNamedTypes = (found, rest) =>
  found.filter(
    (item) =>
      !isPending(item.source) ||
      !found.some(
        (other) =>
          !isPending(other.source) &&
          other.source.typeId === item.source.typeId &&
          sameLine(rest, item, other),
      ),
  );

// La dosis de cada producto es el número más cercano: el que está justo antes de su nombre
// («2 litros de X») o, si no hay, el que le sigue («X 2 L/ha»). Cada número se usa una sola vez.
function withDoses({ found, rest }) {
  let from = 0;
  return found.map(({ source, start, end }, index) => {
    const before = [...rest.slice(from, start).matchAll(NUMBER)].pop();
    const limit = found[index + 1]?.start ?? rest.length;
    const after = before ? null : [...rest.slice(end, limit).matchAll(NUMBER)][0];
    from = after ? end + after.index + after[0].length : end;
    return { ...source, dose: toDose(before?.[0] ?? after?.[0] ?? '') };
  });
}

// Lo que el texto dice que se va a aplicar, en el orden en que aparece: productos del catálogo
// ({ id, name, uom, typeId, dose }) y tipos sin producto ({ pending, typeId, type, dose }).
// Un tipo solo cuenta si trae dosis: «no mezclar con otro fungicida» no es un renglón de receta.
export function detectProducts(text, groups) {
  const terms = searchTerms(groups);
  const seen = new Set();
  return String(text ?? '')
    .split(/\r?\n|;/)
    .flatMap((line) => withDoses(findInLine(plainText(line), terms)))
    .filter((item) => !isPending(item) || item.dose)
    .filter((item) => !seen.has(item.id) && seen.add(item.id));
}

// Un tipo pendiente sobra si la receta ya tiene un producto (o un pendiente) de ese tipo.
const alreadyCovered = (list, item) =>
  list.some((other) => other.id === item.id) ||
  (isPending(item) && list.some((other) => other.typeId === item.typeId));

// Lo detectado que sí se agregaría a la receta tal como está.
export const newDetections = (products, detected) =>
  detected.filter(
    (item, index) => !alreadyCovered([...products, ...detected.slice(0, index)], item),
  );

// Agrega a la receta lo detectado que todavía no está (sin tocar lo ya capturado).
export const addDetectedProducts = (products, detected) =>
  [...products, ...newDetections(products, detected)].slice(
    0,
    Math.max(MAX_PRODUCTS, products.length),
  );

// Quien captura escoge el producto de un tipo pendiente: conserva la dosis detectada. Si ese
// producto ya estaba en la receta, el pendiente solo se quita.
export const choosePending = (products, pendingKey, product) =>
  products.some((item) => item.id === product.id)
    ? products.filter((item) => item.id !== pendingKey)
    : products.map((item) =>
        item.id === pendingKey
          ? {
              id: product.id,
              name: product.name,
              uom: product.uom,
              typeId: item.typeId,
              dose: item.dose,
            }
          : item,
      );
