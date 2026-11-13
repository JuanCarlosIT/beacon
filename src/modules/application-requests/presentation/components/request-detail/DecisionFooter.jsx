import { Ban, Check, MessageCircle, X } from 'lucide-react';
import BusyIcon from '../../../../../shared/ui/BusyIcon.jsx';
import { btnDanger, btnSecondary, btnSuccess, cx } from '../../../../../shared/ui/classes.js';

function footerHint({ approve, cancel, authorizeRate }) {
  if (authorizeRate) return 'La tarifa es mayor a la autorizada del ciclo: autorízala o recházala.';
  if (approve || cancel) return 'Revisa los datos y decide esta solicitud.';
  return 'Puedes reenviar el aviso al aprobador.';
}

// Botones de decisión del detalle; cada uno aparece solo si el backend da el permiso.
export default function DecisionFooter({ actions, busy, requestingApproval, changingStatus }) {
  const { notify, approve, cancel, authorizeRate, rejectRate } = actions;
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-gab-line bg-gab-surface px-5 py-3.5 max-sm:flex-col max-sm:items-stretch max-sm:gap-2 max-sm:px-4 max-sm:pb-[calc(12px+env(safe-area-inset-bottom))]">
      <p className="text-xs text-gab-muted max-sm:hidden">{footerHint(actions)}</p>
      <div className="flex flex-wrap justify-end gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:[&>button]:w-full max-sm:[&>button]:whitespace-normal max-sm:[&>button:only-child]:col-span-full">
        {notify && (
          <button
            type="button"
            className={cx(btnSecondary, 'max-sm:col-span-full')}
            disabled={busy}
            aria-busy={requestingApproval}
            onClick={notify}
          >
            <BusyIcon busy={requestingApproval} icon={MessageCircle} />
            {requestingApproval ? 'Enviando…' : 'Reenviar aviso por WhatsApp'}
          </button>
        )}
        {rejectRate && (
          <button type="button" className={btnDanger} disabled={busy} onClick={rejectRate}>
            <X size={16} /> Rechazar tarifa
          </button>
        )}
        {authorizeRate && (
          <button type="button" className={btnSuccess} disabled={busy} onClick={authorizeRate}>
            <BusyIcon busy={changingStatus} icon={Check} />
            {changingStatus ? 'Guardando…' : 'Autorizar tarifa'}
          </button>
        )}
        {cancel && (
          <button type="button" className={btnDanger} disabled={busy} onClick={cancel}>
            <Ban size={16} /> Cancelar solicitud
          </button>
        )}
        {approve && (
          <button type="button" className={btnSuccess} disabled={busy} onClick={approve}>
            <BusyIcon busy={changingStatus} icon={Check} />
            {changingStatus ? 'Guardando…' : 'Aprobar solicitud'}
          </button>
        )}
      </div>
    </footer>
  );
}
