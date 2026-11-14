export function localToday() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const MAX_RATE = 100000000;

const isPositive = (value) => Number.isFinite(value) && value > 0;
const hasAtMostTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) <= 0.000001;

// AAAA-MM-DD que además existe en el calendario (rechaza 2026-02-30).
function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Sin catálogo no se puede comprobar la lista; basta con que el valor venga.
const inCatalog = (catalog, listName, matches) => !catalog || catalog[listName].some(matches);

const required = (field, message) => (values) => (values[field] ? undefined : message);

// Cada regla regresa el mensaje de error o undefined. El orden importa: el primer error recibe el foco.
const STEP_RULES = {
  1: {
    cycleId: required('cycleId', 'Elige el ciclo agrícola de la aplicación.'),
    zoneId: required('zoneId', 'Elige la zona donde está el predio.'),
    plotNameId: required('plotNameId', 'Elige un lote o predio de la lista.'),
    cropId: required('cropId', 'Elige el cultivo que se va a tratar.'),
    recordId: ({ cropId }, { record }) =>
      cropId && !record ? 'Elige el registro agrícola del lote.' : undefined,
  },
  2: {
    date({ date }, { today }) {
      if (!isCalendarDate(date)) return 'Elige una fecha válida.';
      if (date < today) return 'La fecha no puede ser anterior a hoy.';
    },
    hectares({ hectares }, { record }) {
      const value = Number(hectares);
      if (!isPositive(value))
        return 'Indica cuántas hectáreas se van a aplicar. Debe ser mayor que cero.';
      if (record && value > record.hectares)
        return `No puede superar las ${record.hectares} ha del lote en Odoo.`;
      if (!hasAtMostTwoDecimals(value)) return 'La superficie admite hasta dos decimales.';
    },
    supplierId: ({ supplierId }, { catalog }) =>
      supplierId &&
      inCatalog(catalog, 'suppliers', (item) => String(item.id) === String(supplierId))
        ? undefined
        : 'Elige un proveedor de la lista.',
    applicationPeriodCode: ({ applicationPeriodCode: code }, { catalog }) =>
      code && inCatalog(catalog, 'applicationPeriods', (item) => item.code === code)
        ? undefined
        : 'Elige un periodo de aplicación de la lista.',
    ratePerHectare({ ratePerHectare }) {
      const value = Number(ratePerHectare);
      if (!isPositive(value) || value > MAX_RATE)
        return 'Indica una tarifa mayor que cero y no mayor a 100,000,000 MXN.';
      if (!hasAtMostTwoDecimals(value)) return 'La tarifa admite hasta dos decimales.';
    },
    products({ products = [], recipeText = '', recipeFile = null }) {
      if (!products.length && !recipeText.trim() && !recipeFile)
        return 'Indica qué se va a aplicar: anótalo, sube una imagen o agrega los productos.';
      if (recipeText.length > 4000)
        return 'La receta anotada no debe superar los 4,000 caracteres.';
      const pending = products.find((product) => product.pending);
      if (pending)
        return `Escoge el producto de «${pending.type}» o quita ese renglón de la receta.`;
      // La dosis puede faltar si ya viene en la receta anotada o en su imagen; si se escribe,
      // debe ser válida.
      const doseInRecipe = Boolean(recipeText.trim() || recipeFile);
      const badDose = (product) =>
        product.dose === '' || product.dose == null
          ? !doseInRecipe
          : !isPositive(Number(product.dose));
      if (products.some(badDose))
        return 'Pon la dosis por hectárea de cada producto, o anota la receta o sube su imagen con las dosis.';
    },
  },
};

export function validateRequestStep(step, values, record, today = localToday(), catalog = null) {
  const context = { record, today, catalog };
  return Object.fromEntries(
    Object.entries(STEP_RULES[step] ?? {})
      .map(([field, rule]) => [field, rule(values, context)])
      .filter(([, message]) => message),
  );
}
