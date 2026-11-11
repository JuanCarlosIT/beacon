import { useEffect, useState } from 'react';
import { listenAll } from '../../dom/listen.js';
import { placeMenu, readTheme } from './selectMenu.js';

// Mientras el menú está abierto: lo coloca junto al botón, copia el tema y lo cierra
// con un clic o foco fuera, o con Escape (regresando el foco al botón).
export function useFloatingMenu({ open, triggerRef, menuRef, optionCount, close }) {
  const [position, setPosition] = useState(null);
  const [themeStyle, setThemeStyle] = useState({});

  useEffect(() => {
    if (!open) return undefined;
    const trigger = triggerRef.current;
    setThemeStyle(readTheme(trigger));
    const place = () => setPosition(placeMenu(trigger.getBoundingClientRect(), optionCount));
    const outside = (event) => {
      const inside = trigger.contains(event.target) || menuRef.current?.contains(event.target);
      if (!inside) close();
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close(true);
    };
    place();
    return listenAll([
      [document, 'pointerdown', outside, true],
      [document, 'focusin', outside],
      [document, 'keydown', escape],
      [window, 'resize', place],
      [window, 'scroll', place, true],
      [window.visualViewport, 'resize', place],
      [window.visualViewport, 'scroll', place],
    ]);
  }, [open, optionCount]);

  return { position, themeStyle };
}
