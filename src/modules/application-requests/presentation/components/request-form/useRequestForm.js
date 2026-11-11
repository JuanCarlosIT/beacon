import { useId, useRef, useState } from 'react';
import { uuid } from '../../../../../shared/ids/uuid.js';
import { confirmClear } from '../../../../../shared/feedback/alerts.js';
import {
  applyChange,
  catalogIsComplete,
  dependentsOf,
  deriveSelection,
  emptyDraft,
  estimateSubtotal,
  omitKeys,
  submissionFor,
  toRequestPayload,
  validateDraft,
  withCatalogDefaults,
} from '../../../domain/requestDraft.js';

const OFFLINE_MESSAGE = 'No se puede guardar en este momento. Intenta de nuevo.';

// Estado y acciones del formulario de captura. La lógica de negocio vive en domain/requestDraft.js.
export function useRequestForm({ catalog, catalogLoading, connected, onSave }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const formRef = useRef(null);
  const submissionRef = useRef(null);
  const prefix = useId();

  const list = withCatalogDefaults(catalog);
  const selection = deriveSelection(list, draft);

  function change(name, value) {
    setSaveError('');
    setErrors((current) => omitKeys(current, [name, ...dependentsOf(name)]));
    setDraft((current) => applyChange(current, name, value));
  }

  function clear() {
    setDraft(emptyDraft());
    setErrors({});
    submissionRef.current = null;
  }

  const focusField = (name) =>
    requestAnimationFrame(() => formRef.current?.querySelector(`[name="${name}"]`)?.focus());

  async function save() {
    const payload = toRequestPayload(draft, selection.record);
    submissionRef.current = submissionFor(submissionRef.current, payload, uuid);
    await onSave({ ...payload, submissionKey: submissionRef.current.key });
    clear();
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validateDraft(draft, selection, list);
    setErrors(nextErrors);
    const [firstInvalid] = Object.keys(nextErrors);
    if (firstInvalid) return focusField(firstInvalid);
    if (!connected) return setSaveError(OFFLINE_MESSAGE);
    setBusy(true);
    setSaveError('');
    try {
      await save();
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!(await confirmClear())) return;
    clear();
    setSaveError('');
  }

  return {
    ...selection,
    list,
    draft,
    errors,
    busy,
    saveError,
    formRef,
    catalogLoading,
    catalogReady: Boolean(catalog) && !catalogLoading,
    canSave: !busy && connected && Boolean(catalog) && !catalogLoading && catalogIsComplete(list),
    subtotal: estimateSubtotal(draft),
    submit,
    reset,
    change,
    // Atributos comunes de <FormField> y enlaces de valor para selects e inputs.
    field: (name) => ({ id: `${prefix}-${name}`, name, error: errors[name] }),
    bindSelect: (name) => ({ value: draft[name], onChange: (value) => change(name, value) }),
    bindInput: (name) => ({
      value: draft[name],
      onChange: (event) => change(name, event.target.value),
    }),
  };
}
