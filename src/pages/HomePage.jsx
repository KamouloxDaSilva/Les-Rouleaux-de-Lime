// src/pages/HomePage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { loadDataset } from '../data/storage';
import { getActiveRestaurant } from '../data/model';
import {
  getLastClosings,
  getTodayKPIs,
  getLowStockIngredients,
} from '../data/stats';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import SkeletonLoader from '../components/SkeletonLoader';
import './HomePage.css';

const WEATHER_EMOJIS = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  stormy: '⛈️',
};

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLong(iso, locale) {
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function HomePage({ onChangeTab, onNavigate }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [mascotOk, setMascotOk] = useState(true);

  const navigate = onChangeTab || onNavigate;

  // Warn once if no navigate callback
  useEffect(() => {
    if (!navigate && typeof console !== 'undefined') {
      console.warn(
        '[HomePage] Aucun onChangeTab/onNavigate fourni — les boutons "Accès rapides" seront désactivés.'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charge le dataset une seule fois au mount
  const dataset = useMemo(() => {
    try {
      const data = loadDataset();
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      if (typeof console !== 'undefined') {
        console.warn('[HomePage] loadDataset failed:', e);
      }
      return {};
    }
  }, []);

  // SkeletonLoader 100ms artificiel (perception de chargement)
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  const activeRestaurant = getActiveRestaurant(dataset);
  const currency = activeRestaurant?.currency || 'VND';
  const locale = t('home.locale');

  const todayIso = toIsoDate(new Date());

  const todayKpis = useMemo(
    () => getTodayKPIs(dataset, todayIso),
    [dataset, todayIso]
  );
  const lowStock = useMemo(() => getLowStockIngredients(dataset), [dataset]);
  const lastClosings = useMemo(() => getLastClosings(dataset, 3), [dataset]);

  const mascotState = !todayKpis.hasClosing
    ? 'no_closing'
    : lowStock.length > 0
    ? 'critical'
    : 'ok';

  const formatMoney = (n) => {
    const value = Number(n) || 0;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${Math.round(value).toLocaleString(locale)} ${currency}`;
    }
  };

  const handleNavigate = (tab) => {
    if (navigate) navigate(tab);
  };

  // ── Skeleton ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="home-page">
        <SkeletonLoader variant="text" width="55%" />
        <SkeletonLoader variant="card" className="home-skeleton-gap" />
        <SkeletonLoader variant="card" className="home-skeleton-gap" />
        <SkeletonLoader variant="card" className="home-skeleton-gap" />
      </div>
    );
  }

  const today = new Date();
  const dateLabel = today.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const lowStockPreview = lowStock.slice(0, 3).map((i) => i.name).join(', ');
  const lowStockExtra =
    lowStock.length > 3 ? ` +${lowStock.length - 3}` : '';

  return (
    <div className="home-page">
      {/* ── 1. EN-TÊTE ─────────────────────────────────────── */}
      <header className="home-header">
        <h1 className="home-greeting">{t('home.greeting')}</h1>
        <p className="home-subtitle">{t('home.subtitle')}</p>
        <p className="home-date">{dateLabel}</p>
      </header>

      {/* ── 2. MASCOTTE DYNAMIQUE ──────────────────────────── */}
      <section
        className={`home-mascot home-mascot--${mascotState}`}
        aria-live="polite"
      >
        {mascotOk ? (
          <img
            src={
              mascotState === 'no_closing'
                ? '/assets/personnages/mascot-empty.webp'
                : mascotState === 'critical'
                ? '/assets/personnages/mascot-alert.webp'
                : '/assets/personnages/mascot-ok.webp'
            }
            alt=""
            className="home-mascot__img"
            onError={() => setMascotOk(false)}
          />
        ) : (
          <div className="home-mascot__emoji" aria-hidden="true">
            {mascotState === 'no_closing'
              ? '🍽️'
              : mascotState === 'critical'
              ? '⚠️'
              : '✅'}
          </div>
        )}
        <div className="home-mascot__text">
          {mascotState === 'no_closing' && (
            <>
              <h3>{t('home.empty.title')}</h3>
              <p>{t('home.empty.desc')}</p>
              <button
                type="button"
                className="home-mascot__cta"
                onClick={() => handleNavigate('closing')}
                disabled={!navigate}
              >
                {t('home.empty.cta')}
              </button>
            </>
          )}
          {mascotState === 'critical' && (
            <>
              <h3>{t('team.stockManagement.alert')}</h3>
              <p>
                {lowStockPreview}
                {lowStockExtra}
              </p>
              <button
                type="button"
                className="home-mascot__cta home-mascot__cta--warning"
                onClick={() => handleNavigate('team')}
                disabled={!navigate}
              >
                {t('nav.team')}
              </button>
            </>
          )}
          {mascotState === 'ok' && (
            <>
              <h3>{t('common.success')}</h3>
              <p>{t('home.todaySummary')}</p>
            </>
          )}
        </div>
      </section>

      {/* ── 3. KPI DU JOUR ─────────────────────────────────── */}
      <section className="home-kpi">
        <div className="home-kpi__header">
          <h2 className="home-section-title">{t('stats.today.title')}</h2>
          {!todayKpis.hasClosing && (
            <Badge variant="warning">{t('home.noClosingTitle')}</Badge>
          )}
        </div>
        <div className="home-kpi__grid">
          <div className="home-kpi__card home-kpi__card--revenue">
            <span className="home-kpi__label">
              {t('home.summary.revenue')}
            </span>
            <span className="home-kpi__value">
              {formatMoney(todayKpis.revenue)}
            </span>
          </div>
          <div className="home-kpi__card home-kpi__card--margin">
            <span className="home-kpi__label">
              {t('home.summary.margin')}
            </span>
            <span className="home-kpi__value">
              {formatMoney(todayKpis.margin)}
            </span>
          </div>
          <div className="home-kpi__card home-kpi__card--items">
            <span className="home-kpi__label">
              {t('home.summary.itemsSold')}
            </span>
            <span className="home-kpi__value">{todayKpis.itemsSold}</span>
          </div>
          <div className="home-kpi__card home-kpi__card--alert">
            <span className="home-kpi__label">
              {t('team.stockManagement.alert')}
            </span>
            <span className="home-kpi__value">{lowStock.length}</span>
          </div>
        </div>
      </section>

      {/* ── 4. DERNIÈRES CLÔTURES ──────────────────────────── */}
      <section className="home-history">
        <h2 className="home-section-title">{t('home.historyTitle')}</h2>
        {lastClosings.length === 0 ? (
          <EmptyState
            emoji="📋"
            title={t('home.empty.title')}
            desc={t('home.empty.desc')}
          />
        ) : (
          <ul className="home-history__list">
            {lastClosings.map((c) => (
              <li key={c.date} className="home-history__item">
                <button
                  type="button"
                  className="home-history__btn"
                  onClick={() => handleNavigate('closing')}
                  disabled={!navigate}
                  aria-label={formatDateLong(c.date, locale)}
                >
                  <span className="home-history__date">
                    {formatDateLong(c.date, locale)}
                  </span>
                  <span
                    className="home-history__weather"
                    aria-hidden="true"
                  >
                    {WEATHER_EMOJIS[c.weather] || '—'}
                  </span>
                  <span className="home-history__revenue">
                    {formatMoney(c.revenue)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 5. ALERTES STOCK (conditionnel) ────────────────── */}
      {lowStock.length > 0 && (
        <section className="home-alerts" role="alert">
          <div className="home-alerts__icon" aria-hidden="true">
            ⚠️
          </div>
          <div className="home-alerts__text">
            <strong>{t('team.stockManagement.outOfStock')}</strong>
            <span>
              {lowStockPreview}
              {lowStockExtra}
            </span>
          </div>
          <button
            type="button"
            className="home-alerts__cta"
            onClick={() => handleNavigate('team')}
            disabled={!navigate}
          >
            {t('nav.team')}
          </button>
        </section>
      )}

      {/* ── 6. ACCÈS RAPIDES ───────────────────────────────── */}
      <section className="home-quick">
        <button
          type="button"
          className="home-quick__btn home-quick__btn--close"
          onClick={() => handleNavigate('closing')}
          disabled={!navigate}
        >
          <span className="home-quick__icon" aria-hidden="true">
            ⏰
          </span>
          <span className="home-quick__label">
            {t('home.actions.close')}
          </span>
        </button>
        <button
          type="button"
          className="home-quick__btn home-quick__btn--stats"
          onClick={() => handleNavigate('stats')}
          disabled={!navigate}
        >
          <span className="home-quick__icon" aria-hidden="true">
            📊
          </span>
          <span className="home-quick__label">
            {t('home.actions.stats')}
          </span>
        </button>
        <button
          type="button"
          className="home-quick__btn home-quick__btn--team"
          onClick={() => handleNavigate('team')}
          disabled={!navigate}
        >
          <span className="home-quick__icon" aria-hidden="true">
            ⚙️
          </span>
          <span className="home-quick__label">{t('nav.team')}</span>
        </button>
        <button
          type="button"
          className="home-quick__btn home-quick__btn--menu"
          onClick={() => handleNavigate('menu')}
          disabled={!navigate}
        >
          <span className="home-quick__icon" aria-hidden="true">
            📖
          </span>
          <span className="home-quick__label">{t('nav.menu')}</span>
        </button>
      </section>
    </div>
  );
}