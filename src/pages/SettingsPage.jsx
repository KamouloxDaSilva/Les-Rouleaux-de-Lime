// src/pages/SettingsPage.jsx
// Chantier 29 — F5 : ajout de l'export CSV (plats + clôtures)
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { SCHEMA_VERSION, getActiveRestaurant } from '../data/model.js'
import {
  loadDataset,
  saveDataset,
  resetDataset,
  exportDatasetAsJSON,
  importDatasetFromJSON,
} from '../data/storage.js'
import { createDefaultFixtures } from '../data/fixtures.js'
import ConfirmModal from '../components/ConfirmModal'
import './SettingsPage.css'

const APP_VERSION = '0.5.0'

/* ──────────────────────────────────────────────────────────────
 * Chantier 29 — F5 — Export CSV
 * Échappe une valeur selon RFC 4180 (guillemets, virgules, sauts)
 * ────────────────────────────────────────────────────────────── */
function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convertit le dataset en CSV (plats + clôtures).
 * - 2 sections séparées par une ligne vide
 * - BOM UTF-8 pour Excel + accents vietnamiens
 * - CRLF pour compatibilité Excel Windows/macOS
 */
function convertDatasetToCSV(dataset, t) {
  const lines = []

  // ── Section Plats ──
  lines.push(escapeCSV(t('menu.tabs.dishes')))
  lines.push(
    ['name', 'category', 'subcategory', 'price', 'active', 'ingredients_count']
      .map(escapeCSV)
      .join(',')
  )
  ;(dataset.dishes || []).forEach((dish) => {
    lines.push(
      [
        dish.name || '',
        dish.category || '',
        dish.subcategory || '',
        dish.price ?? 0,
        dish.active !== false ? 'yes' : 'no',
        (dish.recipe || []).length,
      ]
        .map(escapeCSV)
        .join(',')
    )
  })

  lines.push('')

  // ── Section Clôtures ──
  lines.push(escapeCSV(t('nav.closing')))
  lines.push(
    ['date', 'weather', 'items_sold', 'revenue', 'notes'].map(escapeCSV).join(',')
  )
  ;(dataset.daily_closings || []).forEach((closing) => {
    const sales = closing.sales || []
    let itemsSold = 0
    let revenue = 0
    sales.forEach((s) => {
      const qty = Number(s.quantity_sold) || 0
      itemsSold += qty
      const dish = (dataset.dishes || []).find((d) => d.id === s.dish_id)
      if (dish) {
        revenue += (Number(dish.price) || 0) * qty
      }
    })
    lines.push(
      [
        closing.date || '',
        closing.weather || '',
        itemsSold,
        revenue,
        closing.notes || '',
      ]
        .map(escapeCSV)
        .join(',')
    )
  })

  // BOM UTF-8 + CRLF (Excel-friendly)
  return '\uFEFF' + lines.join('\r\n')
}

