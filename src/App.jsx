// src/App.jsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import ThemeToggle from './components/ThemeToggle';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import { loadDataset } from './data/storage.js';
import { getActiveRestaurant } from './data/model.js';
import { useI18n } from './i18n';
import { applyThemeClass, readTheme } from './utils/theme';
import './styles/global.css';

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
  const [phase, setPhase] = useState('splash');

  // ==========================================================
  // Chantier 33 — Navigation PWA & double-tap exit
  // ==========================================================
  const [exitWarning, setExitWarning] = useState(false);
  const exitArmedRef = useRef(false);
  const exitTimerRef = useRef(null);
  const skipPushRef = useRef(false);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // ==========================================================
  // Chantier 32-A — Bootstrap du thème AVANT le premier paint.
  // useLayoutEffect pour éviter tout flash (FOUC) si splash rapide.
  // ==========================================================
  useLayoutEffect(() => {
    applyThemeClass(readTheme());
  }, []);

  const handleSplashFinish = useCallback(() => {
    setPhase(isDatasetEmpty() ? 'firstLaunch' : 'ready');
  }, []);

  const handleFirstLaunchDone = useCallback(() => {
    setPhase('ready');
  }, []);

  // Scroll reset au changement d'onglet (Chantier 12)
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [activeTab]);

  // ==========================================================
  // Chantier 33 — Push d'état à chaque changement d'onglet
  // (sauf quand le changement vient d'un popstate)
  // ==========================================================
  useEffect(() => {
    if (phase !== 'ready') return;
    if (skipPushRef.current) {
      skipPushRef.current = false;
      return;
    }
    try {
      window.history.pushState({ tab: activeTab }, '');
    } catch (e) { /* ignore */ }
  }, [activeTab, phase]);

  // ==========================================================
  // Chantier 33 — Interception du bouton retour (popstate)
  // ==========================================================
  useEffect(() => {
    if (phase !== 'ready') return;

    const handlePopState = (event) => {
      const nextTab = event.state?.tab;

      // Cas 1 : on revient à un onglet précis
      if (nextTab && nextTab !== activeTab) {
        skipPushRef.current = true;
        setActiveTab(nextTab);
        return;
      }

      // Cas 2 : pas de state → fallback home
      if (activeTab !== 'home') {
        skipPushRef.current = true;
        setActiveTab('home');
        return;
      }

      // Cas 3 : sur Home → double-tap pour quitter
      if (exitArmedRef.current) {
        // Deuxième appui dans les 2s → fermer
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
        exitArmedRef.current = false;
        setExitWarning(false);
        try { window.close(); } catch (e) { /* ignore */ }
        // Fallback : remplacer le body (iOS PWA ne supporte pas window.close)
        try {
          document.body.innerHTML =
            '<div style="padding:40px;text-align:center;font-family:sans-serif;background:#FAEBD5;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#2C2C2C;">' +
            tRef.current('common.canCloseApp') +
            '</div>';
        } catch (e) { /* ignore */ }
        return;
      }

      // Premier appui → armer + toast + re-push pour permettre le 2e appui
      exitArmedRef.current = true;
      setExitWarning(true);
      try { window.history.pushState({ tab: 'home' }, ''); } catch (e) { /* ignore */ }
      exitTimerRef.current = setTimeout(() => {
        exitArmedRef.current = false;
        setExitWarning(false);
        exitTimerRef.current = null;
      }, 2000);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [activeTab, phase]);

  if (phase === 'splash') {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (phase === 'firstLaunch') {
    return <FirstLaunchScreen onDone={handleFirstLaunchDone} />;
  }

  return (
    <ErrorBoundary>
      <div className="app-container" style={{ paddingTop: 'var(--header-height)' }}>
        <Header onSettingsClick={() => setShowSettings(true)} />

        <main style={{ padding: '16px', paddingBottom: '100px' }}>
          <div className="page-transition" key={activeTab}>
            {activeTab === 'home' && <HomePage onChangeTab={setActiveTab} />}
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
              background: 'var(--color-cream)',
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
                background: 'var(--color-blue)',
                color: '#FFFFFF',
                fontSize: '1.6rem',
                fontWeight: 700,
                cursor: 'pointer',
                zIndex: 501,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                boxShadow: 'var(--shadow-blue)',
              }}
            >
              ×
            </button>
            <ThemeToggle />
            <SettingsPage />
          </div>
        )}

        <Toast
          open={exitWarning}
          message={t('common.exitWarning')}
          variant="info"
          duration={2000}
          onClose={() => setExitWarning(false)}
        />
      </div>
    </ErrorBoundary>
  );
}