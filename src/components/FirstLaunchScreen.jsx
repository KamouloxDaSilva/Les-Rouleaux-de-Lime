// src/components/FirstLaunchScreen.jsx
import { useState } from 'react';
import { useI18n } from '../i18n';
import {
  saveDataset,
  resetDataset,
  importDatasetFromJSON,
} from '../data/storage.js';
import { createDefaultFixtures } from '../data/fixtures.js';
import './FirstLaunchScreen.css';

export default function FirstLaunchScreen({ onDone }) {
  const { t } = useI18n();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mascotError, setMascotError] = useState(false);

  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = importDatasetFromJSON(String(reader.result || ''));
        if (!result.ok) {
          setError(t('firstLaunch.importError'));
          setBusy(false);
          return;
        }
        saveDataset(result.dataset);
        if (typeof onDone === 'function') onDone();
      } catch (err) {
        setError(t('firstLaunch.importError'));
        setBusy(false);
      }
    };
    reader.onerror = () => {
      setError(t('firstLaunch.importError'));
      setBusy(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStartFresh = () => {
    try {
      resetDataset();
      if (typeof onDone === 'function') onDone();
    } catch (err) {
      setError(t('firstLaunch.importError'));
    }
  };

  const handleUseDemo = () => {
    try {
      const fixtures = createDefaultFixtures();
      saveDataset(fixtures);
      if (typeof onDone === 'function') onDone();
    } catch (err) {
      setError(t('firstLaunch.importError'));
    }
  };

  return (
    <div className="first-launch">
      <div className="first-launch__inner">
        <div className="first-launch__mascot" aria-hidden="true">
          {!mascotError && (
            <img
              src="/assets/personnages/mascot-empty.webp"
              alt=""
              onError={() => setMascotError(true)}
            />
          )}
          {mascotError && <span className="first-launch__emoji">🍽️</span>}
        </div>

        <h1 className="first-launch__title">{t('firstLaunch.title')}</h1>
        <p className="first-launch__subtitle">{t('firstLaunch.subtitle')}</p>

        {error && <div className="first-launch__error">{error}</div>}

        <div className="first-launch__actions">
          <label
            className={`first-launch__btn first-launch__btn--primary ${
              busy ? 'is-busy' : ''
            }`}
          >
            <span className="first-launch__btn-icon" aria-hidden="true">📥</span>
            <span className="first-launch__btn-label">{t('firstLaunch.import')}</span>
            <span className="first-launch__btn-hint">{t('firstLaunch.importHint')}</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              hidden
              disabled={busy}
            />
          </label>

          <button
            type="button"
            className="first-launch__btn first-launch__btn--secondary"
            onClick={handleStartFresh}
            disabled={busy}
          >
            <span className="first-launch__btn-icon" aria-hidden="true">🆕</span>
            <span className="first-launch__btn-label">{t('firstLaunch.startFresh')}</span>
            <span className="first-launch__btn-hint">{t('firstLaunch.startFreshHint')}</span>
          </button>

          <button
            type="button"
            className="first-launch__btn first-launch__btn--tertiary"
            onClick={handleUseDemo}
            disabled={busy}
          >
            <span className="first-launch__btn-icon" aria-hidden="true">🎬</span>
            <span className="first-launch__btn-label">{t('firstLaunch.useDemo')}</span>
            <span className="first-launch__btn-hint">{t('firstLaunch.useDemoHint')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}