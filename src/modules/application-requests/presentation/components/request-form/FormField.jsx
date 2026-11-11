import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  Banknote,
  Building2,
  CalendarDays,
  CircleHelp,
  FileText,
  Flag,
  Layers,
  MapPin,
  MapPinned,
  MessageSquare,
  Ruler,
  Sprout,
} from 'lucide-react';
import { listenAll } from '../../../../../shared/dom/listen.js';
import { cx } from '../../../../../shared/ui/classes.js';

const FIELD_ICONS = {
  cycleId: Layers,
  zoneId: MapPin,
  plotNameId: MapPinned,
  cropId: Sprout,
  recordId: FileText,
  date: CalendarDays,
  hectares: Ruler,
  supplierId: Building2,
  applicationPeriodCode: CalendarDays,
  ratePerHectare: Banknote,
  treatment: FileText,
  priority: Flag,
  notes: MessageSquare,
};

const describedBy = (id, hint, error) =>
  [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

// Burbuja de ayuda: se cierra al tocar fuera, al mover el foco o con Escape.
function Help({ label, text }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = () => ref.current?.removeAttribute('open');
    const closeOutside = (event) => !ref.current?.contains(event.target) && close();
    const closeOnEscape = (event) => event.key === 'Escape' && close();
    return listenAll([
      [document, 'pointerdown', closeOutside, true],
      [document, 'focusin', closeOutside],
      [document, 'keydown', closeOnEscape],
    ]);
  }, []);
  return (
    <details ref={ref} className="group/help ml-auto">
      <summary
        aria-label={`Ayuda: ${label}`}
        className="grid size-8 cursor-pointer list-none place-items-center rounded-md text-gab-muted hover:bg-gab-accent-soft hover:text-gab-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gab-accent group-open/help:bg-gab-accent-soft group-open/help:text-gab-accent max-sm:size-10 [&::-webkit-details-marker]:hidden"
      >
        <CircleHelp size={16} />
      </summary>
      <div className="absolute top-[calc(100%+4px)] right-0 z-10 w-[min(310px,100%)] rounded-[7px] bg-gab-ink p-[13px] text-xs leading-[1.8] break-words text-gab-surface shadow-[0_4px_20px_#12181d26] max-sm:w-full">
        {text}
      </div>
    </details>
  );
}

// Etiqueta, ayuda, pista y error de un campo. `children` recibe los atributos de accesibilidad.
export default function FormField({
  id,
  name,
  label,
  hint,
  help,
  error,
  children,
  required = false,
  wide = false,
}) {
  const Icon = FIELD_ICONS[name];
  return (
    <div className={cx('min-w-0', wide && 'col-span-full')}>
      <div className="relative mb-[7px] flex items-center gap-2 max-sm:mb-1">
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="inline-flex items-center gap-[7px] text-xs font-semibold text-gab-ink [&>span]:text-gab-muted [&>svg]:shrink-0 [&>svg]:text-gab-accent"
        >
          {Icon && <Icon size={16} aria-hidden="true" />}
          {label}
          {required ? (
            <span aria-hidden="true"> *</span>
          ) : (
            <span className="text-[10px] font-normal">Opcional</span>
          )}
        </label>
        {help && <Help label={label} text={help} />}
      </div>
      {children({
        id,
        name,
        'aria-describedby': describedBy(id, hint, error),
        'aria-invalid': Boolean(error),
        'aria-required': required,
      })}
      {hint && (
        <p id={`${id}-hint`} className="mt-[7px] text-[11px] leading-[1.75] text-gab-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-[7px] flex items-start gap-1.5 text-xs leading-[1.6] text-gab-bad [&>svg]:mt-0.5 [&>svg]:shrink-0"
        >
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </div>
  );
}
