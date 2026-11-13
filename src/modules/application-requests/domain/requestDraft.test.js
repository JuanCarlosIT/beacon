import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyChange,
  catalogIsComplete,
  dependentsOf,
  deriveSelection,
  estimateSubtotal,
  omitKeys,
  submissionFor,
  withCatalogDefaults,
} from './requestDraft.js';

const list = withCatalogDefaults({
  records: [
    { id: 10, cycleId: 1, zoneId: 2, plotNameId: 3, cropId: 4, hectares: 20 },
    { id: 11, cycleId: 1, zoneId: 2, plotNameId: 5, cropId: 4, hectares: 8 },
    { id: 12, cycleId: 1, zoneId: 2, plotNameId: 5, cropId: 4, hectares: 9 },
  ],
  zones: [
    { id: 2, name: 'Norte' },
    { id: 9, name: 'Sin lotes' },
  ],
  plots: [
    { id: 3, name: 'C12' },
    { id: 5, name: 'Vargas' },
  ],
  crops: [{ id: 4, name: 'Papa' }],
  suppliers: [{ id: 6, name: 'AGRASAMA' }],
});

test('cambiar un nivel de la ubicación vacía los que siguen', () => {
  assert.deepEqual(dependentsOf('zoneId'), ['plotNameId', 'cropId', 'recordId', 'hectares']);
  assert.deepEqual(dependentsOf('date'), []);
  const draft = { cycleId: '1', zoneId: '2', plotNameId: '3', cropId: '4', hectares: '5' };
  assert.deepEqual(applyChange(draft, 'zoneId', '9'), {
    cycleId: '1',
    zoneId: '9',
    plotNameId: '',
    cropId: '',
    recordId: '',
    hectares: '',
  });
  assert.deepEqual(omitKeys({ a: 1, b: 2, c: 3 }, ['a', 'c']), { b: 2 });
});

test('la selección filtra en cascada y completa el cultivo único', () => {
  const single = deriveSelection(list, { cycleId: '1', zoneId: '2', plotNameId: '3', cropId: '' });
  assert.deepEqual(
    single.zoneOptions.map((zone) => zone.id),
    [2],
  );
  assert.equal(single.cropId, '4');
  assert.equal(single.record.id, 10);
  const twinsDraft = { cycleId: '1', zoneId: '2', plotNameId: '5', cropId: '', recordId: '' };
  const twins = deriveSelection(list, twinsDraft);
  assert.equal(twins.matching.length, 2);
  assert.equal(twins.record, undefined);
  assert.equal(deriveSelection(list, { ...twinsDraft, recordId: '12' }).record.id, 12);
});

test('subtotal, llave de envío y catálogo completo', () => {
  assert.equal(estimateSubtotal({ hectares: '2.5', ratePerHectare: '400' }), 1000);
  assert.equal(estimateSubtotal({ hectares: '', ratePerHectare: '400' }), null);
  const first = submissionFor(null, { a: 1 }, () => 'k1');
  assert.equal(submissionFor(first, { a: 1 }, () => 'k2').key, 'k1');
  assert.equal(submissionFor(first, { a: 2 }, () => 'k2').key, 'k2');
  assert.equal(catalogIsComplete(list), false);
  assert.equal(catalogIsComplete({ ...list, applicationPeriods: [{ code: 'P' }] }), true);
});

test('la lista de productos se filtra por tipo y por nombre, sin importar acentos', async () => {
  const { filterProducts } = await import('./requestDraft.js');
  const groups = [
    { id: 5, name: 'Adherente', products: [{ id: 1, name: 'ADHESIVO X', uom: 'lts' }] },
    {
      id: 8,
      name: 'Fungicida',
      products: [
        { id: 2, name: 'ÁCIDO FOSFOROSO', uom: 'kg' },
        { id: 3, name: 'FUNGIRED', uom: 'lts' },
      ],
    },
  ];
  const names = (filter) => filterProducts(groups, filter).map((product) => product.name);
  assert.deepEqual(names({ typeId: 8 }), ['ÁCIDO FOSFOROSO', 'FUNGIRED']);
  assert.deepEqual(names({ text: 'acido' }), ['ÁCIDO FOSFOROSO']);
  assert.deepEqual(names({ typeId: 5, text: 'fungi' }), []);
  assert.deepEqual(names({}), ['ADHESIVO X', 'ÁCIDO FOSFOROSO', 'FUNGIRED']);
  assert.equal(filterProducts(groups, { text: 'fungi' })[0].type, 'Fungicida');
});

