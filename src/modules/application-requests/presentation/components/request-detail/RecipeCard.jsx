import { FlaskConical } from 'lucide-react';
import { formatNumber } from '../../../../../shared/formatting/formatters.js';
import { sectionClass } from './DetailSection.jsx';
import RecipeImage from './RecipeImage.jsx';

const amount = (value) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(Number(value || 0));

const withUnit = (value, unit, suffix = '') => `${amount(value)}${unit ? ` ${unit}` : ''}${suffix}`;

// Dosis por hectárea y total para la superficie; sin dosis, se remite a la receta anotada.
const doseCells = (product, hectares) =>
  product.dose_per_hectare == null
    ? ['Según receta', '—']
    : [
        withUnit(product.dose_per_hectare, product.uom, ' / ha'),
        withUnit(product.dose_per_hectare * Number(hectares), product.uom),
      ];

const label = 'text-[10px] font-semibold tracking-[0.6px] text-gab-muted uppercase';
const cell = 'border-t border-gab-line px-3 py-2.5 align-top';
const numeric = 'text-right font-mono tabular-nums whitespace-nowrap';

function ProductsTable({ products, hectares }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">Productos de la receta con su dosis y su total</caption>
        <thead>
          <tr className="bg-gab-bg text-left">
            <th scope="col" className={`${label} w-8 px-3 py-2`}>
              #
            </th>
            <th scope="col" className={`${label} px-3 py-2`}>
              Producto
            </th>
            <th scope="col" className={`${label} px-3 py-2 text-right`}>
              Dosis
            </th>
            <th scope="col" className={`${label} px-3 py-2 text-right`}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => {
            const [dose, total] = doseCells(product, hectares);
            return (
              <tr key={product.odoo_product_id ?? product.name}>
                <td className={`${cell} text-gab-muted`}>{index + 1}</td>
                <th scope="row" className={`${cell} text-left font-medium break-words`}>
                  {product.name}
                </th>
                <td className={`${cell} ${numeric}`}>{dose}</td>
                <td className={`${cell} ${numeric} font-semibold`}>{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Lo anotado, renglón por renglón.
function Notes({ text }) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    <div className="border-t border-gab-line px-4 py-3">
      <p className={label}>Receta</p>
      <ul className="mt-1.5 list-none p-0 text-[13px] leading-[1.7]">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`} className="break-words">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Receta de la solicitud como documento: encabezado con folio y superficie, tabla de productos
// con dosis y total, y la receta anotada (o leída de la foto).
export default function RecipeCard({ data, onLoadImage, onDownloadImage }) {
  const products = data.products ?? [];
  const imageOnly = Boolean(data.recipe_file) && !products.length && !data.recipe_text;
  return (
    <section className={sectionClass} aria-labelledby="recipe-card-title">
      <div className="overflow-hidden rounded-lg border border-gab-line bg-gab-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-gab-accent bg-gab-accent-soft px-4 py-3">
          <h3
            id="recipe-card-title"
            className="flex items-center gap-2 font-title text-sm font-bold text-gab-accent"
          >
            <FlaskConical size={17} aria-hidden="true" />
            Receta de aplicación
          </h3>
          <p className="text-[11px] text-gab-muted">
            {data.folio} · {data.lot} ·{' '}
            <b className="text-gab-ink">{formatNumber(data.hectares)} ha</b>
          </p>
        </header>

        {products.length > 0 && <ProductsTable products={products} hectares={data.hectares} />}
        {data.recipe_text && <Notes text={data.recipe_text} />}
        {/* La imagen original solo se muestra si es lo único que hay: sin ella no se vería nada. */}
        {imageOnly && (
          <div className="px-4 py-3">
            <RecipeImage
              file={data.recipe_file}
              onLoad={onLoadImage}
              onDownload={onDownloadImage}
            />
          </div>
        )}
      </div>
    </section>
  );
}
