import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ShoppingCart } from 'lucide-react';
import BusyIcon from '../../../../shared/ui/BusyIcon.jsx';
import { formatMoney, formatNumber } from '../../../../shared/formatting/formatters.js';
import {
  confirmPurchaseFromRemissions,
  confirmStagingPurchaseSaved,
  notifyPurchaseReleased,
  showError,
} from '../../../../shared/feedback/alerts.js';
import {
  btnPrimary,
  btnSecondary,
  cx,
  emptyState,
  panel,
  tag,
} from '../../../../shared/ui/classes.js';
import { groupRemissions, selectionTotal, toggleRemission } from '../../domain/purchaseOrder.js';

const ORDER_STATUS = {
  created: 'Creada en STAG',
  creating: 'En proceso',
  uncertain: 'Por verificar',
};

function RemissionOption({ remission, checked, onToggle }) {
  return (
    <li className="border-b border-gab-line last:border-b-0">
      <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gab-accent-soft">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[var(--gab-accent)]"
          checked={checked}
          onChange={() => onToggle(remission)}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold break-words">
            Remisión {remission.remissionNumber} · {remission.folio}
          </span>
          <span className="mt-0.5 block text-[11px] text-gab-muted">
            {remission.lot} · {remission.crop} · {formatNumber(remission.hectares)} ha ×{' '}
            {formatMoney(remission.ratePerHectare)}
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
          {formatMoney(remission.amount)}
        </span>
      </label>
    </li>
  );
}

function RemissionGroup({ group, selected, onToggle }) {
  return (
    <div className="rounded-[9px] border border-gab-line">
      <p className="flex flex-wrap items-center justify-between gap-2 border-b border-gab-line bg-gab-bg px-4 py-2.5 text-xs font-semibold">
        <span className="break-words">{group.supplierName}</span>
        <span className={tag}>{group.periodName}</span>
      </p>
      <ul className="m-0 list-none p-0">
        {group.remissions.map((remission) => (
          <RemissionOption
            key={remission.id}
            remission={remission}
            checked={selected.includes(remission.id)}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </div>
  );
}

function OrderRow({ order, busy, onVerify }) {
  const numbers = order.remissions.map((item) => item.remissionNumber).join(', ');
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-gab-line px-6 py-3.5 last:border-b-0 max-sm:px-[18px]">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
          {order.reference || 'OCM sin folio'}
          <span className={tag}>{ORDER_STATUS[order.status] ?? order.status}</span>
          {order.status === 'created' && order.needsReview && (
            <span className={cx(tag, 'bg-gab-warn-bg text-gab-warn')}>Revisar en STAG</span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] break-words text-gab-muted">
          {order.supplierName} · Remisiones {numbers || '—'} · {formatMoney(order.total)}
        </p>
      </div>
      {order.url && (
        <a className={btnSecondary} href={order.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} /> Ver en STAG
        </a>
      )}
      {order.status !== 'created' && (
        <button
          type="button"
          className={btnSecondary}
          disabled={busy}
          onClick={() => onVerify(order)}
        >
          <RefreshCw size={15} /> Verificar OCM
        </button>
      )}
    </li>
  );
}

const EMPTY = { enabled: true, remissions: [], orders: [] };

// Tablero del gestor: escoge remisiones validadas (mismo proveedor y periodo) y crea la OCM.
export default function PurchaseBoard({ useCases }) {
  const [board, setBoard] = useState(EMPTY);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await useCases.loadPurchaseBoard();
      setBoard(fresh);
      setSelected((current) =>
        current.filter((id) => fresh.remissions.some((item) => item.id === id)),
      );
      setError('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [useCases]);
  useEffect(() => {
    load();
  }, [load]);

  // Corre una acción del gestor y recarga el tablero pase lo que pase.
  async function run(action) {
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      await showError(failure.message);
    } finally {
      setBusy(false);
      await load();
    }
  }

  const chosen = board.remissions.filter((item) => selected.includes(item.id));
  const total = selectionTotal(selected, board.remissions);

  async function create() {
    if (!(await confirmPurchaseFromRemissions(chosen, total))) return;
    await run(async () => {
      const order = await useCases.createPurchaseOrder(selected);
      setSelected([]);
      await confirmStagingPurchaseSaved(order);
    });
  }

  const verify = (order) =>
    run(async () => {
      const result = await useCases.verifyPurchaseOrder(order.id);
      await (result.released
        ? notifyPurchaseReleased()
        : confirmStagingPurchaseSaved(result.order));
    });

  const groups = groupRemissions(board.remissions);
  return (
    <>
      <section className={cx(panel, 'mb-7')} aria-labelledby="board-title" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gab-line px-6 py-5 max-sm:p-[18px]">
          <div>
            <h2
              id="board-title"
              className="flex items-center gap-2 font-title text-[15px] font-semibold [&>svg]:text-gab-accent"
            >
              <ShoppingCart size={18} />
              Remisiones validadas sin OCM
            </h2>
            <p className="mt-1.5 text-xs leading-[1.7] text-gab-muted">
              Una OCM lleva remisiones del mismo proveedor y periodo, de una o varias solicitudes.
            </p>
          </div>
          <button type="button" className={btnSecondary} onClick={load} disabled={loading || busy}>
            <RefreshCw size={15} /> {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {error && <p className="px-6 py-4 text-xs text-gab-bad">{error}</p>}
        {!board.enabled && (
          <p className="px-6 py-4 text-xs text-gab-warn">
            La creación de OCM en STAG no está habilitada en el servidor.
          </p>
        )}
        {groups.length > 0 ? (
          <div className="grid gap-3.5 p-6 max-sm:p-[18px]">
            {groups.map((group) => (
              <RemissionGroup
                key={group.key}
                group={group}
                selected={selected}
                onToggle={(remission) =>
                  setSelected((current) => toggleRemission(current, remission, board.remissions))
                }
              />
            ))}
          </div>
        ) : (
          !loading &&
          !error && (
            <div className={emptyState.root}>
              <p className={emptyState.title}>No hay remisiones listas</p>
              <p className={emptyState.text}>
                Aquí aparecen cuando se sube la remisión de una solicitud autorizada y el aprobador
                la valida.
              </p>
            </div>
          )
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gab-line bg-gab-bg px-6 py-[18px] max-sm:px-[18px]">
          <span className="text-xs text-gab-muted" role="status" aria-live="polite">
            {chosen.length
              ? `${chosen.length} remisión(es) · ${formatMoney(total)} sin impuestos`
              : 'Escoge las remisiones que irán en la OCM.'}
          </span>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy || !chosen.length || !board.enabled}
            aria-busy={busy}
            onClick={create}
          >
            <BusyIcon busy={busy} icon={ShoppingCart} />
            {busy ? 'Procesando…' : 'Crear OCM en STAG'}
          </button>
        </footer>
      </section>

      <section className={cx(panel, 'mb-7')} aria-labelledby="orders-title">
        <h2
          id="orders-title"
          className="border-b border-gab-line px-6 py-5 font-title text-[15px] font-semibold max-sm:p-[18px]"
        >
          OCM creadas
        </h2>
        {board.orders.length > 0 ? (
          <ul className="m-0 list-none p-0">
            {board.orders.map((order) => (
              <OrderRow key={order.id} order={order} busy={busy} onVerify={verify} />
            ))}
          </ul>
        ) : (
          <p className="px-6 py-5 text-xs text-gab-muted">Todavía no se ha creado ninguna OCM.</p>
        )}
      </section>
    </>
  );
}
