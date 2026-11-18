export const formatNumber = (value) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value || 0));
export const formatMoney = (value) =>
  value == null
    ? '—'
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(`${String(value).slice(0, 10)}T12:00:00`),
      )
    : '—';
// Fecha y hora local: «18 nov 2026, 10:15».
export const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—';
