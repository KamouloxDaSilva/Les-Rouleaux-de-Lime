// src/App.jsx
import { useState } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import StatsPage from './pages/StatsPage';
import TeamPage from './pages/TeamPage';
import MenuPage from './pages/MenuPage';
import ClosingPage from './pages/ClosingPage';
import './styles/global.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="app-container" style={{ paddingTop: 'var(--header-height)' }}>
      {/* Le Header contient le titre et le bouton de langue */}
      <Header />

      <main style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* Chantier 11-C — fade 150ms entre onglets
            key={activeTab} force le remontage du wrapper → relance l'animation pageFade */}
        <div className="page-transition" key={activeTab}>
          {activeTab === 'home' && <HomePage />}
          {activeTab === 'stats' && <StatsPage />}
          {activeTab === 'team' && <TeamPage />}
          {activeTab === 'menu' && <MenuPage />}
          {activeTab === 'closing' && <ClosingPage />}
        </div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}