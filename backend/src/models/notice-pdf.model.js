import { createDrawing } from '../lib/pdf/draw.js';
import { LETTER, buildPdf } from '../lib/pdf/document.js';
import { paginate } from '../lib/pdf/paginate.js';
import { FONT, ellipsize, fitFontSize, textWidth, toWinAnsi, wrap } from '../lib/pdf/text.js';
import { NOTICE_DISCLAIMER, noticeSections, noticeSummary } from './notice-content.model.js';

// Diseño del PDF del aviso: hoja carta con los colores de la app (tema GAB).
// El contenido sale de notice-content.model.js; aquí solo se acomoda.

export { textWidth, toWinAnsi, wrap } from '../lib/pdf/text.js';

const { width: W, height: H } = LETTER;
const MARGIN = 40;
const CONTENT_W = W - 2 * MARGIN;
const COLUMN_GAP = 20;
const COLUMN_W = (CONTENT_W - COLUMN_GAP) / 2;
const LAYOUT = { firstTop: 130, nextTop: 70, bottom: H - 64 };

const COLOR = {
  accent: '#233E56',
  accentSoft: '#e3eaf0',
  headMuted: '#9fb4c7',
  headSub: '#d3dee8',
  ink: '#1c2830',
  muted: '#5b6870',
  line: '#dad9d0',
  bg: '#f4f3ee',
  white: '#ffffff',
};
const TONE = { ok: '#2f7a45', bad: '#b03a2e' };
const toneColor = (tone) => TONE[tone] ?? COLOR.ink;

// [texto, fondo] de la etiqueta de estado.
const STATUS_PILL = {
  Solicitada: ['#9a6410', '#f8ebd2'],
  Aprobada: ['#2f7a45', '#e1f0e5'],
  Ejecutada: [COLOR.accent, COLOR.accentSoft],
  Cancelada: ['#b03a2e', '#f7dfdc'],
  Rechazada: ['#b03a2e', '#f7dfdc'],
};
const NEUTRAL_PILL = ['#5b6870', '#eeeee9'];
const PRIORITY_PILL = ['#b03a2e', '#f7dfdc'];

const draw = createDrawing(H);
const caption = { font: FONT.bold, size: 6.5, color: COLOR.muted, spacing: 0.6 };
const kicker = { font: FONT.bold, size: 7.5, color: COLOR.headMuted, spacing: 0.8 };

// --- Encabezados y pie -------------------------------------------------------

// Etiquetas redondas alineadas a la derecha, de derecha a izquierda.
const pills = (items, right, top) =>
  items.reduce(
    ({ x, ops }, [label, [color, background]]) => {
      const text = toWinAnsi(label);
      const width = textWidth(text, FONT.bold, 8, 0.3) + 18;
      const left = x - width;
      return {
        x: left - 6,
        ops: [
          ...ops,
          ...draw.roundRect(left, top, width, 18, 9, { fill: background }),
          ...draw.text(left + width / 2, top + 12, text, {
            font: FONT.bold,
            size: 8,
            color,
            spacing: 0.3,
            align: 'center',
          }),
        ],
      };
    },
    { x: right, ops: [] },
  ).ops;

const firstPageHeader = (summary) => [
  ...draw.rect(0, 0, W, 108, { fill: COLOR.accent }),
  ...draw.text(MARGIN, 32, 'GRUPO GAB · APLICACIONES AÉREAS', kicker),
  ...draw.text(MARGIN, 58, 'Solicitud de aplicación aérea', {
    font: FONT.bold,
    size: 19,
    color: COLOR.white,
  }),
  ...draw.text(MARGIN, 80, ellipsize(summary.location, FONT.regular, 10, 330), {
    size: 10,
    color: COLOR.headSub,
  }),
  ...draw.text(W - MARGIN, 32, 'FOLIO', { ...kicker, align: 'right' }),
  ...draw.text(W - MARGIN, 60, summary.folio, {
    font: FONT.bold,
    size: 24,
    color: COLOR.white,
    align: 'right',
  }),
  ...pills(
    [
      [summary.status, STATUS_PILL[summary.status] ?? NEUTRAL_PILL],
      ...(summary.highPriority ? [['Prioridad alta', PRIORITY_PILL]] : []),
    ],
    W - MARGIN,
    70,
  ),
];

const continuationHeader = (summary) => [
  ...draw.rect(0, 0, W, 44, { fill: COLOR.accent }),
  ...draw.text(MARGIN, 27, `Solicitud de aplicación aérea ${summary.folio}`, {
    font: FONT.bold,
    size: 11,
    color: COLOR.white,
  }),
  ...draw.text(W - MARGIN, 27, 'continuación', {
    size: 9,
    color: COLOR.headSub,
    align: 'right',
  }),
];

