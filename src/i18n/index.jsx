// src/i18n/index.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import vi from './vi'
import fr from './fr'
import en from './en'

const dictionaries = { vi, fr, en }
const FALLBACK_LANG = 'vi'

const I18nContext = createContext(null)

function resolvePath(dict, keys) {
  let current = dict
  for (const key of keys) {
    if (current == null || current[key] === undefined) return undefined
    current = current[key]
  }
  return current
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('app_lang')
    return saved && dictionaries[saved] ? saved : 'vi'
  })

  useEffect(() => {
    localStorage.setItem('app_lang', lang)
  }, [lang])

  const t = (path) => {
    const keys = path.split('.')
    const value = resolvePath(dictionaries[lang], keys)
    if (value !== undefined) return value
    const fallback = resolvePath(dictionaries[FALLBACK_LANG], keys)
    if (fallback !== undefined) {
      console.warn(`Traduction manquante : ${path} (${lang}) — fallback vi`)
      return fallback
    }
    console.warn(`Traduction manquante partout : ${path}`)
    return path
  }

  const formatCurrency = (value, currency = 'VND') => {
    if (value == null || Number.isNaN(Number(value))) return ''
    try {
      return new Intl.NumberFormat(lang, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(Number(value))
    } catch {
      return `${Number(value).toLocaleString()} ${currency}`
    }
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t, formatCurrency }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n doit être utilisé à l\'intérieur de I18nProvider')
  }
  return context
}