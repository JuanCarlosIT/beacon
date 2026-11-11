import '../../config/env.js';
import { HttpError, ensure } from '../../errors/HttpError.js';

// La app vive en esta PC y n8n en el VPS: la app solo manda el aviso (POST).
// WhatsApp no regresa nada a la app; aprobar se hace en la app.
export const N8N_PATHS = {
  notify: '/webhook/gab-aa-aprobacion/aviso',
};

const NOTIFY_TIMEOUT_MS = 90000; // pasa por WF53 (Evolution): puede tardar
const MIN_TOKEN_LENGTH = 32;

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

// Solo un origen https limpio: sin usuario, ruta, query ni hash.
const isHttpsOrigin = (url) =>
  url.protocol === 'https:' &&
  !url.username &&
  !url.password &&
  !url.search &&
  !url.hash &&
  url.pathname === '/';

export function validateN8nConfig({ url, token }) {
  const target = parseUrl(url);
  ensure(target, 503, 'Falta configurar la conexión con n8n.');
  ensure(isHttpsOrigin(target), 503, 'La dirección de n8n debe ser un origen HTTPS sin ruta.');
  ensure(
    token?.length >= MIN_TOKEN_LENGTH,
    503,
    'Falta un token de n8n de al menos 32 caracteres.',
  );
  return { url: target.origin, token };
}

export function getN8nConfig() {
  ensure(
    process.env.N8N_APPROVALS_ENABLED === 'true',
    503,
    'Los avisos por WhatsApp no están habilitados.',
  );
  return validateN8nConfig({
    url: process.env.N8N_APPROVALS_URL,
    token: process.env.N8N_APPROVALS_TOKEN,
  });
}

export function getN8nAvailability() {
  try {
    getN8nConfig();
    return { enabled: true };
  } catch {
    return { enabled: false };
  }
}

// Los errores nunca incluyen el token ni detalles de la red.
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(503, 'n8n devolvió una respuesta que no es JSON.');
  }
};

const readBody = async (response) => {
  ensure(response.ok, 503, `n8n respondió ${response.status}.`);
  const text = await response.text();
  return text ? parseJson(text) : {};
};

export function createN8nApprovalClient({
  getConfig = getN8nConfig,
  fetchImpl = (...args) => fetch(...args),
} = {}) {
  const post = async (path, body, timeoutMs) => {
    const { url, token } = getConfig();
    const response = await fetchImpl(`${url}${path}`, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-GAB-Token': token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => {
      throw new HttpError(503, 'No hay conexión con n8n.');
    });
    return readBody(response);
  };

  return {
    enabled: () => getN8nAvailability().enabled,
    async notify(messages) {
      await post(N8N_PATHS.notify, { messages }, NOTIFY_TIMEOUT_MS);
    },
  };
}

export const n8nApprovalClient = createN8nApprovalClient();
