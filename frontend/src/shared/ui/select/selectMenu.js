// Funciones puras del selector: búsqueda, posición del menú, tema y navegación con teclado.

// Los proveedores pueden ser miles: buscar recorre todos, el popup renderiza solo 100.
export const MAX_VISIBLE = 100;
const MARGIN = 12;
const ROW_HEIGHT = 48;

export const sameValue = (a, b) => String(a) === String(b);

// Minúsculas y sin acentos, para que "Jose" encuentre "José".
export const normalizeText = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function filterOptions(options, query) {
  const needle = normalizeText(query.trim());
  const matches = options.filter((option) => normalizeText(option.label).includes(needle));
  return { matches, visible: matches.slice(0, MAX_VISIBLE) };
}

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// Medidas de la pantalla visible (en móvil el teclado la achica).
function viewportBox() {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width || window.innerWidth,
    height: viewport?.height || window.innerHeight,
    top: viewport?.offsetTop || 0,
    left: viewport?.offsetLeft || 0,
  };
}

// Abre el menú debajo del botón si cabe; si no, arriba. Siempre dentro de la pantalla.
export function placeMenu(rect, optionCount, view = viewportBox()) {
  const width = Math.min(Math.max(rect.width, 240), view.width - MARGIN * 2);
  const height = Math.min(
    360,
    view.height - MARGIN * 2,
    Math.max(150, optionCount * ROW_HEIGHT + 80),
  );
  const below = view.top + view.height - rect.bottom;
  const top = below >= height + MARGIN ? rect.bottom + 6 : rect.top - height - 6;
  return {
    left: clamp(rect.left, view.left + MARGIN, view.left + view.width - width - MARGIN),
    top: clamp(top, view.top + MARGIN, view.top + view.height - height - MARGIN),
    width,
    maxHeight: height,
  };
}

// El tema GAB va en el estilo en línea del módulo; el menú flotante lo copia.
export function readTheme(trigger) {
  const css = getComputedStyle(trigger.closest('[style*="--gab-"]') || trigger);
  const variables = Object.fromEntries(
    Array.from(css)
      .filter((key) => key.startsWith('--gab-'))
      .map((key) => [key, css.getPropertyValue(key)]),
  );
  return { ...variables, colorScheme: css.colorScheme };
}

// Siguiente opción según la tecla; undefined si la tecla no navega.
const NAVIGATION = {
  Home: () => 0,
  End: (_, total) => total - 1,
  ArrowDown: (index, total) => (index + 1) % total,
  ArrowUp: (index, total) => (index - 1 + total) % total,
};

export const nextOptionIndex = (key, index, total) => NAVIGATION[key]?.(index, total);

export const OPEN_KEYS = ['ArrowDown', 'ArrowUp', 'Enter', ' '];
export const CHOOSE_KEYS = ['Enter', ' '];