const footer = ({ folio, generated, page, total }) => {
  const small = { size: 7, color: COLOR.muted };
  return [
    ...draw.line(MARGIN, H - 50, W - MARGIN, H - 50, COLOR.line),
    ...draw.text(MARGIN, H - 36, NOTICE_DISCLAIMER, small),
    ...draw.text(MARGIN, H - 25, `Generado ${generated} · ${folio}`, small),
    ...draw.text(W - MARGIN, H - 25, `Página ${page} de ${total}`, {
      ...small,
      font: FONT.bold,
      align: 'right',
    }),
  ];
};

// --- Bloques del cuerpo: { space, advance, draw(top) } ------------------------

const block = (height, render, space = height) => ({ space, advance: height, draw: render });

const statsBlock = (stats) => {
  const gap = 10;
  const boxW = (CONTENT_W - gap * (stats.length - 1)) / stats.length;
  const valueW = boxW - 24;
  const statBox = (top) => (stat, index) => {
    const x = MARGIN + index * (boxW + gap);
    const size = fitFontSize(stat.value, FONT.bold, valueW, { max: 14, min: 9 });
    return [
      ...draw.roundRect(x, top, boxW, 52, 6, { fill: COLOR.bg, stroke: COLOR.line }),
      ...draw.text(x + 12, top + 18, stat.label.toUpperCase(), caption),
      ...draw.text(x + 12, top + 39, ellipsize(stat.value, FONT.bold, size, valueW), {
        font: FONT.bold,
        size,
        color: toneColor(stat.tone),
      }),
    ];
  };
  return block(52 + 22, (top) => stats.flatMap(statBox(top)), 52 + 22);
};

const badge = (text, x, top) => {
  const width = textWidth(text, FONT.bold, 6.5, 0.5) + 10;
  return [
    ...draw.roundRect(x, top + 1, width, 13, 3, { fill: COLOR.accentSoft }),
    ...draw.text(x + width / 2, top + 10, text, {
      font: FONT.bold,
      size: 6.5,
      color: COLOR.accent,
      spacing: 0.5,
      align: 'center',
    }),
  ];
};

// El título pide espacio para él y un renglón más, para no quedar solo al final de la hoja.
const titleBlock = ({ title, badge: label }) =>
  block(
    30,
    (top) => [
      ...draw.text(MARGIN, top + 11, title, { font: FONT.bold, size: 11.5, color: COLOR.accent }),
      ...(label
        ? badge(label, MARGIN + textWidth(toWinAnsi(title), FONT.bold, 11.5) + 8, top)
        : []),
      ...draw.line(MARGIN, top + 19, W - MARGIN, top + 19, COLOR.line),
    ],
    64,
  );

const valueLines = (value, width) => wrap(value, FONT.regular, 10, width);
const fieldHeight = (value, width) => 21 + (valueLines(value, width).length - 1) * 13 + 10;

const fieldOps = (x, top, width) => (item) => [
  ...draw.text(x, top + 7, item.label.toUpperCase(), caption),
  ...valueLines(item.value, width).flatMap((text, i) =>
    draw.text(x, top + 21 + i * 13, text, { size: 10, color: toneColor(item.tone) }),
  ),
];

// Campos anchos van solos; los demás de dos en dos.
const toRows = (fields) =>
  fields.reduce((rows, item) => {
    const last = rows.at(-1);
    const canJoin = last?.length === 1 && !last[0].wide && !item.wide;
    return canJoin ? [...rows.slice(0, -1), [...last, item]] : [...rows, [item]];
  }, []);

const rowBlock = (row) => {
  const width = row[0].wide ? CONTENT_W : COLUMN_W;
  const height = Math.max(...row.map((item) => fieldHeight(item.value, width)));
  return block(height, (top) =>
    row.flatMap((item, index) =>
      fieldOps(MARGIN + index * (COLUMN_W + COLUMN_GAP), top, width)(item),
    ),
  );
};

const spacer = (height) => block(height, () => [], 0);

const sectionBlocks = (section) => [
  titleBlock(section),
  ...toRows(section.fields).map(rowBlock),
  spacer(6),
];

// --- Armado --------------------------------------------------------------------

const generatedAt = (now) =>
  now.toLocaleString('es-MX', {
    timeZone: 'America/Mazatlan',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export function buildNoticePdf({ request, execution = null, now = new Date() }) {
  const summary = noticeSummary(request);
  const blocks = [
    statsBlock(summary.stats),
    ...noticeSections(request, execution).flatMap(sectionBlocks),
  ];
  const pages = paginate(blocks, LAYOUT);
  const generated = generatedAt(now);
  const renderPage = (placed, index) => [
    ...(index === 0 ? firstPageHeader(summary) : continuationHeader(summary)),
    ...placed.flatMap(({ block: item, top }) => item.draw(top)),
    ...footer({ folio: summary.folio, generated, page: index + 1, total: pages.length }),
  ];
  return buildPdf(pages.map(renderPage), {
    title: `Solicitud ${summary.folio}`,
    producer: 'GAB Aplicaciones aereas',
  });
}
