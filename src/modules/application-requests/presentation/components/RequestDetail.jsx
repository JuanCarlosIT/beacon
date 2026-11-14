import { useRef } from 'react';
import { X } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import DetailSection from './request-detail/DetailSection.jsx';
import PurchaseOrderPanel from './request-detail/PurchaseOrderPanel.jsx';
import DecisionFooter from './request-detail/DecisionFooter.jsx';
import RemissionsPanel from './request-detail/RemissionsPanel.jsx';
import EventLog from './request-detail/EventLog.jsx';
import RateCorrection from './request-detail/RateCorrection.jsx';
import RecipeCard from './request-detail/RecipeCard.jsx';
import { detailSections, hasRecipe } from './request-detail/detailFields.js';
import { useDialogKeyboard } from './request-detail/useDialogKeyboard.js';
import { cx, iconButton, modal, modalBackdrop } from '../../../../shared/ui/classes.js';

// Acciones disponibles: solo las que el backend permite y la vista sabe ejecutar.
function decisionActions(data, { onRequestApproval, onChangeStatus, onDecideRate }) {
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
    authorizeRate: allowed(permissions.canDecideRate, onDecideRate, () =>
      onDecideRate(data, 'Autorizada'),
    ),
    rejectRate: allowed(permissions.canDecideRate, onDecideRate, () =>
      onDecideRate(data, 'Rechazada'),
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
  onDecideRate,
  onCorrectRate,
  onUploadRemission,
  onReviewRemission,
  onOpenRemission,
  onOpenRecipeImage,
  onLoadRecipeImage,
  // Vista de quien sube remisiones: sin estado del aviso de WhatsApp ni historial.
  remissionsOnly = false,
  remissionBusy = false,
  onChangeStatus,
  changingStatus = false,
  onRequestApproval,
  requestingApproval = false,
}) {
  const closeRef = useRef(null);
  useDialogKeyboard(closeRef, onClose);

  const actions = decisionActions(data, { onRequestApproval, onChangeStatus, onDecideRate });
  const hasDecision = Object.values(actions).some(Boolean);
  const busy = changingStatus || remissionBusy || requestingApproval;
  const [application, ...otherSections] = detailSections(data, { showNotice: !remissionsOnly });
  const showRemissions = data.status !== 'Solicitada' || data.attachments?.length > 0;
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
          <DetailSection {...application} />
          {hasRecipe(data) && (
            <RecipeCard
              data={data}
              onLoadImage={onLoadRecipeImage}
              onDownloadImage={onOpenRecipeImage}
            />
          )}
          {otherSections.map((section) => (
            <DetailSection key={section.title} {...section} />
          ))}
          {data.permissions?.canEditRate && onCorrectRate && (
            <RateCorrection
              data={data}
              busy={busy}
              onCorrect={(rate) => onCorrectRate(data, rate)}
            />
          )}
          {showRemissions && (
            <RemissionsPanel
              remissions={data.attachments ?? []}
              permissions={data.permissions || {}}
              busy={busy}
              onUpload={onUploadRemission && ((remission) => onUploadRemission(data, remission))}
              onReview={
                onReviewRemission &&
                ((remission, status) => onReviewRemission(data, remission, status))
              }
              onOpenFile={onOpenRemission}
            />
          )}
          {data.purchaseOrder && <PurchaseOrderPanel purchase={data.purchaseOrder} />}
          {!remissionsOnly && data.events?.length > 0 && <EventLog events={data.events} />}
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
