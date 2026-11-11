import { CatalogError, buildCatalog } from '../../models/catalog.model.js';

// Solo operaciones de lectura y campos confirmados en el Odoo de producción.
const definitions = {
  zones: { model: 'account.zone', fields: ['id', 'name'], domain: [] },
  plots: { model: 'account.plot_name', fields: ['id', 'name', 'zone_id'], domain: [] },
  crops: { model: 'account.crop', fields: ['id', 'name'], domain: [] },
  cycles: { model: 'account.cycle', fields: ['id', 'name', 'start_date', 'end_date'], domain: [] },
  suppliers: {
    model: 'res.partner',
    fields: ['id', 'name', 'vat', 'ref', 'active', 'supplier_rank'],
    domain: [
      ['active', '=', true],
      ['supplier_rank', '>', 0],
    ],
  },
  fields: {
    model: 'account.plot',
    fields: ['id', 'name', 'has', 'crop_id', 'plot_name_id', 'zone_id', 'cycle_id'],
    domain: [['type', '=', 'Lote']],
  },
};

const TTL = 5 * 60 * 1000;
const PAGE_SIZE = 500;
const MAX_PAGES = 40;

const MESSAGES = {
  missingConfig:
    'Falta configurar el acceso de lectura a Odoo en el servidor. No se permiten catálogos inventados.',
  notHttps: 'Odoo debe usar una conexión HTTPS.',
  badResponse: 'Odoo no respondió correctamente. Intenta actualizar los catálogos en unos minutos.',
  accessDenied:
    'El usuario de Odoo no tiene permiso de lectura sobre los catálogos necesarios. Solicita revisión al administrador.',
  readFailed: 'No se pudo leer el catálogo de Odoo. Revisa la configuración con el administrador.',
  offline: 'No hay conexión con Odoo o se agotó el tiempo de espera. Tu captura no se borró.',
  tooLarge:
    'El catálogo superó el límite de lectura. El administrador debe ajustar la paginación; no se mostrarán resultados incompletos.',
  noPeriods: 'No se pudo leer la lista de periodos de aplicación de Odoo.',
  badCredentials: 'Odoo rechazó las credenciales de lectura. Revisa la clave en el servidor.',
};

// Estado del caché en memoria (uno por proceso).
const state = { uid: null, catalog: null, cachedAt: 0, pending: null };

const env = () => ({
  url: process.env.ODOO_URL,
  database: process.env.ODOO_DB,
  user: process.env.ODOO_USER,
  apiKey: process.env.ODOO_API_KEY,
});

function connection() {
  const config = env();
  if (!config.url || !config.database || !config.user || !config.apiKey)
    throw new CatalogError(MESSAGES.missingConfig);
  if (!config.url.startsWith('https://')) throw new CatalogError(MESSAGES.notHttps);
  return config;
}

const rpcError = (error) =>
  new CatalogError(
    error.data?.name === 'odoo.exceptions.AccessError'
      ? MESSAGES.accessDenied
      : MESSAGES.readFailed,
  );

async function rpc(service, method, args) {
  const { url } = connection();
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/jsonrpc`, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { service, method, args },
        id: 1,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new CatalogError(MESSAGES.badResponse);
    const data = await response.json();
    if (data.error) throw rpcError(data.error);
    return data.result;
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError(MESSAGES.offline);
  }
}

const execute = (model, method, args, kwargs) =>
  rpc('object', 'execute_kw', [
    process.env.ODOO_DB,
    state.uid,
    process.env.ODOO_API_KEY,
    model,
    method,
    args,
    kwargs,
  ]);

// Lee página por página hasta que una venga incompleta; nunca devuelve catálogos truncados.
async function readAll({ model, fields, domain }, page = 0, rows = []) {
  if (page >= MAX_PAGES) throw new CatalogError(MESSAGES.tooLarge);
  const batch = await execute(model, 'search_read', [domain], {
    fields,
    order: 'id asc',
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });
  const all = [...rows, ...batch];
  return batch.length < PAGE_SIZE ? all : readAll({ model, fields, domain }, page + 1, all);
}

const isSelection = (field) =>
  field?.type === 'selection' && Array.isArray(field.selection) && field.selection.length > 0;

async function readApplicationPeriods() {
  const fields = await execute('purchase.order', 'fields_get', [['application_period']], {
    attributes: ['type', 'selection'],
  });
  const period = fields.application_period;
  if (!isSelection(period)) throw new CatalogError(MESSAGES.noPeriods);
  return period.selection.map(([code, name]) => ({ code, name }));
}

async function ensureLogin() {
  state.uid ||= await rpc('common', 'authenticate', [
    process.env.ODOO_DB,
    process.env.ODOO_USER,
    process.env.ODOO_API_KEY,
    {},
  ]);
  if (!state.uid) throw new CatalogError(MESSAGES.badCredentials);
}

async function loadCatalog() {
  await ensureLogin();
  const entries = await Promise.all([
    ...Object.entries(definitions).map(async ([key, definition]) => [
      key,
      await readAll(definition),
    ]),
    readApplicationPeriods().then((periods) => ['applicationPeriods', periods]),
  ]);
  return buildCatalog(Object.fromEntries(entries));
}

const isFresh = () => state.catalog && Date.now() - state.cachedAt < TTL;

export async function getOdooCatalog({ refresh = false } = {}) {
  if (state.pending) return state.pending;
  if (!refresh && isFresh()) return state.catalog;
  state.pending = loadCatalog()
    .then((catalog) => {
      Object.assign(state, { catalog, cachedAt: Date.now() });
      return catalog;
    })
    .catch((error) => {
      state.uid = null;
      throw error;
    })
    .finally(() => {
      state.pending = null;
    });
  return state.pending;
}
