// src/pages/SettingsPage.jsx
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
import './SettingsPage.css'

const APP_VERSION = '0.5.0'

export default function SettingsPage() {
  const { t } = useI18n()
  const [dataset, setDataset] = useState(null)
  const [feedback, setFeedback] = useState(null)

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

  function handleExport() {
    if (!dataset) return
    const { filename, content } = exportDatasetAsJSON(dataset)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
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

  function handleReset() {
    if (!window.confirm(t('settings.sections.data.resetConfirm'))) return
    const fresh = resetDataset()
    setDataset(fresh)
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
    </div>
  )
}