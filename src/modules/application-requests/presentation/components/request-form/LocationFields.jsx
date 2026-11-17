import ResponsiveSelect from '../../../../../shared/ui/ResponsiveSelect.jsx';
import { formatNumber } from '../../../../../shared/formatting/formatters.js';
import FormField from './FormField.jsx';
import { toOptions } from './options.js';

const recordLabel = (item) => `${item.name} · ${formatNumber(item.hectares)} ha`;

// Ciclo → zona → predio → cultivo. Cada select se habilita al elegir el anterior.
export default function LocationFields({ form }) {
  const { draft, list, catalogLoading, catalogReady, matching, field } = form;
  return (
    <>
      <FormField
        {...field('cycleId')}
        label="Ciclo agrícola"
        required
        help="La temporada agrícola de la aplicación. Si no sabes qué ciclo corresponde, consulta a tu supervisor."
      >
        {(props) => (
          <ResponsiveSelect
            {...props}
            {...form.bindSelect('cycleId')}
            disabled={!catalogReady}
            placeholder={catalogLoading ? 'Cargando…' : 'Selecciona ciclo'}
            options={toOptions(list.cycles)}
          />
        )}
      </FormField>
      <FormField
        {...field('zoneId')}
        label="Zona"
        required
        help="Es la zona del catálogo de Odoo. Solo aparecen las que tienen lotes en el ciclo elegido."
      >
        {(props) => (
          <ResponsiveSelect
            {...props}
            {...form.bindSelect('zoneId')}
            disabled={!draft.cycleId || catalogLoading}
            placeholder={draft.cycleId ? 'Selecciona zona' : 'Primero elige ciclo'}
            options={toOptions(form.zoneOptions)}
          />
        )}
      </FormField>
      <FormField
        {...field('plotNameId')}
        label="Lote / predio"
        required
        help="El predio donde se requiere el servicio. Si falta, pide que se revise en Odoo; no se permite inventar nombres."
      >
        {(props) => (
          <ResponsiveSelect
            {...props}
            {...form.bindSelect('plotNameId')}
            disabled={!draft.zoneId || catalogLoading}
            placeholder={draft.zoneId ? 'Selecciona predio' : 'Primero elige zona'}
            options={toOptions(form.plotOptions)}
          />
        )}
      </FormField>
      <FormField
        {...field('cropId')}
        label="Cultivo"
        required
        help="Se obtiene del predio y ciclo en Odoo. Si solo hay uno, se completa automáticamente."
      >
        {(props) => (
          <ResponsiveSelect
            {...props}
            value={form.cropId}
            onChange={(value) => form.change('cropId', value)}
            disabled={!draft.plotNameId || form.cropOptions.length === 1 || catalogLoading}
            placeholder={draft.plotNameId ? 'Selecciona cultivo' : 'Primero elige predio'}
            options={toOptions(form.cropOptions)}
          />
        )}
      </FormField>
      {matching.length > 1 && (
        <FormField
          {...field('recordId')}
          label="Registro del lote"
          wide
          required
          hint="Odoo tiene varias referencias para esta combinación. Elige la correcta."
        >
          {(props) => (
            <ResponsiveSelect
              {...props}
              {...form.bindSelect('recordId')}
              placeholder="Selecciona registro"
              options={toOptions(matching, recordLabel)}
            />
          )}
        </FormField>
      )}
    </>
  );
}
