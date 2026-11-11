import { ExternalLink, RefreshCw, ShoppingCart } from 'lucide-react';
import BusyIcon from '../../../../../shared/ui/BusyIcon.jsx';
import { btnPrimary, btnSecondary } from '../../../../../shared/ui/classes.js';
import {
  purchaseOrderAction,
  purchaseOrderMessage,
  purchaseOrderReady,
} from '../../../domain/purchaseOrder.js';

function PurchaseOrderButton({ purchase, creating, disabled, onClick }) {
  const verify = purchase.canVerify;
  const label = verify ? 'Verificar OCM en STAG' : 'Generar OCM en STAG';
  return (
    <button type="button" className={btnPrimary} disabled={disabled} onClick={onClick}>
      <BusyIcon busy={creating} icon={verify ? RefreshCw : ShoppingCart} />
      {creating ? 'Procesando…' : label}
    </button>
  );
}

// Panel de la orden de compra en STAG: estado explicado y la acción que corresponda.
export default function PurchaseOrderPanel({
  purchase,
  requestStatus,
  creating,
  changingStatus,
  onCreate,
}) {
  const action = purchaseOrderAction(purchase);
  return (
    <section
      className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[7px] border border-gab-line bg-gab-accent-soft p-4"
      aria-labelledby="staging-purchase-title"
      aria-busy={creating}
    >
      <div className="min-w-0 flex-[1_1_240px]">
        <h3
          id="staging-purchase-title"
          className="flex flex-wrap items-center gap-2 font-title text-[13px] font-semibold"
        >
          <ShoppingCart size={16} /> Orden de compra{' '}
          <span className="rounded bg-gab-surface px-1.5 py-0.5 text-[10px] text-gab-accent">
            STAG
          </span>
        </h3>
        <p className="mt-2 text-xs leading-[1.7] break-words text-gab-muted">
          {purchaseOrderMessage(purchase, requestStatus)}
        </p>
      </div>
      {action === 'link' && (
        <a className={btnSecondary} href={purchase.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} /> Ver OCM en STAG
        </a>
      )}
      {action === 'button' && onCreate && (
        <PurchaseOrderButton
          purchase={purchase}
          creating={creating}
          disabled={creating || changingStatus || !purchaseOrderReady(purchase)}
          onClick={onCreate}
        />
      )}
    </section>
  );
}
