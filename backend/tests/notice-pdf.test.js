import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { buildNoticePdf, toWinAnsi, wrap, textWidth } from '../src/models/notice-pdf.model.js';

const request = {
  number: 2,
  status: 'Solicitada',
  lot: 'Lote 4',
  crop: 'Maíz',
  ranch: 'Zona Norte',
  hectares: '12.50',
  treatment: 'Fungicida (foliar)',
  priority: 'Alta',
  notes: 'Avisar a Ñañez 🙏',
  supplier_name: 'AGRASAMA',
  supplier_vat: 'AGR010101AAA',
  application_period_name: 'Noviembre',
  rate_per_hectare: '400.00',
  estimated_subtotal: '5000.00',
  requested_date: new Date('2026-11-10T00:00:00Z'),
  created_at: new Date('2026-11-09T00:00:00Z'),
  requested_by: 'María',
  purchase_order_status: null,
};

// Texto de todas las hojas (los streams van comprimidos).
function pagesText(buffer) {
  const raw = buffer.toString('latin1');
  const streams = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) =>
    inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'),
  );
  return streams.map((s) =>
    [...s.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)]
      .map((m) => m[1].replace(/\\(.)/g, '$1'))
      .join('\n'),
  );
}

test('el PDF es válido: encabezado, xref con offsets correctos y fin', () => {
  const pdf = buildNoticePdf({ request });
  const raw = pdf.toString('latin1');
  assert.ok(raw.startsWith('%PDF-1.4'));
  assert.ok(raw.trimEnd().endsWith('%%EOF'));
  const xref = Number(raw.match(/startxref\n(\d+)/)[1]);
  assert.ok(raw.slice(xref).startsWith('xref'));
  const offsets = [...raw.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  offsets.forEach((offset, index) => assert.ok(raw.slice(offset).startsWith(`${index + 1} 0 obj`)));
});

test('el PDF trae folio, estado, secciones y datos con acentos, sin el link', () => {
  const [page, ...rest] = pagesText(buildNoticePdf({ request }));
  assert.equal(rest.length, 0, 'un aviso normal cabe en una hoja');
  for (const expected of [
    'AA-00002',
    'Solicitada',
    'Prioridad alta',
    'Aplicación',
    'Ubicación y cultivo',
    'Proveedor y costo',
    'Orden de compra (OCM)',
    'Maíz',
    'AGRASAMA',
    '$400.00 MXN / ha',
    '$5,000.00 MXN',
    '10/11/2026',
    'Sin OCM todavía',
    'Fungicida (foliar)',
    'Avisar a Ñañez',
    'Página 1 de 1',
  ])
    assert.ok(page.includes(expected), expected);
  assert.ok(!page.includes('http') && !page.includes('solicitud='));
  assert.ok(!page.includes('Remisiones'), 'las remisiones ya no van en el PDF');
});

test('las observaciones largas pasan a otra hoja con pie en cada una', () => {
  const pages = pagesText(
    buildNoticePdf({
      request: { ...request, notes: 'Texto largo de prueba. '.repeat(400) },
      execution: {
        execution_date: '2026-11-12',
        hectares: '12',
        provider: 'AGRASAMA',
        pilot: 'Juan',
        cost: '4800',
      },
    }),
  );
  assert.ok(pages.length > 1);
  pages.forEach((text, index) =>
    assert.ok(text.includes(`Página ${index + 1} de ${pages.length}`)),
  );
  assert.ok(pages.at(-1).includes('Aplicación realizada'));
});

test('el texto se limpia a WinAnsi y se parte sin pasarse del ancho', () => {
  assert.equal(toWinAnsi('Hola — “mundo” 🙏\n  ñ'), 'Hola - "mundo" ñ');
  const lines = wrap('palabra '.repeat(40) + 'x'.repeat(200), 'F1', 10, 200);
  assert.ok(lines.length > 3);
  lines.forEach((line) => assert.ok(textWidth(line, 'F1', 10) <= 200, line));
});
