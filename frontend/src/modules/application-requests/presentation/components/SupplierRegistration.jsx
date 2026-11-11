import { useRef, useState } from 'react';
import { Search, X, LoaderCircle } from 'lucide-react';
import { supplierIdentifier } from '../../domain/supplier.js';
import { cx, modal, btnPrimary, btnSecondary, iconButton } from '../../../../shared/ui/classes.js';
import { cycleFocus, useRestoreFocus } from '../../../../shared/ui/focus.js';
import BusyIcon from '../../../../shared/ui/BusyIcon.jsx';

// En celular el fondo deja 12 px de margen (el detalle de validación, en cambio, va a pantalla completa).
const backdrop =
  'fixed inset-0 z-60 flex items-center justify-center bg-[#12181d88] p-[22px] backdrop-blur-sm max-sm:p-3';
const focus =
  'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gab-accent';
const searchInput = cx(
  'min-h-11 min-w-0 flex-1 rounded-md border border-gab-line bg-gab-surface px-3 py-2.5 text-base text-gab-ink',
  'placeholder:text-gab-muted/85 hover:border-gab-muted focus-visible:border-gab-accent',
  'disabled:cursor-not-allowed disabled:opacity-60',
  focus,
);
const candidate = cx(
  'grid min-h-15 cursor-pointer gap-1.5 rounded-md border p-3 text-left text-xs break-words transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-50',
  focus,
);
const FOCUSABLE = 'button:not(:disabled),input:not(:disabled)';
const MIN_QUERY = 3;

// Corre una tarea asíncrona marcando "ocupado" y guardando el mensaje de error.
async function track(setBusy, setError, task) {
  setBusy(true);
  setError('');
  try {
    await task();
  } catch (failure) {
    setError(failure.message);
  } finally {
    setBusy(false);
  }
}

function CandidateList({ result, selected, busy, onSelect }) {
  return (
    <div className="grid gap-2 px-6 pb-[18px]" aria-label="Proveedores encontrados">
      {result.suppliers.map((supplier) => {
        const isSelected = selected?.id === supplier.id;
        return (
          <button
            type="button"
            key={supplier.id}
            className={cx(
              candidate,
              isSelected
                ? 'border-gab-accent bg-gab-accent-soft'
                : 'border-gab-line enabled:hover:bg-gab-accent-soft',
            )}
            aria-pressed={isSelected}
            disabled={busy}
            onClick={() => onSelect(supplier)}
          >
            <strong>{supplier.name}</strong>
            <span className="text-gab-muted">{supplierIdentifier(supplier)}</span>
          </button>
        );
      })}
      {!result.suppliers.length && (
        <p className="text-xs text-gab-muted">No hay coincidencias disponibles para registrar.</p>
      )}
      {result.hasMore && (
        <p className="text-xs text-gab-muted">
          Hay más resultados. Precisa el nombre o RFC para encontrarlos.
        </p>
      )}
    </div>
  );
}

export default function SupplierRegistration({ onSearch, onSave, onClose }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef(null);
  const busy = searching || saving;
  const queryTooShort = query.trim().length < MIN_QUERY;
  useRestoreFocus(searchRef);

  async function search(event) {
    event.preventDefault();
    if (busy || queryTooShort) return;
    setSelected(null);
    setResult(null);
    await track(setSearching, setError, async () => setResult(await onSearch(query)));
  }
  async function save() {
    if (!selected || busy) return;
    await track(setSaving, setError, () => onSave(selected));
  }
  function changeQuery(event) {
    setQuery(event.target.value);
    setResult(null);
    setSelected(null);
  }
  function keyboard(event) {
    if (event.key === 'Escape' && !busy) onClose();
    cycleFocus(event, event.currentTarget.querySelectorAll(FOCUSABLE));
  }

  return (
    <div className={backdrop}>
      <section
        className={cx(modal, 'max-sm:max-h-[94vh]')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-registration-title"
        onKeyDown={keyboard}
        aria-busy={busy}
      >
        <header className="flex items-start justify-between border-b border-gab-line p-6">
          <div>
            <h2 id="supplier-registration-title" className="font-title text-xl font-semibold">
              Registrar proveedor
            </h2>
            <p className="mt-1.5 text-xs text-gab-muted">
              Alta local para aplicaciones aéreas. No modifica Odoo.
            </p>
          </div>
          <button
            type="button"
            className={iconButton}
            aria-label="Cerrar registro de proveedor"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <form className="px-6 py-[18px]" onSubmit={search}>
          <label htmlFor="supplier-query" className="mb-2 block text-xs font-semibold">
            Buscar proveedor existente en Odoo
          </label>
          <div className="flex gap-2">
            <input
              id="supplier-query"
              ref={searchRef}
              type="search"
              className={searchInput}
              value={query}
              maxLength={100}
              minLength={MIN_QUERY}
              placeholder="Nombre, RFC o referencia"
              disabled={busy}
              onChange={changeQuery}
            />
            <button type="submit" className={btnSecondary} disabled={busy || queryTooShort}>
              <BusyIcon busy={searching} icon={Search} /> Buscar
            </button>
          </div>
          <p className="mt-[7px] text-[11px] leading-[1.75] text-gab-muted">
            Mínimo 3 caracteres. Solo contactos activos, con RFC o referencia y aún no autorizados.
          </p>
        </form>
        {error && (
          <p
            className="mx-6 mb-4 rounded-md bg-gab-bad-bg p-3 text-xs leading-[1.7] text-gab-bad"
            role="alert"
          >
            {error}
          </p>
        )}
        {result && (
          <CandidateList result={result} selected={selected} busy={busy} onSelect={setSelected} />
        )}
        <footer className="flex items-center justify-end gap-3 border-t border-gab-line bg-gab-bg px-6 py-[18px] max-sm:gap-[9px] max-sm:px-[18px] max-sm:py-4">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>
            Volver
          </button>
          <button type="button" className={btnPrimary} disabled={!selected || busy} onClick={save}>
            {saving && <LoaderCircle size={16} className="animate-spin" />}{' '}
            {saving ? 'Registrando…' : 'Registrar proveedor'}
          </button>
        </footer>
      </section>
    </div>
  );
}
