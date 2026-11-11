// Contenido del aviso de una solicitud, como datos: lo usan el PDF y el HTML de respaldo.
// Aquí no hay diseño, solo qué se dice y con qué formato.

export const folioOf = (number) => `AA-${String(number).padStart(5, '0')}`;

export const OCM_STATUS = {
  none: 'Sin OCM todavía (se genera en STAG después de aprobar)',
  creating: 'En proceso',
  created: 'Creada en STAG',
  uncertain: 'Por revisar',
};

const isPresent = (value) => value != null && value !== '';

// Valor formateado, o el texto de respaldo si no hay dato.
const orElse = (value, fallback, format = (x) => x) =>
  isPresent(value) ? format(value) : fallback;

export const formatMoney = (value) =>
  `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;

const isoDay = (value) => String(value?.toISOString?.() ?? value).slice(0, 10);

// dd/mm/aaaa; si no es fecha, se deja como viene.
export const formatDate = (value) =>
  orElse(value, 'sin fecha', (date) => {
    const iso = isoDay(date);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso;
  });

export const formatHectares = (value) =>
  `${Number(value ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })} ha`;

const MISSING = 'Sin capturar';
const field = (label, value, options = {}) => ({ label, value, ...options });
const isHighPriority = (request) => request.priority === 'Alta';

// Encabezado y cifras clave (van arriba en el PDF).
export function noticeSummary(request) {
  return {
    folio: folioOf(request.number),
    status: request.status || 'Sin estado',
    highPriority: isHighPriority(request),
    location: [request.lot, request.crop, request.ranch].filter(Boolean).join(' · '),
    stats: [
      field('Superficie', formatHectares(request.hectares)),
      field('Fecha requerida', formatDate(request.requested_date)),
      field('Prioridad', request.priority || 'Normal', {
        tone: isHighPriority(request) ? 'bad' : undefined,
      }),
      field(
        'Subtotal estimado',
        orElse(request.estimated_subtotal, 'Sin tarifa', (v) => formatMoney(v).replace(' MXN', '')),
      ),
    ],
  };
}

const applicationSection = (request) => ({
  title: 'Aplicación',
  // Fecha, superficie y prioridad ya van en las cifras clave.
  fields: [
    field('Solicitante', request.requested_by || MISSING),
    field('Registrada', formatDate(request.created_at)),
    field('Tratamiento', request.treatment || 'No especificado', { wide: true }),
    field('Observaciones', request.notes || 'Sin observaciones', { wide: true }),
  ],
});

const locationSection = (request) => ({
  title: 'Ubicación y cultivo',
  fields: [
    field('Zona / rancho', request.ranch || MISSING),
    field('Lote / predio', request.lot || MISSING),
    field('Cultivo', request.crop || MISSING),
    field('Ciclo agrícola', request.cycle_name || MISSING),
  ],
});

const supplierSection = (request) => ({
  title: 'Proveedor y costo',
  fields: [
    field('Proveedor solicitado', request.supplier_name || MISSING),
    field(
      'RFC / referencia',
      request.supplier_vat || request.supplier_reference || 'No disponible',
    ),
    field('Periodo de aplicación', request.application_period_name || MISSING),
    field(
      'Tarifa por hectárea',
      orElse(request.rate_per_hectare, 'No registrada', (v) => `${formatMoney(v)} / ha`),
    ),
    field(
      'Subtotal estimado (sin IVA)',
      orElse(request.estimated_subtotal, 'No registrado', formatMoney),
    ),
  ],
});

const purchaseSection = (request) => {
  const status = request.purchase_order_status || 'none';
  return {
    title: 'Orden de compra (OCM)',
    badge: 'STAG',
    fields: [
      field('Estado', OCM_STATUS[status] || status, {
        wide: true,
        tone: status === 'created' ? 'ok' : undefined,
      }),
      field('Referencia', request.purchase_order_name || 'Sin referencia'),
      field('Base', request.purchase_order_database || 'STAG (al generarse)'),
    ],
  };
};

const executionSection = (execution) => ({
  title: 'Aplicación realizada',
  fields: [
    field('Fecha', formatDate(execution.execution_date)),
    field('Hectáreas aplicadas', formatHectares(execution.hectares)),
    field('Proveedor', execution.provider || MISSING),
    field('Piloto', execution.pilot || MISSING),
    field('Costo', orElse(execution.cost, 'No registrado', formatMoney)),
  ],
});

// Secciones en el mismo orden que el detalle de la app.
export const noticeSections = (request, execution = null) => [
  applicationSection(request),
  locationSection(request),
  supplierSection(request),
  purchaseSection(request),
  ...(execution ? [executionSection(execution)] : []),
];

export const NOTICE_DISCLAIMER =
  'Documento informativo. La aprobación se hace en la app; responder por WhatsApp no aprueba nada. Aprobar no crea la OCM.';
