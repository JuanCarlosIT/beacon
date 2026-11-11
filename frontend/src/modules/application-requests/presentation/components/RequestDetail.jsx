import { useRef } from 'react';
import { X } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import DetailSection from './request-detail/DetailSection.jsx';
import PurchaseOrderPanel from './request-detail/PurchaseOrderPanel.jsx';
import DecisionFooter from './request-detail/DecisionFooter.jsx';
import { detailSections, executionSection } from './request-detail/detailFields.js';
import { useDialogKeyboard } from './request-detail/useDialogKeyboard.js';
import { cx, iconButton, modal, modalBackdrop, tagHigh } from '../../../../shared/ui/classes.js';

// Acciones disponibles: solo las que el backend permite y la vista sabe ejecutar.
function decisionActions(data, { onRequestApproval, onChangeStatus }) {
  const permissions = data.permissions || {};
  const allowed = (permission, handler, run) => (permission && handler ? run : null);
  return {
    notify: allowed(permissions.canRequestApproval, onRequestApproval, () =>
      onRequestApproval(data),
    ),
    cancel: allowed(permissions.canCancel, onChangeStatus, () => onChangeStatus(data, 'Cancelada')),
    approve: allowed(permissions.canApprove, onChangeStatus, () =>
      onChangeStatus(data, 'Aprobada'),
    ),
  };
}

function DetailHeader({ data, closeRef, onClose }) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-gab-line px-5 py-[18px] max-sm:px-4 max-sm:py-3.5">
      <div className="min-w-0">
        <h2 id="detail-title" className="font-title text-xl font-bold">
          {data.folio}
        </h2>
        <p className="mt-1 text-[13px] break-words text-gab-muted">
          {data.lot} · {data.crop} · {data.ranch}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <StatusBadge status={data.status} />
          {data.priority === 'Alta' && <span className={tagHigh}>Prioridad alta</span>}
        </div>
      </div>
      <button
        ref={closeRef}
        className={cx(iconButton, 'shrink-0')}
        aria-label="Cerrar detalle"
        onClick={onClose}
      >
        <X />
      </button>
    </header>
  );
}

export default function RequestDetail({
  data,
  onClose,
  onCreatePurchase,
  creatingPurchase = false,
  onChangeStatus,
  changingStatus = false,
  onRequestApproval,
  requestingApproval = false,
}) {
  const closeRef = useRef(null);
  useDialogKeyboard(closeRef, onClose);

  const actions = decisionActions(data, { onRequestApproval, onChangeStatus });
  const hasDecision = Object.values(actions).some(Boolean);
  const busy = changingStatus || creatingPurchase || requestingApproval;
  return (
    <div className={modalBackdrop}>
      <section
        className={cx(
          modal,
          'flex w-[640px] flex-col overflow-hidden max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:rounded-none max-sm:border-0',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <DetailHeader data={data} closeRef={closeRef} onClose={onClose} />

        <div className="flex-1 overflow-y-auto px-5 pt-1 pb-5 max-sm:px-4 max-sm:pt-0 max-sm:pb-4">
          {detailSections(data).map((section) => (
            <DetailSection key={section.title} {...section} />
          ))}
          {data.purchaseOrder && (
            <PurchaseOrderPanel
              purchase={data.purchaseOrder}
              requestStatus={data.status}
              creating={creatingPurchase}
              changingStatus={changingStatus}
              onCreate={onCreatePurchase && (() => onCreatePurchase(data))}
            />
          )}
          {data.execution && <DetailSection {...executionSection(data.execution)} />}
        </div>

        {hasDecision && (
          <DecisionFooter
            actions={actions}
            busy={busy}
            requestingApproval={requestingApproval}
            changingStatus={changingStatus}
          />
        )}
      </section>
    </div>
  );
}
