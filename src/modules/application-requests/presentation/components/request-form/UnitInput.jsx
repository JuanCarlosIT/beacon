import { unitInput, unitLabel } from './formStyles.js';

// Input numérico con la unidad (ha, MXN) dentro del campo.
export default function UnitInput({ unit, ...props }) {
  return (
    <div className="relative">
      <input
        {...props}
        type="number"
        className={unitInput}
        inputMode="decimal"
        min="0.01"
        step="0.01"
      />
      <span className={unitLabel}>{unit}</span>
    </div>
  );
}
