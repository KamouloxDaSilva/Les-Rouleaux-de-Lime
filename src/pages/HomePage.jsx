// src/pages/HomePage.jsx
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { loadDataset } from '../data/storage';
import { getActiveRestaurant } from '../data/model';
import './HomePage.css';

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function computeDishFoodCost(dish, ingredientMap) {
  if (!dish || !Array.isArray(dish.recipe)) return 0;
  let total = 0;
  for (const r of dish.recipe) {
    const ing = ingredientMap.get(r.ingredient_id);
    if (!ing) continue;
    const qty = Number(r.quantity) || 0;
    const cost = Number(ing.unit_cost) || 0;
    total += qty * cost;
  }
  return total;
}

export default function HomePage({ onNavigate }) {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [mascotOk, setMascotOk] = useState(true);

  const dataset = useMemo(() => {
    try {
      const data = loadDataset();
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[HomePage] loadDataset failed:', e);
      return {};
    }
  }, []);

  const closings  = Array.isArray(dataset.daily_closings) ? dataset.daily_closings : [];
  const dishes    = Array.isArray(dataset.dishes) ? dataset.dishes : [];
  const ingredients = Array.isArray(dataset.ingredients) ? dataset.ingredients : [];

  const dishMap       = useMemo(() => new Map(dishes.map(d => [d.id, d])), [dishes]);
  const ingredientMap = useMemo(() => new Map(ingredients.map(i => [i.id, i])), [ingredients]);

  const activeRestaurant = getActiveRestaurant(dataset);
  const currency = activeRestaurant?.currency || 'VND';

  const today  = new Date();
  const locale = t('home.locale');
  const days   = t('home.days');

  const startOfWeek = new Date(today);
  const dow = today.getDay();
  startOfWeek.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const selectedIso = toIsoDate(selectedDate);
  const closing = closings.find(c => c.date === selectedIso) || null;

  const dayStats = useMemo(() => {
    if (!closing || !Array.isArray(closing.sales)) {
      return { revenue: 0, margin: 0, itemsSold: 0 };
    }
    let revenue = 0;
    let foodCost = 0;
    let itemsSold = 0;
    for (const s of closing.sales) {
      const dish = dishMap.get(s.dish_id);
      const qty = Number(s.quantity_sold) || 0;
      itemsSold += qty;
      if (!dish) continue;
      const price = Number(dish.price) || 0;
      const unitFood = computeDishFoodCost(dish, ingredientMap);
      revenue  += qty * price;
      foodCost += qty * unitFood;
    }
    return { revenue, margin: revenue - foodCost, itemsSold };
  }, [closing, dishMap, ingredientMap]);

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

  const weekLabel = `${t('home.timeline.weekOf')} ${startOfWeek.toLocaleString(locale, {
    day: 'numeric',
    month: 'long',
  })}`;

  return (
    <div className="home-page">
      <header className="home-header">
        <h1>
          {today.getDate()}{' '}
          {today.toLocaleString(locale, { month: 'long' })}{' '}
          <span>{today.getFullYear()}</span>
        </h1>
      </header>

      <section className="timeline" aria-label={weekLabel}>
        <div className="timeline__caption">{weekLabel}</div>
        <div className="timeline__days">
          {weekDays.map((d, index) => {
            const isWeekend = index >= 5;
            const isActive = isSameDay(d, selectedDate);
            return (
              <button
                key={index}
                type="button"
                className={
                  'day-card' +
                  (isWeekend ? ' day-card--weekend' : '') +
                  (isActive ? ' day-card--active' : '')
                }
                onClick={() => setSelectedDate(d)}
                aria-pressed={isActive}
                aria-label={`${days[index]} ${d.getDate()}`}
              >
                <span className="day-card__label">{days[index]}</span>
                <span className="day-card__number">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </section>

      {closing ? (
        <section className="summary">
          <h2 className="summary__title">{t('home.todaySummary')}</h2>
          <div className="summary__grid">
            <div className="summary__card summary__card--revenue">
              <span className="summary__label">{t('home.summary.revenue')}</span>
              <span className="summary__value">{formatMoney(dayStats.revenue)}</span>
            </div>
            <div className="summary__card summary__card--margin">
              <span className="summary__label">{t('home.summary.margin')}</span>
              <span className="summary__value">{formatMoney(dayStats.margin)}</span>
            </div>
            <div className="summary__card summary__card--items">
              <span className="summary__label">{t('home.summary.itemsSold')}</span>
              <span className="summary__value">{dayStats.itemsSold}</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="empty">
          {mascotOk ? (
            <img
              src="/assets/personnages/mascot-empty.webp"
              alt=""
              className="empty__mascot"
              onError={() => setMascotOk(false)}
            />
          ) : (
            <div className="empty__emoji" aria-hidden="true">🍽️</div>
          )}
          <h3 className="empty__title">{t('home.empty.title')}</h3>
          <p className="empty__desc">{t('home.empty.desc')}</p>
          <button
            type="button"
            className="empty__cta"
            onClick={() => onNavigate?.('closing')}
          >
            {t('home.empty.cta')}
          </button>
        </section>
      )}

      <section className="quick-actions">
        <button
          type="button"
          className="action-btn action-btn--close"
          onClick={() => onNavigate?.('closing')}
        >
          <span className="action-btn__icon">⏰</span>
          <span>{t('home.actions.close')}</span>
        </button>
        <button
          type="button"
          className="action-btn action-btn--expense"
          onClick={() => onNavigate?.('team')}
        >
          <span className="action-btn__icon">💰</span>
          <span>{t('home.actions.expense')}</span>
        </button>
        <button
          type="button"
          className="action-btn action-btn--stats"
          onClick={() => onNavigate?.('stats')}
        >
          <span className="action-btn__icon">📊</span>
          <span>{t('home.actions.stats')}</span>
        </button>
      </section>
    </div>
  );
}