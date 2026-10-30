// src/pages/ClosingPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { WEATHER_OPTIONS, createDailyClosing, getActiveRestaurant } from '../data/model.js';
import { loadDataset, saveDataset } from '../data/storage.js';
import { createDefaultFixtures } from '../data/fixtures.js';
import './ClosingPage.css';

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// La Clôture ne suit que 3 catégories (les sauces sont considérées
// comme des accompagnements, pas des ventes autonomes).
const CLOSING_CATEGORIES = [
  { id: 'dish', i18nKey: 'menu.sections.dish' },
  { id: 'drink', i18nKey: 'menu.sections.drink' },
  { id: 'dessert', i18nKey: 'menu.sections.dessert' },
];

export default function ClosingPage() {
  const { t, formatCurrency } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [weather, setWeather] = useState('');
  const [notes, setNotes] = useState('');
  const [sales, setSales] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [activeCategory, setActiveCategory] = useState('dish');

  useEffect(() => {
    const loaded = loadDataset();
    const isEmpty = loaded.dishes.length === 0 && loaded.daily_closings.length === 0;
    const initial = isEmpty ? createDefaultFixtures() : loaded;
    if (isEmpty) {
      try { saveDataset(initial); } catch (e) { console.warn(e); }
    }
    setDataset(initial);
  }, []);

  const restaurant = useMemo(() => dataset ? getActiveRestaurant(dataset) : null, [dataset]);

  // Filtrage par catégorie normalisée (dish / drink / dessert)
  const activeDishes = useMemo(() => {
    if (!dataset || !restaurant) return [];
    return dataset.dishes.filter(
      (d) => d.active && d.restaurant_id === restaurant.id && d.category === activeCategory
    );
  }, [dataset, restaurant, activeCategory]);

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
      setWeather(''); setNotes(''); setSales({});
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
    return activeDishes.reduce((sum, dish) => {
      const sold = sales[dish.id]?.sold ?? 0;
      return sum + dish.price * sold;
    }, 0);
  }, [activeDishes, sales]);

  function handleSave() {
    if (!dataset || !restaurant) return;
    const salesArray = activeDishes
      .map((dish) => ({ dish_id: dish.id, quantity_sold: Number(sales[dish.id]?.sold) || 0 }))
      .filter((s) => s.quantity_sold > 0);

    const existingIndex = dataset.daily_closings.findIndex((c) => c.date === selectedDate);
    const nextClosings = [...dataset.daily_closings];
    if (existingIndex >= 0) {
      nextClosings[existingIndex] = { ...nextClosings[existingIndex], weather, notes, sales: salesArray, updatedAt: new Date().toISOString() };
    } else {
      nextClosings.push(createDailyClosing({ restaurant_id: restaurant.id, date: selectedDate, weather, notes, sales: salesArray }));
    }
    const nextDataset = { ...dataset, daily_closings: nextClosings };
    try {
      saveDataset(nextDataset); setDataset(nextDataset);
      setFeedback({ type: 'success', message: t('closing.saveSuccess') });
    } catch (e) { setFeedback({ type: 'error', message: e.message }); }
  }

  if (!dataset || !restaurant) return <div>{t('common.loading')}</div>;

  return (
    <div className="closing-page">
      <h1 className="closing-title">{t('closing.title')}</h1>
      {feedback && <div className={`closing-feedback closing-feedback--${feedback.type}`}>{feedback.message}</div>}

      <div className="closing-top-grid">
        <div className="card date-card">
          <label className="closing-label">{t('closing.date')}</label>
          <input type="date" className="date-input-clean" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} max={getTodayString()} />
        </div>

        <div className="card weather-card">
          <span className="closing-label">{t('closing.weather')}</span>
          <div className="weather-options-row">
            {WEATHER_OPTIONS.map((w) => (
              <button
                key={w}
                className={`weather-btn-clean ${weather === w ? 'active' : ''}`}
                onClick={() => setWeather(w)}
              >
                <span className="weather-icon">{w === 'sunny' ? '☀️' : w === 'cloudy' ? '☁️' : w === 'rainy' ? '🌧️' : '⛈️'}</span>
                <span className="weather-label">{t(`closing.weatherOptions.${w}`)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="closing-section card">
        <h2 className="closing-section-title">{t('closing.sales')}</h2>

        <div className="category-tabs">
          {CLOSING_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
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
                  <button className="qty-btn" onClick={() => bumpSale(dish.id, 'sold', -1)}>−</button>
                  <input
                    type="number" className="qty-input" min="0"
                    value={s.sold || ''} placeholder="0"
                    onChange={(e) => updateSale(dish.id, 'sold', Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <button className="qty-btn" onClick={() => bumpSale(dish.id, 'sold', 1)}>+</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="closing-section card">
        <label className="closing-label" htmlFor="notes">{t('closing.notes')}</label>
        <textarea id="notes" className="closing-notes" rows={3} placeholder={t('closing.notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      <div className="closing-footer-fixed">
        <div className="closing-total">
          <span>{t('closing.estimatedRevenue')}</span>
          <strong>{formatCurrency(estimatedRevenue)}</strong>
        </div>
        <button className="btn-primary" onClick={handleSave}>{t('closing.saveButton')}</button>
      </div>
    </div>
  );
}