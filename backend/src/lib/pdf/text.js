// Medición y limpieza de texto para las fuentes estándar Helvetica (WinAnsi).
// Acentos y ñ sí se pueden dibujar; emojis y símbolos fuera de latin1 se quitan.

export const FONT = { regular: 'F1', bold: 'F2' };

// Anchos AFM (1/1000 em) de los caracteres 32..126.
const ASCII_WIDTHS = {
  F1: '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584',
  F2: '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584',
};
const WIDTHS = Object.fromEntries(
  Object.entries(ASCII_WIDTHS).map(([font, list]) => [font, list.split(',').map(Number)]),
);
const SYMBOL_WIDTHS = {
  '·': 278,
  '°': 400,
  '¿': 611,
  '¡': 333,
  º: 365,
  ª: 370,
  '«': 556,
  '»': 556,
};
const DEFAULT_WIDTH = 556;

const REPLACEMENTS = [
  [/\s+/g, ' '],
  [/[–—]/g, '-'],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/…/g, '...'],
  [/[^\x20-\x7e\xa1-\xff]/g, ''],
  [/ {2,}/g, ' '],
];

export const toWinAnsi = (value) =>
  REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(value ?? '').normalize('NFC'),
  ).trim();

const asciiWidth = (font, code) =>
  code >= 32 && code <= 126 ? WIDTHS[font][code - 32] : undefined;

// Letras con acento miden lo mismo que su letra base (á → a).
const charWidth = (font) => (char) =>
  asciiWidth(font, char.charCodeAt(0)) ??
  SYMBOL_WIDTHS[char] ??
  asciiWidth(font, char.normalize('NFD').charCodeAt(0)) ??
  DEFAULT_WIDTH;

export const textWidth = (text, font, size, spacing = 0) =>
  ([...text].map(charWidth(font)).reduce((sum, width) => sum + width, 0) / 1000) * size +
  spacing * text.length;

const fitsIn = (font, size, width) => (text) => textWidth(text, font, size) <= width;

// Corta una palabra más ancha que el renglón en pedazos que sí caben.
const breakWord = (word, fits) => {
  if (fits(word) || word.length <= 1) return [word];
  const cut = [...Array(word.length - 1).keys()]
    .map((index) => word.length - 1 - index)
    .find((length) => length <= 1 || fits(word.slice(0, length)));
  return [word.slice(0, cut), ...breakWord(word.slice(cut), fits)];
};

// Agrega la palabra al último renglón si cabe; si no, abre uno nuevo.
const appendWord = (fits) => (lines, word) => {
  const joined = lines.length ? `${lines.at(-1)} ${word}` : word;
  return lines.length && fits(joined) ? [...lines.slice(0, -1), joined] : [...lines, word];
};

export function wrap(text, font, size, width) {
  const fits = fitsIn(font, size, width);
  const lines = toWinAnsi(text)
    .split(' ')
    .filter(Boolean)
    .flatMap((word) => breakWord(word, fits))
    .reduce(appendWord(fits), []);
  return lines.length ? lines : [''];
}

// Recorta con «...» si no cabe en el ancho.
export function ellipsize(text, font, size, width) {
  const clean = toWinAnsi(text);
  if (fitsIn(font, size, width)(clean)) return clean;
  const keep = [...Array(clean.length).keys()]
    .map((index) => clean.length - index)
    .find((count) => count <= 1 || textWidth(`${clean.slice(0, count)}...`, font, size) <= width);
  return `${clean.slice(0, keep).trimEnd()}...`;
}

// Tamaño de letra más grande (de max a min, en pasos) con el que el texto cabe.
export function fitFontSize(text, font, width, { max, min, step = 0.5 }) {
  const sizes = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, i) => max - i * step,
  );
  return sizes.find((size) => textWidth(toWinAnsi(text), font, size) <= width) ?? min;
}
