// src/components/SearchBar.jsx
import { useI18n } from '../i18n';
import './SearchBar.css';

export default function SearchBar({
  value = '',
  onChange,
  placeholder = '',
  ariaLabel,
  className = '',
  disabled = false,
}) {
  const { t } = useI18n();

  const clear = () => { onChange && onChange(''); };

  return (
    <div className={`searchbar ${className}`.trim()}>
      <span className="searchbar__icon" aria-hidden="true">🔍</span>
      <input
        type="search"
        className="searchbar__input"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
      />
      {value && (
        <button
          type="button"
          className="searchbar__clear"
          onClick={clear}
          aria-label={t('common.close')}
        >
          ×
        </button>
      )}
    </div>
  );
}