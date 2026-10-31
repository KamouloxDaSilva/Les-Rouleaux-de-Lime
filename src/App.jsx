// src/App.jsx
import { useCallback, useState } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import StatsPage from './pages/StatsPage';
import TeamPage from './pages/TeamPage';
import MenuPage from './pages/MenuPage';
import ClosingPage from './pages/ClosingPage';
import SettingsPage from './pages/SettingsPage';
import SplashScreen from './components/SplashScreen';
import FirstLaunchScreen from './components/FirstLaunchScreen';
import { loadDataset } from './data/storage.js';
import { getActiveRestaurant } from './data/model.js';
import { useI18n } from './i18n';
import './styles/global.css';

/**
 * Dataset vide = pas de restaurant actif OU aucun plat pour ce restaurant.
 * try/catch : si loadDataset() lance, on considère le dataset vide.
 */
function isDatasetEmpty() {
  try {
    const ds = loadDataset();
    if (!ds || !Array.isArray(ds.restaurants) || ds.restaurants.length === 0) return true;
    const resto = getActiveRestaurant(ds);
    if (!resto) return true;
    const rid = resto.id;
    const hasDishes = Array.isArray(ds.dishes) && ds.dishes.some((d) => d && d.restaurant_id === rid);
    return !hasDishes;
  } catch {
    return true;
  }
}

export default function App() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);
  const [phase, setPhase] = useState('splash'); // 'splash' | 'firstLaunch' | 'ready'

  const handleSplashFinish = useCallback(() => {
    setPhase(isDatasetEmpty() ? 'firstLaunch' : 'ready');
  }, []);

  const handleFirstLaunchDone = useCallback(() => {
    setPhase('ready');
  }, []);

  if (phase === 'splash') {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (phase === 'firstLaunch') {
    return <FirstLaunchScreen onDone={handleFirstLaunchDone} />;
  }

  return (
    <div className="app-container" style={{ paddingTop: 'var(--header-height)' }}>
      <Header onSettingsClick={() => setShowSettings(true)} />

      <main style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* Chantier 11-C — NE PAS RETIRER : key force le remontage et relance pageFade */}
        <div className="page-transition" key={activeTab}>
          {activeTab === 'home' && <HomePage />}
          {activeTab === 'stats' && <StatsPage />}
          {activeTab === 'team' && <TeamPage />}
          {activeTab === 'menu' && <MenuPage />}
          {activeTab === 'closing' && <ClosingPage />}
        </div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {showSettings && (
        <div
          className="settings-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.settings')}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#FAEBD5',
            zIndex: 500,
            overflowY: 'auto',
            padding: '16px',
            paddingTop: 'calc(var(--header-height) + 16px)',
            paddingBottom: '24px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            aria-label={t('common.close')}
            style={{
              position: 'fixed',
              top: 'calc(env(safe-area-inset-top) + 12px)',
              right: '16px',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              border: 'none',
              background: '#3C91A6',
              color: '#FFFFFF',
              fontSize: '1.6rem',
              fontWeight: 700,
              cursor: 'pointer',
              zIndex: 501,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              boxShadow: '0 4px 12px rgba(60,145,166,0.35)',
            }}
          >
            ×
          </button>
          <SettingsPage />
        </div>
      )}
    </div>
  );
}