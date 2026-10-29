// src/components/Clock.jsx
import { useState, useEffect } from 'react'
import { useI18n } from '../i18n'
import './Clock.css'

export default function Clock() {
  const { lang } = useI18n()
  const [time, setTime] = useState(new Date())

  // Met à jour l'heure chaque seconde
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer) // Nettoyage quand le composant disparaît
  }, [])

  // Correspondance entre nos langues et les locales standard pour le formatage
  const localeMap = {
    vi: 'vi-VN',
    fr: 'fr-FR',
    en: 'en-US',
  }
  const locale = localeMap[lang] || 'vi-VN'

  // Formate l'heure (ex: 14:35:22)
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // Formate la date (ex: Thứ Năm, 29 tháng 10, 2026)
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="clock-container">
      <span className="clock-time">{timeFormatter.format(time)}</span>
      <span className="clock-date">{dateFormatter.format(time)}</span>
    </div>
  )
}