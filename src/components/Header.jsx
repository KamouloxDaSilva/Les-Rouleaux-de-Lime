// src/components/Header.jsx
import { useI18n } from '../i18n';
import LanguageSwitch from './LanguageSwitch';
import './Header.css';

export default function Header({ onSettingsClick }) {
  const { t } = useI18n();

  return (
    <header className="app-header">
      <img
        src="/assets/logo-burihagio.png"
        alt={t('app.name')}
        className="app-logo"
      />

      <div className="app-header-actions">
        <LanguageSwitch />

        <button
          type="button"
          className="app-header-settings"
          onClick={onSettingsClick}
          aria-label={t('nav.settings')}
        >
          <span className="app-header-settings__emoji" aria-hidden="true">
            ⚙️
          </span>
        </button>
      </div>
    </header>
  );
}