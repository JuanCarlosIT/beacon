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
