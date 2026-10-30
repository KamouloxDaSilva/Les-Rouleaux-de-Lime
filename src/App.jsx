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
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'stats' && <StatsPage />}
        {activeTab === 'team' && <TeamPage />}
        {activeTab === 'menu' && <MenuPage />}
        {activeTab === 'closing' && <ClosingPage />}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}