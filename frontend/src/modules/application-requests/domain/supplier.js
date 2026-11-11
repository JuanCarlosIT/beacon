// Se muestra el RFC; si no hay, la referencia de Odoo.
const IDENTIFIERS = [
  ['vat', 'RFC'],
  ['reference', 'Ref.'],
];

export function supplierIdentifier(supplier) {
  const found = IDENTIFIERS.find(([field]) => supplier[field]);
  return found ? `${found[1]}: ${supplier[found[0]]}` : 'Sin identificador';
}

export const supplierOptionLabel = (supplier) =>
  `${supplier.name} · ${supplierIdentifier(supplier)}${supplier.isNew ? ' · Nuevo' : ''}`;
