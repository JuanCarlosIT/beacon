import {
  NOTICE_DISCLAIMER,
  folioOf,
  formatHectares,
  noticeSections,
  noticeSummary,
} from './notice-content.model.js';

// Aviso de aprobación por WhatsApp: solo informa. Ningún mensaje de WhatsApp aprueba
// ni cambia nada; el aprobador entra a la app y decide ahí.

export { folioOf, OCM_STATUS } from './notice-content.model.js';

// Últimos 10 dígitos: WhatsApp manda 521XXXXXXXXXX@s.whatsapp.net o variantes.
export function phoneLast10(value) {
  const digits = String(value ?? '')
    .split('@')[0]
    .replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export const requestLink = (baseUrl, id) =>
  `${String(baseUrl).replace(/\/+$/, '')}/validar?solicitud=${encodeURIComponent(id)}`;

export const noticeText = ({ request, link }) =>
  [
    `Solicitud de aplicación aérea *${folioOf(request.number)}* pendiente de aprobación.`,
    [
      request.lot,
      request.crop,
      formatHectares(request.hectares),
      request.supplier_name || 'sin proveedor',
    ].join(' · '),
    `Solicita: ${request.requested_by}`,
    '',
    `Para aprobar o rechazar entra a la app:\n${link}`,
    '',
    'Este mensaje es solo un aviso: responder aquí no aprueba nada.',
  ].join('\n');

// --- HTML de respaldo: WF53 lo imprime como PDF de texto si no llega el PDF de la app ---

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);

const paragraph = (text) => `<p>${escapeHtml(text)}</p>`;
const tableRow = (cells, tag = 'td') =>
  `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`;
const fieldsTable = (fields) =>
  `<table>${tableRow(['Campo', 'Valor'], 'th')}${fields
    .map(({ label, value }) => tableRow([label, value]))
    .join('')}</table>`;
const htmlSection = ({ title, fields }) => paragraph(title) + fieldsTable(fields);

// El link va solo en el texto del mensaje, no en el PDF.
export function noticeHtml({ request, execution = null }) {
  const summary = noticeSummary(request);
  return [
    paragraph(`Solicitud de aplicación aérea ${summary.folio} · estado: ${summary.status}`),
    htmlSection({ title: 'Resumen', fields: summary.stats }),
    ...noticeSections(request, execution).map(htmlSection),
    paragraph(NOTICE_DISCLAIMER),
  ].join('');
}
