import { useI18n } from '../i18n';
import Clock from '../components/Clock';
import './HomePage.css';

export default function HomePage() {
  const { t } = useI18n();
  const today = new Date();
  const currentDay = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="home-page">
      <header className="home-header">
        <h1>{today.getDate()} {today.toLocaleString('fr-FR', { month: 'long' })} <span>{today.getFullYear()}</span></h1>
      </header>

      {/* Barre des jours horizontale (comme sur l'image) */}
      <div className="week-days">
        {days.map((day, index) => {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + index);
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={day} className={`day-item ${isToday ? 'day-item--active' : ''}`}>
              <span className="day-name">{day}</span>
              <span className="day-number">{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* Boutons d'action rapide */}
      <div className="quick-actions">
        <button className="action-btn action-btn--green"><span>📞</span>Appeler</button>
        <button className="action-btn action-btn--pink"><span>⏰</span>Clôturer</button>
        <button className="action-btn action-btn--yellow"><span>✈️</span>Dépense</button>
      </div>

      <Clock />
    </div>
  );
}