import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../src/lib/pdf/paginate.js';
import { buildPdf } from '../src/lib/pdf/document.js';
import { ellipsize, fitFontSize, textWidth } from '../src/lib/pdf/text.js';

const block = (height, space = height) => ({ space, advance: height, draw: () => [] });
const tops = (pages) => pages.map((page) => page.map(({ top }) => top));

test('paginate acomoda bloques y abre hoja nueva cuando no caben', () => {
  const layout = { firstTop: 100, nextTop: 50, bottom: 300 };
  assert.deepEqual(tops(paginate([block(100), block(100), block(100)], layout)), [
    [100, 200],
    [50],
  ]);
});

test('un título que pide más espacio del que ocupa pasa a la hoja siguiente', () => {
  const layout = { firstTop: 0, nextTop: 10, bottom: 100 };
  const title = block(20, 60);
  assert.deepEqual(tops(paginate([block(50), title, block(20)], layout)), [[0], [10, 30]]);
});

test('ellipsize recorta con puntos y fitFontSize baja la letra hasta que cabe', () => {
  const short = ellipsize('Texto muy largo para la caja', 'F1', 10, 60);
  assert.ok(short.endsWith('...'));
  assert.ok(textWidth(short, 'F1', 10) <= 60);
  assert.equal(ellipsize('Corto', 'F1', 10, 200), 'Corto');
  const size = fitFontSize('$1,234,567.00', 'F2', 80, { max: 14, min: 9 });
  assert.ok(size < 14 && size >= 9);
  assert.equal(fitFontSize('x', 'F2', 80, { max: 14, min: 9 }), 14);
});

test('buildPdf arma un PDF con una hoja por lista de instrucciones', () => {
  const raw = buildPdf([['0 0 m'], ['0 0 m']], { title: 'Prueba (1)' }).toString('latin1');
  assert.match(raw, /\/Count 2/);
  assert.match(raw, /\/Title \(Prueba \\\(1\\\)\)/);
  assert.ok(raw.trimEnd().endsWith('%%EOF'));
});
