// src/App.jsx
import { useState } from 'react'
import { I18nProvider } from './i18n'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import ClosingPage from './pages/ClosingPage'
import MenuPage from './pages/MenuPage'
import ExpensesPage from './pages/ExpensesPage'
import SettingsPage from './pages/SettingsPage'

// On sépare le contenu de l'App pour pouvoir utiliser le hook useI18n
// à l'intérieur du I18nProvider (sinon React lève une erreur)
function AppContent() {
  const [activeTab, setActiveTab] = useState('home')

  const renderPage = () => {
    switch (activeTab) {
      case 'home':     return <HomePage />
      case 'closing':  return <ClosingPage />
      case 'menu':     return <MenuPage />
      case 'expenses': return <ExpensesPage />
      case 'settings': return <SettingsPage />
      default:         return <HomePage />
    }
  }

  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        {renderPage()}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

// Le composant racine qui englobe tout dans le Provider i18n
export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}