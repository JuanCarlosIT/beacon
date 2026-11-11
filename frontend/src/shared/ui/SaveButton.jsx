import { LoaderCircle } from 'lucide-react';
import { btnPrimary, cx } from './classes.js';

// El ícono se anima al pasar el mouse (solo en equipos con mouse y con el botón habilitado).
export default function SaveButton({ disabled, busy }) {
  return (
    <button
      type="submit"
      className={cx(btnPrimary, 'group w-full gap-2.5 max-sm:min-h-[46px] sm:w-auto')}
      disabled={disabled}
      aria-busy={busy}
    >
      {busy ? (
        <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
      ) : (
        <span className="grid size-[25px] shrink-0 place-items-center" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
            fill="none"
            className="size-5 overflow-visible"
          >
            <path
              d="m19,21H5c-1.1,0-2-.9-2-2V5c0-1.1.9-2,2-2h11l5,5v11c0,1.1-.9,2-2,2Z"
              data-path="box"
              className="pointer-fine:group-enabled:group-hover:animate-gab-saved-box pointer-fine:group-enabled:group-hover:fill-[color-mix(in_srgb,var(--gab-accent-ink)_25%,transparent)]"
            />
            <path
              d="M7 3L7 8L15 8"
              data-path="line-top"
              className="pointer-fine:group-enabled:group-hover:animate-gab-saved-top"
            />
            <path
              d="M17 20L17 13L7 13L7 20"
              data-path="line-bottom"
              className="pointer-fine:group-enabled:group-hover:animate-gab-saved-bottom"
            />
          </svg>
        </span>
      )}
      <span>{busy ? 'Guardando…' : 'Registrar solicitud'}</span>
    </button>
  );
}
