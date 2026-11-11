import { useEffect, useRef } from 'react';
import { cycleFocus, useRestoreFocus } from '../../../../../shared/ui/focus.js';

const FOCUSABLE = 'button:not(:disabled),a[href]';

// Teclado del diálogo: Escape cierra y Tab no sale del diálogo que contiene `ref`.
export function useDialogKeyboard(ref, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useRestoreFocus(ref);

  useEffect(() => {
    function keyboard(event) {
      if (event.key === 'Escape') closeRef.current();
      const dialog = ref.current?.closest('[role="dialog"]');
      cycleFocus(event, dialog ? [...dialog.querySelectorAll(FOCUSABLE)] : []);
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [ref]);
}
