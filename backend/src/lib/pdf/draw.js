import { FONT, textWidth, toWinAnsi } from './text.js';

// Operaciones de dibujo puras: cada función regresa la lista de instrucciones PDF.
// Se trabaja con coordenadas de arriba hacia abajo (como en pantalla); aquí se voltean.

const round2 = (value) => Number(value.toFixed(2));
const point = (x, y) => `${round2(x)} ${round2(y)}`;

const rgb = (hex) =>
  [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');

export const escapePdfText = (text) =>
  text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

// Relleno, contorno o ambos.
const PAINT = { 'fill+stroke': 'B', fill: 'f', stroke: 'S' };
const paint = (path, { fill, stroke }) => {
  const mode = [fill && 'fill', stroke && 'stroke'].filter(Boolean).join('+');
  if (!mode) return [];
  const colors = [fill && `${rgb(fill)} rg`, stroke && `0.6 w ${rgb(stroke)} RG`].filter(Boolean);
  return [[...colors, path, PAINT[mode]].join(' ')];
};

const ALIGN = {
  left: (x) => x,
  center: (x, width) => x - width / 2,
  right: (x, width) => x - width,
};

export function createDrawing(pageHeight) {
  const flip = (top) => pageHeight - top;

  const rect = (x, top, width, height, style) =>
    paint(`${point(x, flip(top + height))} ${point(width, height)} re`, style);

  const roundRect = (x, top, width, height, radius, style) => {
    const k = radius * 0.5523;
    const [left, right, bottom, upper] = [x, x + width, flip(top + height), flip(top)];
    const path = [
      `${point(left + radius, bottom)} m`,
      `${point(right - radius, bottom)} l`,
      `${point(right - radius + k, bottom)} ${point(right, bottom + radius - k)} ${point(right, bottom + radius)} c`,
      `${point(right, upper - radius)} l`,
      `${point(right, upper - radius + k)} ${point(right - radius + k, upper)} ${point(right - radius, upper)} c`,
      `${point(left + radius, upper)} l`,
      `${point(left + radius - k, upper)} ${point(left, upper - radius + k)} ${point(left, upper - radius)} c`,
      `${point(left, bottom + radius)} l`,
      `${point(left, bottom + radius - k)} ${point(left + radius - k, bottom)} ${point(left + radius, bottom)} c`,
      'h',
    ].join(' ');
    return paint(path, style);
  };

  const line = (x1, y1, x2, y2, color, width = 0.6) => [
    `${width} w ${rgb(color)} RG ${point(x1, flip(y1))} m ${point(x2, flip(y2))} l S`,
  ];

  // baseline = distancia desde arriba hasta la línea base del texto.
  const text = (
    x,
    baseline,
    value,
    { font = FONT.regular, size = 10, color = '#000000', spacing = 0, align = 'left' } = {},
  ) => {
    const clean = toWinAnsi(value);
    if (!clean) return [];
    const left = ALIGN[align](x, textWidth(clean, font, size, spacing));
    return [
      `BT /${font} ${size} Tf ${rgb(color)} rg ${spacing} Tc ${point(left, flip(baseline))} Td (${escapePdfText(clean)}) Tj ET`,
    ];
  };

  return { rect, roundRect, line, text };
}
