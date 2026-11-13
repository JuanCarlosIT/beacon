import { useState } from 'react';
import { Banknote, Save } from 'lucide-react';
import BusyIcon from '../../../../../shared/ui/BusyIcon.jsx';
import { formatMoney } from '../../../../../shared/formatting/formatters.js';
import { btnSecondary, cx, input } from '../../../../../shared/ui/classes.js';
import { sectionClass } from './DetailSection.jsx';

const isRate = (value) => Number(value) > 0 && Number(value) <= 100000000;

// Qué pasará con la tarifa escrita, según la autorizada del ciclo.
function effect(value, data) {
  if (!isRate(value)) return 'Pesos por hectárea, sin impuestos.';
  if (Number(value) === data.rate_per_hectare) return 'Es la tarifa que ya tiene la solicitud.';
  if (data.authorized_rate != null && Number(value) <= data.authorized_rate)
    return 'Se corrige de inmediato: no pasa de la tarifa autorizada del ciclo.';
  return 'Es mayor a la autorizada del ciclo: se pedirá autorización por WhatsApp y, mientras tanto, la solicitud conserva la tarifa actual.';
}

// Corrección de la tarifa por el gestor, por si se capturó mal. Bajarla es libre; subirla por
// encima de la autorizada del ciclo pide autorización.
export default function RateCorrection({ data, busy, onCorrect }) {
  const [value, setValue] = useState('');
  const changed = isRate(value) && Number(value) !== data.rate_per_hectare;

  async function submit(event) {
    event.preventDefault();
    if (!changed) return;
    if (await onCorrect(Number(value))) setValue('');
  }

  return (
    <section className={sectionClass} aria-labelledby="rate-correction-title">
      <h3
        id="rate-correction-title"
        className="flex items-center gap-2 font-title text-[13px] font-semibold text-gab-accent"
      >
        <Banknote size={16} aria-hidden="true" />
        Corregir tarifa
      </h3>
      <p className="mt-2 text-xs leading-[1.7] text-gab-muted">
        Tarifa actual: <b className="text-gab-ink">{formatMoney(data.rate_per_hectare)} MXN / ha</b>
        {data.authorized_rate != null &&
          ` · Autorizada del ciclo: ${formatMoney(data.authorized_rate)} MXN / ha`}
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="rate-correction">
          Nueva tarifa por hectárea
        </label>
        <input
          id="rate-correction"
          className={cx(input, 'w-[170px] font-mono max-sm:w-full')}
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Nueva tarifa"
          aria-describedby="rate-correction-effect"
        />
        <button type="submit" className={btnSecondary} disabled={busy || !changed}>
          <BusyIcon busy={busy} icon={Save} />
          Guardar tarifa
        </button>
      </form>
      <p
        id="rate-correction-effect"
        className="mt-2 text-[11px] leading-[1.7] text-gab-muted"
        role="status"
        aria-live="polite"
      >
        {effect(value, data)}
      </p>
    </section>
  );
}
