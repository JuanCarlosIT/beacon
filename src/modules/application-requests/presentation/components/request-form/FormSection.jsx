import { fieldGrid } from './formStyles.js';

// Bloque del formulario: número de paso, título, una línea de qué va ahí y sus campos.
export default function FormSection({ step, title, note, grid = true, children }) {
  const id = `seccion-${step}`;
  return (
    <section
      aria-labelledby={id}
      className="border-t border-gab-line px-6 py-5 first:border-t-0 max-sm:px-[18px] max-sm:py-4"
    >
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-gab-accent font-mono text-[11px] font-semibold text-gab-accent-ink"
        >
          {step}
        </span>
        <div className="min-w-0">
          <h3 id={id} className="text-[13px] font-semibold">
            {title}
          </h3>
          {note && <p className="text-[11px] leading-[1.6] text-gab-muted">{note}</p>}
        </div>
      </header>
      <div className={grid ? fieldGrid : 'mt-3'}>{children}</div>
    </section>
  );
}
