import { ClipboardList } from 'lucide-react';
import { emptyState } from '../../../../../shared/ui/classes.js';

const TITLES = {
  loading: 'Cargando solicitudes…',
  error: 'Historial no disponible',
  filtered: 'No hay coincidencias',
  empty: 'Todavía no hay solicitudes',
};
const TEXTS = {
  error: 'Las solicitudes aparecerán cuando el servicio esté disponible.',
  filtered: 'Cambia el filtro o el término de búsqueda.',
  empty: 'Cuando alguien capture una solicitud aparecerá aquí.',
};

// El primer motivo que aplica decide el mensaje (la carga solo cambia el título).
const firstReason = (reasons) => reasons.find(([, applies]) => applies)?.[0] ?? 'empty';

export default function EmptyHistory({ loading, error, filtered }) {
  const textReason = firstReason([
    ['error', error],
    ['filtered', filtered],
  ]);
  const titleReason = loading ? 'loading' : textReason;
  return (
    <div className={emptyState.root}>
      <div className={emptyState.icon}>
        <ClipboardList size={27} />
      </div>
      <h3 className={emptyState.title}>{TITLES[titleReason]}</h3>
      <p className={emptyState.text}>{TEXTS[textReason]}</p>
    </div>
  );
}
