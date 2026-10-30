import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { getActiveRestaurant, createEmployee, createFixedCost } from '../data/model';
import { loadDataset, saveDataset } from '../data/storage';
import './TeamPage.css';

export default function TeamPage() {
  const { t, formatCurrency } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [view, setView] = useState('dashboard'); 
  
  // Planning : index du jour sélectionné (0 = Lundi, 6 = Dimanche)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  // Formulaires
  const [empForm, setEmpForm] = useState({ id: null, name: '', role: '', salary_type: 'monthly', amount: '' });
  const [costForm, setCostForm] = useState({ name: '', amount: '', frequency: 'monthly' });

  useEffect(() => {
    setDataset(loadDataset());
  }, []);

  const restaurant = useMemo(() => dataset ? getActiveRestaurant(dataset) : null, [dataset]);

  function commit(next) {
    setDataset(next);
    saveDataset(next);
  }

  // --- GESTION EMPLOYÉS ---
  function saveEmployee(e) {
    e.preventDefault();
    const isEdit = !!empForm.id;
    const amount = Number(empForm.amount);

    const empData = {
      restaurant_id: restaurant.id,
      name: empForm.name,
      role: empForm.role,
      salary_type: empForm.salary_type,
      hourly_rate: empForm.salary_type === 'hourly' ? amount : 0,
      monthly_salary: empForm.salary_type === 'monthly' ? amount : 0,
    };

    let nextEmployees;
    if (isEdit) {
      nextEmployees = dataset.employees.map(emp => emp.id === empForm.id ? { ...emp, ...empData } : emp);
    } else {
      nextEmployees = [...dataset.employees, createEmployee(empData)];
    }
    commit({ ...dataset, employees: nextEmployees });
    setEmpForm({ id: null, name: '', role: '', salary_type: 'monthly', amount: '' });
  }

  // --- GESTION CHARGES ---
  function saveCost(e) {
    e.preventDefault();
    const newCost = createFixedCost({ restaurant_id: restaurant.id, name: costForm.name, amount: Number(costForm.amount), frequency: costForm.frequency });
    commit({ ...dataset, fixed_costs: [...dataset.fixed_costs, newCost] });
    setCostForm({ name: '', amount: '', frequency: 'monthly' });
  }

  const totalCharges = dataset?.fixed_costs.reduce((sum, c) => sum + c.amount, 0) || 0;

  if (!dataset) return <div>{t('common.loading')}</div>;

  return (
    <div className="team-page">
      {view !== 'dashboard' && (
        <button className="btn-back" onClick={() => setView('dashboard')}>← {t('team.back')}</button>
      )}

      {view === 'dashboard' && (
        <>
          <h1>{t('team.title')}</h1>
          <div className="team-grid">
            <div className="team-card card-blue" onClick={() => setView('employees')}>
              <span className="icon">👥</span>
              <h3>{t('team.employees')}</h3>
              <p>{dataset.employees.length} {t('team.employees').toLowerCase()}</p>
            </div>
            <div className="team-card card-orange" onClick={() => setView('costs')}>
              <span className="icon">💳</span>
              <h3>{t('team.fixedCosts')}</h3>
              <p>{formatCurrency(totalCharges)}</p>
            </div>
            <div className="team-card card-green" onClick={() => setView('planning')}>
              <span className="icon">📅</span>
              <h3>{t('team.planning')}</h3>
              <p>{t('menu.dish.active')}</p>
            </div>
          </div>
        </>
      )}

      {/* VUE EMPLOYÉS */}
      {view === 'employees' && (
        <div className="section-container">
          <h2>{t('team.employees')}</h2>
          
          <form className="card form-card" onSubmit={saveEmployee}>
            <input type="text" placeholder={t('team.name')} value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} required />
            <input type="text" placeholder={t('team.role')} value={empForm.role} onChange={e => setEmpForm({...empForm, role: e.target.value})} />
            
            <div className="salary-row">
              <select value={empForm.salary_type} onChange={e => setEmpForm({...empForm, salary_type: e.target.value})}>
                <option value="monthly">{t('team.monthly')}</option>
                <option value="hourly">{t('team.hourly')}</option>
              </select>
              <input type="number" placeholder={t('team.amount')} value={empForm.amount} onChange={e => setEmpForm({...empForm, amount: e.target.value})} required />
            </div>
            
            <div className="form-actions">
              <button type="submit" className="btn-primary">{empForm.id ? t('common.edit') : t('common.add')}</button>
              {empForm.id && <button type="button" className="btn-ghost" onClick={() => setEmpForm({ id: null, name: '', role: '', salary_type: 'monthly', amount: '' })}>{t('common.cancel')}</button>}
            </div>
          </form>

          <div className="list">
            {dataset.employees.map(emp => (
              <div key={emp.id} className="list-item card">
                <div>
                  <strong>{emp.name}</strong>
                  <div className="sub">
                    {emp.role} - {formatCurrency(emp.salary_type === 'monthly' ? emp.monthly_salary : emp.hourly_rate)} / {emp.salary_type === 'monthly' ? t('team.monthly').toLowerCase() : t('team.hourly').toLowerCase()}
                  </div>
                </div>
                <button className="btn-edit" onClick={() => setEmpForm({ 
                  id: emp.id, name: emp.name, role: emp.role, salary_type: emp.salary_type, 
                  amount: emp.salary_type === 'monthly' ? emp.monthly_salary : emp.hourly_rate 
                })}>✏️</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VUE CHARGES */}
      {view === 'costs' && (
        <div className="section-container">
          <h2>{t('team.fixedCosts')}</h2>
          
          <form className="card form-card" onSubmit={saveCost}>
            <input type="text" placeholder={t('team.name')} value={costForm.name} onChange={e => setCostForm({...costForm, name: e.target.value})} required />
            <input type="number" placeholder={t('team.amount')} value={costForm.amount} onChange={e => setCostForm({...costForm, amount: e.target.value})} required />
            <select value={costForm.frequency} onChange={e => setCostForm({...costForm, frequency: e.target.value})}>
              <option value="monthly">{t('team.freq.monthly')}</option>
              <option value="weekly">{t('team.freq.weekly')}</option>
              <option value="daily">{t('team.freq.daily')}</option>
            </select>
            <button type="submit" className="btn-primary">{t('team.addFixedCost')}</button>
          </form>

          <div className="list">
            {dataset.fixed_costs.map(cost => (
              <div key={cost.id} className="list-item card">
                <div>
                  <strong>{cost.name}</strong>
                  <div className="sub">{t(`team.freq.${cost.frequency}`)}</div>
                </div>
                <strong>{formatCurrency(cost.amount)}</strong>
              </div>
            ))}
            {/* TOTAL EN BAS */}
            <div className="total-card card">
              <span>{t('team.totalExpenses').toUpperCase()}</span>
              <strong>{formatCurrency(totalCharges)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* VUE PLANNING */}
      {view === 'planning' && (
        <div className="section-container">
          <h2>{t('team.planning')}</h2>
          
          {/* Design des jours inspiré de l'image */}
          <div className="planning-week">
            {t('team.days').map((day, index) => {
              const isWeekend = index === 5 || index === 6;
              const isActive = selectedDay === index;
              
              return (
                <div 
                  key={day} 
                  className={`planning-day-card ${isActive ? 'active' : ''} ${isWeekend && !isActive ? 'weekend' : ''}`} 
                  onClick={() => setSelectedDay(index)}
                >
                  <span className="day-label">{day}</span>
                  <span className="day-dot"></span>
                </div>
              );
            })}
          </div>

          <div className="card planning-detail">
            <h3>{t('team.planningDetail')} - {t('team.days')[selectedDay]}</h3>
            
            <div className="planning-content">
              <div className="planning-row">
                <label>{t('team.openTime')}</label>
                <input type="time" defaultValue="08:00" className="time-input" />
              </div>
              <div className="planning-row">
                <label>{t('team.closeTime')}</label>
                <input type="time" defaultValue="20:00" className="time-input" />
              </div>
              <div className="planning-row">
                <label>{t('team.tasks')}</label>
                <textarea placeholder="..." rows={2} className="tasks-input" />
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: '16px', width: '100%' }}>{t('common.save')}</button>
          </div>
        </div>
      )}
    </div>
  );
}