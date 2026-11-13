import { ClipboardList, MapPin, Building2, Plane } from 'lucide-react';
import {
  formatDate,
  formatMoney,
  formatNumber,
} from '../../../../../shared/formatting/formatters.js';

// Secciones del detalle: [etiqueta, valor, ocupa todo el ancho].
const MISSING = 'No registrado en la captura original';

const moneyOr = (value, fallback, suffix = 'MXN') =>
  value == null ? fallback : `${formatMoney(value)} ${suffix}`;

// Estado del último aviso por WhatsApp, tal como lo registró el backend.
const NOTICE_TEXT = {
  sent: (detail) => `Enviado a ${detail}`,
  failed: (detail) => `No se envió: ${detail}`,
};
const noticeMoment = (value) =>
  new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
export const noticeLabel = (notice) =>
  notice
    ? `${NOTICE_TEXT[notice.status](notice.detail)} · ${noticeMoment(notice.at)}`
    : 'Todavía no se ha enviado';

// Tarifa capturada y, si pidió autorización, en qué quedó.
const RATE_NOTE = {
  Pendiente: (data) =>
    `Se pidió ${formatMoney(data.requested_rate ?? data.rate_per_hectare)} MXN / ha: espera autorización por ser mayor a la del ciclo (${
      data.authorized_rate == null ? 'sin tarifa' : `${formatMoney(data.authorized_rate)} MXN / ha`
    })`,
  Autorizada: (data) => `Alza autorizada por ${data.rate_decided_by}`,
  Rechazada: (data) =>
    `Se pidió ${formatMoney(data.requested_rate)} MXN / ha; ${data.rate_decided_by} la rechazó`,
};
export const rateLabel = (data) => {
  const rate = moneyOr(data.rate_per_hectare, 'No registrada', 'MXN / ha');
  const note = RATE_NOTE[data.rate_authorization]?.(data);
  return note ? `${rate} · ${note}` : rate;
};

// Hay receta si se anotó, se subió una imagen o se agregaron productos.
export const hasRecipe = (data) =>
  Boolean(data.recipe_text || data.recipe_file || data.products?.length);

// showNotice: la vista de quien sube remisiones no muestra el estado del aviso de WhatsApp.
export const detailSections = (data, { showNotice = true } = {}) => [
  {
    icon: ClipboardList,
    title: 'Aplicación',
    fields: [
      ['Fecha requerida', formatDate(data.requested_date)],
      ['Superficie', `${formatNumber(data.hectares)} ha`],
      ...(data.priority === 'Alta' ? [['Prioridad', data.priority]] : []),
      ['Solicitante', data.requested_by],
      // Datos de capturas anteriores: se muestran solo si la solicitud los trae.
      ...(data.treatment ? [['Tratamiento', data.treatment, true]] : []),
      ...(data.notes ? [['Observaciones', data.notes, true]] : []),
      ...(showNotice ? [['Aviso por WhatsApp', noticeLabel(data.notice), true]] : []),
    ],
  },
  {
    icon: MapPin,
    title: 'Ubicación y cultivo',
    fields: [
      [data.odoo_zone_id ? 'Zona' : 'Ubicación', data.ranch],
      ['Lote / predio', data.lot],
      ['Cultivo', data.crop],
      ['Ciclo agrícola', data.cycle_name || MISSING],
    ],
  },
  {
    icon: Building2,
    title: 'Proveedor y costo',
    fields: [
      ['Proveedor solicitado', data.supplier_name || MISSING, true],
      ['RFC / referencia', data.supplier_vat || data.supplier_reference || 'No disponible'],
      ['Periodo de aplicación', data.application_period_name || MISSING],
      ['Tarifa por hectárea', rateLabel(data), true],
      ['Subtotal estimado (sin impuestos)', moneyOr(data.estimated_subtotal, 'No registrado')],
    ],
  },
];

export const executionSection = (execution) => ({
  icon: Plane,
  title: 'Aplicación realizada',
  fields: [
    ['Fecha', formatDate(execution.execution_date)],
    ['Hectáreas aplicadas', `${formatNumber(execution.hectares)} ha`],
    ['Proveedor', execution.provider],
    ['Piloto', execution.pilot],
  ],
});
