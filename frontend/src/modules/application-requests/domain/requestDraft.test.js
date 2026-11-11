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
