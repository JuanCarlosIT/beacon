export function filterRequests(rows, { status = 'Todas', query = '' }) {
  const term = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (status === 'Todas' || row.status === status) &&
      `${row.folio} ${row.ranch} ${row.lot} ${row.crop}`.toLowerCase().includes(term),
  );
}

export function createRequestPayload(input) {
  return {
    ...(input.submissionKey ? { submissionKey: input.submissionKey } : {}),
    odooPlotId: Number(input.odooPlotId),
    date: input.date,
    hectares: Number(input.hectares),
    odooSupplierId: Number(input.odooSupplierId),
    applicationPeriodCode: input.applicationPeriodCode,
    ratePerHectare: Number(input.ratePerHectare),
    recipeText: (input.recipeText || '').trim(),
    ...(input.recipeFileId ? { recipeFileId: input.recipeFileId } : {}),
    products: (input.products || []).map((product) => ({
      odooProductId: Number(product.odooProductId),
      // Sin dosis = ya viene en la receta anotada o en su imagen.
      dosePerHectare: product.dosePerHectare ? Number(product.dosePerHectare) : null,
    })),
  };
}

export const requestStatuses = [
  { value: 'Todas', label: 'Todas' },
  { value: 'Solicitada', label: 'Por autorizar' },
  { value: 'Aprobada', label: 'Autorizadas' },
  { value: 'Cancelada', label: 'Canceladas' },
];
