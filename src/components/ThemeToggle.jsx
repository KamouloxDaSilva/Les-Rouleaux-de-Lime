// src/components/ThemeToggle.jsx
// Chantier 32-A — Sélecteur de thème 3 états (Système / Clair / Sombre).
// Affiche l'option active, applique immédiatement la classe sur <body>,
// persiste dans localStorage et émet un petit feedback haptique.
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import {
  THEME_VALUES, readTheme, writeTheme, applyThemeClass, hapticPulse,
} from '../utils/theme';
import './ThemeToggle.css';

const ICONS = { system: '🌓', light: '☀️', dark: '🌙' };

export default function ThemeToggle({ className = '' }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState(readTheme);

  // Applique au mount + à chaque changement
  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Suit la préférence système quand l'utilisateur est en mode "Système"
  useEffect(() => {
    if (theme !== 'system') return undefined;
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeClass('system');
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [theme]);

  const handle = (next) => {
    setTheme(next);
    writeTheme(next);
    applyThemeClass(next);
    hapticPulse(8);
  };

  return (
    <div className={`theme-toggle ${className}`.trim()}>
      <span className="theme-toggle__label">
        {t('settings.sections.appearance.title')}
      </span>
      <div
        className="theme-toggle__group"
        role="radiogroup"
        aria-label={t('settings.sections.appearance.title')}
      >
        {THEME_VALUES.map((opt) => {
          const active = theme === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              className={`theme-toggle__btn ${active ? 'theme-toggle__btn--active' : ''}`}
              onClick={() => handle(opt)}
            >
              <span className="theme-toggle__icon" aria-hidden="true">
                {ICONS[opt]}
              </span>
              <span className="theme-toggle__text">
                {t(`settings.sections.appearance.${opt}`)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}