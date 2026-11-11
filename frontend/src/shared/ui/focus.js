import { useEffect } from 'react';

// Mantiene el foco dentro de un diálogo: Tab en el último salta al primero y Shift+Tab al revés.
export function cycleFocus(event, controls) {
  if (event.key !== 'Tab' || !controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  const [edge, target] = event.shiftKey ? [first, last] : [last, first];
  if (document.activeElement !== edge) return;
  event.preventDefault();
  target.focus();
}

// Enfoca `ref` al montar y regresa el foco al elemento anterior al desmontar.
export function useRestoreFocus(ref) {
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    return () => previous?.focus();
  }, [ref]);
}
