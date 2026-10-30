// src/components/BottomNav.jsx
import { useI18n } from '../i18n';
import './BottomNav.css';

const TABS = [
  { id: 'home', icon: '🏠', labelKey: 'nav.home' }, // Accueil
  { id: 'menu', icon: '📋', labelKey: 'nav.menu' }, // Menu
  { id: 'closing', icon: '➕', labelKey: 'nav.closing', center: true }, // Clôture (Bouton Central)
  { id: 'team', icon: '👥', labelKey: 'nav.team' }, // Mon équipe
  { id: 'stats', icon: '📊', labelKey: 'nav.stats' }, // Statistiques
];

export default function BottomNav({ activeTab, onTabChange }) {
  const { t } = useI18n();

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        if (tab.center) {
          return (
            <button
              key={tab.id}
              className={`nav-item nav-item--center ${activeTab === tab.id ? 'nav-item--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="nav-center-icon">{tab.icon}</span>
            </button>
          );
        }
        return (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'nav-item--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}