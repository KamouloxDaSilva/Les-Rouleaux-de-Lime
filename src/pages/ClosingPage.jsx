// src/pages/ClosingPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import {
  WEATHER_OPTIONS,
  createDailyClosing,
  getActiveRestaurant,
} from '../data/model.js'
import { loadDataset, saveDataset } from '../data/storage.js'
import { createDefaultFixtures } from '../data/fixtures.js'
import './ClosingPage.css'

// Date du jour au format YYYY-MM-DD (locale, pas UTC)
function getTodayString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ClosingPage() {
  const { t, formatCurrency } = useI18n()
  const [dataset, setDataset] = useState(null)
  const [selectedDate, setSelectedDate] = useState(getTodayString())
  const [weather, setWeather] = useState('')
  const [notes, setNotes] = useState('')
  // { [dish_id]: { sold: number, lost: number } }
  const [sales, setSales] = useState({})
  const [feedback, setFeedback] = useState(null)

  // Chargement initial : dataset + seed si vide
  useEffect(() => {
    const loaded = loadDataset()
    const isEmpty =
      loaded.dishes.length === 0 && loaded.daily_closings.length === 0
    const initial = isEmpty ? createDefaultFixtures() : loaded
    if (isEmpty) {
      try {
        saveDataset(initial)
      } catch (e) {
        console.warn('[ClosingPage] seed fixtures échoué', e)
      }
    }
    setDataset(initial)
  }, [])

  const restaurant = useMemo(
    () => (dataset ? getActiveRestaurant(dataset) : null),
    [dataset],
  )

  const activeDishes = useMemo(() => {
    if (!dataset || !restaurant) return []
    return dataset.dishes.filter(
      (d) => d.active && d.restaurant_id === restaurant.id,
    )
  }, [dataset, restaurant])

  // Pré-remplissage à chaque changement de date (ou de dataset)
  useEffect(() => {
    if (!dataset) return
    const existing = dataset.daily_closings.find(
      (c) => c.date === selectedDate,
    )
    if (existing) {
      setWeather(existing.weather || '')
      setNotes(existing.notes || '')
      const map = {}
      existing.sales.forEach((s) => {
        map[s.dish_id] = {
          sold: s.quantity_sold ?? 0,
          lost: s.quantity_lost ?? 0,
        }
      })
      setSales(map)
    } else {
      setWeather('')
      setNotes('')
      setSales({})
    }
    setFeedback(null)
  }, [selectedDate, dataset])

  function updateSale(dishId, field, value) {
    setSales((prev) => ({
      ...prev,
      [dishId]: {
        sold: prev[dishId]?.sold ?? 0,
        lost: prev[dishId]?.lost ?? 0,
        [field]: value,
      },
    }))
  }

  function bumpSale(dishId, field, delta) {
    setSales((prev) => {
      const current = prev[dishId] ?? { sold: 0, lost: 0 }
      const nextVal = Math.max(0, (current[field] ?? 0) + delta)
      return {
        ...prev,
        [dishId]: { ...current, [field]: nextVal },
      }
    })
  }

  const estimatedRevenue = useMemo(() => {
    return activeDishes.reduce((sum, dish) => {
      const sold = sales[dish.id]?.sold ?? 0
      return sum + dish.price * sold
    }, 0)
  }, [activeDishes, sales])

  function handleSave() {
    if (!dataset || !restaurant) return

    // Construire le tableau des ventes (uniquement les plats avec >0)
    const salesArray = activeDishes
      .map((dish) => ({
        dish_id: dish.id,
        quantity_sold: Number(sales[dish.id]?.sold) || 0,
        quantity_lost: Number(sales[dish.id]?.lost) || 0,
      }))
      .filter((s) => s.quantity_sold > 0 || s.quantity_lost > 0)

    const existingIndex = dataset.daily_closings.findIndex(
      (c) => c.date === selectedDate,
    )
    const nextClosings = [...dataset.daily_closings]

    if (existingIndex >= 0) {
      nextClosings[existingIndex] = {
        ...nextClosings[existingIndex],
        weather,
        notes,
        sales: salesArray,
        updatedAt: new Date().toISOString(),
      }
    } else {
      nextClosings.push(
        createDailyClosing({
          restaurant_id: restaurant.id,
          date: selectedDate,
          weather,
          notes,
          sales: salesArray,
        }),
      )
    }

    const nextDataset = { ...dataset, daily_closings: nextClosings }
    try {
      saveDataset(nextDataset)
      setDataset(nextDataset)
      setFeedback({ type: 'success', message: t('closing.saveSuccess') })
    } catch (e) {
      setFeedback({ type: 'error', message: e.message })
    }
  }

  if (!dataset || !restaurant) {
    return <div className="closing-page">{t('common.loading')}</div>
  }

  const isAlreadyClosed = dataset.daily_closings.some(
    (c) => c.date === selectedDate,
  )

  return (
    <div className="closing-page">
      <h1 className="closing-title">{t('closing.title')}</h1>

      {feedback && (
        <div className={`closing-feedback closing-feedback--${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {isAlreadyClosed && (
        <div className="closing-info">{t('closing.alreadyClosed')}</div>
      )}

      {/* Date */}
      <section className="closing-section">
        <label className="closing-label" htmlFor="closing-date">
          {t('closing.date')}
        </label>
        <input
          id="closing-date"
          type="date"
          className="closing-date-input"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={getTodayString()}
        />
      </section>

      {/* Météo */}
      <section className="closing-section">
        <span className="closing-label">{t('closing.weather')}</span>
        <div className="closing-weather-grid">
          {WEATHER_OPTIONS.map((w) => (
            <button
              key={w}
              type="button"
              className={
                'closing-weather-btn' +
                (weather === w ? ' closing-weather-btn--active' : '')
              }
              onClick={() => setWeather(weather === w ? '' : w)}
            >
              {t(`closing.weatherOptions.${w}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Ventes par plat */}
      <section className="closing-section">
        <h2 className="closing-section-title">{t('closing.sales')}</h2>
        <div className="closing-sales-header">
          <span>{t('closing.dishName')}</span>
          <span>{t('closing.sold')}</span>
          <span>{t('closing.lost')}</span>
        </div>
        <ul className="closing-dishes">
          {activeDishes.map((dish) => {
            const s = sales[dish.id] ?? { sold: 0, lost: 0 }
            return (
              <li key={dish.id} className="closing-dish">
                <div className="closing-dish-main">
                  <span className="closing-dish-name">{dish.name}</span>
                  <span className="closing-dish-price">
                    {formatCurrency(dish.price)}
                  </span>
                </div>
                <div className="closing-dish-inputs">
                  <QuantityStepper
                    value={s.sold}
                    onChange={(v) => updateSale(dish.id, 'sold', v)}
                    onBump={(d) => bumpSale(dish.id, 'sold', d)}
                    label={t('closing.sold')}
                  />
                  <QuantityStepper
                    value={s.lost}
                    onChange={(v) => updateSale(dish.id, 'lost', v)}
                    onBump={(d) => bumpSale(dish.id, 'lost', d)}
                    label={t('closing.lost')}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Notes */}
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

      {/* Barre de sauvegarde fixe */}
      <div className="closing-footer">
        <div className="closing-total">
          <span className="closing-total-label">
            {t('closing.estimatedRevenue')}
          </span>
          <span className="closing-total-value">
            {formatCurrency(estimatedRevenue)}
          </span>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          {t('closing.saveButton')}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Petit composant interne : stepper + / -                             */
/* ------------------------------------------------------------------ */

function QuantityStepper({ value, onChange, onBump, label }) {
  return (
    <div className="qty-stepper" aria-label={label}>
      <button
        type="button"
        className="qty-btn"
        onClick={() => onBump(-1)}
        aria-label={`-1 ${label}`}
      >
        −
      </button>
      <input
        type="number"
        className="qty-input"
        min="0"
        inputMode="numeric"
        value={value || ''}
        placeholder="0"
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') return onChange('')
          const n = Math.max(0, parseInt(raw, 10) || 0)
          onChange(n)
        }}
      />
      <button
        type="button"
        className="qty-btn"
        onClick={() => onBump(1)}
        aria-label={`+1 ${label}`}
      >
        +
      </button>
    </div>
  )
}