import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, FlaskConical, ImageUp, ListPlus, Search, Trash2 } from 'lucide-react';
import { formatNumber } from '../../../../../shared/formatting/formatters.js';
import { btnSecondary, cx, iconButton, textAction } from '../../../../../shared/ui/classes.js';
import {
  MAX_PRODUCTS,
  detectProducts,
  filterProducts,
  isPending,
  newDetections,
  productTotal,
} from '../../../domain/requestDraft.js';
import { fieldInput, unitInput, unitLabel } from './formStyles.js';

// Catálogo de Odoo para la receta, ya separado por tipo. Se carga una vez al abrir el formulario.
function useProductCatalog(onLoad) {
  const [state, setState] = useState({ groups: [], loading: true, error: '' });
  const load = useCallback(async () => {
    if (!onLoad) return setState({ groups: [], loading: false, error: '' });
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      setState({ groups: await onLoad(), loading: false, error: '' });
    } catch (error) {
      setState({ groups: [], loading: false, error: error.message });
    }
  }, [onLoad]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

const doseTotal = (product, hectares) => {
  const total = productTotal(product.dose, hectares);
  return total == null ? 'Total: —' : `Total: ${formatNumber(total)} ${product.uom}`.trim();
};

const chip = (selected) =>
  cx(
    'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gab-accent',
    selected
      ? 'border-gab-accent bg-gab-accent text-gab-accent-ink'
      : 'border-gab-line bg-gab-bg text-gab-muted hover:text-gab-ink',
  );

// Tipos de producto (adherente, fungicida, insecticida…) para escoger de cuál ver la lista.
function TypeChips({ groups, typeId, onSelect }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tipo de producto">
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          aria-pressed={typeId === group.id}
          className={chip(typeId === group.id)}
          onClick={() => onSelect(typeId === group.id ? null : group.id)}
        >
          {group.name} <span className="font-normal opacity-75">{group.products.length}</span>
        </button>
      ))}
    </div>
  );
}

