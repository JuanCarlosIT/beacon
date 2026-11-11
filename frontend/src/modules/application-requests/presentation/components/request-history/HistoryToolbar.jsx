import { RefreshCw, Search } from 'lucide-react';
import { count, cx, iconButton } from '../../../../../shared/ui/classes.js';
import { requestStatuses } from '../../../domain/request.js';

const pill = (selected) =>
  cx(
    'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
    selected
      ? 'border-gab-accent bg-gab-accent text-gab-accent-ink'
      : 'border-gab-line bg-gab-bg text-gab-muted hover:text-gab-ink',
  );

function StatusFilter({ filter, setFilter }) {
  return (
    <div
      className="order-3 flex w-full flex-wrap gap-1.5"
      role="group"
      aria-label="Filtrar por estado"
    >
      {requestStatuses.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={filter === value}
          className={pill(filter === value)}
          onClick={() => setFilter(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ query, setQuery }) {
  return (
    <label className="flex min-h-10 w-[280px] items-center gap-2 rounded-lg border border-gab-line bg-gab-surface px-3 text-gab-muted focus-within:border-gab-accent max-sm:w-full">
      <Search size={17} aria-hidden="true" />
      <input
        aria-label="Buscar solicitudes"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar folio, zona o lote…"
        className="w-full min-w-0 border-0 bg-transparent text-[13px] text-gab-ink outline-none placeholder:text-gab-muted max-sm:text-base"
      />
    </label>
  );
}

// Encabezado del historial: título con total, recargar, filtro por estado y búsqueda.
export default function HistoryToolbar({
  total,
  loading,
  onRefresh,
  filter,
  setFilter,
  query,
  setQuery,
}) {
  return (
    <div className="mb-[18px] flex flex-wrap items-center gap-3">
      <div className="mr-auto flex items-center gap-2">
        <h2
          id="request-history-title"
          className="flex items-center gap-2 font-title text-[15px] font-semibold"
        >
          Solicitudes de aplicación aérea <span className={count}>{total}</span>
        </h2>
        <button
          type="button"
          className={iconButton}
          aria-label="Actualizar solicitudes"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <StatusFilter filter={filter} setFilter={setFilter} />
      <SearchBox query={query} setQuery={setQuery} />
    </div>
  );
}
