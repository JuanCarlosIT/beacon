import { ArrowRight, CalendarDays, MapPin, Sprout } from 'lucide-react';
import {
  formatDate,
  formatMoney,
  formatNumber,
} from '../../../../../shared/formatting/formatters.js';
import {
  btnPrimary,
  btnSecondary,
  cx,
  numeric,
  statusLine,
  tag,
  tagHigh,
} from '../../../../../shared/ui/classes.js';
import StatusBadge from '../StatusBadge.jsx';

const STATUS_TEXT = {
  Solicitada: 'En espera de autorización',
  Aprobada: 'Pendiente de aplicación',
  Realizada: 'Aplicación registrada',
  Cancelada: 'Solicitud cancelada',
};

function CardFigures({ row }) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
      <div>
        <dt className="text-[10px] text-gab-muted">Fecha requerida</dt>
        <dd className="mt-0.5 flex items-center gap-1 text-xs font-semibold break-words">
          <CalendarDays size={13} aria-hidden="true" />
          {formatDate(row.requested_date)}
        </dd>
      </div>
      <div>
        <dt className="text-[10px] text-gab-muted">Superficie</dt>
        <dd className={cx(numeric, 'mt-0.5 text-xs font-semibold')}>
          {formatNumber(row.hectares)} ha
        </dd>
      </div>
      <div>
        <dt className="text-[10px] text-gab-muted">Subtotal</dt>
        <dd className={cx(numeric, 'mt-0.5 text-xs font-semibold break-words')}>
          {row.estimated_subtotal == null ? '—' : formatMoney(row.estimated_subtotal)}
        </dd>
      </div>
    </dl>
  );
}

function CardTags({ row }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      <span className={tag}>
        <Sprout size={13} aria-hidden="true" />
        {row.crop}
      </span>
      {row.priority === 'Alta' && <span className={tagHigh}>Prioridad alta</span>}
      {row.supplier_name && (
        <span className={tag} title={row.supplier_name}>
          {row.supplier_name}
        </span>
      )}
    </div>
  );
}

// Tarjeta de una solicitud en el historial; las pendientes invitan a revisarlas.
export default function RequestCard({ row, onOpen }) {
  const pending = row.status === 'Solicitada';
  return (
    <article
      data-card="solicitud"
      className={cx(
        'flex h-full flex-col rounded-[10px] border border-l-4 border-gab-line bg-gab-surface p-4',
        statusLine[row.status] || 'border-l-gab-gris',
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <span className={cx(numeric, 'text-[11px] text-gab-muted')}>{row.folio}</span>
        <StatusBadge status={row.status} />
      </header>
      <h3 className="mt-2 font-title text-lg font-bold break-words">{row.lot}</h3>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gab-muted">
        <MapPin size={14} aria-hidden="true" />
        {row.ranch}
        {row.cycle_name && <span> · Ciclo {row.cycle_name}</span>}
      </p>
      <CardFigures row={row} />
      <CardTags row={row} />
      {row.treatment && <p className="mt-2 text-xs text-gab-muted">{row.treatment}</p>}
      <footer className="mt-auto flex items-center justify-between gap-2.5 pt-3.5">
        <span className="text-[11px] text-gab-muted">{STATUS_TEXT[row.status]}</span>
        <button
          type="button"
          className={cx(pending ? btnPrimary : btnSecondary, 'min-h-[38px] px-3.5 py-2')}
          aria-label={`Ver detalle de ${row.folio}`}
          onClick={() => onOpen(row.id)}
        >
          {pending ? 'Revisar' : 'Ver detalle'}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
}
