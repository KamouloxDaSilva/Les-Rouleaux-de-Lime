// src/components/SplashScreen.jsx
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import './SplashScreen.css';

export default function SplashScreen({ onFinish }) {
  const { t } = useI18n();
  const [imgError, setImgError] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const showMs = reduced ? 0 : 1500;
    const fadeMs = reduced ? 0 : 300;

    const tShow = setTimeout(() => setFading(true), showMs);
    const tDone = setTimeout(() => {
      if (typeof onFinish === 'function') onFinish();
    }, showMs + fadeMs);

    return () => {
      clearTimeout(tShow);
      clearTimeout(tDone);
    };
  }, [onFinish]);

  return (
    <div
      className={`splash ${fading ? 'splash--fading' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="splash__card">
        {imgError ? (
          <span className="splash__fallback">Burihagio</span>
        ) : (
          <img
            src="/assets/logo-burihagio.png"
            alt={t('app.name')}
            className="splash__logo"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <p className="splash__tagline">{t('splash.tagline')}</p>
    </div>
  );
}