import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, Check, ImageUp, Plus, X } from 'lucide-react';
import { formatNumber } from '../../../../../shared/formatting/formatters.js';
import { btnSecondary, cx } from '../../../../../shared/ui/classes.js';
import {
  MAX_PRODUCTS,
  detectProducts,
  isPending,
  newDetections,
  productTotal,
} from '../../../domain/requestDraft.js';
import { fieldInput, numberInput } from './formStyles.js';

// Productos de la receta, por pasos. Al abrir el formulario solo se piden los tipos; los productos
// de un tipo se piden la primera vez que se abre y se guardan; la lista completa solo se pide para
// reconocer los productos de una foto.
function useProductCatalog(source) {
  const [state, setState] = useState({ types: [], loading: true, error: '' });
  const [byType, setByType] = useState(() => new Map());
  const asked = useRef(new Set());
  const everything = useRef(null);

  const load = useCallback(async () => {
    if (!source) return setState({ types: [], loading: false, error: '' });
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      setState({ types: await source.types(), loading: false, error: '' });
    } catch (error) {
      setState({ types: [], loading: false, error: error.message });
    }
  }, [source]);
  useEffect(() => {
    load();
  }, [load]);

  // Pide los productos de un tipo una sola vez. null = cargando, [] = no tiene.
  const loadType = useCallback(
    async (typeId) => {
      if (!source || typeId == null || asked.current.has(typeId)) return;
      asked.current.add(typeId);
      try {
        const products = await source.ofType(typeId);
        setByType((current) => new Map(current).set(typeId, products));
      } catch {
        asked.current.delete(typeId);
        setByType((current) => new Map(current).set(typeId, undefined));
      }
    },
    [source],
  );

  // Lista completa por tipo ([{ id, name, products }]), para buscar en el texto de una foto.
  const loadAll = useCallback(async () => {
    everything.current ??= source.all().catch((error) => {
      everything.current = null;
      throw error;
    });
    return everything.current;
  }, [source]);

  return { ...state, byType, reload: load, loadType, loadAll };
}

// Total a llevar según la dosis y la superficie; mientras falte algo, dice qué falta.
const doseTotal = (product, hectares) => {
  const total = productTotal(product.dose, hectares);
  if (total != null) return `Total ${formatNumber(total)} ${product.uom}`.trim();
  return product.dose === '' ? 'Escribe la dosis' : 'Faltan las hectáreas para el total';
};

const chip = (selected) =>
  cx(
    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-3 text-xs font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gab-accent',
    selected
      ? 'border-gab-accent bg-gab-accent text-gab-accent-ink'
      : 'border-gab-line bg-gab-surface text-gab-ink hover:border-gab-muted',
  );
// Cuántos productos tiene la categoría / cuántos llevas elegidos.
const chipCount = (selected) =>
  cx(
    'rounded-full px-1.5 py-0.5 font-mono text-[10px] font-normal tabular-nums',
    selected ? 'bg-white/15' : 'bg-gab-bg text-gab-muted',
  );
const chipPicked = (selected) =>
  cx(
    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
    selected ? 'bg-white text-gab-accent' : 'bg-gab-accent text-gab-accent-ink',
  );

