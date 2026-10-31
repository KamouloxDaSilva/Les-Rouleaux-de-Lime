// src/components/BottomNav.jsx
import { useI18n } from '../i18n';
import './BottomNav.css';

export default function BottomNav({ activeTab, onTabChange }) {
  const { t } = useI18n();

  return (
    <nav className="bottom-nav">
      <button
        type="button"
        className={`nav-item ${activeTab === 'home' ? 'nav-item--active' : ''}`}
        onClick={() => onTabChange('home')}
      >
        <span className="nav-icon">🏠</span>
        <span>{t('nav.home')}</span>
      </button>

      <button
        type="button"
        className={`nav-item ${activeTab === 'menu' ? 'nav-item--active' : ''}`}
        onClick={() => onTabChange('menu')}
      >
        <span className="nav-icon">📋</span>
        <span>{t('nav.menu')}</span>
      </button>

      {/* Bouton central surélevé */}
      <button
        type="button"
        className={`nav-item nav-item--center ${activeTab === 'closing' ? 'nav-item--active' : ''}`}
        onClick={() => onTabChange('closing')}
      >
        <span className="nav-center-icon">➕</span>
      </button>

      <button
        type="button"
        className={`nav-item ${activeTab === 'team' ? 'nav-item--active' : ''}`}
        onClick={() => onTabChange('team')}
      >
        <span className="nav-icon">👥</span>
        <span>{t('nav.team')}</span>
      </button>

      <button
        type="button"
        className={`nav-item ${activeTab === 'stats' ? 'nav-item--active' : ''}`}
        onClick={() => onTabChange('stats')}
      >
        <span className="nav-icon">📊</span>
        <span>{t('nav.stats')}</span>
      </button>
    </nav>
  );
}