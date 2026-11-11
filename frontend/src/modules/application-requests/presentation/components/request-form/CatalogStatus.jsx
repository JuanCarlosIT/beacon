import { RefreshCw, ShieldCheck } from 'lucide-react';
import { cx, iconButton } from '../../../../../shared/ui/classes.js';
import { blockNote } from './formStyles.js';

const statusText = ({ loading, error }) =>
  loading
    ? 'Cargando Odoo…'
    : error || 'Selecciona ciclo → zona → predio. El cultivo se completa desde Odoo.';

// Avisos que aplican cuando el catálogo ya cargó pero le faltan datos.
const CATALOG_GAPS = [
  [
    (list) => !list.records.length,
    'No hay lotes con datos completos en Odoo. Consulta al responsable del catálogo.',
  ],
  [
    (list) => !list.suppliers.length || !list.applicationPeriods.length,
    'Faltan proveedores o periodos de aplicación. Actualiza las opciones o consulta al responsable del catálogo.',
  ],
];

// Estado de los catálogos de Odoo, botón para recargarlos y avisos de datos faltantes.
export default function CatalogStatus({ catalog, list, loading, error, onReload }) {
  const gaps = catalog && !loading ? CATALOG_GAPS.filter(([applies]) => applies(list)) : [];
  return (
    <>
      <div
        className={cx(
          'mx-6 flex items-center gap-[9px] pt-3 text-[11px] leading-[1.7] max-sm:mx-[18px] max-sm:pt-2 [&>svg]:shrink-0 [&>svg]:text-gab-accent',
          error ? 'text-gab-warn' : 'text-gab-muted',
        )}
        role="status"
      >
        <ShieldCheck size={16} />
        <span>{statusText({ loading, error })}</span>
        <button
          type="button"
          className={cx(iconButton, 'ml-auto shrink-0')}
          aria-label="Actualizar catálogos de Odoo"
          onClick={onReload}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {gaps.map(([, message]) => (
        <p key={message} className={blockNote}>
          {message}
        </p>
      ))}
    </>
  );
}
