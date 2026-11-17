import ResponsiveSelect from '../../../../../shared/ui/ResponsiveSelect.jsx';
import { formatNumber } from '../../../../../shared/formatting/formatters.js';
import { APPLICATION_TYPES } from '../../../domain/request.js';
import { localToday } from '../../../domain/request.validation.js';
import FormField from './FormField.jsx';
import UnitInput from './UnitInput.jsx';
import { numberInput, textAction } from './formStyles.js';
import { toOptions } from './options.js';

// Cuándo, cuánta superficie, con qué (avión o dron) y en qué periodo.
export default function ScheduleFields({ form }) {
  const { list, catalogReady, record, field } = form;
  return (
    <>
      <FormField
        {...field('date')}
        label="Fecha requerida"
        required
        help="Día para el que solicitas la aplicación. Debe ser hoy o una fecha futura."
      >
        {(props) => (
          <input
            {...props}
            {...form.bindInput('date')}
            type="date"
            className={numberInput}
            min={localToday()}
          />
        )}
      </FormField>
      <FormField
        {...field('hectares')}
        label="Hectáreas a aplicar"
        required
        help="La superficie que se va a tratar, no la dosis ni el costo. Puede ser una parte del lote. Ejemplo: 12.5 ha."
        hint={record ? `Máximo: ${formatNumber(record.hectares)} ha en Odoo.` : undefined}
      >
        {(props) => (
          <>
            <UnitInput
              {...props}
              {...form.bindInput('hectares')}
              unit="ha"
              max={record?.hectares}
              placeholder="Ej. 12.5"
            />
            {record && (
              <button
                type="button"
                className={textAction}
                onClick={() => form.change('hectares', String(record.hectares))}
              >
                Usar lote completo
              </button>
            )}
          </>
        )}
      </FormField>
      <FormField
        {...field('applicationType')}
        label="Tipo de aplicación"
        required
        help="Indica con qué se hará la aplicación: avión o dron."
      >
        {(props) => (
          <ResponsiveSelect
            {...props}
            {...form.bindSelect('applicationType')}
            placeholder="Avión o dron"
            searchLabel="tipo de aplicación"
            options={toOptions(
              APPLICATION_TYPES,
              (item) => item,
              (item) => item,
            )}
          />
        )}
      </FormField>
      <FormField
        {...field('applicationPeriodCode')}
        label="Periodo de aplicación"
        required
        help="Indica si la aplicación corresponde a pre-siembra o post-siembra. Las opciones son las mismas que usa Odoo en las órdenes de compra."
      >
        {(props) => (
          <ResponsiveSelect
            {...props}
            {...form.bindSelect('applicationPeriodCode')}
            disabled={!catalogReady || !list.applicationPeriods.length}
            placeholder="Selecciona periodo"
            searchLabel="periodo de aplicación"
            options={toOptions(
              list.applicationPeriods,
              (item) => item.name,
              (item) => item.code,
            )}
          />
        )}
      </FormField>
    </>
  );
}
