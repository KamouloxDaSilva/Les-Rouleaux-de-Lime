// src/components/Header.jsx
import { useI18n } from '../i18n'
import LanguageSwitch from './LanguageSwitch'
import './Header.css'

export default function Header() {
  const { t } = useI18n()

  return (
    <header className="app-header">
      <h1 className="app-header-title">{t('app.name')}</h1>
      <LanguageSwitch />
    </header>
  )
}