// Categorías (adherente, fungicida, insecticida…): al tocar una aparece su lista. La palomita dice
// cuántos productos de esa categoría ya están elegidos.
function TypeChips({ groups, typeId, chosenByType, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoría de producto">
      {groups.map((group) => {
        const picked = chosenByType.get(group.id) ?? 0;
        const selected = typeId === group.id;
        return (
          <button
            key={group.id}
            type="button"
            aria-pressed={selected}
            className={chip(selected)}
            onClick={() => onSelect(selected ? null : group.id)}
          >
            {group.name}
            {picked > 0 ? (
              <span className={chipPicked(selected)}>
                <Check size={11} strokeWidth={3} aria-hidden="true" />
                {picked}
                <span className="sr-only"> elegidos</span>
              </span>
            ) : (
              <span className={chipCount(selected)}>{group.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Dosis por hectárea de un producto ya elegido, con su unidad.
function DoseInput({ product, invalid, doseInRecipe, onDose, autoFocus = false }) {
  const id = `dose-${product.id}`;
  return (
    <div className="relative w-[128px] shrink-0">
      <label htmlFor={id} className="sr-only">
        Dosis por hectárea de {product.name ?? product.type}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        autoFocus={autoFocus}
        value={product.dose}
        onChange={(event) => onDose(product.id, event.target.value)}
        // La rueda del ratón no debe cambiar la dosis sin querer.
        onWheel={(event) => event.currentTarget.blur()}
        aria-invalid={invalid}
        className={cx(
          numberInput,
          'min-h-[36px] rounded-full py-1.5 pr-[52px] pl-3.5 text-right text-[13px]',
        )}
        placeholder={doseInRecipe ? 'Foto' : '0'}
      />
      <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px] text-gab-muted">
        {product.uom ? `${product.uom}/ha` : '/ha'}
      </span>
    </div>
  );
}

const removeButton =
  'grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-gab-muted transition-colors hover:bg-gab-bad-bg hover:text-gab-bad focus-visible:outline-2 focus-visible:outline-gab-accent';

// Marca a la izquierda del renglón: palomita si ya está elegido, «+» si se puede agregar.
const rowMark = (picked) =>
  cx(
    'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
    picked
      ? 'border-gab-accent bg-gab-accent text-gab-accent-ink'
      : 'border-gab-line text-gab-muted group-hover:border-gab-accent group-hover:text-gab-accent',
  );

// Renglón de un producto ya elegido: su dosis ahí mismo y una X para quitarlo.
function ChosenItem({ product, hectares, invalid, doseInRecipe, justAdded, onDose, onRemove }) {
  return (
    <div className="flex items-center gap-2.5 bg-gab-accent-soft py-2 pr-1.5 pl-3 shadow-[inset_3px_0_0_var(--gab-accent)]">
      <span className={rowMark(true)} aria-hidden="true">
        <Check size={12} strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-tight font-semibold break-words">{product.name}</p>
        <p className="mt-0.5 text-[11px] text-gab-muted">{doseTotal(product, hectares)}</p>
      </div>
      <DoseInput
        product={product}
        invalid={invalid}
        doseInRecipe={doseInRecipe}
        onDose={onDose}
        autoFocus={justAdded}
      />
      <button
        type="button"
        className={removeButton}
        aria-label={`Quitar ${product.name}`}
        onClick={() => onRemove(product.id)}
      >
        <X size={15} />
      </button>
    </div>
  );
}

// Lista de la categoría elegida, en orden alfabético. Tocar un producto lo elige y ahí mismo se
// escribe su dosis; la X lo quita.
function ProductList({ items, chosen, full, lastAdded, rowProps, onPick }) {
  if (!items) return <p className="mt-2 text-xs text-gab-muted">Cargando productos…</p>;
  if (!items.length)
    return (
      <p className="mt-2 text-xs text-gab-muted">Esta categoría no tiene productos en Odoo.</p>
    );
  return (
    <ul className="mt-3 max-h-72 list-none divide-y divide-gab-line overflow-y-auto rounded-lg border border-gab-line bg-gab-surface p-0">
      {items.map((item) => {
        const picked = chosen.get(item.id);
        return (
          <li key={item.id}>
            {picked ? (
              <ChosenItem
                product={picked}
                justAdded={lastAdded === item.id}
                {...rowProps(picked)}
              />
            ) : (
              <button
                type="button"
                disabled={full}
                onClick={() => onPick(item)}
                className="group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-gab-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gab-accent disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className={rowMark(false)} aria-hidden="true">
                  <Plus size={12} strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1 break-words">{item.name}</span>
                <span className="shrink-0 text-[11px] text-gab-muted">{item.uom}</span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Lista para escoger el producto de un tipo que la receta nombró sin decir cuál.
function PendingProduct({ product, options, invalid, onChoose }) {
  return (
    <>
      <label htmlFor={`choose-${product.id}`} className="block text-[13px] font-medium">
        {product.type}: falta escoger el producto
      </label>
      <select
        id={`choose-${product.id}`}
        name="products"
        value=""
        aria-invalid={invalid}
        onChange={(event) => {
          const chosen = options.find((item) => String(item.id) === event.target.value);
          if (chosen) onChoose(product.id, chosen);
        }}
        className={cx(fieldInput, 'mt-1.5')}
      >
        <option value="">Elige el producto de {product.type.toLowerCase()}…</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </>
  );
}

// Renglón de un tipo que la foto nombró sin decir el producto: se escoge de su lista.
function PendingRow({ product, options, invalid, doseInRecipe, onDose, onRemove, onChoose }) {
  return (
    <li className="flex flex-wrap items-end gap-2 border-b border-gab-line px-3 py-3 last:border-b-0">
      <div className="min-w-[180px] flex-1">
        <PendingProduct product={product} options={options} invalid={invalid} onChoose={onChoose} />
      </div>
      <DoseInput product={product} invalid={false} doseInRecipe={doseInRecipe} onDose={onDose} />
      <button
        type="button"
        className={removeButton}
        aria-label={`Quitar ${product.type}`}
        onClick={() => onRemove(product.id)}
      >
        <X size={16} />
      </button>
    </li>
  );
}

// Resumen de lo elegido en todas las categorías: nombre, dosis y una X para quitarlo.
function ChosenSummary({ products, onRemove, onShow }) {
  if (!products.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold text-gab-muted">Elegidos: {products.length}</p>
      <ul className="mt-1.5 flex list-none flex-wrap gap-1.5 p-0">
        {products.map((product) => (
          <li
            key={product.id}
            className="inline-flex items-center rounded-full border border-gab-line bg-gab-surface text-xs"
          >
            <button
              type="button"
              className="cursor-pointer rounded-l-full py-1.5 pr-1 pl-3 text-left focus-visible:outline-2 focus-visible:outline-gab-accent"
              title="Ver en su categoría"
              onClick={() => onShow(product.typeId)}
            >
              <b className="font-semibold">{product.name}</b>{' '}
              <span className="font-mono text-gab-muted tabular-nums">
                {product.dose === '' ? 'sin dosis' : `${product.dose} ${product.uom}/ha`}
              </span>
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-r-full py-1.5 pr-2.5 pl-1 text-gab-muted hover:text-gab-bad focus-visible:outline-2 focus-visible:outline-gab-accent"
              aria-label={`Quitar ${product.name}`}
              onClick={() => onRemove(product.id)}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MAX_IMAGE_MB = 10;
const pickerButton = cx(btnSecondary, 'min-h-[40px]');

// Imagen de la receta: foto con la cámara del teléfono o una captura/imagen ya guardada.
// Al elegirla se sube y se le lee el texto para reconocer sus productos.
function RecipeImage({ form, onRead }) {
  const cameraRef = useRef(null);
  const filesRef = useRef(null);
  const [tooBig, setTooBig] = useState(false);
  const { recipeFile } = form.draft;
  const { reading, message } = form.recipeImage;

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const big = file.size > MAX_IMAGE_MB * 1024 * 1024;
    setTooBig(big);
    if (big) return;
    const read = await form.attachRecipeImage(file);
    if (read?.text) onRead(read.text);
  }

  return (
    <div className="mt-4 border-t border-gab-line pt-4">
      <p className="mb-2 text-xs font-semibold">Foto de la receta</p>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={pick}
        aria-label="Tomar foto de la receta"
      />
      <input
        ref={filesRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={pick}
        aria-label="Elegir imagen de la receta"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={pickerButton}
          disabled={reading}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera size={15} /> Tomar foto
        </button>
        <button
          type="button"
          className={pickerButton}
          disabled={reading}
          onClick={() => filesRef.current?.click()}
        >
          <ImageUp size={15} /> Subir captura o imagen
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-[1.7] text-gab-muted" role="status" aria-live="polite">
        {reading && 'Subiendo la imagen y leyendo su texto…'}
        {!reading && tooBig && (
          <span className="text-gab-bad">
            Esa imagen pesa más de {MAX_IMAGE_MB} MB. Elige otra o tómala con menos resolución.
          </span>
        )}
        {!reading && !tooBig && recipeFile && (
          <>
            Imagen: <b className="break-all text-gab-ink">{recipeFile.name}</b>{' '}
            <button
              type="button"
              className="cursor-pointer text-gab-accent underline underline-offset-2"
              onClick={form.removeRecipeImage}
            >
              Quitar
            </button>
            {message && <span className="block">{message}</span>}
          </>
        )}
        {!reading && !tooBig && !recipeFile && (message || 'JPG, PNG o WebP de máximo 10 MB.')}
      </p>
    </div>
  );
}

// Qué decir después de buscar productos en un texto.
function detectedMessage(found, added) {
  if (!found.length)
    return 'No se reconoció ningún producto en la foto. Escógelos por categoría; la foto queda guardada con la solicitud.';
  if (!added.length) return 'Lo que dice la foto ya estaba en la lista.';
  const named = added.filter((item) => !isPending(item)).map((item) => item.name);
  const pending = added.filter(isPending).map((item) => item.type);
  return [
    named.length && `Se agregaron de la foto: ${named.join(', ')}.`,
    pending.length &&
      `La foto dice la dosis de ${pending.join(', ')} sin decir el producto: escógelo en su renglón.`,
    'Revisa las dosis antes de guardar.',
  ]
    .filter(Boolean)
    .join(' ');
}

// Productos de la aplicación: del catálogo de Odoo por categoría. Al tocar un producto queda elegido
// y su dosis se escribe en ese mismo renglón. La foto de la receta es opcional: de ella se
// reconocen productos y, si trae las dosis, pueden quedar vacías.
export default function ProductFields({ form, source }) {
  const catalog = useProductCatalog(source);
  const { products, hectares } = form.draft;
  const error = form.errors.products;
  const full = products.length >= MAX_PRODUCTS;
  // Con la foto de la receta, la dosis de cada producto puede quedarse vacía.
  const doseInRecipe = Boolean(form.draft.recipeFile);
  const [detected, setDetected] = useState('');
  const [typeId, setTypeId] = useState(null);
  const [lastAdded, setLastAdded] = useState(null);

  const named = products.filter((product) => !isPending(product));
  const pending = products.filter(isPending);
  const chosen = new Map(named.map((product) => [product.id, product]));
  const chosenByType = new Map();
  for (const product of named)
    chosenByType.set(product.typeId, (chosenByType.get(product.typeId) ?? 0) + 1);

  // Se piden los productos del tipo abierto y de los renglones que esperan producto.
  const { loadType } = catalog;
  const wanted = [typeId, ...pending.map((item) => item.typeId)].filter((id) => id != null);
  const wantedKey = wanted.join(',');
  useEffect(() => {
    wanted.forEach(loadType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, loadType]);

  const typeName = catalog.types.find((type) => type.id === typeId)?.name;
  const items = catalog.byType
    .get(typeId)
    ?.map((product) => ({ ...product, typeId, type: typeName }));

  const missingDose = (product) =>
    !(Number(product.dose) > 0) && !(doseInRecipe && product.dose === '');
  const rowProps = (product) => ({
    hectares,
    doseInRecipe,
    invalid: Boolean(error) && missingDose(product),
    onDose: form.setProductDose,
    onRemove: form.removeProduct,
  });
  // Productos del tipo de un renglón pendiente que todavía no están elegidos.
  const optionsFor = (item) =>
    (catalog.byType.get(item.typeId) ?? []).filter((option) => !chosen.has(option.id));

  // Reconoce en el texto leído de la foto los productos del catálogo y los agrega con su dosis.
  async function detect(text) {
    try {
      const groups = await catalog.loadAll();
      const found = detectProducts(text, groups);
      const added = newDetections(products, found);
      form.addDetectedProducts(found);
      setDetected(detectedMessage(found, added));
    } catch {
      setDetected(
        'La foto quedó guardada, pero no se pudieron reconocer sus productos. Elígelos por categoría.',
      );
    }
  }

  function pick(product) {
    form.addProduct(product);
    setLastAdded(product.id);
  }

  return (
    <>
      {catalog.loading && <p className="text-xs text-gab-muted">Cargando productos de Odoo…</p>}
      {catalog.error && (
        <p className="text-xs text-gab-bad">
          {catalog.error}{' '}
          <button
            type="button"
            className="cursor-pointer underline underline-offset-2"
            onClick={catalog.reload}
          >
            Reintentar
          </button>
        </p>
      )}
      {!catalog.loading && !catalog.error && (
        <>
          <TypeChips
            groups={catalog.types}
            typeId={typeId}
            chosenByType={chosenByType}
            onSelect={setTypeId}
          />
          {typeId != null && (
            <ProductList
              items={items}
              chosen={chosen}
              full={full}
              lastAdded={lastAdded}
              rowProps={rowProps}
              onPick={pick}
            />
          )}
          {typeId == null && !products.length && (
            <p className="mt-2 text-xs text-gab-muted">
              Toca una categoría para ver sus productos. Al elegir uno, ahí mismo pones su dosis.
            </p>
          )}
          {full && <p className="mt-2 text-xs text-gab-muted">Ya tienes el máximo de productos.</p>}
        </>
      )}

      <ChosenSummary products={named} onRemove={form.removeProduct} onShow={setTypeId} />

      {pending.length > 0 && (
        <div className="mt-3 rounded-md border border-gab-line">
          <p className="border-b border-gab-line bg-gab-bg px-3 py-2 text-xs font-semibold">
            La foto no dice qué producto: escógelo
          </p>
          <ul className="list-none p-0">
            {pending.map((product) => (
              <PendingRow
                key={product.id}
                product={product}
                options={optionsFor(product)}
                invalid={Boolean(error)}
                doseInRecipe={doseInRecipe}
                onDose={form.setProductDose}
                onRemove={form.removeProduct}
                onChoose={form.choosePending}
              />
            ))}
          </ul>
        </div>
      )}

      <RecipeImage form={form} onRead={detect} />
      {detected && (
        <p
          className="mt-2 rounded-md bg-gab-accent-soft px-3 py-2 text-[11px] leading-[1.7]"
          role="status"
          aria-live="polite"
        >
          {detected}
        </p>
      )}
      {error && (
        <p
          data-error="products"
          className="mt-3 flex items-start gap-1.5 text-xs leading-[1.6] text-gab-bad [&>svg]:mt-0.5 [&>svg]:shrink-0"
        >
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </>
  );
}
