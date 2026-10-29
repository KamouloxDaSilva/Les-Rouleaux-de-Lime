// src/pages/HomePage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import Clock from '../components/Clock'
import { loadDataset } from '../data/storage.js'
import { getActiveRestaurant } from '../data/model.js'
import { getDishFoodCost, getDailyLaborCost } from '../data/calculations.js'
import './HomePage.css'

function getTodayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function HomePage() {
  const { t, formatCurrency, lang } = useI18n()
  const [dataset, setDataset] = useState(null)

  useEffect(() => { setDataset(loadDataset()) }, [])
  const restaurant = useMemo(() => (dataset ? getActiveRestaurant(dataset) : null), [dataset])
  const todayClosing = useMemo(() => dataset?.daily_closings.find((c) => c.date === getTodayString()), [dataset])

  const todayRevenue = useMemo(() => {
    if (!dataset || !todayClosing) return 0
    return todayClosing.sales.reduce((sum, sale) => {
      const dish = dataset.dishes.find((d) => d.id === sale.dish_id)
      return dish ? sum + dish.price * sale.quantity_sold : sum
    }, 0)
  }, [dataset, todayClosing])

  const todayFoodCost = useMemo(() => {
    if (!dataset || !todayClosing) return 0
    return todayClosing.sales.reduce((sum, sale) => {
      const dish = dataset.dishes.find((d) => d.id === sale.dish_id)
      if (!dish) return sum
      return sum + getDishFoodCost(dish, dataset.ingredients) * sale.quantity_sold
    }, 0)
  }, [dataset, todayClosing])

  const fixedExpenses = useMemo(() => {
    if (!dataset || !restaurant) return 0
    return dataset.fixed_costs.filter((fc) => fc.restaurant_id === restaurant.id).reduce((sum, fc) => {
      if (fc.frequency === 'daily') return sum + fc.amount
      if (fc.frequency === 'weekly') return sum + fc.amount / 7
      if (fc.frequency === 'monthly') return sum + fc.amount / 30
      return sum
    }, 0)
  }, [dataset, restaurant])

  const todayLaborCost = useMemo(() => {
    if (!dataset) return 0
    return getDailyLaborCost(getTodayString(), dataset.shifts, dataset.employees)
  }, [dataset])

  const profit = todayRevenue - todayFoodCost - fixedExpenses - todayLaborCost

  if (!dataset) return <div className="home-page">{t('common.loading')}</div>

  return (
    <div className="home-page">
      <header className="home-greeting"><h2>{t('home.greeting')}</h2><p>{t('home.subtitle')}</p></header>
      <Clock />

      <section className="home-summary">
        <h3>{t('home.todaySummary')}</h3>
        
        <div className="summary-row">
          <article className="summary-card summary-card--revenue">
            <span className="card-label">{t('home.revenue')}</span>
            <span className="card-value">{formatCurrency(todayRevenue)}</span>
          </article>
          <article className="summary-card summary-card--expenses">
            <span className="card-label">{t('home.expenses')}</span>
            <span className="card-value">{formatCurrency(fixedExpenses)}</span>
          </article>
        </div>

        <div className="summary-row">
          <article className="summary-card summary-card--foodcost">
            <span className="card-label">{t('home.foodCost')}</span>
            <span className="card-value">{formatCurrency(todayFoodCost)}</span>
          </article>
          <article className="summary-card summary-card--labor">
            <span className="card-label">{t('home.laborCost')}</span>
            <span className="card-value">{formatCurrency(todayLaborCost)}</span>
          </article>
        </div>

        <div className="summary-row">
          <article className="summary-card summary-card--profit" style={{ gridColumn: '1 / -1' }}>
            <span className="card-label">{t('home.profit')}</span>
            <span className="card-value text-success" style={{ fontSize: '1.5rem' }}>{formatCurrency(profit)}</span>
          </article>
        </div>
      </section>
    </div>
  )
}