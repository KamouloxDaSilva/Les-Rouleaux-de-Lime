// src/components/PlaceholderPage.jsx
import { useI18n } from '../i18n'
import './PlaceholderPage.css'

export default function PlaceholderPage({ titleKey }) {
  const { t } = useI18n()

  return (
    <section className="placeholder-page">
      <h2 className="placeholder-title">{t(titleKey)}</h2>
      <p className="placeholder-text">{t('placeholder.comingSoon')}</p>
    </section>
  )
}