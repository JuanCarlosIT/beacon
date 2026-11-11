import { AlertCircle, Plus, RefreshCw } from 'lucide-react';
import { btnSecondary, cx, panel } from '../../../../shared/ui/classes.js';

// Título y subtítulo de cada vista.
const VIEW_COPY = {
  review: {
    title: 'Solicitudes por validar',
    subtitle: 'Revisa cada solicitud y apruébala o cancélala.',
  },
  capture: {
    title: 'Solicitud de aplicación aérea',
    subtitle: 'Llena la solicitud; el aprobador recibe el aviso por WhatsApp.',
  },
};

export function ModuleHeader({ reviewing, user }) {
  const copy = reviewing ? VIEW_COPY.review : VIEW_COPY.capture;
  return (
    <div className="mb-[26px] flex items-center justify-between gap-5 max-sm:mb-5">
      <div>
        <h1 className="font-title text-[28px] leading-[1.3] font-bold tracking-[-0.7px] max-sm:text-2xl">
          {copy.title}
        </h1>
        <p className="mt-2 text-[13px] leading-[1.7] text-gab-muted max-sm:text-xs">
          {copy.subtitle}
        </p>
        {user && (
          <p className="mt-2.5 inline-block rounded-full bg-black/5 px-2.5 py-0.5 text-xs leading-[1.6]">
            Usuario de prueba: <b>{user.name}</b> ({user.role})
          </p>
        )}
      </div>
    </div>
  );
}

// Aviso cuando el servicio no responde, con botón para reintentar.
export function ServiceAlert({ error, loading, onRetry }) {
  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--gab-warn)_30%,var(--gab-warn-bg))] bg-gab-warn-bg p-[17px] text-gab-warn max-sm:flex-wrap"
      role="alert"
    >
      <AlertCircle size={20} className="mt-0.5 shrink-0" />
      <div>
        <b className="text-xs font-semibold">{error}</b>
      </div>
      <button
        className={cx(btnSecondary, 'ml-auto max-sm:w-full')}
        onClick={onRetry}
        disabled={loading}
      >
        <RefreshCw size={15} />
        {loading ? 'Revisando…' : 'Reintentar'}
      </button>
    </div>
  );
}

// Panel "Nueva solicitud" que envuelve el formulario de captura.
export function CapturePanel({ children }) {
  return (
    <section className={cx(panel, 'mb-7')} aria-labelledby="request-form-title">
      <div className="flex items-center justify-between gap-3 border-b border-gab-line px-6 py-5 max-sm:p-[18px]">
        <h2
          id="request-form-title"
          className="flex items-center gap-2 font-title text-[15px] font-semibold max-sm:text-[13px] [&>svg]:text-gab-accent"
        >
          <Plus size={18} />
          Nueva solicitud
        </h2>
        <span className="text-xs text-gab-muted max-sm:text-[10px]">* Campos obligatorios</span>
      </div>
      {children}
    </section>
  );
}
