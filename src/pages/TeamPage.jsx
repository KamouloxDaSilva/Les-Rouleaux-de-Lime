// src/pages/TeamPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import {
  getActiveRestaurant,
  createEmployee,
  createFixedCost,
  createIngredient,
  createSupplier,
  createExpense,
  createPromotion,
  MENU_CATEGORIES,
  EXPENSE_CATEGORIES,
  PROMO_TYPES,
} from '../data/model';
import { loadDataset, saveDataset } from '../data/storage';
import BackButton from '../components/BackButton';
import ConfirmModal from '../components/ConfirmModal';
import FormModal from '../components/FormModal';
import './TeamPage.css';

const CATEGORY_EMOJI = { dish: '🥗', drink: '🥤', dessert: '🍰', sauce: '🥫' };
const UNIT_OPTIONS = ['g', 'kg', 't', 'ml', 'cl', 'l', 'pièce', 'cái', 'tờ', 'hộp', 'gói', 'bó'];

export default function TeamPage() {
  const { t, formatCurrency } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [view, setView] = useState('dashboard'); // dashboard, employees, costs, planning, ingredients, suppliers, stock, expenses, promotions

  // --- ÉTATS POUR LES MODALES ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // --- ÉTATS POUR LES FORMULAIRES ---
  const [empForm, setEmpForm] = useState({ id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5 });
  const [costForm, setCostForm] = useState({ id: null, name: '', amount: '', frequency: 'monthly' });
  const [ingForm, setIngForm] = useState({ id: null, name: '', category: 'dish', unit: 'g', unit_cost: '', supplier_id: '' });
  const [supForm, setSupForm] = useState({ id: null, name: '', phone: '', notes: '' });
  const [expForm, setExpForm] = useState({ id: null, name: '', amount: '', category: 'material', note: '' });
  const [promoForm, setPromoForm] = useState({ id: null, dish_id: '', type: 'percentage', value: '', start_date: '', end_date: '' });

  // --- ÉTATS PLANNING ---
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [tasks, setTasks] = useState([{ id: 1, text: '🧹 Nettoyage cuisine', done: false }]);
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    setDataset(loadDataset());
  }, []);

  const restaurant = useMemo(() => dataset ? getActiveRestaurant(dataset) : null, [dataset]);

  function commit(next) {
    setDataset(next);
    saveDataset(next);
  }

  // --- HELPERS ---
  function handleBack() {
    setView('dashboard');
    setIsFormOpen(false);
  }

  function openConfirm(title, message, onConfirm) {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  }

  function handleDeleteItem(collection, id, name) {
    openConfirm(
      t('common.delete'),
      `${t('common.delete')} "${name}" ?`,
      () => {
        const next = { ...dataset, [collection]: dataset[collection].filter(item => item.id !== id) };
        commit(next);
        setConfirmConfig({ ...confirmConfig, isOpen: false });
      }
    );
  }

  function moveItem(collection, item, direction) {
    const list = [...dataset[collection]].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const index = list.findIndex(i => i.id === item.id);
    if (direction === 'up' && index > 0) {
      const temp = list[index].sort_order;
      list[index].sort_order = list[index - 1].sort_order;
      list[index - 1].sort_order = temp;
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index].sort_order;
      list[index].sort_order = list[index + 1].sort_order;
      list[index + 1].sort_order = temp;
    }
    commit({ ...dataset, [collection]: list });
  }

  // --- SAUVEGARDE EMPLOYÉS ---
  function saveEmployee(e) {
    e.preventDefault();
    const amount = Number(empForm.amount);
    const days = Number(empForm.days_per_week);
    const empData = {
      restaurant_id: restaurant.id, name: empForm.name, role: empForm.role, salary_type: empForm.salary_type,
      days_per_week: days, hourly_rate: empForm.salary_type === 'hourly' ? amount : 0, monthly_salary: empForm.salary_type === 'monthly' ? amount : 0,
    };
    let nextEmployees;
    if (empForm.id) {
      nextEmployees = dataset.employees.map(emp => emp.id === empForm.id ? { ...emp, ...empData } : emp);
    } else {
      nextEmployees = [...dataset.employees, createEmployee(empData)];
    }
    commit({ ...dataset, employees: nextEmployees });
    setIsFormOpen(false);
    setEmpForm({ id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5 });
  }

  // --- SAUVEGARDE CHARGES ---
  function saveCost(e) {
    e.preventDefault();
    const amount = Number(costForm.amount);
    let nextCosts;
    if (costForm.id) {
      nextCosts = dataset.fixed_costs.map(c => c.id === costForm.id ? { ...c, name: costForm.name, amount, frequency: costForm.frequency } : c);
    } else {
      nextCosts = [...dataset.fixed_costs, createFixedCost({ restaurant_id: restaurant.id, name: costForm.name, amount, frequency: costForm.frequency })];
    }
    commit({ ...dataset, fixed_costs: nextCosts });
    setIsFormOpen(false);
    setCostForm({ id: null, name: '', amount: '', frequency: 'monthly' });
  }

  // --- SAUVEGARDE INGRÉDIENTS ---
  function saveIngredient(e) {
    e.preventDefault();
    const cost = Number(ingForm.unit_cost);
    let nextIngs;
    if (ingForm.id) {
      nextIngs = dataset.ingredients.map(i => i.id === ingForm.id ? { ...i, name: ingForm.name, category: ingForm.category, unit: ingForm.unit, unit_cost: cost, supplier_id: ingForm.supplier_id } : i);
    } else {
      nextIngs = [...dataset.ingredients, createIngredient({ restaurant_id: restaurant.id, name: ingForm.name, category: ingForm.category, unit: ingForm.unit, unit_cost: cost, supplier_id: ingForm.supplier_id })];
    }
    commit({ ...dataset, ingredients: nextIngs });
    setIsFormOpen(false);
    setIngForm({ id: null, name: '', category: 'dish', unit: 'g', unit_cost: '', supplier_id: '' });
  }

  // --- SAUVEGARDE FOURNISSEURS ---
  function saveSupplier(e) {
    e.preventDefault();
    let nextSups;
    if (supForm.id) {
      nextSups = dataset.suppliers.map(s => s.id === supForm.id ? { ...s, name: supForm.name, phone: supForm.phone, notes: supForm.notes } : s);
    } else {
      nextSups = [...dataset.suppliers, createSupplier({ restaurant_id: restaurant.id, ...supForm })];
    }
    commit({ ...dataset, suppliers: nextSups });
    setIsFormOpen(false);
    setSupForm({ id: null, name: '', phone: '', notes: '' });
  }

  // --- SAUVEGARDE DÉPENSES ---
  function saveExpense(e) {
    e.preventDefault();
    const amount = Number(expForm.amount);
    const nextExps = [...dataset.expenses, createExpense({ restaurant_id: restaurant.id, date: new Date().toISOString().slice(0, 10), amount, category: expForm.category, note: expForm.name })];
    commit({ ...dataset, expenses: nextExps });
    setIsFormOpen(false);
    setExpForm({ id: null, name: '', amount: '', category: 'material', note: '' });
  }

  // --- SAUVEGARDE PROMOTIONS ---
  function savePromotion(e) {
    e.preventDefault();
    const value = Number(promoForm.value);
    const nextPromos = [...dataset.promotions, createPromotion({ restaurant_id: restaurant.id, dish_id: promoForm.dish_id, type: promoForm.type, value, start_date: new Date().toISOString().slice(0, 10), end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) })];
    commit({ ...dataset, promotions: nextPromos });
    setIsFormOpen(false);
    setPromoForm({ id: null, dish_id: '', type: 'percentage', value: '', start_date: '', end_date: '' });
  }

  // --- ACTIONS STOCK ---
  function adjustStock(ing, amount) {
    const nextIngs = dataset.ingredients.map(i => i.id === ing.id ? { ...i, stock_quantity: Math.max(0, (i.stock_quantity || 0) + amount) } : i);
    commit({ ...dataset, ingredients: nextIngs });
  }

  // --- PLANNING ---
  function addTask() {
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTask, done: false }]);
    setNewTask('');
  }
  function toggleTask(id) {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }
  function deleteTask(id) {
    setTasks(tasks.filter(t => t.id !== id));
  }

  if (!dataset || !restaurant) return <div className="team-page">{t('common.loading')}</div>;

  // Calculs globaux
  const activeEmployees = dataset.employees.filter(e => e.active !== false);
  const lowStockCount = dataset.ingredients.filter(i => (i.stock_quantity || 0) <= (i.min_stock || 0)).length;
  const totalMonthlyCharges = dataset.fixed_costs.reduce((sum, c) => sum + (c.frequency === 'monthly' ? c.amount : c.frequency === 'weekly' ? c.amount * 4.33 : c.amount * 30), 0);

  return (
    <div className="team-page">
      <header className="team-header">
        {view !== 'dashboard' && <BackButton onClick={handleBack} />}
        <h1 className="team-title">
          {view === 'dashboard' ? t('team.title') : t(`team.${view === 'ingredients' ? 'costIngredients' : view}`)}
        </h1>
      </header>

      {/* ================= DASHBOARD ================= */}
      {view === 'dashboard' && (
        <div className="management-hub">
          <div className="hub-section">
            <h2 className="hub-section-title">{t('team.sections.hr')}</h2>
            <div className="team-grid">
              <div className="team-card card-blue" onClick={() => setView('employees')}>
                <span className="icon">👥</span>
                <h3>{t('team.employees')}</h3>
                <p>{activeEmployees.length} {t('team.employees').toLowerCase()}</p>
              </div>
              <div className="team-card card-green" onClick={() => setView('planning')}>
                <span className="icon">📅</span>
                <h3>{t('team.planning')}</h3>
                <p>{t('team.planningDetail')}</p>
              </div>
            </div>
          </div>

          <div className="hub-section">
            <h2 className="hub-section-title">{t('team.sections.finance')}</h2>
            <div className="team-grid">
              <div className="team-card card-orange" onClick={() => setView('costs')}>
                <span className="icon">💳</span>
                <h3>{t('team.fixedCosts')}</h3>
                <p>{formatCurrency(totalMonthlyCharges)} / {t('team.freq.monthly').toLowerCase()}</p>
              </div>
              <div className="team-card card-purple" onClick={() => setView('expenses')}>
                <span className="icon">💸</span>
                <h3>{t('team.expenses')}</h3>
                <p>{dataset.expenses.length} {t('team.filters.items')}</p>
              </div>
            </div>
          </div>

          <div className="hub-section">
            <h2 className="hub-section-title">{t('team.sections.stock')}</h2>
            <div className="team-grid">
              <div className="team-card card-blue" onClick={() => setView('ingredients')}>
                <span className="icon">🥗</span>
                <h3>{t('team.costIngredients')}</h3>
                <p>{dataset.ingredients.length} {t('team.filters.items')}</p>
              </div>
              <div className="team-card card-orange" onClick={() => setView('stock')}>
                <span className="icon">📦</span>
                <h3>{t('team.stock')}</h3>
                <p style={{ color: lowStockCount > 0 ? '#FFF' : 'inherit' }}>{lowStockCount} alertes</p>
              </div>
              <div className="team-card card-green" onClick={() => setView('suppliers')}>
                <span className="icon">🚚</span>
                <h3>{t('team.suppliers')}</h3>
                <p>{dataset.suppliers.length} {t('team.filters.items')}</p>
              </div>
            </div>
          </div>

          <div className="hub-section">
            <h2 className="hub-section-title">{t('team.sections.marketing')}</h2>
            <div className="team-grid">
              <div className="team-card card-purple" onClick={() => setView('promotions')}>
                <span className="icon">🏷️</span>
                <h3>{t('team.promotions')}</h3>
                <p>{dataset.promotions.length} {t('team.filters.items')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= EMPLOYÉS ================= */}
      {view === 'employees' && (
        <div className="section-container">
          <button className="btn-primary full-width" onClick={() => { setEmpForm({ id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5 }); setIsFormOpen(true); }}>
            + {t('team.addEmployee')}
          </button>
          <div className="list">
            {[...dataset.employees].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map((emp, idx, arr) => (
              <div key={emp.id} className="list-item">
                <div className="list-item-info">
                  <h4>{emp.name}</h4>
                  <p>{emp.role || '-'} · {formatCurrency(emp.salary_type === 'monthly' ? emp.monthly_salary : emp.hourly_rate)} / {emp.salary_type === 'monthly' ? t('team.monthly').toLowerCase() : t('team.hourly').toLowerCase()} · {emp.days_per_week}j/sem</p>
                </div>
                <div className="list-item-actions">
                  <button className="btn-icon" onClick={() => moveItem('employees', emp, 'up')} disabled={idx === 0}>↑</button>
                  <button className="btn-icon" onClick={() => moveItem('employees', emp, 'down')} disabled={idx === arr.length - 1}>↓</button>
                  <button className="btn-edit" onClick={() => { setEmpForm({ ...emp, amount: emp.salary_type === 'monthly' ? emp.monthly_salary : emp.hourly_rate }); setIsFormOpen(true); }}>✏️</button>
                  <button className="btn-delete" onClick={() => handleDeleteItem('employees', emp.id, emp.name)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= CHARGES ================= */}
      {view === 'costs' && (
        <div className="section-container">
          <button className="btn-primary full-width" onClick={() => { setCostForm({ id: null, name: '', amount: '', frequency: 'monthly' }); setIsFormOpen(true); }}>
            + {t('team.addFixedCost')}
          </button>
          <div className="list">
            {[...dataset.fixed_costs].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map((cost, idx, arr) => (
              <div key={cost.id} className="list-item">
                <div className="list-item-info">
                  <h4>{cost.name}</h4>
                  <p>{formatCurrency(cost.amount)} / {t(`team.freq.${cost.frequency}`).toLowerCase()}</p>
                </div>
                <div className="list-item-actions">
                  <button className="btn-icon" onClick={() => moveItem('fixed_costs', cost, 'up')} disabled={idx === 0}>↑</button>
                  <button className="btn-icon" onClick={() => moveItem('fixed_costs', cost, 'down')} disabled={idx === arr.length - 1}>↓</button>
                  <button className="btn-edit" onClick={() => { setCostForm(cost); setIsFormOpen(true); }}>✏️</button>
                  <button className="btn-delete" onClick={() => handleDeleteItem('fixed_costs', cost.id, cost.name)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= INGRÉDIENTS ================= */}
      {view === 'ingredients' && (
        <div className="section-container">
          <button className="btn-primary full-width" onClick={() => { setIngForm({ id: null, name: '', category: 'dish', unit: 'g', unit_cost: '', supplier_id: '' }); setIsFormOpen(true); }}>
            + {t('menu.ingredients.add')}
          </button>
          <div className="list">
            {[...dataset.ingredients].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map((ing, idx, arr) => (
              <div key={ing.id} className="list-item ingredient-card">
                <div className="list-item-info">
                  <h4>{CATEGORY_EMOJI[ing.category]} {ing.name}</h4>
                  <p>{formatCurrency(ing.unit_cost)} / {ing.unit} {ing.supplier_id && `· ${dataset.suppliers.find(s=>s.id===ing.supplier_id)?.name || ''}`}</p>
                </div>
                <div className="list-item-actions">
                  <button className="btn-icon" onClick={() => moveItem('ingredients', ing, 'up')} disabled={idx === 0}>↑</button>
                  <button className="btn-icon" onClick={() => moveItem('ingredients', ing, 'down')} disabled={idx === arr.length - 1}>↓</button>
                  <button className="btn-edit" onClick={() => { setIngForm({ ...ing, unit_cost: String(ing.unit_cost) }); setIsFormOpen(true); }}>✏️</button>
                  <button className="btn-delete" onClick={() => handleDeleteItem('ingredients', ing.id, ing.name)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= FOURNISSEURS ================= */}
      {view === 'suppliers' && (
        <div className="section-container">
          <button className="btn-primary full-width" onClick={() => { setSupForm({ id: null, name: '', phone: '', notes: '' }); setIsFormOpen(true); }}>
            + {t('team.addSupplier')}
          </button>
          <div className="list">
            {dataset.suppliers.map(sup => (
              <div key={sup.id} className="list-item">
                <div className="list-item-info">
                  <h4>{sup.name}</h4>
                  <p>{sup.phone} {sup.notes && `· ${sup.notes}`}</p>
                </div>
                <div className="list-item-actions">
                  <a href={`tel:${sup.phone}`} className="btn-icon" style={{ textDecoration: 'none' }}>📞</a>
                  <button className="btn-edit" onClick={() => { setSupForm(sup); setIsFormOpen(true); }}>✏️</button>
                  <button className="btn-delete" onClick={() => handleDeleteItem('suppliers', sup.id, sup.name)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= DÉPENSES ================= */}
      {view === 'expenses' && (
        <div className="section-container">
          <button className="btn-primary full-width" onClick={() => { setExpForm({ id: null, name: '', amount: '', category: 'material', note: '' }); setIsFormOpen(true); }}>
            + {t('team.addExpense')}
          </button>
          <div className="list">
            {dataset.expenses.map(exp => (
              <div key={exp.id} className="list-item">
                <div className="list-item-info">
                  <h4>{exp.note || t(`team.expenseCats.${exp.category}`)}</h4>
                  <p>{exp.date} · {t(`team.expenseCats.${exp.category}`)}</p>
                </div>
                <div className="list-item-actions">
                  <span style={{ fontWeight: 'bold', color: '#E53935' }}>-{formatCurrency(exp.amount)}</span>
                  <button className="btn-delete" onClick={() => handleDeleteItem('expenses', exp.id, exp.note || 'Dépense')}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= PROMOTIONS ================= */}
      {view === 'promotions' && (
        <div className="section-container">
          <button className="btn-primary full-width" onClick={() => { setPromoForm({ id: null, dish_id: '', type: 'percentage', value: '' }); setIsFormOpen(true); }}>
            + {t('team.addPromo')}
          </button>
          <div className="list">
            {dataset.promotions.map(promo => {
              const dish = dataset.dishes.find(d => d.id === promo.dish_id);
              return (
                <div key={promo.id} className={`list-item ${promo.active ? 'promo-active' : 'promo-inactive'}`}>
                  <div className="list-item-info">
                    <h4>🏷️ {dish ? dish.name : 'Plat inconnu'}</h4>
                    <p>
                      {promo.type === 'percentage' ? `-${promo.value}%` : `-${formatCurrency(promo.value)}`}
                      {promo.start_date && ` · ${promo.start_date}`} {promo.end_date && `→ ${promo.end_date}`}
                    </p>
                  </div>
                  <div className="list-item-actions">
                    <button className="btn-delete" onClick={() => handleDeleteItem('promotions', promo.id, dish?.name || 'Promo')}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= STOCK ================= */}
      {view === 'stock' && (
        <div className="section-container">
          <div className="list">
            {dataset.ingredients.map(ing => {
              const stock = ing.stock_quantity || 0;
              const min = ing.min_stock || 0;
              const pct = min > 0 ? Math.min(100, (stock / (min * 2)) * 100) : (stock > 0 ? 100 : 0);
              const color = stock <= min ? '#E53935' : stock <= min * 1.5 ? '#FF9800' : '#43A047';
              return (
                <div key={ing.id} className="list-item stock-item">
                  <div className="list-item-info" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                      <h4>{ing.name}</h4>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{stock} {ing.unit}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#F0F0F0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color }} />
                    </div>
                  </div>
                  <div className="list-item-actions">
                    <button className="btn-icon" onClick={() => adjustStock(ing, -1)}>-</button>
                    <button className="btn-icon" onClick={() => adjustStock(ing, 1)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= PLANNING ================= */}
      {view === 'planning' && (
        <div className="section-container">
          <div className="planning-week">
            {t('team.days').map((day, index) => {
              const isWeekend = index === 5 || index === 6;
              const isActive = selectedDay === index;
              return (
                <div key={day} className={`planning-day-card ${isActive ? 'active' : ''} ${isWeekend ? 'weekend' : ''}`} onClick={() => setSelectedDay(index)}>
                  <span className="day-label">{day.substring(0, 3)}</span>
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
                {tasks.map(task => (
                  <div key={task.id} className="task-item">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: task.done ? 'line-through' : 'none', opacity: task.done ? 0.5 : 1 }}>
                      <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                      <span>{task.text}</span>
                    </label>
                    <button className="btn-delete" style={{ fontSize: '1rem' }} onClick={() => deleteTask(task.id)}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input className="form-input" placeholder={t('team.taskPlaceholder')} value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
                <button className="btn-primary" style={{ padding: '0 16px', borderRadius: '12px' }} onClick={addTask}>+</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALES ================= */}
      
      {/* Formulaire Employé */}
      <FormModal isOpen={isFormOpen && view === 'employees'} onClose={() => setIsFormOpen(false)} title={empForm.id ? t('common.edit') : t('team.addEmployee')}>
        <form className="form-card" onSubmit={saveEmployee}>
          <input className="form-input" type="text" placeholder={t('team.name')} value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} required />
          <input className="form-input" type="text" placeholder={t('team.role')} value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })} />
          <div className="row-inputs">
            <select className="form-select" value={empForm.salary_type} onChange={e => setEmpForm({ ...empForm, salary_type: e.target.value })}>
              <option value="monthly">{t('team.monthly')}</option>
              <option value="hourly">{t('team.hourly')}</option>
            </select>
            <input className="form-input" type="number" placeholder={t('team.amount')} value={empForm.amount} onChange={e => setEmpForm({ ...empForm, amount: e.target.value })} required />
          </div>
          <input className="form-input" type="number" min="1" max="7" placeholder={t('team.employeeDays')} value={empForm.days_per_week} onChange={e => setEmpForm({ ...empForm, days_per_week: e.target.value })} required />
          <button type="submit" className="btn-primary">{t('common.save')}</button>
        </form>
      </FormModal>

      {/* Formulaire Charge */}
      <FormModal isOpen={isFormOpen && view === 'costs'} onClose={() => setIsFormOpen(false)} title={costForm.id ? t('common.edit') : t('team.addFixedCost')}>
        <form className="form-card" onSubmit={saveCost}>
          <input className="form-input" type="text" placeholder={t('team.name')} value={costForm.name} onChange={e => setCostForm({ ...costForm, name: e.target.value })} required />
          <div className="row-inputs">
            <input className="form-input" type="number" placeholder={t('team.amount')} value={costForm.amount} onChange={e => setCostForm({ ...costForm, amount: e.target.value })} required />
            <select className="form-select" value={costForm.frequency} onChange={e => setCostForm({ ...costForm, frequency: e.target.value })}>
              <option value="monthly">{t('team.freq.monthly')}</option>
              <option value="weekly">{t('team.freq.weekly')}</option>
              <option value="daily">{t('team.freq.daily')}</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">{t('common.save')}</button>
        </form>
      </FormModal>

      {/* Formulaire Ingrédient */}
      <FormModal isOpen={isFormOpen && view === 'ingredients'} onClose={() => setIsFormOpen(false)} title={ingForm.id ? t('common.edit') : t('menu.ingredients.add')}>
        <form className="form-card" onSubmit={saveIngredient}>
          <input className="form-input" type="text" placeholder={t('menu.ingredients.name')} value={ingForm.name} onChange={e => setIngForm({ ...ingForm, name: e.target.value })} required />
          <select className="form-select" value={ingForm.category} onChange={e => setIngForm({ ...ingForm, category: e.target.value })}>
            {MENU_CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_EMOJI[cat]} {t(`menu.sections.${cat}`)}</option>)}
          </select>
          <div className="row-inputs">
            <select className="form-select" value={ingForm.unit} onChange={e => setIngForm({ ...ingForm, unit: e.target.value })}>
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input className="form-input" type="number" placeholder={t('menu.ingredients.unitCost')} value={ingForm.unit_cost} onChange={e => setIngForm({ ...ingForm, unit_cost: e.target.value })} required />
          </div>
          <select className="form-select" value={ingForm.supplier_id} onChange={e => setIngForm({ ...ingForm, supplier_id: e.target.value })}>
            <option value="">{t('team.noSupplier')}</option>
            {dataset.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="submit" className="btn-primary">{t('common.save')}</button>
        </form>
      </FormModal>

      {/* Formulaire Fournisseur */}
      <FormModal isOpen={isFormOpen && view === 'suppliers'} onClose={() => setIsFormOpen(false)} title={supForm.id ? t('common.edit') : t('team.addSupplier')}>
        <form className="form-card" onSubmit={saveSupplier}>
          <input className="form-input" type="text" placeholder={t('team.name')} value={supForm.name} onChange={e => setSupForm({ ...supForm, name: e.target.value })} required />
          <input className="form-input" type="tel" placeholder={t('team.phone')} value={supForm.phone} onChange={e => setSupForm({ ...supForm, phone: e.target.value })} />
          <input className="form-input" type="text" placeholder={t('team.notes')} value={supForm.notes} onChange={e => setSupForm({ ...supForm, notes: e.target.value })} />
          <button type="submit" className="btn-primary">{t('common.save')}</button>
        </form>
      </FormModal>

      {/* Formulaire Dépense */}
      <FormModal isOpen={isFormOpen && view === 'expenses'} onClose={() => setIsFormOpen(false)} title={t('team.addExpense')}>
        <form className="form-card" onSubmit={saveExpense}>
          <input className="form-input" type="number" placeholder={t('team.amount')} value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} required />
          <select className="form-select" value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
            {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{t(`team.expenseCats.${cat}`)}</option>)}
          </select>
          <input className="form-input" type="text" placeholder={t('team.notes')} value={expForm.name} onChange={e => setExpForm({ ...expForm, name: e.target.value })} />
          <button type="submit" className="btn-primary">{t('common.save')}</button>
        </form>
      </FormModal>

      {/* Formulaire Promotion */}
      <FormModal isOpen={isFormOpen && view === 'promotions'} onClose={() => setIsFormOpen(false)} title={t('team.addPromo')}>
        <form className="form-card" onSubmit={savePromotion}>
          <select className="form-select" value={promoForm.dish_id} onChange={e => setPromoForm({ ...promoForm, dish_id: e.target.value })} required>
            <option value="">{t('team.selectDish')}</option>
            {dataset.dishes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="row-inputs">
            <select className="form-select" value={promoForm.type} onChange={e => setPromoForm({ ...promoForm, type: e.target.value })}>
              <option value="percentage">%</option>
              <option value="fixed_amount">VND</option>
            </select>
            <input className="form-input" type="number" placeholder={t('team.amount')} value={promoForm.value} onChange={e => setPromoForm({ ...promoForm, value: e.target.value })} required />
          </div>
          <button type="submit" className="btn-primary">{t('common.save')}</button>
        </form>
      </FormModal>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        confirmText={t('common.delete')}
        isDestructive={true}
      />
    </div>
  );
}