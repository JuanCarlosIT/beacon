import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCatalog,
  resolveCatalogSelection,
  resolvePurchaseSelection,
} from '../src/models/catalog.model.js';

const source = {
  zones: [{ id: 1, name: 'Zona de prueba' }],
  plots: [{ id: 2, name: 'Predio de prueba', zone_id: [1, 'Zona de prueba'] }],
  crops: [{ id: 3, name: 'Cultivo de prueba' }],
  cycles: [{ id: 4, name: '26.27', start_date: '2026-01-01', end_date: '2027-12-31' }],
  suppliers: [
    { id: 6, name: 'Proveedor confirmado', active: true, supplier_rank: 1 },
    { id: 7, name: 'Archivado', active: false, supplier_rank: 2 },
    { id: 8, name: 'Solo contacto', active: true, supplier_rank: 0 },
  ],
  applicationPeriods: [
    { code: 'Pre-siembra', name: 'Pre-siembra' },
    { code: 'Post-siembra', name: 'Post-siembra' },
  ],
  fields: [
    {
      id: 5,
      name: 'Referencia',
      has: 12.5,
      zone_id: [1, 'Zona'],
      plot_name_id: [2, 'Predio'],
      crop_id: [3, 'Cultivo'],
      cycle_id: [4, 'Ciclo'],
    },
  ],
};
test('el catálogo conserva IDs y relaciones reales, y excluye relaciones incompletas', () => {
  const catalog = buildCatalog({
    ...source,
    fields: [...source.fields, { ...source.fields[0], id: 6, crop_id: false }],
  });
  assert.equal(catalog.records.length, 1);
  assert.equal(catalog.excludedRecords, 1);
  assert.equal(catalog.records[0].plotNameId, 2);
  assert.deepEqual(catalog.suppliers, [
    { id: 6, name: 'Proveedor confirmado', vat: '', reference: '' },
  ]);
  assert.deepEqual(catalog.applicationPeriods, source.applicationPeriods);
});
test('proveedor y periodo se resuelven desde sus claves de catálogo', () => {
  const catalog = buildCatalog(source);
  const result = resolvePurchaseSelection(catalog, 6, 'Post-siembra');
  assert.deepEqual(result.supplier, {
    id: 6,
    name: 'Proveedor confirmado',
    vat: '',
    reference: '',
  });
  assert.deepEqual(result.applicationPeriod, { code: 'Post-siembra', name: 'Post-siembra' });
  for (const supplier of [7, 8, 999]) {
    assert.throws(
      () => resolvePurchaseSelection(catalog, supplier, 'Pre-siembra'),
      /proveedor activo/,
    );
  }
  assert.throws(
    () => resolvePurchaseSelection(catalog, 6, 'Periodo inventado'),
    /periodo de aplicación/,
  );
});
test('rechaza predios cuya zona no coincide', () => {
  const catalog = buildCatalog({
    ...source,
    plots: [{ ...source.plots[0], zone_id: [99, 'Otra zona'] }],
  });
  assert.equal(catalog.records.length, 0);
});
test('resuelve los nombres desde Odoo y no desde texto del navegador', () => {
  const selection = resolveCatalogSelection(buildCatalog(source), 5, 10);
  assert.equal(selection.crop.name, 'Cultivo de prueba');
  assert.equal(selection.zone.id, 1);
});
test('rechaza IDs inventados y superficies mayores a las del lote', () => {
  const catalog = buildCatalog(source);
  assert.throws(() => resolveCatalogSelection(catalog, 99, 10), /ya no está disponible/);
  assert.throws(() => resolveCatalogSelection(catalog, 5, 13), /no superar/);
  assert.throws(() => resolveCatalogSelection(catalog, 5, 0), /mayor a cero/);
  assert.doesNotThrow(() => resolveCatalogSelection(catalog, 5, 12.5));
});
