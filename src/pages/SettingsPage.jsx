// src/pages/SettingsPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import {
  createFixedCost,
  FIXED_COST_FREQUENCIES,
  SCHEMA_VERSION,
  getActiveRestaurant,
} from '../data/model.js'
import {
  loadDataset,
  saveDataset,
  resetDataset,
  exportDatasetAsJSON,
  importDatasetFromJSON,
} from '../data/storage.js'
import { createDefaultFixtures } from '../data/fixtures.js'
import './SettingsPage.css'

const APP_VERSION = '0.4.0'

export default function SettingsPage() {
  const { t, formatCurrency } = useI18n()
  const [dataset, setDataset] = useState(null)
  const [editingCost, setEditingCost] = useState(null) // null | 'new' | id
  const [costForm, setCostForm] = useState({ name: '', amount: '', frequency: 'monthly' })
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    const loaded = loadDataset()
    const isEmpty =
      loaded.ingredients.length === 0 &&
      loaded.dishes.length === 0 &&
      loaded.fixed_costs.length === 0
    const initial = isEmpty ? createDefaultFixtures() : loaded
    if (isEmpty) {
      try {
        saveDataset(initial)
      } catch (e) {
        console.warn('[SettingsPage] seed fixtures échoué', e)
      }
    }
    setDataset(initial)
  }, [])

  const restaurant = useMemo(
    () => (dataset ? getActiveRestaurant(dataset) : null),
    [dataset],
  )

  function commit(next) {
    setDataset(next)
    try {
      saveDataset(next)
    } catch (e) {
      setFeedback({ type: 'error', message: e.message })
    }
  }

  /* --- Charges fixes --- */
  function openNewCost() {
    setEditingCost('new')
    setCostForm({ name: '', amount: '', frequency: 'monthly' })
  }
  function openEditCost(cost) {
    setEditingCost(cost.id)
    setCostForm({
      name: cost.name,
      amount: String(cost.amount),
      frequency: cost.frequency,
    })
  }
  function cancelCost() {
    setEditingCost(null)
    setCostForm({ name: '', amount: '', frequency: 'monthly' })
  }
  function submitCost(e) {
    e.preventDefault()
    if (!dataset || !restaurant) return
    const name = costForm.name.trim()
    const amount = Number(costForm.amount)
    if (!name || !Number.isFinite(amount) || amount < 0) return

    if (editingCost === 'new') {
      const cost = createFixedCost({
        restaurant_id: restaurant.id,
        name,
        amount,
        frequency: costForm.frequency,
      })
      commit({ ...dataset, fixed_costs: [...dataset.fixed_costs, cost] })
    } else {
      const next = dataset.fixed_costs.map((c) =>
        c.id === editingCost
          ? {
              ...c,
              name,
              amount,
              frequency: costForm.frequency,
              updatedAt: new Date().toISOString(),
            }
          : c,
      )
      commit({ ...dataset, fixed_costs: next })
    }
    cancelCost()
  }
  function deleteCost(id) {
    if (!dataset) return
    if (!window.confirm(t('settings.sections.fixedCosts.confirmDelete'))) return
    commit({
      ...dataset,
      fixed_costs: dataset.fixed_costs.filter((c) => c.id !== id),
    })
  }

  /* --- Données --- */
  function handleExport() {
    if (!dataset) return
    const { filename, content } = exportDatasetAsJSON(dataset)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = importDatasetFromJSON(String(reader.result || ''))
      if (!result.ok) {
        setFeedback({
          type: 'error',
          message: t('settings.sections.data.importError'),
        })
        return
      }
      commit(result.dataset)
      setFeedback({
        type: 'success',
        message: t('settings.sections.data.importSuccess'),
      })
    }
    reader.onerror = () => {
      setFeedback({
        type: 'error',
        message: t('settings.sections.data.importError'),
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }
  function handleReset() {
    if (!window.confirm(t('settings.sections.data.resetConfirm'))) return
    const fresh = resetDataset()
    setDataset(fresh)
  }

  if (!dataset || !restaurant) {
    return <div className="settings-page">{t('common.loading')}</div>
  }

  return (
    <div className="settings-page">
      <h1 className="settings-title">{t('settings.title')}</h1>

      {feedback && (
        <div className={`settings-feedback settings-feedback--${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {/* Restaurant */}
      <section className="settings-section">
        <h2>{t('settings.sections.restaurant.title')}</h2>
        <dl className="settings-kv">
          <div>
            <dt>{t('settings.sections.restaurant.name')}</dt>
            <dd>{restaurant.name || '—'}</dd>
          </div>
          <div>
            <dt>{t('settings.sections.restaurant.address')}</dt>
            <dd>{restaurant.address || '—'}</dd>
          </div>
          <div>
            <dt>{t('settings.sections.restaurant.phone')}</dt>
            <dd>{restaurant.phone || '—'}</dd>
          </div>
          <div>
            <dt>{t('settings.sections.restaurant.currency')}</dt>
            <dd>{restaurant.currency}</dd>
          </div>
          <div>
            <dt>{t('settings.sections.restaurant.timezone')}</dt>
            <dd>{restaurant.timezone}</dd>
          </div>
        </dl>
      </section>

      {/* Charges fixes */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2>{t('settings.sections.fixedCosts.title')}</h2>
          <button type="button" className="btn btn-primary" onClick={openNewCost}>
            + {t('settings.sections.fixedCosts.add')}
          </button>
        </div>

        {editingCost !== null && (
          <form className="settings-cost-form" onSubmit={submitCost}>
            <input
              type="text"
              placeholder={t('settings.sections.fixedCosts.columns.name')}
              value={costForm.name}
              onChange={(e) => setCostForm({ ...costForm, name: e.target.value })}
              required
            />
            <input
              type="number"
              min="0"
              step="1000"
              placeholder={t('settings.sections.fixedCosts.columns.amount')}
              value={costForm.amount}
              onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
              required
            />
            <select
              value={costForm.frequency}
              onChange={(e) => setCostForm({ ...costForm, frequency: e.target.value })}
            >
              {FIXED_COST_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {t(`settings.sections.fixedCosts.frequency.${f}`)}
                </option>
              ))}
            </select>
            <div className="settings-form-actions">
              <button type="button" className="btn btn-ghost" onClick={cancelCost}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                {t('common.save')}
              </button>
            </div>
          </form>
        )}

        {dataset.fixed_costs.length === 0 ? (
          <p className="settings-empty">
            {t('settings.sections.fixedCosts.empty')}
          </p>
        ) : (
          <ul className="settings-cost-list">
            {dataset.fixed_costs.map((cost) => (
              <li key={cost.id} className="settings-cost-item">
                <div className="settings-cost-main">
                  <span className="settings-cost-name">{cost.name}</span>
                  <span className="settings-cost-amount">
                    {formatCurrency(cost.amount)} ·{' '}
                    {t(`settings.sections.fixedCosts.frequency.${cost.frequency}`)}
                  </span>
                </div>
                <div className="settings-cost-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => openEditCost(cost)}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger"
                    onClick={() => deleteCost(cost.id)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Données */}
      <section className="settings-section">
        <h2>{t('settings.sections.data.title')}</h2>
        <div className="settings-data-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExport}>
            {t('settings.sections.data.export')}
          </button>
          <label className="btn btn-secondary settings-file-btn">
            {t('settings.sections.data.import')}
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              hidden
            />
          </label>
          <button type="button" className="btn btn-ghost btn-danger" onClick={handleReset}>
            {t('settings.sections.data.reset')}
          </button>
        </div>
        <ul className="settings-hints">
          <li>{t('settings.sections.data.exportHint')}</li>
          <li>{t('settings.sections.data.importHint')}</li>
          <li>{t('settings.sections.data.resetHint')}</li>
        </ul>
      </section>

      {/* À propos */}
      <section className="settings-section">
        <h2>{t('settings.sections.about.title')}</h2>
        <dl className="settings-kv">
          <div>
            <dt>{t('settings.sections.about.version')}</dt>
            <dd>{APP_VERSION}</dd>
          </div>
          <div>
            <dt>{t('settings.sections.about.schemaVersion')}</dt>
            <dd>{dataset.schema_version ?? SCHEMA_VERSION}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}