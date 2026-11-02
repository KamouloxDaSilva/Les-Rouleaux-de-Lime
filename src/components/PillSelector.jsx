// src/components/PillSelector.jsx
import './PillSelector.css';

export default function PillSelector({
  value,
  options = [],
  onChange,
  className = '',
  ariaLabel,
}) {
  return (
    <div
      className={`pill-selector ${className}`.trim()}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value;
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        const checked = optValue === value;
        return (
          <button
            key={String(optValue)}
            type="button"
            role="radio"
            aria-checked={checked}
            className={`pill-selector__pill ${checked ? 'pill-selector__pill--active' : ''}`.trim()}
            onClick={() => onChange && onChange(optValue)}
          >
            {optLabel}
          </button>
        );
      })}
    </div>
  );
}