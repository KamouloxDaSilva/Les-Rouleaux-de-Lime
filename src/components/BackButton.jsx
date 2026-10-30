// src/components/BackButton.jsx
// Chantier 11-A — Bouton retour réutilisable (cercle bleu #3C91A6)
import { useI18n } from '../i18n';
import './BackButton.css';

export default function BackButton({ onClick, className = '' }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`back-button ${className}`.trim()}
      onClick={onClick}
      aria-label={t('common.back')}
    >
      <span aria-hidden="true">←</span>
    </button>
  );
}