// Lista de productos del tipo elegido (o los que coinciden con lo escrito), en orden alfabético.
function ProductList({ items, showType, chosen, onPick }) {
  if (!items.length)
    return <p className="mt-2 text-xs text-gab-muted">Ningún producto coincide en Odoo.</p>;
  return (
    <ul className="mt-2 max-h-64 list-none overflow-y-auto rounded-md border border-gab-line p-0">
      {items.map((product) => {
        const added = chosen.has(product.id);
        return (
          <li key={product.id} className="border-b border-gab-line last:border-b-0">
            <button
              type="button"
              disabled={added}
              onClick={() => onPick(product)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left text-xs hover:bg-gab-accent-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gab-accent disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="min-w-0 break-words">
                {product.name}
                {showType && (
                  <span className="ml-2 text-[11px] text-gab-muted">{product.type}</span>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-gab-muted">
                {added ? 'Ya agregado' : product.uom}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Escoger productos: primero el tipo, luego el producto de la lista. Escribir filtra por nombre.
function ProductPicker({ catalog, chosen, disabled, invalid, onPick }) {
  const [typeId, setTypeId] = useState(null);
  const [text, setText] = useState('');
  const browsing = typeId != null || text.trim().length >= 2;
  const items = browsing ? filterProducts(catalog.groups, { typeId, text }) : [];

  if (catalog.loading)
    return <p className="mt-2 text-xs text-gab-muted">Cargando productos de Odoo…</p>;
  if (catalog.error)
    return (
      <p className="mt-2 text-xs text-gab-bad">
        {catalog.error}{' '}
        <button
          type="button"
          className="cursor-pointer underline underline-offset-2"
          onClick={catalog.reload}
        >
          Reintentar
        </button>
      </p>
    );
  return (
    <>
      <TypeChips groups={catalog.groups} typeId={typeId} onSelect={setTypeId} />
      <div className="relative mt-2">
        <Search
          size={15}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gab-muted"
        />
        <input
          name="products"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={disabled}
          aria-label="Filtrar productos por nombre"
          aria-invalid={invalid}
          className={cx(fieldInput, 'pl-9')}
          placeholder={
            disabled
              ? 'La receta ya tiene el máximo de productos'
              : 'Escribe para filtrar por nombre'
          }
        />
      </div>
      {browsing ? (
        <ProductList
          items={items}
          showType={typeId == null}
          chosen={chosen}
          onPick={(product) => {
            onPick(product);
            setText('');
          }}
        />
      ) : (
        <p className="mt-2 text-[11px] text-gab-muted">
          Elige un tipo para ver su lista, o escribe el nombre del producto.
        </p>
      )}
    </>
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

function ProductRow({
  product,
  hectares,
  invalid,
  doseInRecipe,
  options = [],
  onDose,
  onRemove,
  onChoose,
}) {
  const doseId = `dose-${product.id}`;
  const pending = isPending(product);
  const label = pending ? product.type : product.name;
  return (
    <li className="grid grid-cols-[1fr_170px_auto] items-center gap-3 border-b border-gab-line py-3 last:border-b-0 max-sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        {pending ? (
          <PendingProduct
            product={product}
            options={options}
            invalid={invalid}
            onChoose={onChoose}
          />
        ) : (
          <>
            <p className="text-[13px] font-medium break-words">{product.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-gab-muted tabular-nums">
              {doseTotal(product, hectares)}
            </p>
          </>
        )}
      </div>
      <div className="relative max-sm:order-3 max-sm:col-span-full">
        <label htmlFor={doseId} className="sr-only">
          Dosis por hectárea de {label}
        </label>
        <input
          id={doseId}
          name={`dose-${product.id}`}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={product.dose}
          onChange={(event) => onDose(product.id, event.target.value)}
          // La rueda del ratón no debe cambiar la dosis sin querer.
          onWheel={(event) => event.currentTarget.blur()}
          aria-invalid={invalid && !pending}
          className={cx(unitInput, 'pr-[64px]')}
          placeholder={doseInRecipe ? 'En la receta' : 'Dosis'}
        />
        <span className={unitLabel}>{product.uom ? `${product.uom}/ha` : '/ha'}</span>
      </div>
      <button
        type="button"
        className={iconButton}
        aria-label={`Quitar ${label}`}
        onClick={() => onRemove(product.id)}
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}

const MAX_IMAGE_MB = 10;
const pickerButton = cx(btnSecondary, 'min-h-[40px]');

// Imagen de la receta: foto con la cámara del teléfono o una captura/imagen ya guardada.
// Al elegirla se sube y se le lee el texto, que cae en el cuadro de la receta anotada.
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
    <div className="mt-3">
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
    return 'No se reconoció ningún producto ni tipo en el texto. Escógelos de la lista o deja la receta anotada.';
  if (!added.length) return 'Lo que dice el texto ya estaba en la receta.';
  const named = added.filter((item) => !isPending(item)).map((item) => item.name);
  const pending = added.filter(isPending).map((item) => item.type);
  return [
    named.length && `Se agregaron del texto: ${named.join(', ')}.`,
    pending.length &&
      `El texto dice la dosis de ${pending.join(', ')} sin decir el producto: escógelo en su renglón.`,
    'Revisa las dosis antes de guardar.',
  ]
    .filter(Boolean)
    .join(' ');
}

// Receta de la aplicación. Primero los productos del catálogo de Odoo con su dosis; si no están ahí,
// se puede anotar o subir una imagen (se le lee el texto). Basta una de las tres.
export default function ProductFields({ form, onLoad }) {
  const catalog = useProductCatalog(onLoad);
  const { products, hectares, recipeText } = form.draft;
  const error = form.errors.products;
  const full = products.length >= MAX_PRODUCTS;
  // Con receta anotada o imagen, la dosis de cada producto puede quedarse vacía.
  const doseInRecipe = Boolean(recipeText.trim() || form.draft.recipeFile);
  const [detected, setDetected] = useState('');
  // Productos del tipo de un renglón pendiente que todavía no están en la receta.
  const optionsFor = (pending) =>
    (catalog.groups.find((group) => group.id === pending.typeId)?.products ?? []).filter(
      (item) => !products.some((chosen) => chosen.id === item.id),
    );

  // Reconoce en un texto (lo anotado o lo leído de la foto) los productos del catálogo y los
  // agrega con la dosis que traigan. Lo que no reconoce se queda en la receta anotada.
  function detect(text) {
    const found = detectProducts(text, catalog.groups);
    const added = newDetections(products, found);
    form.addDetectedProducts(found);
    setDetected(detectedMessage(found, added));
  }

  return (
    <section
      className="mx-6 mb-5 border-t border-gab-line pt-4 max-sm:mx-[18px]"
      aria-labelledby="recipe-title"
    >
      <h3
        id="recipe-title"
        className="flex items-center gap-2 text-xs font-semibold [&>svg]:text-gab-accent"
      >
        <FlaskConical size={16} aria-hidden="true" />
        Receta: qué se va a aplicar <span className="text-gab-muted">*</span>
      </h3>
      <p className="mt-1.5 text-[11px] leading-[1.75] text-gab-muted">
        Elige el tipo (adherente, fungicida, insecticida…) y toca el producto. La dosis por hectárea
        es opcional si ya viene en la receta anotada o en la foto de abajo.
      </p>

      <p className="mt-3 text-[11px] font-semibold">Productos del catálogo de Odoo</p>
      <ProductPicker
        catalog={catalog}
        chosen={new Set(products.map((product) => product.id))}
        disabled={full}
        invalid={Boolean(error)}
        onPick={form.addProduct}
      />
      {detected && (
        <p
          className="mt-2 rounded-md bg-gab-accent-soft px-3 py-2 text-[11px] leading-[1.7]"
          role="status"
          aria-live="polite"
        >
          {detected}
        </p>
      )}

      {products.length > 0 && (
        <ul className="mt-3 list-none p-0">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              hectares={hectares}
              invalid={
                Boolean(error) &&
                (isPending(product) ||
                  (!(Number(product.dose) > 0) && !(doseInRecipe && product.dose === '')))
              }
              doseInRecipe={doseInRecipe}
              options={isPending(product) ? optionsFor(product) : []}
              onDose={form.setProductDose}
              onRemove={form.removeProduct}
              onChoose={form.choosePending}
            />
          ))}
        </ul>
      )}

      <label htmlFor="recipe-text" className="mt-4 block text-[11px] font-semibold">
        O anota la receta{' '}
        <span className="font-normal text-gab-muted">
          Si el producto no está en Odoo o quieres agregar indicaciones
        </span>
      </label>
      <textarea
        id="recipe-text"
        rows={3}
        maxLength={4000}
        value={recipeText}
        onChange={(event) => form.setRecipeText(event.target.value)}
        className={cx(fieldInput, 'mt-1.5 resize-y')}
        placeholder="Ej. 1 litro de adhesivo, 2 litros de fungicida por hectárea…"
      />
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          className={textAction}
          disabled={!recipeText.trim() || catalog.loading}
          onClick={() => detect(recipeText)}
        >
          <ListPlus size={14} /> Pasar lo anotado a productos
        </button>
      </div>
      <RecipeImage form={form} onRead={detect} />
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-[1.6] text-gab-bad [&>svg]:mt-0.5 [&>svg]:shrink-0">
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </section>
  );
}
