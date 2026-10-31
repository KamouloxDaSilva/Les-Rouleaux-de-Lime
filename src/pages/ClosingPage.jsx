// src/pages/ClosingPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { WEATHER_OPTIONS, createDailyClosing, getActiveRestaurant } from '../data/model.js';
import { loadDataset, saveDataset } from '../data/storage.js';
import { createDefaultFixtures } from '../data/fixtures.js';
import './ClosingPage.css';

function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayString() {
  return formatDateString(new Date());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day; // lundi comme premier jour
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// La Clôture suit désormais les 4 catégories (Sauces incluses)
const CLOSING_CATEGORIES = [
  { id: 'dish', i18nKey: 'menu.sections.dish' },
  { id: 'drink', i18nKey: 'menu.sections.drink' },
  { id: 'dessert', i18nKey: 'menu.sections.dessert' },
  { id: 'sauce', i18nKey: 'menu.sections.sauce' },
];

export default function ClosingPage() {
  const { t, formatCurrency, locale } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [weather, setWeather] = useState('');
  const [notes, setNotes] = useState('');
  const [sales, setSales] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [activeCategory, setActiveCategory] = useState('dish');

  // Date affichée dans la bande semaine
  const [viewDate, setViewDate] = useState(() => new Date());

  useEffect(() => {
    const loaded = loadDataset();
    const isEmpty = loaded.dishes.length === 0 && loaded.daily_closings.length === 0;
    const initial = isEmpty ? createDefaultFixtures() : loaded;
    if (isEmpty) {
      try { saveDataset(initial); } catch (e) { console.warn(e); }
    }
    setDataset(initial);
  }, []);

  // Garde la semaine affichée synchronisée avec la date sélectionnée
  useEffect(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    if (year && month && day) {
      setViewDate(new Date(year, month - 1, day));
    }
  }, [selectedDate]);

  const restaurant = useMemo(() => dataset ? getActiveRestaurant(dataset) : null, [dataset]);

  // Tous les plats concernés par la clôture (4 catégories)
  const closingDishes = useMemo(() => {
    if (!dataset || !restaurant) return [];
    const categoryIds = CLOSING_CATEGORIES.map((c) => c.id);
    return dataset.dishes.filter(
      (d) => d.active && d.restaurant_id === restaurant.id && categoryIds.includes(d.category)
    );
  }, [dataset, restaurant]);

  // Plats affichés dans l'onglet actif
  const activeDishes = useMemo(() => {
    return closingDishes.filter((d) => d.category === activeCategory);
  }, [closingDishes, activeCategory]);

  useEffect(() => {
    if (!dataset) return;
    const existing = dataset.daily_closings.find((c) => c.date === selectedDate);
    if (existing) {
      setWeather(existing.weather || '');
      setNotes(existing.notes || '');
      const map = {};
      existing.sales.forEach((s) => { map[s.dish_id] = { sold: s.quantity_sold ?? 0 }; });
      setSales(map);
    } else {
      setWeather('');
      setNotes('');
      setSales({});
    }
    setFeedback(null);
  }, [selectedDate, dataset]);

  function updateSale(dishId, field, value) {
    setSales((prev) => ({
      ...prev,
      [dishId]: { ...(prev[dishId] || {}), [field]: value },
    }));
  }

  function bumpSale(dishId, field, delta) {
    setSales((prev) => {
      const current = prev[dishId] || { sold: 0 };
      const nextVal = Math.max(0, (current[field] ?? 0) + delta);
      return { ...prev, [dishId]: { ...current, [field]: nextVal } };
    });
  }

  const estimatedRevenue = useMemo(() => {
    return closingDishes.reduce((sum, dish) => {
      const sold = sales[dish.id]?.sold ?? 0;
      return sum + dish.price * sold;
    }, 0);
  }, [closingDishes, sales]);

  const totalItemsSold = useMemo(() => {
    return closingDishes.reduce((sum, dish) => {
      return sum + (sales[dish.id]?.sold ?? 0);
    }, 0);
  }, [closingDishes, sales]);

  function handleSave() {
    if (!dataset || !restaurant) return;
    const salesArray = closingDishes
      .map((dish) => ({ dish_id: dish.id, quantity_sold: Number(sales[dish.id]?.sold) || 0 }))
      .filter((s) => s.quantity_sold > 0);

    const existingIndex = dataset.daily_closings.findIndex((c) => c.date === selectedDate);
    const nextClosings = [...dataset.daily_closings];
    if (existingIndex >= 0) {
      nextClosings[existingIndex] = {
        ...nextClosings[existingIndex],
        weather,
        notes,
        sales: salesArray,
        updatedAt: new Date().toISOString(),
      };
    } else {
      nextClosings.push(
        createDailyClosing({
          restaurant_id: restaurant.id,
          date: selectedDate,
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
      setFeedback({ type: 'success', message: t('closing.saveSuccess') });
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    }
  }

  // --- LOGIQUE DU CALENDRIER COMPACT ---
  const weekStart = useMemo(() => getStartOfWeek(viewDate), [viewDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekTitle = useMemo(() => {
    const formatted = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(weekStart);
    return `${t('closing.weekOf')} ${formatted}`;
  }, [locale, t, weekStart]);

  const formattedSelectedDate = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }, [locale, selectedDate]);

  const handlePrevWeek = () => setViewDate((prev) => addDays(prev, -7));
  const handleNextWeek = () => setViewDate((prev) => addDays(prev, 7));

  const handleDayClick = (dayDate) => {
    setSelectedDate(formatDateString(dayDate));
  };

  const renderWeekCalendar = () => {
    return (
      <div className="week-calendar">
        <div className="week-calendar-header">
          <button
            type="button"
            className="week-nav-btn"
            onClick={handlePrevWeek}
            aria-label={t('closing.prevWeek')}
          >
            ‹
          </button>
          <span className="week-title">{weekTitle}</span>
          <button
            type="button"
            className="week-nav-btn"
            onClick={handleNextWeek}
            aria-label={t('closing.nextWeek')}
          >
            ›
          </button>
        </div>

        <div className="week-days">
          {weekDays.map((dayDate) => {
            const dateStr = formatDateString(dayDate);
            const isSelected = dateStr === selectedDate;
            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
            const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(dayDate);

            return (
              <button
                key={dateStr}
                type="button"
                className={`week-day ${isSelected ? 'selected' : ''} ${isWeekend ? 'weekend' : ''}`}
                onClick={() => handleDayClick(dayDate)}
              >
                <span className="week-day-name">{weekdayLabel}</span>
                <span className="week-day-number">{dayDate.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (!dataset || !restaurant) return <div>{t('common.loading')}</div>;

  return (
    <div className="closing-page">
      <h1 className="closing-title">{t('closing.title')}</h1>

      {feedback && (
        <div className={`closing-feedback closing-feedback--${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      <div className="closing-top-grid">
        {/* CALENDRIER COMPACT */}
        <div className="card date-card">
          <label className="closing-label">{t('closing.date')}</label>
          {renderWeekCalendar()}
        </div>

        {/* MÉTÉO */}
        <div className="card weather-card">
          <span className="closing-label">{t('closing.weather')}</span>
          <div className="weather-options-row">
            {WEATHER_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                className={`weather-btn-clean ${weather === w ? 'active' : ''} weather-${w}`}
                onClick={() => setWeather(w)}
              >
                <span className="weather-icon">
                  {w === 'sunny' ? '☀️' : w === 'cloudy' ? '☁️' : w === 'rainy' ? '🌧️' : '⛈️'}
                </span>
                <span className="weather-label">{t(`closing.weatherOptions.${w}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* RÉSUMÉ DU JOUR */}
        <div className="card closing-summary-card">
          <span className="closing-label">{t('closing.daySummary')}</span>
          <div className="closing-summary-date">{formattedSelectedDate}</div>

          <div className="closing-summary-stats">
            <div>
              <span>{t('closing.estimatedRevenue')}</span>
              <strong>{formatCurrency(estimatedRevenue)}</strong>
            </div>
            <div>
              <span>{t('closing.itemsSold')}</span>
              <strong>{totalItemsSold}</strong>
            </div>
            <div>
              <span>{t('closing.weather')}</span>
              <strong>{weather ? t(`closing.weatherOptions.${weather}`) : '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      <section className="closing-section card">
        <h2 className="closing-section-title">{t('closing.sales')}</h2>

        <div className="category-tabs">
          {CLOSING_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {t(cat.i18nKey)}
            </button>
          ))}
        </div>

        <div className="closing-sales-header">
          <span>{t('closing.dishName')}</span>
          <span>{t('closing.sold')}</span>
        </div>

        <ul className="closing-dishes">
          {activeDishes.map((dish) => {
            const s = sales[dish.id] || { sold: 0 };
            return (
              <li key={dish.id} className="closing-dish-item">
                <div className="dish-info">
                  <span className="dish-name">{dish.name}</span>
                  <span className="dish-price">{formatCurrency(dish.price)}</span>
                </div>
                <div className="qty-stepper">
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => bumpSale(dish.id, 'sold', -1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="qty-input"
                    min="0"
                    value={s.sold || ''}
                    placeholder="0"
                    onChange={(e) =>
                      updateSale(
                        dish.id,
                        'sold',
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    }
                  />
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => bumpSale(dish.id, 'sold', 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="closing-section card">
        <label className="closing-label" htmlFor="notes">
          {t('closing.notes')}
        </label>
        <textarea
          id="notes"
          className="closing-notes"
          rows={3}
          placeholder={t('closing.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      <div className="closing-footer-fixed">
        <div className="closing-total">
          <span>{t('closing.estimatedRevenue')}</span>
          <strong>{formatCurrency(estimatedRevenue)}</strong>
        </div>
        <button type="button" className="btn-primary" onClick={handleSave}>
          {t('closing.saveButton')}
        </button>
      </div>
    </div>
  );
}