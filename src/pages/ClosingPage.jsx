// src/pages/ClosingPage.jsx
// Chantier 21 — Clôture v3 (calendrier + bilan)
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useI18n } from '../i18n';
import {
  WEATHER_OPTIONS,
  MENU_CATEGORIES,
  createDailyClosing,
  getActiveRestaurant,
} from '../data/model.js';
import { loadDataset, saveDataset } from '../data/storage.js';
import { createDefaultFixtures } from '../data/fixtures.js';
import { getDishSellingPrice, getDishFoodCost } from '../data/calculations.js';
import CalendarStrip from '../components/CalendarStrip.jsx';
import Stepper from '../components/Stepper.jsx';
import PillSelector from '../components/PillSelector.jsx';
import Toast from '../components/Toast.jsx';
import Badge from '../components/Badge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import './ClosingPage.css';

const CLOSING_CATEGORIES = [
  { id: 'dish', i18nKey: 'menu.sections.dish' },
  { id: 'drink', i18nKey: 'menu.sections.drink' },
  { id: 'dessert', i18nKey: 'menu.sections.dessert' },
  { id: 'sauce', i18nKey: 'menu.sections.sauce' },
];

const WEATHER_EMOJIS = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  stormy: '⛈️',
};

function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ClosingPage() {
  const { t, formatCurrency } = useI18n();

  const [dataset, setDataset] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weather, setWeather] = useState('');
  const [notes, setNotes] = useState('');
  const [sales, setSales] = useState({});
  const [activeCategory, setActiveCategory] = useState('dish');
  const [toast, setToast] = useState({ open: false, message: '', variant: 'info' });

  const selectedDateStr = useMemo(
    () => formatDateString(selectedDate),
    [selectedDate]
  );

  const locale = t('home.locale');

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(selectedDate);
    } catch (e) {
      return '';
    }
  }, [selectedDate, locale]);

  // ── Chargement initial du dataset ────────────────────────────
  useEffect(() => {
    const loaded = loadDataset();
    const isEmpty = loaded.dishes.length === 0 && loaded.daily_closings.length === 0;
    const initial = isEmpty ? createDefaultFixtures() : loaded;
    if (isEmpty) {
      try { saveDataset(initial); } catch (e) { console.warn(e); }
    }
    setDataset(initial);
  }, []);

  const restaurant = useMemo(
    () => (dataset ? getActiveRestaurant(dataset) : null),
    [dataset]
  );

  // ── Plats à afficher : actifs + inactifs ayant déjà des ventes
  //    dans la clôture sélectionnée (préserve l'historique) ───────
  const closingDishes = useMemo(() => {
    if (!dataset || !restaurant) return [];
    const existing = dataset.daily_closings.find((c) => c.date === selectedDateStr);
    const soldIds = new Set((existing?.sales || []).map((s) => s.dish_id));
    return dataset.dishes.filter((d) => {
      if (!d || d.restaurant_id !== restaurant.id) return false;
      if (!MENU_CATEGORIES.includes(d.category)) return false;
      return d.active === true || soldIds.has(d.id);
    });
  }, [dataset, restaurant, selectedDateStr]);

  const activeDishes = useMemo(
    () => closingDishes.filter((d) => d.category === activeCategory),
    [closingDishes, activeCategory]
  );

  const isAlreadyClosed = useMemo(() => {
    if (!dataset) return false;
    return dataset.daily_closings.some((c) => c.date === selectedDateStr);
  }, [dataset, selectedDateStr]);

  // ── Re-sync du formulaire quand la date change ───────────────
  useEffect(() => {
    if (!dataset) return;
    const existing = dataset.daily_closings.find((c) => c.date === selectedDateStr);
    if (existing) {
      setWeather(existing.weather || '');
      setNotes(existing.notes || '');
      const map = {};
      (existing.sales || []).forEach((s) => {
        map[s.dish_id] = s.quantity_sold ?? 0;
      });
      setSales(map);
    } else {
      setWeather('');
      setNotes('');
      setSales({});
    }
  }, [selectedDateStr, dataset]);

  // ── Helpers prix / coût ──────────────────────────────────────
  const getEffectivePrice = useCallback(
    (dish) => {
      if (!dataset || !dish) return 0;
      return getDishSellingPrice(dataset, dish, selectedDateStr);
    },
    [dataset, selectedDateStr]
  );

  // ── Bilan temps réel ─────────────────────────────────────────
  const summary = useMemo(() => {
    if (!dataset) {
      return { revenue: 0, items: 0, foodCost: 0, margin: 0, marginPct: 0 };
    }
    const ingredients = dataset.ingredients || [];
    let revenue = 0;
    let items = 0;
    let foodCost = 0;
    closingDishes.forEach((dish) => {
      const sold = Number(sales[dish.id]) || 0;
      if (!sold) return;
      revenue += getDishSellingPrice(dataset, dish, selectedDateStr) * sold;
      items += sold;
      foodCost += getDishFoodCost(dish, ingredients) * sold;
    });
    const margin = revenue - foodCost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
    return { revenue, items, foodCost, margin, marginPct };
  }, [dataset, closingDishes, sales, selectedDateStr]);

  // ── Handlers ─────────────────────────────────────────────────
  const updateSale = useCallback((dishId, value) => {
    const n = Math.max(0, Number(value) || 0);
    setSales((prev) => ({ ...prev, [dishId]: n }));
  }, []);

  const handleSelectDate = useCallback((date) => {
    setSelectedDate(date);
  }, []);

  const closeToast = useCallback(
    () => setToast((prev) => ({ ...prev, open: false })),
    []
  );

  const handleSave = useCallback(() => {
    if (!dataset || !restaurant) return;

    const salesArray = closingDishes
      .map((dish) => ({
        dish_id: dish.id,
        quantity_sold: Number(sales[dish.id]) || 0,
      }))
      .filter((s) => s.quantity_sold > 0);

    const nextClosings = [...dataset.daily_closings];
    const idx = nextClosings.findIndex((c) => c.date === selectedDateStr);

    if (idx >= 0) {
      nextClosings[idx] = {
        ...nextClosings[idx],
        weather,
        notes,
        sales: salesArray,
        updatedAt: new Date().toISOString(),
      };
    } else {
      nextClosings.push(
        createDailyClosing({
          restaurant_id: restaurant.id,
          date: selectedDateStr,
          weather,
          notes,
          sales: salesArray,
        })
      );
    }

    const nextDataset = { ...dataset, daily_closings: nextClosings };
    try {
      saveDataset(nextDataset);
      setDataset(nextDataset);
      setToast({
        open: true,
        message: t('closing.saveSuccess'),
        variant: 'success',
      });
    } catch (e) {
      setToast({
        open: true,
        message: e?.message || t('common.error'),
        variant: 'error',
      });
    }
  }, [
    dataset,
    restaurant,
    closingDishes,
    sales,
    selectedDateStr,
    weather,
    notes,
    t,
  ]);

  if (!dataset || !restaurant) {
    return (
      <div className="closing-page closing-page--loading">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const categoryOptions = CLOSING_CATEGORIES.map((c) => ({
    value: c.id,
    label: t(c.i18nKey),
  }));

  return (
    <div className="closing-page">
      <Toast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={closeToast}
      />

      <h1 className="closing-title">{t('closing.title')}</h1>

      {/* Bande semaine + sélection jour */}
      <CalendarStrip
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
      />

      {/* Indicateur informatif (modification libre même après minuit) */}
      {isAlreadyClosed && (
        <div className="closing-status" role="status">
          <span className="closing-status__icon" aria-hidden="true">🔒</span>
          <span className="closing-status__text">{t('closing.alreadyClosed')}</span>
        </div>
      )}

      {/* Météo */}
      <section className="closing-section">
        <span className="closing-label">{t('closing.weather')}</span>
        <div
          className="weather-grid"
          role="radiogroup"
          aria-label={t('closing.weather')}
        >
          {WEATHER_OPTIONS.map((w) => {
            const checked = weather === w;
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={checked}
                className={
                  'weather-option' + (checked ? ' weather-option--active' : '')
                }
                onClick={() => setWeather(w)}
              >
                <span className="weather-option__emoji" aria-hidden="true">
                  {WEATHER_EMOJIS[w]}
                </span>
                <span className="weather-option__label">
                  {t(`closing.weatherOptions.${w}`)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Bilan temps réel */}
      <section className="closing-section">
        <div className="summary-header">
          <span className="closing-label" style={{ marginBottom: 0 }}>
            {t('closing.daySummary')}
          </span>
          <span className="summary-date">{formattedDate}</span>
        </div>

        <div className="closing-summary-grid">
          <div className="summary-stat summary-stat--wide">
            <span className="summary-stat__label">
              {t('stats.metrics.revenue')}
            </span>
            <span className="summary-stat__value summary-stat__value--orange">
              {formatCurrency(summary.revenue)}
            </span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat__label">
              {t('stats.metrics.items')}
            </span>
            <span className="summary-stat__value">{summary.items}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat__label">
              {t('stats.metrics.foodCost')}
            </span>
            <span className="summary-stat__value">
              {formatCurrency(summary.foodCost)}
            </span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat__label">
              {t('stats.metrics.margin')}
            </span>
            <span className="summary-stat__value summary-stat__value--blue">
              {formatCurrency(summary.margin)}
            </span>
          </div>
          <div className="summary-stat">
            <span className="summary-stat__label">
              {t('stats.metrics.marginPct')}
            </span>
            <span className="summary-stat__value">
              {summary.marginPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </section>

      {/* Ventes par catégorie */}
      <section className="closing-section">
        <h2 className="closing-section__title">{t('closing.sales')}</h2>

        <PillSelector
          value={activeCategory}
          options={categoryOptions}
          onChange={setActiveCategory}
          ariaLabel={t('closing.sales')}
        />

        {activeDishes.length === 0 ? (
          <EmptyState
            emoji="🍽️"
            title={t('menu.empty')}
            desc={t('closing.dishName')}
          />
        ) : (
          <ul className="closing-dishes">
            {activeDishes.map((dish) => {
              const sold = Number(sales[dish.id]) || 0;
              const basePrice = Number(dish.price) || 0;
              const effectivePrice = getEffectivePrice(dish);
              const hasPromo =
                effectivePrice > 0 && effectivePrice < basePrice;

              return (
                <li key={dish.id} className="closing-dish-item">
                  <div className="dish-info">
                    <div className="dish-name-row">
                      <span className="dish-name">{dish.name}</span>
                      {hasPromo && <Badge variant="promo">PROMO</Badge>}
                    </div>
                    <div className="dish-price-row">
                      {hasPromo ? (
                        <>
                          <span className="dish-price dish-price--original">
                            {formatCurrency(basePrice)}
                          </span>
                          <span className="dish-price dish-price--effective">
                            {formatCurrency(effectivePrice)}
                          </span>
                        </>
                      ) : (
                        <span className="dish-price">
                          {formatCurrency(basePrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <Stepper
                    value={sold}
                    min={0}
                    max={999}
                    onChange={(v) => updateSale(dish.id, v)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Notes libres */}
      <section className="closing-section">
        <label className="closing-label" htmlFor="closing-notes">
          {t('closing.notes')}
        </label>
        <textarea
          id="closing-notes"
          className="closing-notes"
          rows={3}
          placeholder={t('closing.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      {/* Footer fixe : total + save */}
      <div className="closing-footer">
        <div className="closing-footer__total">
          <span>{t('stats.metrics.revenue')}</span>
          <strong>{formatCurrency(summary.revenue)}</strong>
        </div>
        <button
          type="button"
          className="closing-save-btn"
          onClick={handleSave}
        >
          {t('closing.saveButton')}
        </button>
      </div>
    </div>
  );
}