import { Plus } from 'lucide-react';
import ResponsiveSelect from '../../../../../shared/ui/ResponsiveSelect.jsx';
import { formatDate, formatMoney } from '../../../../../shared/formatting/formatters.js';
import { supplierIdentifier, supplierOptionLabel } from '../../../domain/supplier.js';
import FormField from './FormField.jsx';
import UnitInput from './UnitInput.jsx';
import { fieldInput, textAction } from './formStyles.js';
import { toOptions } from './options.js';

const supplierHint = (supplier) =>
  supplier
    ? `${supplierIdentifier(supplier)} · Alta: ${formatDate(supplier.registeredAt)}${supplier.isNew ? ' · Nuevo (últimos 30 días)' : ''}`
    : 'Solo proveedores autorizados para aplicaciones aéreas.';

function EstimatedSubtotal({ value }) {
  return (
    <div
      className="col-span-full flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[7px] border border-gab-line bg-gab-accent-soft px-3.5 py-3 text-xs leading-[1.7]"
      role="status"
      aria-live="polite"
    >
      <span>
        Subtotal estimado <strong className="ml-2 font-mono">{formatMoney(value)} MXN</strong>
      </span>
      <small className="text-[11px] text-gab-muted">
        Sin impuestos. La OCM requiere aprobación y generación manual.
      </small>
    </div>
  );
}

// Proveedor, periodo, tarifa, subtotal estimado y motivo de la aplicación.
export default function SupplierFields({ form, onAddSupplier }) {
  const { list, catalogLoading, catalogReady, field } = form;
  const canRegisterSupplier = list.supplierPermissions?.canRegister && onAddSupplier;
  return (
    <>
      <FormField
        {...field('supplierId')}
        label="Proveedor"
        required
        help="Solo aparecen proveedores autorizados en esta aplicación y activos en Odoo. Busca por nombre o RFC. Administración debe autorizar explícitamente cada nueva alta; no se modifican contactos en Odoo."
        hint={supplierHint(form.supplier)}
      >
        {(props) => (
          <>
            <ResponsiveSelect
              {...props}
              {...form.bindSelect('supplierId')}
              disabled={!catalogReady || !list.suppliers.length}
              placeholder={catalogLoading ? 'Cargando…' : 'Selecciona proveedor'}
              searchLabel="proveedor por nombre o RFC"
              options={toOptions(list.suppliers, supplierOptionLabel)}
            />
            {canRegisterSupplier && (
              <button
                type="button"
                className={textAction}
                onClick={onAddSupplier}
                disabled={catalogLoading}
              >
                <Plus size={14} /> Registrar proveedor
              </button>
            )}
          </>
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
      <FormField
        {...field('ratePerHectare')}
        label="Tarifa por hectárea"
        required
        help="Captura la tarifa acordada por cada hectárea, en pesos mexicanos y sin impuestos. No es el importe total. Ejemplo: 400.00 MXN por ha."
      >
        {(props) => (
          <UnitInput
            {...props}
            {...form.bindInput('ratePerHectare')}
            unit="MXN"
            max="100000000"
            placeholder="Ej. 400.00"
          />
        )}
      </FormField>
      <EstimatedSubtotal value={form.subtotal} />
      <FormField
        {...field('treatment')}
        label="¿Qué aplicación necesitas?"
        wide
        help="Puedes indicar el motivo o dejarlo vacío. No inventes productos ni dosis; eso corresponde al responsable agronómico."
      >
        {(props) => (
          <input
            {...props}
            {...form.bindInput('treatment')}
            maxLength={500}
            className={fieldInput}
            placeholder="Puedes dejarlo vacío"
          />
        )}
      </FormField>
    </>
  );
}
