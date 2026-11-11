import ResponsiveSelect from '../../../../../shared/ui/ResponsiveSelect.jsx';
import { cx } from '../../../../../shared/ui/classes.js';
import FormField from './FormField.jsx';
import { fieldInput } from './formStyles.js';
import { PRIORITY_OPTIONS } from './options.js';

// Sección plegable con los campos opcionales.
export default function MoreDetails({ form }) {
  return (
    <details className="group/more mx-6 mb-[18px] border-t border-gab-line max-sm:mx-[18px] max-sm:mb-3.5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-semibold text-gab-accent before:text-[17px] before:font-normal before:content-['+'] group-open/more:before:content-['−'] [&::-webkit-details-marker]:hidden">
        Más detalles <span className="text-[10px] font-normal text-gab-muted">Opcional</span>
      </summary>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-1 max-sm:grid-cols-1 max-sm:gap-[18px]">
        <FormField
          {...form.field('priority')}
          label="Prioridad"
          help="Por defecto es Normal. Elige Alta solo si el responsable indicó urgencia; no equivale a aprobación."
        >
          {(props) => (
            <ResponsiveSelect
              {...props}
              {...form.bindSelect('priority')}
              placeholder="Selecciona prioridad"
              options={PRIORITY_OPTIONS}
            />
          )}
        </FormField>
        <FormField {...form.field('notes')} label="Observaciones" wide>
          {(props) => (
            <textarea
              {...props}
              {...form.bindInput('notes')}
              rows={2}
              maxLength={2000}
              className={cx(fieldInput, 'resize-y')}
              placeholder="Indicaciones adicionales, si las hay"
            />
          )}
        </FormField>
      </div>
    </details>
  );
}
