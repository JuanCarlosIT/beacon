import { useId, useRef, useState } from 'react';
import { uuid } from '../../../../../shared/ids/uuid.js';
import { confirmClear } from '../../../../../shared/feedback/alerts.js';
import {
  addDetectedProducts,
  addProduct,
  appendRecipeText,
  applyChange,
  authorizedRateOf,
  catalogIsComplete,
  choosePending,
  dependentsOf,
  deriveSelection,
  emptyDraft,
  estimateSubtotal,
  omitKeys,
  rateNeedsAuthorization,
  removeProduct,
  setProductDose,
  submissionFor,
  toRequestPayload,
  validateDraft,
  withCatalogDefaults,
} from '../../../domain/requestDraft.js';

// Qué decir después de leer la imagen de la receta.
function recipeImageMessage(read) {
  if (read.readFailed)
    return 'La imagen quedó guardada, pero no se pudo leer su texto. Anota la receta a mano.';
  return read.text
    ? 'Se leyó el texto de la imagen y se agregó abajo. Revísalo y corrígelo si hace falta.'
    : 'La imagen quedó guardada, pero no se le encontró texto legible. Puedes anotar la receta a mano.';
}

const OFFLINE_MESSAGE = 'No se puede guardar en este momento. Intenta de nuevo.';

// Estado y acciones del formulario de captura. La lógica de negocio vive en domain/requestDraft.js.
export function useRequestForm({ catalog, catalogLoading, connected, onSave, onReadRecipeImage }) {
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
    setDraft((current) => withCycleRate(applyChange(current, name, value), name));
  }

  // Al elegir ciclo se propone su tarifa autorizada (se puede bajar; subirla pide autorización).
  function withCycleRate(next, changed) {
    if (changed !== 'cycleId') return next;
    const rate = authorizedRateOf(list, next.cycleId);
    return rate == null ? next : { ...next, ratePerHectare: String(rate) };
  }

  // Imagen de la receta: se sube, se le lee el texto y lo leído se agrega a lo anotado.
  const [recipeImage, setRecipeImage] = useState({ reading: false, message: '' });
  async function attachRecipeImage(file) {
    if (!file || recipeImage.reading || !onReadRecipeImage) return null;
    setSaveError('');
    setRecipeImage({ reading: true, message: '' });
    try {
      const read = await onReadRecipeImage(file);
      setErrors((current) => omitKeys(current, ['products']));
      setDraft((current) => ({
        ...current,
        recipeFile: { id: read.id, name: read.name },
        recipeText: appendRecipeText(current.recipeText, read.text),
      }));
      setRecipeImage({ reading: false, message: recipeImageMessage(read) });
      return read;
    } catch (error) {
      setRecipeImage({ reading: false, message: error.message });
      return null;
    }
  }
  function removeRecipeImage() {
    setDraft((current) => ({ ...current, recipeFile: null }));
    setRecipeImage({ reading: false, message: '' });
  }

  const changeProducts = (update) => {
    setSaveError('');
    setErrors((current) => omitKeys(current, ['products']));
    setDraft((current) => ({ ...current, products: update(current.products) }));
  };

  function clear() {
    setDraft(emptyDraft());
    setErrors({});
    submissionRef.current = null;
    setRecipeImage({ reading: false, message: '' });
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
    rateNeedsAuthorization: rateNeedsAuthorization(draft.ratePerHectare, selection.authorizedRate),
    addProduct: (product) => changeProducts((products) => addProduct(products, product)),
    removeProduct: (id) => changeProducts((products) => removeProduct(products, id)),
    setProductDose: (id, dose) => changeProducts((products) => setProductDose(products, id, dose)),
    // Se escoge el producto de un tipo detectado sin producto («1 litro de adherente»).
    choosePending: (pendingKey, product) =>
      changeProducts((products) => choosePending(products, pendingKey, product)),
    // Productos del catálogo reconocidos en un texto (lo anotado o lo leído de la foto).
    addDetectedProducts: (detected) =>
      changeProducts((products) => addDetectedProducts(products, detected)),
    setRecipeText: (text) => {
      setSaveError('');
      setErrors((current) => omitKeys(current, ['products']));
      setDraft((current) => ({ ...current, recipeText: text }));
    },
    recipeImage,
    attachRecipeImage,
    removeRecipeImage,
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
