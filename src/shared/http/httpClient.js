const unavailableMessage = 'Servicio no disponible. Intenta de nuevo.';
const downloadFailedMessage = 'No se pudo descargar el archivo. Intenta de nuevo.';
const SPREADSHEET = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Le dice al backend qué vista está en uso (demo local: elige el usuario de prueba).
const viewHeader = () => ({
  'X-GAB-Vista': /^\/validar\/?$/.test(globalThis.location?.pathname ?? '') ? 'validar' : 'captura',
});

// Mensaje para el usuario cuando la respuesta no sirve.
// 503 trae un mensaje del backend pensado para el usuario; otros 5xx se ocultan.
function errorMessage(status, data) {
  if (!data) return unavailableMessage;
  if (status >= 500 && !(status === 503 && data.error)) return unavailableMessage;
  return data.error || 'No se pudo completar la operación.';
}

// fetch que convierte la falta de red en un Error con el mensaje dado.
async function fetchOr(message, path, init) {
  try {
    return await fetch(`/api${path}`, { credentials: 'same-origin', ...init });
  } catch {
    throw new Error(message);
  }
}

export async function httpRequest(path, options = {}) {
  const response = await fetchOr(unavailableMessage, path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...viewHeader(), ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(errorMessage(response.status, data));
  return data;
}

export async function httpDownload(path, fileName) {
  const response = await fetchOr(downloadFailedMessage, path, {
    headers: { Accept: SPREADSHEET, ...viewHeader() },
  });
  const isSpreadsheet = response.headers.get('content-type')?.includes('spreadsheetml');
  if (!response.ok || !isSpreadsheet) throw new Error(downloadFailedMessage);
  return { blob: await response.blob(), fileName };
}
