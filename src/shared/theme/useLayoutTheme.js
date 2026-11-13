import { useEffect, useState } from 'react';
import gabTheme from './tema-calidad-gab.json';
import { normalizeTheme } from './theme.js';

// Clave que el layout principal puede escribir en localStorage (mismo dominio) con 'oscuro' o 'claro'.
export const THEME_STORAGE_KEY = 'gab-tema';

function readStored() {
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readUrl() {
  return normalizeTheme(new URLSearchParams(window.location.search).get('tema'));
}

// Capta el tema del layout principal sin estar conectado a él. Tres vías, sin botón propio:
// 1. ?tema=oscuro en la URL (al abrir la página).
// 2. Mensaje del layout cuando la app va dentro de un iframe: postMessage({ tipo: 'tema', tema: 'oscuro' }).
// 3. localStorage 'gab-tema' = 'oscuro' | 'claro' (si el layout vive en el mismo dominio; se capta al momento).
// Sin ninguna de las tres, se queda en claro.
export function useLayoutTheme() {
  const [theme, setTheme] = useState(() => readUrl() ?? readStored() ?? 'light');

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window.parent || window.parent === window) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || !['tema', 'theme'].includes(data.tipo ?? data.type))
        return;
      const next = normalizeTheme(data);
      if (next) setTheme(next);
    }
    function onStorage(event) {
      if (event.key !== THEME_STORAGE_KEY) return;
      const next = normalizeTheme(event.newValue);
      if (next) setTheme(next);
    }
    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // El fondo fuera del módulo (body) y los controles nativos también cambian.
  useEffect(() => {
    const palette = theme === 'dark' ? 'oscuro' : 'claro';
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    document.body.style.backgroundColor = gabTheme.colores.bg[palette];
  }, [theme]);

  return theme;
}
