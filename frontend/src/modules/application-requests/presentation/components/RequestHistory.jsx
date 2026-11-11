import RequestCard from './request-history/RequestCard.jsx';
import HistoryToolbar from './request-history/HistoryToolbar.jsx';
import EmptyHistory from './request-history/EmptyHistory.jsx';

export default function RequestHistory({
  rows,
  visible,
  loading,
  error,
  filter,
  query,
  setFilter,
  setQuery,
  onRefresh,
  onOpen,
}) {
  return (
    <section
      className="rounded-xl border border-gab-line bg-gab-surface p-5 max-sm:p-3.5"
      aria-labelledby="request-history-title"
    >
      <HistoryToolbar
        total={rows.length}
        loading={loading}
        onRefresh={onRefresh}
        filter={filter}
        setFilter={setFilter}
        query={query}
        setQuery={setQuery}
      />

      {visible.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5 p-0 max-sm:grid-cols-1">
          {visible.map((row) => (
            <li key={row.id}>
              <RequestCard row={row} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}

      {!visible.length && (
        <EmptyHistory
          loading={loading}
          error={error}
          filtered={Boolean(query) || filter !== 'Todas'}
        />
      )}
      <p className="mt-4 text-right text-[11px] text-gab-muted">
        {visible.length} de {rows.length} solicitudes
      </p>
    </section>
  );
}
