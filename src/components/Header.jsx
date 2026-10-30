// src/components/Header.jsx
import { useI18n } from '../i18n';
import LanguageSwitch from './LanguageSwitch';
import './Header.css';

export default function Header() {
  const { t } = useI18n();

  return (
    <header className="app-header">
      {/* Remplacer le texte par l'image du logo */}
      <img 
        src="/assets/logo-burihagio.png" 
        alt={t('app.name')} 
        className="app-logo" 
      />
      <LanguageSwitch />
    </header>
  );
}