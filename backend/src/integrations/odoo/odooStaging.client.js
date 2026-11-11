import { HttpError } from '../../errors/HttpError.js';
import { getStagingConfig, validateStagingConfig } from './odooStaging.config.js';

export class StagingOdooError extends HttpError {
  constructor(message, uncertain = false, status = 503) {
    super(status, message);
    this.uncertain = uncertain;
  }
}

// Lista blanca: qué se puede leer y qué campos puede llevar el único borrador permitido.
const readMethods = new Set([
  'search_read',
  'read',
  'fields_get',
  'default_get',
  'check_access_rights',
]);
const readModels = new Set([
  'purchase.order',
  'purchase.order.line',
  'res.partner',
  'res.currency',
  'res.users',
  'product.product',
  'account.zone',
  'account.plot_name',
  'account.crop',
  'account.cycle',
  'account.plot',
]);
const orderKeys = new Set([
  'partner_id',
  'company_id',
  'currency_id',
  'picking_type_id',
  'date_order',
  'date_planned',
  'origin',
  'application_period',
  'gab_ocm_zone_id',
  'gab_ocm_bool',
  'gab_ocm_purchase_type',
  'gab_ocm_reason',
  'gab_ocm_rq_user_id_to_use',
  'order_line',
  'state',
]);
const lineKeys = new Set([
  'name',
  'product_id',
  'product_uom',
  'product_qty',
  'price_unit',
  'date_planned',
  'plot_id',
  'cycle_id',
  'has_to_apply',
]);

// Mensajes según si la llamada escribía o solo leía.
const MESSAGES = {
  rejected: {
    write: [
      'STAG rechazó el borrador. Revisa el proveedor, los datos y los permisos en Odoo.',
      422,
    ],
    read: ['No pudimos consultar STAG. Revisa la conexión y los permisos.', 503],
  },
  unreachable: {
    write: 'No pudimos confirmar el resultado. Verifica la OCM antes de volver a intentarlo.',
    read: 'No hay conexión con STAG. Intenta de nuevo.',
  },
};
const mode = (writing) => (writing ? 'write' : 'read');

// Un error JSON-RPC de Odoo revierte su transacción. Nunca exponer debug ni argumentos.
const rejectedError = (writing) => {
  const [message, status] = MESSAGES.rejected[mode(writing)];
  return new StagingOdooError(message, false, status);
};
const unreachableError = (writing) =>
  new StagingOdooError(MESSAGES.unreachable[mode(writing)], writing);

function rpcResult(data, writing) {
  if (data.error) throw rejectedError(writing);
  if (!Object.hasOwn(data, 'result')) throw new Error('Respuesta incompleta');
  return data.result;
}

const isKeySubset = (object, allowed) => Object.keys(object).every((key) => allowed.has(key));
const isNewLineCommand = (command) =>
  Array.isArray(command) &&
  command.length === 3 &&
  command[0] === 0 &&
  command[1] === 0 &&
  Boolean(command[2]) &&
  isKeySubset(command[2], lineKeys);

// Solo una OCM nueva, en borrador, marcada como solicitud GAB y con una sola línea.
const isDraftOrder = (values) =>
  isKeySubset(values, orderKeys) &&
  (values.state === undefined || values.state === 'draft') &&
  values.gab_ocm_bool === true &&
  values.gab_ocm_purchase_type === 'Solicitud' &&
  Boolean(values.origin?.startsWith('GAB-AA:')) &&
  Array.isArray(values.order_line) &&
  values.order_line.length === 1 &&
  isNewLineCommand(values.order_line[0]);

const draftContext = (companyId) => ({
  context: {
    allowed_company_ids: [companyId],
    tracking_disable: true,
    mail_create_nosubscribe: true,
    mail_notify_force_send: false,
  },
});

const credentialsKey = (config) =>
  JSON.stringify([config.url, config.database, config.username, config.apiKey]);

const assertUserId = (userId) => {
  if (!Number.isInteger(userId) || userId <= 0)
    throw new StagingOdooError('STAG no autorizó el acceso. Revisa sus credenciales.');
  return userId;
};

export function createStagingOdooClient({
  getConfig = getStagingConfig,
  fetchImpl = (...args) => fetch(...args),
} = {}) {
  // Una sola autenticación compartida mientras no cambien las credenciales.
  const session = { key: null, userId: null };
  let sequence = 0;
  const settings = () => validateStagingConfig(getConfig());

  async function rpc(config, service, method, args, writing = false) {
    try {
      const response = await fetchImpl(`${config.url}/jsonrpc`, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { service, method, args },
          id: ++sequence,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error('Respuesta no confirmada');
      return rpcResult(await response.json(), writing);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw unreachableError(writing);
    }
  }

  function authenticate(config) {
    const key = credentialsKey(config);
    if (session.key !== key) Object.assign(session, { key, userId: null });
    session.userId ??= rpc(config, 'common', 'authenticate', [
      config.database,
      config.username,
      config.apiKey,
      {},
    ])
      .then(assertUserId)
      .catch((error) => {
        if (session.key === key) session.userId = null;
        throw error;
      });
    return session.userId;
  }

  async function object(model, method, args, kwargs, writing = false) {
    const config = settings();
    const userId = await authenticate(config);
    return rpc(
      config,
      'object',
      'execute_kw',
      [config.database, userId, config.apiKey, model, method, args, kwargs],
      writing,
    );
  }

  return {
    target() {
      const { url, database } = settings();
      return { url, database };
    },
    authenticate: async () => authenticate(settings()),
    read(model, method, args = [], kwargs = {}) {
      if (!readModels.has(model) || !readMethods.has(method))
        throw new HttpError(400, 'Operación de consulta no permitida.');
      return object(model, method, args, kwargs);
    },
    // No se exponen write, button_confirm, autorizaciones ni pagos.
    createDraft(values) {
      if (!isDraftOrder(values))
        throw new HttpError(400, 'Solo se permite crear una OCM nueva en borrador.');
      return object(
        'purchase.order',
        'create',
        [{ ...values, state: 'draft' }],
        draftContext(values.company_id),
        true,
      );
    },
  };
}

export const stagingOdooClient = createStagingOdooClient();
