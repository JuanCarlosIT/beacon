import { deflateSync } from 'node:zlib';
import { escapePdfText } from './draw.js';
import { FONT, toWinAnsi } from './text.js';

// Arma el archivo PDF 1.4 a partir de las instrucciones de cada hoja.
// Objetos fijos: 1 catálogo, 2 árbol de hojas, 3 Helvetica, 4 Helvetica-Bold, 5 info.
// Luego, por hoja: su contenido (comprimido) y la hoja.

export const LETTER = { width: 612, height: 792 };

const FIXED_OBJECTS = 5;
const contentId = (pageIndex) => FIXED_OBJECTS + 1 + pageIndex * 2;
const pageId = (pageIndex) => FIXED_OBJECTS + 2 + pageIndex * 2;
const ref = (id) => `${id} 0 R`;

const latin1 = (text) => Buffer.from(text, 'latin1');
const fontObject = (baseFont) =>
  `<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`;

const objectBytes = (id, body) =>
  typeof body === 'string'
    ? latin1(`${id} 0 obj\n${body}\nendobj\n`)
    : Buffer.concat([
        latin1(`${id} 0 obj\n<< /Length ${body.length} /Filter /FlateDecode >>\nstream\n`),
        body,
        latin1('\nendstream\nendobj\n'),
      ]);

function buildObjects(pages, { title, producer, width, height }) {
  const resources = `<< /Font << /${FONT.regular} 3 0 R /${FONT.bold} 4 0 R >> >>`;
  const kids = pages.map((_, index) => ref(pageId(index))).join(' ');
  const perPage = pages.flatMap((ops, index) => [
    deflateSync(latin1(ops.join('\n'))),
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources ${resources} /Contents ${ref(contentId(index))} >>`,
  ]);
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    fontObject('Helvetica'),
    fontObject('Helvetica-Bold'),
    `<< /Title (${escapePdfText(toWinAnsi(title))}) /Producer (${escapePdfText(producer)}) >>`,
    ...perPage,
  ];
}

// Posición en bytes de cada objeto (la tabla xref la necesita).
const offsetsOf = (start, chunks) =>
  chunks.reduce(
    ({ offsets, end }, chunk) => ({ offsets: [...offsets, end], end: end + chunk.length }),
    { offsets: [], end: start },
  );

const xrefTable = (offsets, end) =>
  [
    'xref',
    `0 ${offsets.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${offsets.length + 1} /Root 1 0 R /Info 5 0 R >>`,
    'startxref',
    String(end),
    '%%EOF',
    '',
  ].join('\n');

export function buildPdf(pages, { title = '', producer = '', ...size } = {}) {
  const page = { ...LETTER, ...size };
  const header = latin1('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const objects = buildObjects(pages, { title, producer, ...page }).map((body, index) =>
    objectBytes(index + 1, body),
  );
  const { offsets, end } = offsetsOf(header.length, objects);
  return Buffer.concat([header, ...objects, latin1(xrefTable(offsets, end))]);
}
