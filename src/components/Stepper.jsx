// src/components/Stepper.jsx
import { useI18n } from '../i18n';
import './Stepper.css';

export default function Stepper({
  value = 0,
  min = 0,
  max = 999,
  step = 1,
  onChange,
  disabled = false,
  className = '',
}) {
  const { t } = useI18n();

  const clamp = (n) => Math.min(max, Math.max(min, n));

  const decrement = () => {
    if (disabled) return;
    onChange && onChange(clamp(value - step));
  };
  const increment = () => {
    if (disabled) return;
    onChange && onChange(clamp(value + step));
  };
  const handleChange = (e) => {
    const n = parseFloat(e.target.value);
    if (Number.isNaN(n)) return;
    onChange && onChange(clamp(n));
  };

  return (
    <div
      className={`stepper ${className}`.trim()}
      aria-live="polite"
    >
      <button
        type="button"
        className="stepper__btn stepper__btn--minus"
        onClick={decrement}
        disabled={disabled || value <= min}
        aria-label={t('common.delete')}
      >
        −
      </button>
      <input
        type="number"
        className="stepper__input"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        inputMode="decimal"
      />
      <button
        type="button"
        className="stepper__btn stepper__btn--plus"
        onClick={increment}
        disabled={disabled || value >= max}
        aria-label={t('common.add')}
      >
        +
      </button>
    </div>
  );
}