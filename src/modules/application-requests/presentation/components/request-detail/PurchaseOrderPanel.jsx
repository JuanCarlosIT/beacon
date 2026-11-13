import { ExternalLink, ShoppingCart } from 'lucide-react';
import { btnSecondary } from '../../../../../shared/ui/classes.js';
import { purchaseOrderMessage } from '../../../domain/purchaseOrder.js';

// Estado de la OCM de la solicitud. La OCM la crea el gestor en su tablero, con las remisiones.
export default function PurchaseOrderPanel({ purchase }) {
  return (
    <section
      className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[7px] border border-gab-line bg-gab-accent-soft p-4"
      aria-labelledby="staging-purchase-title"
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
          {purchaseOrderMessage(purchase)}
        </p>
      </div>
      {purchase.url && (
        <a className={btnSecondary} href={purchase.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} /> Ver OCM en STAG
        </a>
      )}
    </section>
  );
}
