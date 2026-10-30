import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { getActiveRestaurant, createEmployee, createFixedCost, createIngredient, MENU_CATEGORIES } from '../data/model';
import { loadDataset, saveDataset } from '../data/storage';
import './TeamPage.css';

const CATEGORY_EMOJI = { dish: '🥗', drink: '🥤', dessert: '🍰', sauce: '🥫' };

export default function TeamPage() {
  const { t, formatCurrency } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [view, setView] = useState('dashboard'); 
  
  // Planning state
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  // Forms state
  const [empForm, setEmpForm] = useState({ id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5 });
  const [costForm, setCostForm] = useState({ id: null, name: '', amount: '', frequency: 'monthly' });
  
  // Ingrédients state
  const [activeCategory, setActiveCategory] = useState('dish');
  const [ingForm, setIngForm] = useState({ id: null, name: '', category: 'dish', unit: 'g', unit_cost: '', supplier: '' });
  const [isEditingIng, setIsEditingIng] = useState(false);

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
    const days = Number(empForm.days_per_week);

    const empData = {
      restaurant_id: restaurant.id,
      name: empForm.name,
      role: empForm.role,
      salary_type: empForm.salary_type,
      days_per_week: days,
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
    setEmpForm({ id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5 });
  }

  function editEmployee(emp) {
    setEmpForm({ 
      id: emp.id, name: emp.name, role: emp.role, salary_type: emp.salary_type, 
      amount: emp.salary_type === 'monthly' ? emp.monthly_salary : emp.hourly_rate,
      days_per_week: emp.days_per_week || 5
    });
  }

  function deleteEmployee(id) {
    if (window.confirm(t('team.confirmDeleteEmp'))) {
      commit({ ...dataset, employees: dataset.employees.filter(e => e.id !== id) });
    }
  }

  // --- GESTION CHARGES ---
  function saveCost(e) {
    e.preventDefault();
    const amount = Number(costForm.amount);
    if (costForm.id) {
      const nextCosts = dataset.fixed_costs.map(c => c.id === costForm.id ? { ...c, name: costForm.name, amount, frequency: costForm.frequency } : c);
      commit({ ...dataset, fixed_costs: nextCosts });
    } else {
      const newCost = createFixedCost({ restaurant_id: restaurant.id, name: costForm.name, amount, frequency: costForm.frequency });
      commit({ ...dataset, fixed_costs: [...dataset.fixed_costs, newCost] });
    }
    setCostForm({ id: null, name: '', amount: '', frequency: 'monthly' });
  }

  function editCost(cost) {
    setCostForm({ id: cost.id, name: cost.name, amount: cost.amount, frequency: cost.frequency });
  }

  function deleteCost(id) {
    if (window.confirm(t('team.confirmDeleteCost'))) {
      commit({ ...dataset, fixed_costs: dataset.fixed_costs.filter(c => c.id !== id) });
    }
  }

  // Calculs coûts
  const totalMonthlyCharges = dataset?.fixed_costs.reduce((sum, c) => {
    if (c.frequency === 'monthly') return sum + c.amount;
    if (c.frequency === 'weekly') return sum + (c.amount * 52 / 12);
    if (c.frequency === 'daily') return sum + (c.amount * 365 / 12);
    return sum;
  }, 0) || 0;

  const totalYearlyCharges = dataset?.fixed_costs.reduce((sum, c) => {
    if (c.frequency === 'monthly') return sum + (c.amount * 12);
    if (c.frequency === 'weekly') return sum + (c.amount * 52);
    if (c.frequency === 'daily') return sum + (c.amount * 365);
    return sum;
  }, 0) || 0;

  // --- GESTION INGRÉDIENTS ---
  function saveIngredient(e) {
    e.preventDefault();
    const cost = Number(ingForm.unit_cost);
    if (ingForm.id) {
      const nextIngs = dataset.ingredients.map(i => i.id === ingForm.id ? { ...i, name: ingForm.name, category: ingForm.category, unit: ingForm.unit, unit_cost: cost, supplier: ingForm.supplier } : i);
      commit({ ...dataset, ingredients: nextIngs });
    } else {
      const newIng = createIngredient({ restaurant_id: restaurant.id, name: ingForm.name, category: ingForm.category, unit: ingForm.unit, unit_cost: cost, supplier: ingForm.supplier });
      commit({ ...dataset, ingredients: [...dataset.ingredients, newIng] });
    }
    setIngForm({ id: null, name: '', category: activeCategory, unit: 'g', unit_cost: '', supplier: '' });
    setIsEditingIng(false);
  }

  function editIngredient(ing) {
    setIngForm({ ...ing, unit_cost: String(ing.unit_cost) });
    setIsEditingIng(true);
  }

  function deleteIngredient(id) {
    if (window.confirm(t('menu.ingredients.confirmDelete'))) {
      commit({ ...dataset, ingredients: dataset.ingredients.filter(i => i.id !== id) });
    }
  }

  if (!dataset) return <div className="team-page">{t('common.loading')}</div>;

  return (
    <div className="team-page">
      <header className="team-header">
        {view !== 'dashboard' && (
          <button className="btn-back" onClick={() => { setView('dashboard'); setIsEditingIng(false); setIngForm({ id: null, name: '', category: activeCategory, unit: 'g', unit_cost: '', supplier: '' }); }}>
            ←
          </button>
        )}
        <h1 className="team-title">
          {view === 'dashboard' ? t('team.title') : t(`team.${view === 'ingredients' ? 'costIngredients' : view}`)}
        </h1>
      </header>

      {/* --- VUE DASHBOARD --- */}
      {view === 'dashboard' && (
        <div className="team-grid">
          <div className="team-card card-blue" onClick={() => setView('employees')}>
            <span className="icon">👥</span>
            <h3>{t('team.employees')}</h3>
            <p>{dataset.employees.length} {t('team.employees').toLowerCase()}</p>
          </div>
          <div className="team-card card-orange" onClick={() => setView('costs')}>
            <span className="icon">💳</span>
            <h3>{t('team.fixedCosts')}</h3>
            <p>{formatCurrency(totalMonthlyCharges)} / {t('team.freq.monthly').toLowerCase()}</p>
          </div>
          <div className="team-card card-green" onClick={() => setView('planning')}>
            <span className="icon">📅</span>
            <h3>{t('team.planning')}</h3>
            <p>{t('team.planningDetail')}</p>
          </div>
          <div className="team-card card-purple" onClick={() => setView('ingredients')}>
            <span className="icon">🥗</span>
            <h3>{t('team.costIngredients')}</h3>
            <p>{dataset.ingredients.length} ingrédients</p>
          </div>
        </div>
      )}

      {/* --- VUE EMPLOYÉS --- */}
      {view === 'employees' && (
        <div className="section-container">
          <form className="card form-card" onSubmit={saveEmployee}>
            <input className="form-input" type="text" placeholder={t('team.name')} value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} required />
            <input className="form-input" type="text" placeholder={t('team.role')} value={empForm.role} onChange={e => setEmpForm({...empForm, role: e.target.value})} />
            
            <div className="row-inputs">
              <select className="form-select" value={empForm.salary_type} onChange={e => setEmpForm({...empForm, salary_type: e.target.value})}>
                <option value="monthly">{t('team.monthly')}</option>
                <option value="hourly">{t('team.hourly')}</option>
              </select>
              <input className="form-input" type="number" placeholder={t('team.amount')} value={empForm.amount} onChange={e => setEmpForm({...empForm, amount: e.target.value})} required />
            </div>

            <input className="form-input" type="number" min="1" max="7" placeholder={t('team.employeeDays')} value={empForm.days_per_week} onChange={e => setEmpForm({...empForm, days_per_week: e.target.value})} required />
            
            <button type="submit" className="btn-primary" style={{ marginTop: '4px' }}>
              {empForm.id ? t('common.edit') : t('common.add')}
            </button>
            {empForm.id && (
              <button type="button" className="btn-ghost" style={{ marginTop: '8px', width: '100%', color: '#7A7A7A', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setEmpForm({ id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5 })}>
                {t('common.cancel')}
              </button>
            )}
          </form>

          <div className="list">
            {dataset.employees.map(emp => (
              <div key={emp.id} className="list-item">
                <div className="list-item-info">
                  <h4>{emp.name}</h4>
                  <p>{emp.role || '-'} · {formatCurrency(emp.salary_type === 'monthly' ? emp.monthly_salary : emp.hourly_rate)} / {emp.salary_type === 'monthly' ? t('team.monthly').toLowerCase() : t('team.hourly').toLowerCase()} · {emp.days_per_week}j/sem</p>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-edit" onClick={() => editEmployee(emp)}>✏️</button>
                  <button className="btn-delete" onClick={() => deleteEmployee(emp.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- VUE CHARGES --- */}
      {view === 'costs' && (
        <div className="section-container">
          <form className="card form-card" onSubmit={saveCost}>
            <input className="form-input" type="text" placeholder={t('team.name')} value={costForm.name} onChange={e => setCostForm({...costForm, name: e.target.value})} required />
            <div className="row-inputs">
              <input className="form-input" type="number" placeholder={t('team.amount')} value={costForm.amount} onChange={e => setCostForm({...costForm, amount: e.target.value})} required />
              <select className="form-select" value={costForm.frequency} onChange={e => setCostForm({...costForm, frequency: e.target.value})}>
                <option value="monthly">{t('team.freq.monthly')}</option>
                <option value="weekly">{t('team.freq.weekly')}</option>
                <option value="daily">{t('team.freq.daily')}</option>
              </select>
            </div>
            <button type="submit" className="btn-primary">{costForm.id ? t('common.edit') : t('team.addFixedCost')}</button>
            {costForm.id && (
              <button type="button" style={{ background: 'none', border: 'none', color: '#7A7A7A', marginTop: '8px', cursor: 'pointer' }} onClick={() => setCostForm({ id: null, name: '', amount: '', frequency: 'monthly' })}>
                {t('common.cancel')}
              </button>
            )}
          </form>

          <div className="list">
            {dataset.fixed_costs.map(cost => (
              <div key={cost.id} className="list-item">
                <div className="list-item-info">
                  <h4>{cost.name}</h4>
                  <p>{formatCurrency(cost.amount)} / {t(`team.freq.${cost.frequency}`).toLowerCase()}</p>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-edit" onClick={() => editCost(cost)}>✏️</button>
                  <button className="btn-delete" onClick={() => deleteCost(cost.id)}>🗑️</button>
                </div>
              </div>
            ))}
            
            <div className="total-card">
              <div className="total-card-row main">
                <span>{t('team.totalExpenses')}</span>
                <strong>{formatCurrency(totalMonthlyCharges)} / {t('team.freq.monthly').toLowerCase()}</strong>
              </div>
              <div className="total-card-row sub">
                <span>{t('team.fixedCostsYearly')}</span>
                <strong>{formatCurrency(totalYearlyCharges)} / an</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- VUE PLANNING --- */}
      {view === 'planning' && (
        <div className="section-container">
          <div className="planning-week">
            {t('team.days').map((day, index) => {
              const isWeekend = index === 5 || index === 6;
              const isActive = selectedDay === index;
              return (
                <div key={day} className={`planning-day-card ${isActive ? 'active' : ''} ${isWeekend ? 'weekend' : ''}`} onClick={() => setSelectedDay(index)}>
                  <span className="day-label">{day.substring(0,3)}</span>
                  <span className="day-number">{index + 12}</span>
                </div>
              );
            })}
          </div>

          <div className="card planning-content">
            <div className="planning-row">
              <label>{t('team.openTime')}</label>
              <input type="time" defaultValue="08:00" className="form-input" />
            </div>
            <div className="planning-row">
              <label>{t('team.closeTime')}</label>
              <input type="time" defaultValue="20:00" className="form-input" />
            </div>
            
            <div style={{ marginTop: '12px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#4A4A4A' }}>{t('team.planningTasks')}</label>
              <div className="tasks-list">
                <div className="task-item">
                  <span>🧹 Nettoyage cuisine</span>
                  <button className="btn-delete" style={{ fontSize: '1rem' }}>✕</button>
                </div>
                <div className="task-item">
                  <span>🛒 Achat ingrédients</span>
                  <button className="btn-delete" style={{ fontSize: '1rem' }}>✕</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input className="form-input" placeholder={t('team.taskPlaceholder')} />
                <button className="btn-primary" style={{ padding: '0 16px', borderRadius: '12px' }}>+</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- VUE INGRÉDIENTS --- */}
      {view === 'ingredients' && (
        <div className="section-container">
          {isEditingIng ? (
            <form className="card form-card" onSubmit={saveIngredient}>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{ingForm.id ? t('common.edit') : t('menu.ingredients.add')}</h3>
              <input className="form-input" type="text" placeholder={t('menu.ingredients.name')} value={ingForm.name} onChange={e => setIngForm({ ...ingForm, name: e.target.value })} required />
              <select className="form-select" value={ingForm.category} onChange={e => setIngForm({ ...ingForm, category: e.target.value })}>
                {MENU_CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_EMOJI[cat]} {t(`menu.sections.${cat}`)}</option>)}
              </select>
              <div className="row-inputs">
                <input className="form-input" type="text" placeholder={t('menu.ingredients.unit')} value={ingForm.unit} onChange={e => setIngForm({ ...ingForm, unit: e.target.value })} required />
                <input className="form-input" type="number" placeholder={t('menu.ingredients.unitCost')} value={ingForm.unit_cost} onChange={e => setIngForm({ ...ingForm, unit_cost: e.target.value })} required />
              </div>
              <input className="form-input" type="text" placeholder={t('menu.ingredients.supplier')} value={ingForm.supplier} onChange={e => setIngForm({ ...ingForm, supplier: e.target.value })} />
              <button type="submit" className="btn-primary">{t('common.save')}</button>
              <button type="button" style={{ background: 'none', border: 'none', color: '#7A7A7A', marginTop: '8px', cursor: 'pointer' }} onClick={() => setIsEditingIng(false)}>{t('common.cancel')}</button>
            </form>
          ) : (
            <>
              <div className="filter-pills">
                {MENU_CATEGORIES.map(cat => (
                  <button key={cat} className={`filter-pill ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
                    {CATEGORY_EMOJI[cat]} {t(`menu.sections.${cat}`)}
                  </button>
                ))}
              </div>
              <button className="btn-primary" style={{ marginBottom: '16px', width: '100%' }} onClick={() => { setIngForm({ id: null, name: '', category: activeCategory, unit: 'g', unit_cost: '', supplier: '' }); setIsEditingIng(true); }}>
                + {t('menu.ingredients.add')}
              </button>
              
              <div className="list">
                {dataset.ingredients.filter(i => i.category === activeCategory).map(ing => (
                  <div key={ing.id} className="ingredient-card">
                    <div className="ingredient-info">
                      <h4>{ing.name}</h4>
                      <p>{formatCurrency(ing.unit_cost)} / {ing.unit} {ing.supplier && `· ${ing.supplier}`}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-edit" onClick={() => editIngredient(ing)}>✏️</button>
                      <button className="btn-delete" onClick={() => deleteIngredient(ing.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}