test('reconoce en un texto los productos del catálogo y su dosis', async () => {
  const { addDetectedProducts, detectProducts } = await import('./requestDraft.js');
  const groups = [
    {
      id: 5,
      name: 'Adherente',
      products: [
        { id: 1, name: 'ACIMAX', uom: 'lts' },
        { id: 2, name: 'PM RADIX', uom: 'lts' },
      ],
    },
    {
      id: 8,
      name: 'Fungicida',
      products: [
        { id: 3, name: 'AGRY GENT 800', uom: 'Kgs' },
        { id: 4, name: 'AGRY GENT PLUS 5000', uom: 'Kgs' },
        { id: 5, name: 'ÁCIDO PARACÉTICO', uom: 'lts' },
        { id: 6, name: 'FUNGIRED', uom: 'lts' },
      ],
    },
  ];
  const found = (text) => detectProducts(text, groups).map((p) => [p.name, p.dose]);

  // Un producto por renglón, con la dosis antes o después del nombre.
  assert.deepEqual(found('RECETA LOTE 4\n1.5 lts de Fungired\nAcimax 0,25 L/ha\notra cosa 3'), [
    ['FUNGIRED', '1.5'],
    ['ACIMAX', '0.25'],
  ]);
  // Varios en un mismo renglón: cada número se usa una sola vez.
  assert.deepEqual(found('1 litro de acimax, 2 litros de fungired y pm radix'), [
    ['ACIMAX', '1'],
    ['FUNGIRED', '2'],
    ['PM RADIX', ''],
  ]);
  assert.deepEqual(found('acimax 1 fungired 2'), [
    ['ACIMAX', '1'],
    ['FUNGIRED', '2'],
  ]);
  // El número del nombre no es la dosis, y el nombre largo gana al corto.
  assert.deepEqual(found('Agry gent plus 5000 a 0.5 kg'), [['AGRY GENT PLUS 5000', '0.5']]);
  assert.deepEqual(found('agry gent 800'), [['AGRY GENT 800', '']]);
  // Sin acentos, sin pedazos de palabra y sin repetir.
  assert.deepEqual(found('acido paracetico 2\nÁCIDO PARACÉTICO 3'), [['ÁCIDO PARACÉTICO', '2']]);
  assert.deepEqual(found('fungiredox 2, macimax 1'), []);
  assert.deepEqual(found(''), []);

  // Se agregan sin tocar lo que ya estaba capturado.
  const current = [{ id: 6, name: 'FUNGIRED', uom: 'lts', dose: '9' }];
  assert.deepEqual(addDetectedProducts(current, detectProducts('fungired 2\nacimax 1', groups)), [
    ...current,
    { id: 1, name: 'ACIMAX', uom: 'lts', typeId: 5, dose: '1' },
  ]);
});

test('si la receta dice la dosis de un tipo sin decir el producto, queda un renglón por escoger', async () => {
  const { addDetectedProducts, choosePending, detectProducts, isPending, newDetections } =
    await import('./requestDraft.js');
  const groups = [
    {
      id: 5,
      name: 'Adherente',
      products: [
        { id: 1, name: 'ACIMAX', uom: 'lts' },
        { id: 2, name: 'ADHEREX', uom: 'lts' },
      ],
    },
    { id: 8, name: 'Fungicida', products: [{ id: 6, name: 'FUNGIRED', uom: 'lts' }] },
    { id: 10, name: 'Insecticida', products: [{ id: 7, name: 'INSECTO X', uom: 'kg' }] },
  ];
  const found = (text) =>
    detectProducts(text, groups).map((item) => [
      isPending(item) ? `(${item.type})` : item.name,
      item.dose,
    ]);

  // Tipo con dosis y sin producto: renglón pendiente con la dosis ya puesta.
  assert.deepEqual(found('1 litro de adherente\n2 litros de fungicida por hectarea'), [
    ['(Adherente)', '1'],
    ['(Fungicida)', '2'],
  ]);
  // Sinónimos y plural.
  assert.deepEqual(found('0.5 lts de adhesivo y 1.5 de insecticidas'), [
    ['(Adherente)', '0.5'],
    ['(Insecticida)', '1.5'],
  ]);
  // Si el renglón nombra el producto, el tipo sobra.
  assert.deepEqual(found('1 lt de adherente ACIMAX'), [['ACIMAX', '1']]);
  // …pero con otra dosis en medio son dos renglones distintos.
  assert.deepEqual(found('2 litros de fungicida y 1.5 de fungired'), [
    ['(Fungicida)', '2'],
    ['FUNGIRED', '1.5'],
  ]);
  // Un tipo sin dosis no es un renglón de receta.
  assert.deepEqual(found('No mezclar con otro fungicida'), []);
  // Producto con nombre y tipo sin producto en el mismo texto.
  assert.deepEqual(found('Fungired 1.5\nadherente 0.25'), [
    ['FUNGIRED', '1.5'],
    ['(Adherente)', '0.25'],
  ]);

  const detected = detectProducts('adherente 0.25\nfungicida 2', groups);
  const pending = detected[0];
  assert.deepEqual(
    [pending.pending, pending.typeId, pending.type, pending.uom, pending.dose],
    [true, 5, 'Adherente', 'lts', '0.25'],
  );
  // No se agrega el pendiente si la receta ya tiene un producto de ese tipo.
  const withAdherent = [{ id: 2, name: 'ADHEREX', uom: 'lts', typeId: 5, dose: '1' }];
  assert.deepEqual(
    newDetections(withAdherent, detected).map((item) => item.type),
    ['Fungicida'],
  );
  assert.equal(addDetectedProducts(addDetectedProducts([], detected), detected).length, 2);

  // Al escoger el producto, el renglón conserva la dosis detectada.
  const list = addDetectedProducts([], detected);
  const chosen = choosePending(list, pending.id, groups[0].products[0]);
  assert.deepEqual(chosen[0], { id: 1, name: 'ACIMAX', uom: 'lts', typeId: 5, dose: '0.25' });
  assert.equal(isPending(chosen[1]), true);
  // Si ese producto ya estaba, el pendiente solo se quita.
  const dup = choosePending([...withAdherent, pending], pending.id, groups[0].products[1]);
  assert.deepEqual(dup, withAdherent);
});
