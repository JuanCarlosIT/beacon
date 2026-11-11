import gabTheme from './tema-calidad-gab.json';

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