export default function SettingsPage() {
  const { t } = useI18n()
  const [dataset, setDataset] = useState(null)
  const [feedback, setFeedback] = useState(null)
  // Chantier 28 — F1 : remplace window.confirm (bloqué iOS PWA)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

  useEffect(() => {
    const loaded = loadDataset()
    const isEmpty = loaded.ingredients.length === 0 && loaded.dishes.length === 0
    const initial = isEmpty ? createDefaultFixtures() : loaded
    if (isEmpty) {
      try { saveDataset(initial) } catch (e) { console.warn(e) }
    }
    setDataset(initial)
  }, [])

  const restaurant = useMemo(() => (dataset ? getActiveRestaurant(dataset) : null), [dataset])

  function commit(next) {
    setDataset(next)
    try { saveDataset(next) } catch (e) { setFeedback({ type: 'error', message: e.message }) }
  }

  // Export JSON (full backup)
  function handleExport() {
    if (!dataset) return
    const { filename, content } = exportDatasetAsJSON(dataset)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  // Chantier 29 — F5 : export CSV (plats + clôtures)
  function handleExportCSV() {
    if (!dataset) return
    try {
      const csv = convertDatasetToCSV(dataset, t)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const now = new Date()
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      a.href = url
      a.download = `burihagio-csv-${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setFeedback({ type: 'success', message: t('common.success') })
    } catch (e) {
      setFeedback({ type: 'error', message: t('common.error') })
    }
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = importDatasetFromJSON(String(reader.result || ''))
      if (!result.ok) {
        setFeedback({ type: 'error', message: t('settings.sections.data.importError') })
        return
      }
      commit(result.dataset)
      setFeedback({ type: 'success', message: t('settings.sections.data.importSuccess') })
    }
    reader.onerror = () => setFeedback({ type: 'error', message: t('settings.sections.data.importError') })
    reader.readAsText(file)
    e.target.value = ''
  }

  // Chantier 28 — F1 : ouvre la modale au lieu de window.confirm
  function handleReset() {
    setConfirmResetOpen(true)
  }

  function confirmReset() {
    setConfirmResetOpen(false)
    const fresh = resetDataset()
    setDataset(fresh)
  }

  function cancelReset() {
    setConfirmResetOpen(false)
  }

  if (!dataset || !restaurant) return <div className="settings-page">{t('common.loading')}</div>

  return (
    <div className="settings-page">
      <h1 className="settings-title">{t('settings.title')}</h1>

      {feedback && (
        <div className={`settings-feedback settings-feedback--${feedback.type}`}>{feedback.message}</div>
      )}

      <section className="settings-section">
        <h2>{t('settings.sections.restaurant.title')}</h2>
        <dl className="settings-kv">
          <div><dt>{t('settings.sections.restaurant.name')}</dt><dd>{restaurant.name || '—'}</dd></div>
          <div><dt>{t('settings.sections.restaurant.address')}</dt><dd>{restaurant.address || '—'}</dd></div>
          <div><dt>{t('settings.sections.restaurant.phone')}</dt><dd>{restaurant.phone || '—'}</dd></div>
          <div><dt>{t('settings.sections.restaurant.currency')}</dt><dd>{restaurant.currency}</dd></div>
          <div><dt>{t('settings.sections.restaurant.timezone')}</dt><dd>{restaurant.timezone}</dd></div>
        </dl>
      </section>

      <section className="settings-section">
        <h2>{t('settings.sections.data.title')}</h2>
        <div className="settings-data-actions">
          <button type="button" className="btn btn-secondary" onClick={handleExport}>{t('settings.sections.data.export')}</button>
          <label className="btn btn-secondary settings-file-btn">
            {t('settings.sections.data.import')}
            <input type="file" accept="application/json,.json" onChange={handleImportFile} hidden />
          </label>
          {/* Chantier 29 — F5 : bouton Export CSV */}
          <button type="button" className="btn btn-secondary" onClick={handleExportCSV}>{t('settings.sections.data.exportCsv')}</button>
          <button type="button" className="btn btn-ghost btn-danger" onClick={handleReset}>{t('settings.sections.data.reset')}</button>
        </div>
        <ul className="settings-hints">
          <li>{t('settings.sections.data.exportHint')}</li>
          <li>{t('settings.sections.data.importHint')}</li>
          <li>{t('settings.sections.data.resetHint')}</li>
        </ul>
      </section>

      <section className="settings-section">
        <h2>{t('settings.sections.about.title')}</h2>
        <dl className="settings-kv">
          <div><dt>{t('settings.sections.about.version')}</dt><dd>{APP_VERSION}</dd></div>
          <div><dt>{t('settings.sections.about.schemaVersion')}</dt><dd>{dataset.schema_version ?? SCHEMA_VERSION}</dd></div>
        </dl>
      </section>

      {/* Chantier 28 — F1 : modale de confirmation (remplace window.confirm) */}
      <ConfirmModal
        isOpen={confirmResetOpen}
        title={t('settings.sections.data.reset')}
        message={t('settings.sections.data.resetConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmReset}
        onCancel={cancelReset}
        danger
      />
    </div>
  )
}