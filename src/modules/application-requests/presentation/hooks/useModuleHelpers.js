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

// El aviso de WhatsApp trae ?solicitud=<id>: lo quita de la dirección y lo entrega una vez.
export function useLinkedRequest(onLinked) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const linked = url.searchParams.get('solicitud');
    if (!linked) return;
    url.searchParams.delete('solicitud');
    window.history.replaceState(null, '', url);
    onLinked(linked);
    // Solo al montar: el link se usa una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
