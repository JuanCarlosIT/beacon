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
    treatment: (input.treatment || '').trim(),
    priority: input.priority || 'Normal',
    notes: (input.notes || '').trim(),
  };
}

export const requestStatuses = [
  { value: 'Todas', label: 'Todas' },
  { value: 'Solicitada', label: 'Por autorizar' },
  { value: 'Aprobada', label: 'Aprobadas' },
  { value: 'Realizada', label: 'Realizadas' },
  { value: 'Cancelada', label: 'Canceladas' },
];
