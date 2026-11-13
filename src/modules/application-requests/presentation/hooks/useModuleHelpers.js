import { useEffect, useState } from 'react';
import { showError } from '../../../../shared/feedback/alerts.js';

// Acción con confirmación previa: ignora clics repetidos, marca "ocupado" y muestra el error.
export function useGuardedAction({ confirm, run }) {
  const [busy, setBusy] = useState(false);
  async function execute(...args) {
    if (busy || !(await confirm(...args))) return;
    setBusy(true);
    try {
      await run(...args);
    } catch (error) {
      await showError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return [busy, execute];
}

// Usuario de prueba que reporta el backend (null si no hay o falla).
export function useCurrentUser(useCases) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    useCases
      .currentUser?.()
      .then(setUser)
      .catch(() => setUser(null));
  }, [useCases]);
  return user;
}

// La dirección recuerda en qué pestaña se está y qué solicitud está abierta
// (?pestana=historial&solicitud=<id>): al recargar la página se regresa al mismo lugar, y el
// link del aviso de WhatsApp (?solicitud=<id>) abre directo esa solicitud.
export const readUrlParam = (name) => new URL(window.location.href).searchParams.get(name);

export function writeUrlParam(name, value) {
  const url = new URL(window.location.href);
  if (value == null || value === '') url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState(null, '', url);
}

// Corre una vez al montar con la solicitud que venga en la dirección.
export function useLinkedRequest(onLinked) {
  useEffect(() => {
    const linked = readUrlParam('solicitud');
    if (linked) onLinked(linked);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
