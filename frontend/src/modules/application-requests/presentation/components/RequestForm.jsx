import { AlertCircle } from 'lucide-react';
import SaveButton from '../../../../shared/ui/SaveButton.jsx';
import { btnSecondary, cx } from '../../../../shared/ui/classes.js';
import { useRequestForm } from './request-form/useRequestForm.js';
import CatalogStatus from './request-form/CatalogStatus.jsx';
import LocationFields from './request-form/LocationFields.jsx';
import SupplierFields from './request-form/SupplierFields.jsx';
import MoreDetails from './request-form/MoreDetails.jsx';
import { fieldGrid } from './request-form/formStyles.js';

// El error de «registro del lote» va arriba si su select no está visible (una sola coincidencia).
const errorSummary = (errors, matching) =>
  errors.recordId && matching.length <= 1 ? errors.recordId : 'Revisa los campos señalados.';

export default function RequestForm({
  connected,
  catalog,
  catalogLoading,
  catalogError,
  reloadCatalog,
  onSave,
  onAddSupplier,
}) {
  const form = useRequestForm({ catalog, catalogLoading, connected, onSave });
  const hasErrors = Object.keys(form.errors).length > 0;
  return (
    <form ref={form.formRef} onSubmit={form.submit} noValidate>
      <fieldset disabled={form.busy} className="min-w-0">
        <CatalogStatus
          catalog={catalog}
          list={form.list}
          loading={catalogLoading}
          error={catalogError}
          onReload={reloadCatalog}
        />
        <div className={fieldGrid}>
          <LocationFields form={form} />
          <SupplierFields form={form} onAddSupplier={onAddSupplier} />
        </div>
        <MoreDetails form={form} />
        {hasErrors && (
          <p className="mx-6 mb-5 flex items-center gap-2 text-xs text-gab-bad" role="alert">
            <AlertCircle size={16} />
            {errorSummary(form.errors, form.matching)}
          </p>
        )}
        {form.saveError && (
          <div
            role="alert"
            className="mx-6 mb-4 rounded-md bg-gab-bad-bg p-3 text-xs leading-[1.7] text-gab-bad"
          >
            {form.saveError}
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-gab-line bg-gab-bg px-6 py-[18px] max-sm:gap-[9px] max-sm:px-[18px] max-sm:py-4">
          <span className="mr-auto text-xs text-gab-muted max-sm:mb-[3px] max-sm:basis-full">
            El folio se genera al guardar.
          </span>
          <button type="button" className={cx(btnSecondary, 'max-sm:px-3.5')} onClick={form.reset}>
            Limpiar
          </button>
          <SaveButton busy={form.busy} disabled={!form.canSave} />
        </footer>
      </fieldset>
    </form>
  );
}
