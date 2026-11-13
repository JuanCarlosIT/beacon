import gabTheme from './tema-calidad-gab.json';

// Acepta lo que mande el layout principal: 'oscuro'/'dark' o 'claro'/'light' (texto o { tema } / { theme }).
// Cualquier otra cosa devuelve null para que no cambie el tema actual.
export function normalizeTheme(value) {
  const raw = value && typeof value === 'object' ? (value.tema ?? value.theme) : value;
  const text = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (['oscuro', 'dark'].includes(text)) return 'dark';
  if (['claro', 'light'].includes(text)) return 'light';
  return null;
}

export function getGabThemeStyle(mode = 'light') {
  const palette = ['dark', 'oscuro'].includes(mode) ? 'oscuro' : 'claro';
  return {
    ...Object.fromEntries(
      Object.entries(gabTheme.colores).map(([name, value]) => [`--gab-${name}`, value[palette]]),
    ),
    '--gab-font-title': `"${gabTheme.fuentes.titulos}", sans-serif`,
    '--gab-font-text': `"${gabTheme.fuentes.texto}", sans-serif`,
    '--gab-font-number': `"${gabTheme.fuentes.numeros}", monospace`,
    colorScheme: palette === 'oscuro' ? 'dark' : 'light',
  };
}
