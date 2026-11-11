import { cx } from '../../../../../shared/ui/classes.js';

// Campos del formulario (input, fecha, número, texto largo).
export const fieldInput = cx(
  'block min-h-[43px] w-full rounded-md border border-gab-line bg-gab-surface px-3 py-[11px] text-[13px] text-gab-ink',
  'placeholder:text-gab-muted/85 hover:border-gab-muted focus-visible:border-gab-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gab-accent',
  'disabled:cursor-not-allowed disabled:bg-gab-gris-bg disabled:text-gab-muted',
  'aria-invalid:border-gab-bad aria-invalid:bg-[color-mix(in_srgb,var(--gab-bad-bg)_30%,var(--gab-surface))] max-sm:text-base',
);
export const numberInput = cx(fieldInput, 'font-mono tabular-nums');
export const unitInput = cx(numberInput, 'pr-[43px]');
export const unitLabel =
  'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-gab-muted';
export const textAction = cx(
  'inline-flex min-h-[34px] cursor-pointer items-center gap-1 text-left text-[11px] leading-[1.7] font-semibold',
  'text-gab-accent underline underline-offset-3 disabled:cursor-not-allowed disabled:opacity-50',
  'focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gab-accent max-sm:min-h-11 max-sm:text-xs',
);
export const blockNote =
  'mx-6 my-[18px] rounded-md bg-gab-warn-bg px-[15px] py-3 text-xs leading-[1.8] text-gab-warn max-sm:mx-[18px] max-sm:my-4';
export const fieldGrid =
  'grid grid-cols-2 gap-x-6 gap-y-3.5 p-6 pt-3 max-sm:grid-cols-1 max-sm:gap-3 max-sm:p-[18px] max-sm:pt-1.5 min-[1000px]:grid-cols-3';
