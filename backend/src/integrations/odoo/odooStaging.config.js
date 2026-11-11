import '../../config/env.js';
import { HttpError } from '../../errors/HttpError.js';

const MISSING_ACCESS = 'Falta configurar el acceso a STAG.';
const STAGING_ONLY = 'Las OCM solo pueden crearse en STAG. Revisa la configuración.';
const STAGING_DATABASE = /(?:^|-)stag(?:ing)?(?:-|$)/i;

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    throw new HttpError(503, MISSING_ACCESS);
  }
}

// Reglas que debe cumplir la dirección para aceptarla como STAG (nunca producción).
const stagingRules = [
  (target) => target.protocol === 'https:',
  (target, { database }) => target.hostname === `${database}.dev.odoo.com`,
  (_, { database }) => STAGING_DATABASE.test(database || ''),
  (target) => !target.username && !target.password && !target.port,
  (target) => !target.search && !target.hash && target.pathname === '/',
];

function stagingTarget(values) {
  const target = parseUrl(values.url);
  if (!stagingRules.every((rule) => rule(target, values))) throw new HttpError(503, STAGING_ONLY);
  return target;
}

const isPositiveId = (value) => Number.isSafeInteger(value) && value > 0;

export function validateStagingConfig(values) {
  const target = stagingTarget(values);
  if (!values.username || !values.apiKey) throw new HttpError(503, MISSING_ACCESS);
  return { ...values, url: target.origin };
}

export function buildStagingPurchaseUrl(target, orderId) {
  const { origin } = stagingTarget(target);
  if (!isPositiveId(orderId)) throw new HttpError(503, 'No se pudo identificar la OCM vinculada.');
  const url = new URL('/web', origin);
  url.searchParams.set('db', target.database);
  url.hash = new URLSearchParams({
    id: String(orderId),
    model: 'purchase.order',
    view_type: 'form',
  }).toString();
  return url.href;
}

const configFromEnv = (env) => ({
  url: env.ODOO_STAGING_URL,
  database: env.ODOO_STAGING_DB,
  username: env.ODOO_STAGING_USER,
  apiKey: env.ODOO_STAGING_API_KEY,
});

export function getStagingConfig() {
  if (process.env.ODOO_STAGING_OCM_ENABLED !== 'true')
    throw new HttpError(503, 'La creación de OCM en STAG no está habilitada.');
  return validateStagingConfig(configFromEnv(process.env));
}

const succeeds = (fn) => {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
};

export const getStagingAvailability = () => ({
  enabled: succeeds(getStagingConfig),
  environment: 'staging',
});
