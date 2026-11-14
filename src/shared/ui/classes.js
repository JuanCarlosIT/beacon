// Clases de Tailwind compartidas. Aquí vive el diseño común (botones, campos, modales, etiquetas);
// la app no tiene CSS propio. Los colores gab-* vienen del tema (app/styles.css).

export const cx = (...parts) => parts.filter(Boolean).join(' ');

const focus =
  'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gab-accent';

export const btn = cx(
  'inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[7px]',
  'border border-transparent px-4 py-2.5 text-xs font-semibold transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-50',
  focus,
);
export const btnPrimary = cx(
  btn,
  'bg-gab-accent text-gab-accent-ink enabled:hover:bg-[color-mix(in_srgb,var(--gab-accent),var(--gab-ink)_15%)]',
);
export const btnSecondary = cx(
  btn,
  'border-gab-line bg-gab-surface text-gab-accent enabled:hover:border-gab-accent enabled:hover:bg-gab-accent-soft',
);
export const btnSuccess = cx(
  btn,
  'border-gab-ok bg-gab-ok text-white enabled:hover:bg-[color-mix(in_srgb,var(--gab-ok),#000_14%)]',
);
export const btnDanger = cx(
  btn,
  'border-gab-line bg-gab-surface text-gab-bad enabled:hover:border-gab-bad enabled:hover:bg-gab-bad-bg',
);
export const iconButton = cx(
  'inline-flex cursor-pointer items-center justify-center rounded-md p-2 text-gab-muted transition-colors',
  'enabled:hover:bg-gab-accent-soft enabled:hover:text-gab-accent disabled:cursor-not-allowed disabled:opacity-50',
  focus,
);
export const textAction = cx(
  'inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gab-accent underline-offset-2 hover:underline',
  'disabled:cursor-not-allowed disabled:opacity-50',
  focus,
);

export const count =
  'inline-block rounded bg-gab-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-gab-accent';
export const numeric = 'font-mono tabular-nums';

export const panel = 'overflow-hidden rounded-[10px] border border-gab-line bg-gab-surface';
export const input = cx(
  'block min-h-[43px] w-full rounded-md border border-gab-line bg-gab-surface px-3 py-2.5 text-[13px] text-gab-ink',
  'placeholder:text-gab-muted/85 hover:border-gab-muted focus-visible:border-gab-accent focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:bg-gab-bg disabled:text-gab-muted aria-invalid:border-gab-bad max-sm:text-base',
);

export const modalBackdrop =
  'fixed inset-0 z-60 flex items-center justify-center bg-[#12181d88] p-[22px] backdrop-blur-sm max-sm:p-0';
export const modal = cx(
  'max-h-[90vh] w-[610px] max-w-full overflow-y-auto rounded-[11px] border border-gab-line bg-gab-surface',
  'shadow-[0_20px_70px_#12181d33]',
);

export const tag =
  'inline-flex max-w-full items-center gap-1 rounded-full bg-gab-gris-bg px-2 py-0.5 text-[11px] font-semibold break-words text-gab-muted';

// Color por estado de la solicitud: etiqueta y raya de las tarjetas.
export const statusBadge = {
  Solicitada: 'bg-gab-warn-bg text-gab-warn',
  Aprobada: 'bg-gab-accent-soft text-gab-accent',
  Cancelada: 'bg-gab-bad-bg text-gab-bad',
};
export const statusLine = {
  Solicitada: 'border-l-gab-warn',
  Aprobada: 'border-l-gab-accent',
  Cancelada: 'border-l-gab-bad',
};

export const emptyState = {
  root: 'flex min-h-[220px] flex-col items-center px-5 py-[38px] text-center',
  icon: 'mb-[15px] grid size-[52px] place-items-center rounded-xl bg-gab-gris-bg text-gab-muted',
  title: 'font-title text-[15px] font-semibold',
  text: 'mt-[7px] max-w-[410px] text-xs leading-[1.8] text-gab-muted',
};
