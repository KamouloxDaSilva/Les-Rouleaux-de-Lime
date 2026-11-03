// src/pages/TeamPage.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useI18n } from '../i18n';
import {
  getActiveRestaurant,
  createEmployee,
  createFixedCost,
  createIngredient,
  createSupplier,
  createExpense,
  createPromotion,
  createTask,
  MENU_CATEGORIES,
  INGREDIENT_CATEGORIES,
  STORAGE_TYPES,
  BASE_UNITS,
  EXPENSE_CATEGORIES,
  TASK_TYPES,
} from '../data/model';
import { loadDataset, saveDataset } from '../data/storage';
import BackButton from '../components/BackButton';
import ConfirmModal from '../components/ConfirmModal';
import FormModal from '../components/FormModal';
import CalendarStrip from '../components/CalendarStrip';
import BottomSheet from '../components/BottomSheet';
import Toast from '../components/Toast';
import PillSelector from '../components/PillSelector';
import SearchBar from '../components/SearchBar';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import SkeletonLoader from '../components/SkeletonLoader';
import './TeamPage.css';

// ── Emojis catégories MENU (pour le stock) ──────────────────────────
const MENU_CATEGORY_EMOJI = { dish: '🥗', drink: '🥤', dessert: '🍰', sauce: '🥫' };

// ── Emojis catégories INGRÉDIENTS v9 ────────────────────────────────
const INGREDIENT_CATEGORY_EMOJI = {
  meat: '🥩', fish: '🐟', vegetable: '🥬', fruit: '🍎', staple: '🍚',
  dairy: '🧀', spice: '🌿', sauce: '🥫', oil: '🫒', beverage: '🥤',
  packaging: '📦', cleaning: '🧴',
};

// ── Presets par catégorie (SPEC_UNITES §5) ──────────────────────────
const CATEGORY_PRESETS = {
  meat: {
    base_unit: 'g',
    purchase_options: [
      { label: 'kg', quantity_in_base: 1000 },
      { label: 'barquette 500g', quantity_in_base: 500 },
    ],
    recipe_units: [
      { label: 'g', quantity_in_base: 1, is_default: true },
      { label: 'portion 150g', quantity_in_base: 150 },
    ],
  },
  fish: {
    base_unit: 'g',
    purchase_options: [
      { label: 'kg', quantity_in_base: 1000 },
      { label: 'filet 200g', quantity_in_base: 200 },
    ],
    recipe_units: [
      { label: 'g', quantity_in_base: 1, is_default: true },
      { label: 'filet', quantity_in_base: 150 },
    ],
  },
  vegetable: {
    base_unit: 'g',
    purchase_options: [
      { label: 'kg', quantity_in_base: 1000 },
      { label: 'botte 200g', quantity_in_base: 200 },
    ],
    recipe_units: [
      { label: 'g', quantity_in_base: 1, is_default: true },
      { label: 'feuille 10g', quantity_in_base: 10 },
      { label: 'botte', quantity_in_base: 200 },
    ],
  },
  fruit: {
    base_unit: 'g',
    purchase_options: [
      { label: 'kg', quantity_in_base: 1000 },
      { label: 'pièce', quantity_in_base: 150 },
      { label: 'barquette', quantity_in_base: 500 },
    ],
    recipe_units: [
      { label: 'g', quantity_in_base: 1, is_default: true },
      { label: 'pièce', quantity_in_base: 150 },
      { label: 'tranche 25g', quantity_in_base: 25 },
    ],
  },
  staple: {
    base_unit: 'g',
    purchase_options: [
      { label: 'kg', quantity_in_base: 1000 },
      { label: 'sac 5kg', quantity_in_base: 5000 },
    ],
    recipe_units: [
      { label: 'g', quantity_in_base: 1, is_default: true },
      { label: 'portion 100g', quantity_in_base: 100 },
      { label: 'bol 200g', quantity_in_base: 200 },
    ],
  },
  dairy: {
    base_unit: 'ml',
    purchase_options: [
      { label: 'L', quantity_in_base: 1000 },
      { label: 'plaquette 250g', quantity_in_base: 250 },
    ],
    recipe_units: [
      { label: 'ml', quantity_in_base: 1, is_default: true },
      { label: 'c. à soupe 15ml', quantity_in_base: 15 },
    ],
  },
  spice: {
    base_unit: 'g',
    purchase_options: [
      { label: 'pot 50g', quantity_in_base: 50 },
      { label: 'sachet 100g', quantity_in_base: 100 },
    ],
    recipe_units: [
      { label: 'g', quantity_in_base: 1, is_default: true },
      { label: 'c. à café 5g', quantity_in_base: 5 },
      { label: 'pincée 1g', quantity_in_base: 1 },
    ],
  },
  sauce: {
    base_unit: 'ml',
    purchase_options: [
      { label: 'bouteille 750ml', quantity_in_base: 750 },
      { label: 'pot 500g', quantity_in_base: 500 },
    ],
    recipe_units: [
      { label: 'ml', quantity_in_base: 1, is_default: true },
      { label: 'c. à soupe 15ml', quantity_in_base: 15 },
    ],
  },
  oil: {
    base_unit: 'ml',
    purchase_options: [
      { label: 'bouteille 1L', quantity_in_base: 1000 },
      { label: 'bidon 5L', quantity_in_base: 5000 },
    ],
    recipe_units: [
      { label: 'ml', quantity_in_base: 1, is_default: true },
      { label: 'c. à soupe 15ml', quantity_in_base: 15 },
    ],
  },
  beverage: {
    base_unit: 'ml',
    purchase_options: [
      { label: 'canette 330ml', quantity_in_base: 330 },
      { label: 'bouteille 750ml', quantity_in_base: 750 },
    ],
    recipe_units: [
      { label: 'ml', quantity_in_base: 1, is_default: true },
      { label: 'verre 250ml', quantity_in_base: 250 },
    ],
  },
  packaging: {
    base_unit: 'piece',
    purchase_options: [
      { label: 'pack 100', quantity_in_base: 100 },
      { label: 'carton 1000', quantity_in_base: 1000 },
    ],
    recipe_units: [
      { label: 'piece', quantity_in_base: 1, is_default: true },
    ],
  },
  cleaning: {
    base_unit: 'ml',
    purchase_options: [
      { label: 'bidon 5L', quantity_in_base: 5000 },
      { label: 'bouteille 1L', quantity_in_base: 1000 },
    ],
    recipe_units: [
      { label: 'ml', quantity_in_base: 1, is_default: true },
    ],
  },
};

const UNIT_I18N_KEYS = {
  g: 'g', kg: 'kg', t: 't', ml: 'ml', cl: 'cl', l: 'l',
  'pièce': 'piece', 'cái': 'piece_vi', 'tờ': 'sheet',
  'hộp': 'box', 'gói': 'pack', 'bó': 'bunch',
};

function unitLabel(t, unitId) {
  if (!unitId) return '';
  const key = UNIT_I18N_KEYS[unitId] || unitId;
  const path = `team.units.${key}`;
  const val = t(path);
  return val === path ? unitId : val;
}

function bucketKey(task) {
  if (!task) return 'day';
  if (task.type === 'day') {
    return `day_${Number.isInteger(task.day_of_week) ? task.day_of_week : 0}`;
  }
  return task.type || 'day';
}

function tempId() {
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function HubCard({ className = '', icon, title, subtitle, onClick }) {
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      className={`team-card ${className}`.trim()}
      onClick={onClick}
      onKeyDown={handleKey}
    >
      <span className="icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );
}

export default function TeamPage() {
  const { t, formatCurrency } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [view, setView] = useState('dashboard');

  // --- MODALES ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false, title: '', message: '', onConfirm: null,
  });

  // --- TOAST ---
  const [toast, setToast] = useState({ open: false, message: '', variant: 'success' });
  const showToast = useCallback((message, variant = 'success') => {
    setToast({ open: true, message, variant });
  }, []);
  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  // --- FORMULAIRES ---
  const [empForm, setEmpForm] = useState({
    id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5,
  });
  const [costForm, setCostForm] = useState({ id: null, name: '', amount: '', frequency: 'monthly' });

  const emptyIngForm = {
    id: null,
    name: '',
    category: 'meat',
    base_unit: 'g',
    reference_unit_cost: '',
    preferred_supplier_id: '',
    storage_type: 'ambient',
    shelf_life_days: '',
    stock_quantity: 0,
    min_stock: 0,
    track_stock: true,
    yield_factor_pct: 100,
    purchase_options: [],
    recipe_units: [],
  };
  const [ingForm, setIngForm] = useState(emptyIngForm);
  const [ingredientSheetOpen, setIngredientSheetOpen] = useState(false);

  const [supForm, setSupForm] = useState({ id: null, name: '', phone: '', notes: '' });
  const [expForm, setExpForm] = useState({ id: null, name: '', amount: '', category: 'material', note: '' });
  const [promoForm, setPromoForm] = useState({
    id: null, dish_id: '', type: 'percentage', value: '', start_date: '', end_date: '',
  });

  // --- PLANNING (CalendarStrip + BottomSheet) ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [newTaskType, setNewTaskType] = useState('day');

  const selectedDayOfWeek = useMemo(() => {
    const d = selectedDate.getDay();
    return (d + 6) % 7; // 0 = lundi, 6 = dimanche
  }, [selectedDate]);

  // --- FILTRES ---
  const [ingredientFilter, setIngredientFilter] = useState('all');
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [supplierSearch, setSupplierSearch] = useState('');

  useEffect(() => {
    setDataset(loadDataset());
  }, []);

  const restaurant = useMemo(
    () => (dataset ? getActiveRestaurant(dataset) : null),
    [dataset]
  );

  // --- LISTES FILTRÉES & TRIÉES ---
  const filteredIngredients = useMemo(() => {
    if (!dataset) return [];
    let list = [...(dataset.ingredients || [])].sort(
      (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    );
    if (ingredientFilter !== 'all') {
      list = list.filter((i) => (i.category || '') === ingredientFilter);
    }
    if (ingredientSearch.trim()) {
      const q = ingredientSearch.trim().toLowerCase();
      list = list.filter((i) => (i.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [dataset, ingredientFilter, ingredientSearch]);

  const filteredStock = useMemo(() => {
    if (!dataset) return [];
    let list = [...(dataset.ingredients || [])].sort(
      (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    );
    if (stockFilter !== 'all') {
      list = list.filter((i) => (i.category || 'dish') === stockFilter);
    }
    return list;
  }, [dataset, stockFilter]);

  const filteredSuppliers = useMemo(() => {
    if (!dataset) return [];
    const list = [...(dataset.suppliers || [])].sort(
      (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    );
    if (!supplierSearch.trim()) return list;
    const q = supplierSearch.trim().toLowerCase();
    return list.filter((s) => (s.name || '').toLowerCase().includes(q));
  }, [dataset, supplierSearch]);

  // --- COMMIT (save avant setState pour atomicité) ---
  function commit(next, options = {}) {
    try {
      saveDataset(next);
      setDataset(next);
      if (options.success) showToast(options.success, 'success');
      return true;
    } catch (err) {
      showToast(t('common.error'), 'error');
      return false;
    }
  }

  // --- HELPERS ---
  function handleBack() {
    setView('dashboard');
    setIsFormOpen(false);
    setIngredientSheetOpen(false);
    setTaskSheetOpen(false);
  }

  function openConfirm(title, message, onConfirm) {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  }

  function handleDeleteItem(collection, id, name) {
    openConfirm(
      t('common.delete'),
      `${t('common.delete')} "${name}" ?`,
      () => {
        const next = {
          ...dataset,
          [collection]: (dataset[collection] || []).filter((item) => item.id !== id),
        };
        const ok = commit(next, { success: t('common.success') });
        if (ok) setConfirmConfig((c) => ({ ...c, isOpen: false }));
      }
    );
  }

  function nextSortOrder(collection) {
    const list = dataset[collection] || [];
    return list.reduce((m, it) => Math.max(m, Number(it.sort_order) || 0), -1) + 1;
  }

  function moveItem(collection, item, direction) {
    const source = dataset[collection] || [];
    const list = [...source].sort((a, b) => {
      const sa = Number(a.sort_order) || 0;
      const sb = Number(b.sort_order) || 0;
      return sa - sb;
    });
    const index = list.findIndex((i) => i.id === item.id);
    if (index < 0) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= list.length) return;
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
    const renumbered = list.map((it, i) => ({ ...it, sort_order: i }));
    commit({ ...dataset, [collection]: renumbered });
  }

  function moveTask(task, direction) {
    const allTasks = dataset.tasks || [];
    const bucket = bucketKey(task);
    const sameBucket = allTasks
      .filter((tk) => bucketKey(tk) === bucket)
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    const idx = sameBucket.findIndex((tk) => tk.id === task.id);
    if (idx < 0) return;
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= sameBucket.length) return;
    const reordered = [...sameBucket];
    [reordered[idx], reordered[neighborIdx]] = [reordered[neighborIdx], reordered[idx]];
    const renumbered = reordered.map((tk, i) => ({ ...tk, sort_order: i }));
    const map = new Map(renumbered.map((tk) => [tk.id, tk]));
    const nextTasks = allTasks.map((tk) => map.get(tk.id) || tk);
    commit({ ...dataset, tasks: nextTasks });
  }

  // --- SAUVEGARDE EMPLOYÉS ---
  function saveEmployee(e) {
    e.preventDefault();
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
    if (empForm.id) {
      nextEmployees = dataset.employees.map((emp) =>
        emp.id === empForm.id ? { ...emp, ...empData } : emp
      );
    } else {
      nextEmployees = [
        ...dataset.employees,
        createEmployee({ ...empData, sort_order: nextSortOrder('employees') }),
      ];
    }
    const ok = commit({ ...dataset, employees: nextEmployees }, {
      success: t('closing.saveSuccess'),
    });
    if (ok) {
      setIsFormOpen(false);
      setEmpForm({ id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5 });
    }
  }

  // --- SAUVEGARDE CHARGES ---
  function saveCost(e) {
    e.preventDefault();
    const amount = Number(costForm.amount);
    let nextCosts;
    if (costForm.id) {
      nextCosts = dataset.fixed_costs.map((c) =>
        c.id === costForm.id
          ? { ...c, name: costForm.name, amount, frequency: costForm.frequency }
          : c
      );
    } else {
      nextCosts = [
        ...dataset.fixed_costs,
        createFixedCost({
          restaurant_id: restaurant.id,
          name: costForm.name,
          amount,
          frequency: costForm.frequency,
          sort_order: nextSortOrder('fixed_costs'),
        }),
      ];
    }
    const ok = commit({ ...dataset, fixed_costs: nextCosts }, {
      success: t('closing.saveSuccess'),
    });
    if (ok) {
      setIsFormOpen(false);
      setCostForm({ id: null, name: '', amount: '', frequency: 'monthly' });
    }
  }

  // --- SAUVEGARDE INGRÉDIENTS (v9) ---
  function saveIngredient(e) {
    e.preventDefault();
    const yieldFactor = Math.max(0.01, (Number(ingForm.yield_factor_pct) || 100) / 100);
    const payload = {
      restaurant_id: restaurant.id,
      name: ingForm.name,
      category: ingForm.category,
      base_unit: ingForm.base_unit,
      reference_unit_cost: Number(ingForm.reference_unit_cost) || 0,
      preferred_supplier_id: ingForm.preferred_supplier_id || '',
      storage_type: ingForm.storage_type,
      shelf_life_days: ingForm.shelf_life_days === '' ? null : Number(ingForm.shelf_life_days),
      stock_quantity: Number(ingForm.stock_quantity) || 0,
      min_stock: Number(ingForm.min_stock) || 0,
      track_stock: ingForm.track_stock,
      yield_factor: yieldFactor,
      purchase_options: ingForm.purchase_options
        .filter((o) => (o.label || '').trim())
        .map((o) => ({
          id: o.id,
          label: o.label.trim(),
          quantity_in_base: Number(o.quantity_in_base) || 1,
        })),
      recipe_units: ingForm.recipe_units
        .filter((u) => (u.label || '').trim())
        .map((u) => ({
          id: u.id,
          label: u.label.trim(),
          quantity_in_base: Number(u.quantity_in_base) || 1,
          is_default: u.is_default === true,
        })),
    };

    let nextIngs;
    if (ingForm.id) {
      nextIngs = dataset.ingredients.map((i) =>
        i.id === ingForm.id ? createIngredient({ ...i, ...payload, id: i.id }) : i
      );
    } else {
      nextIngs = [
        ...dataset.ingredients,
        createIngredient({ ...payload, sort_order: nextSortOrder('ingredients') }),
      ];
    }
    const ok = commit({ ...dataset, ingredients: nextIngs }, {
      success: t('closing.saveSuccess'),
    });
    if (ok) {
      setIngredientSheetOpen(false);
      setIngForm(emptyIngForm);
    }
  }

  // --- SAUVEGARDE FOURNISSEURS ---
  function saveSupplier(e) {
    e.preventDefault();
    let nextSups;
    if (supForm.id) {
      nextSups = dataset.suppliers.map((s) =>
        s.id === supForm.id
          ? { ...s, name: supForm.name, phone: supForm.phone, notes: supForm.notes }
          : s
      );
    } else {
      nextSups = [
        ...dataset.suppliers,
        createSupplier({
          restaurant_id: restaurant.id,
          ...supForm,
          sort_order: nextSortOrder('suppliers'),
        }),
      ];
    }
    const ok = commit({ ...dataset, suppliers: nextSups }, {
      success: t('closing.saveSuccess'),
    });
    if (ok) {
      setIsFormOpen(false);
      setSupForm({ id: null, name: '', phone: '', notes: '' });
    }
  }

  // --- SAUVEGARDE DÉPENSES ---
  function saveExpense(e) {
    e.preventDefault();
    const amount = Number(expForm.amount);
    const nextExps = [
      ...dataset.expenses,
      createExpense({
        restaurant_id: restaurant.id,
        date: new Date().toISOString().slice(0, 10),
        amount,
        category: expForm.category,
        note: expForm.name,
      }),
    ];
    const ok = commit({ ...dataset, expenses: nextExps }, {
      success: t('closing.saveSuccess'),
    });
    if (ok) {
      setIsFormOpen(false);
      setExpForm({ id: null, name: '', amount: '', category: 'material', note: '' });
    }
  }

  // --- SAUVEGARDE PROMOTIONS ---
  function savePromotion(e) {
    e.preventDefault();
    const value = Number(promoForm.value);
    const nextPromos = [
      ...dataset.promotions,
      createPromotion({
        restaurant_id: restaurant.id,
        dish_id: promoForm.dish_id,
        type: promoForm.type,
        value,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      }),
    ];
    const ok = commit({ ...dataset, promotions: nextPromos }, {
      success: t('closing.saveSuccess'),
    });
    if (ok) {
      setIsFormOpen(false);
      setPromoForm({ id: null, dish_id: '', type: 'percentage', value: '', start_date: '', end_date: '' });
    }
  }

  // --- ACTIONS STOCK ---
  function adjustStock(ing, amount) {
    const nextIngs = dataset.ingredients.map((i) =>
      i.id === ing.id
        ? { ...i, stock_quantity: Math.max(0, (i.stock_quantity || 0) + amount) }
        : i
    );
    commit({ ...dataset, ingredients: nextIngs });
  }

  // --- PLANNING ---
  function nextTaskSortOrder(type, dayOfWeek) {
    const allTasks = dataset.tasks || [];
    const bucket = type === 'day' ? `day_${dayOfWeek}` : type;
    const sameBucket = allTasks.filter((tk) => bucketKey(tk) === bucket);
    return sameBucket.reduce((m, tk) => Math.max(m, Number(tk.sort_order) || 0), -1) + 1;
  }

  function handleAddTask(e) {
    if (e) e.preventDefault();
    const text = newTask.trim();
    if (!text) return;
    const dayOfWeek = newTaskType === 'day' ? selectedDayOfWeek : null;
    const newTaskObj = createTask({
      restaurant_id: restaurant.id,
      text,
      done: false,
      type: newTaskType,
      day_of_week: dayOfWeek,
      sort_order: nextTaskSortOrder(newTaskType, dayOfWeek),
    });
    const ok = commit(
      { ...dataset, tasks: [...(dataset.tasks || []), newTaskObj] },
      { success: t('closing.saveSuccess') }
    );
    if (ok) {
      setNewTask('');
      setTaskSheetOpen(false);
    }
  }

  function toggleTask(id) {
    const nextTasks = (dataset.tasks || []).map((tk) =>
      tk.id === id ? { ...tk, done: !tk.done, updatedAt: new Date().toISOString() } : tk
    );
    commit({ ...dataset, tasks: nextTasks });
  }

  function requestDeleteTask(task) {
    openConfirm(
      t('common.delete'),
      `${t('common.delete')} "${task.text}" ?`,
      () => {
        const next = {
          ...dataset,
          tasks: (dataset.tasks || []).filter((tk) => tk.id !== task.id),
        };
        const ok = commit(next, { success: t('common.success') });
        if (ok) setConfirmConfig((c) => ({ ...c, isOpen: false }));
      }
    );
  }

  // --- FORMULAIRE INGRÉDIENT v9 ---
  function openIngredientForm(ing = null) {
    if (ing) {
      setIngForm({
        id: ing.id,
        name: ing.name || '',
        category: ing.category || 'meat',
        base_unit: ing.base_unit || 'g',
        reference_unit_cost: ing.reference_unit_cost != null ? String(ing.reference_unit_cost) : '',
        preferred_supplier_id: ing.preferred_supplier_id || '',
        storage_type: ing.storage_type || 'ambient',
        shelf_life_days: ing.shelf_life_days != null ? String(ing.shelf_life_days) : '',
        stock_quantity: ing.stock_quantity || 0,
        min_stock: ing.min_stock || 0,
        track_stock: ing.track_stock !== false,
        yield_factor_pct: Math.round((ing.yield_factor || 1) * 100),
        purchase_options: (ing.purchase_options || []).map((o) => ({ ...o, id: o.id || tempId() })),
        recipe_units: (ing.recipe_units || []).map((u) => ({ ...u, id: u.id || tempId() })),
      });
    } else {
      setIngForm(emptyIngForm);
    }
    setIngredientSheetOpen(true);
  }

  function applyPresets() {
    const preset = CATEGORY_PRESETS[ingForm.category];
    if (!preset) return;
    setIngForm((f) => ({
      ...f,
      base_unit: preset.base_unit,
      purchase_options: preset.purchase_options.map((o) => ({ ...o, id: tempId() })),
      recipe_units: preset.recipe_units.map((u) => ({ ...u, id: tempId() })),
    }));
    showToast(t('common.success'), 'success');
  }

  function addPurchaseOption() {
    setIngForm((f) => ({
      ...f,
      purchase_options: [
        ...f.purchase_options,
        { id: tempId(), label: '', quantity_in_base: 1 },
      ],
    }));
  }

  function removePurchaseOption(id) {
    setIngForm((f) => ({
      ...f,
      purchase_options: f.purchase_options.filter((o) => o.id !== id),
    }));
  }

  function updatePurchaseOption(id, field, value) {
    setIngForm((f) => ({
      ...f,
      purchase_options: f.purchase_options.map((o) =>
        o.id === id ? { ...o, [field]: value } : o
      ),
    }));
  }

  function addRecipeUnit() {
    setIngForm((f) => ({
      ...f,
      recipe_units: [
        ...f.recipe_units,
        { id: tempId(), label: '', quantity_in_base: 1, is_default: false },
      ],
    }));
  }

  function removeRecipeUnit(id) {
    setIngForm((f) => ({
      ...f,
      recipe_units: f.recipe_units.filter((u) => u.id !== id),
    }));
  }

  function updateRecipeUnit(id, field, value) {
    setIngForm((f) => ({
      ...f,
      recipe_units: f.recipe_units.map((u) =>
        u.id === id ? { ...u, [field]: value } : u
      ),
    }));
  }

  function setDefaultRecipeUnit(id) {
    setIngForm((f) => ({
      ...f,
      recipe_units: f.recipe_units.map((u) => ({
        ...u,
        is_default: u.id === id,
      })),
    }));
  }

  // --- PILLS FILTRE CATÉGORIE (générique) ---
  function renderCategoryFilterPills(currentFilter, onFilterChange, categories, emojiMap, labelPrefix) {
    return (
      <div className="category-filter-row" role="group" aria-label={t('menu.tabs.ingredients')}>
        <button
          type="button"
          className={`filter-pill ${currentFilter === 'all' ? 'filter-pill--active' : ''}`}
          onClick={() => onFilterChange('all')}
        >
          {t('stats.filters.all')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`filter-pill ${currentFilter === cat ? 'filter-pill--active' : ''}`}
            onClick={() => onFilterChange(cat)}
          >
            <span className="filter-pill__emoji" aria-hidden="true">{emojiMap[cat] || '🍽️'}</span>
            <span className="filter-pill__label">{t(`${labelPrefix}.${cat}`)}</span>
          </button>
        ))}
      </div>
    );
  }

  if (!dataset || !restaurant) {
    return (
      <div className="team-page">
        <div className="team-loading" role="status" aria-label={t('common.loading')}>
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </div>
      </div>
    );
  }

  // --- CALCULS HUB ---
  const activeEmployees = dataset.employees.filter((e) => e.active !== false);
  const lowStockCount = dataset.ingredients.filter(
    (i) => (i.stock_quantity || 0) <= (i.min_stock || 0)
  ).length;
  const totalMonthlyCharges = dataset.fixed_costs.reduce((sum, c) => {
    const amount = Number(c.amount) || 0;
    if (c.frequency === 'monthly') return sum + amount;
    if (c.frequency === 'weekly') return sum + amount * 4.33;
    return sum + amount * 30;
  }, 0);

  // --- TÂCHES PLANNING ---
  const tasksByType = TASK_TYPES.map((type) => {
    const tasks = (dataset.tasks || [])
      .filter((tk) => tk.type === type)
      .filter((tk) => type !== 'day' || Number(tk.day_of_week) === selectedDayOfWeek)
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    return { type, tasks };
  });

  const taskTypeOptions = TASK_TYPES.map((type) => ({
    value: type,
    label: t(`team.taskTypes.${type}`),
  }));

  return (
    <div className="team-page">
      <header className="team-header">
        {view !== 'dashboard' && <BackButton onClick={handleBack} />}
        <h1 className="team-title">
          {view === 'dashboard'
            ? t('team.title')
            : t(`team.${view === 'ingredients' ? 'costIngredients' : view}`)}
        </h1>
      </header>

      {/* ================= HUB ================= */}
      {view === 'dashboard' && (
        <div className="management-hub">
          <div className="hub-section">
            <h2 className="hub-section-title">{t('team.sections.hr')}</h2>
            <div className="team-grid">
              <HubCard
                className="card-blue"
                icon="👥"
                title={t('team.employees')}
                subtitle={`${activeEmployees.length} ${t('team.employees').toLowerCase()}`}
                onClick={() => setView('employees')}
              />
              <HubCard
                className="card-green"
                icon="📅"
                title={t('team.planning')}
                subtitle={t('team.planningDetail')}
                onClick={() => setView('planning')}
              />
            </div>
          </div>

          <div className="hub-section">
            <h2 className="hub-section-title">{t('team.sections.finance')}</h2>
            <div className="team-grid">
              <HubCard
                className="card-orange"
                icon="💳"
                title={t('team.fixedCosts')}
                subtitle={`${formatCurrency(totalMonthlyCharges)} / ${t('team.freq.monthly').toLowerCase()}`}
                onClick={() => setView('costs')}
              />
              <HubCard
                className="card-purple"
                icon="💸"
                title={t('team.expenses')}
                subtitle={`${dataset.expenses.length} ${t('team.filters.items')}`}
                onClick={() => setView('expenses')}
              />
            </div>
          </div>

          <div className="hub-section">
            <h2 className="hub-section-title">{t('team.sections.stock')}</h2>
            <div className="team-grid">
              <HubCard
                className="card-blue"
                icon="🥗"
                title={t('team.costIngredients')}
                subtitle={`${dataset.ingredients.length} ${t('team.filters.items')}`}
                onClick={() => setView('ingredients')}
              />
              <HubCard
                className="card-orange"
                icon="📦"
                title={t('team.stock')}
                subtitle={
                  lowStockCount > 0
                    ? `⚠️ ${lowStockCount} ${t('team.stockManagement.alert').toLowerCase()}`
                    : `${dataset.ingredients.length} ${t('team.filters.items')}`
                }
                onClick={() => setView('stock')}
              />
              <HubCard
                className="card-green"
                icon="🚚"
                title={t('team.suppliers')}
                subtitle={`${dataset.suppliers.length} ${t('team.filters.items')}`}
                onClick={() => setView('suppliers')}
              />
            </div>
          </div>

          <div className="hub-section">
            <h2 className="hub-section-title">{t('team.sections.marketing')}</h2>
            <div className="team-grid">
              <HubCard
                className="card-purple"
                icon="🏷️"
                title={t('team.promotions')}
                subtitle={`${dataset.promotions.length} ${t('team.filters.items')}`}
                onClick={() => setView('promotions')}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= EMPLOYÉS ================= */}
      {view === 'employees' && (
        <div className="section-container">
          <button
            className="btn-primary full-width"
            onClick={() => {
              setEmpForm({ id: null, name: '', role: '', salary_type: 'monthly', amount: '', days_per_week: 5 });
              setIsFormOpen(true);
            }}
          >
            + {t('team.addEmployee')}
          </button>
          {dataset.employees.length === 0 ? (
            <EmptyState
              emoji="👥"
              title={t('team.emptyEmployees')}
              desc={t('team.addEmployee')}
            />
          ) : (
            <div className="list">
              {[...dataset.employees]
                .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
                .map((emp, idx, arr) => (
                  <div key={emp.id} className="list-item">
                    <div className="list-item-info">
                      <h4>{emp.name}</h4>
                      <p>
                        {emp.role || '-'} ·{' '}
                        {formatCurrency(
                          emp.salary_type === 'monthly' ? emp.monthly_salary : emp.hourly_rate
                        )}{' '}
                        /{' '}
                        {emp.salary_type === 'monthly'
                          ? t('team.monthly').toLowerCase()
                          : t('team.hourly').toLowerCase()}{' '}
                        · {emp.days_per_week}j/sem
                      </p>
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="btn-icon"
                        onClick={() => moveItem('employees', emp, 'up')}
                        disabled={idx === 0}
                        aria-label="↑"
                      >
                        ↑
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => moveItem('employees', emp, 'down')}
                        disabled={idx === arr.length - 1}
                        aria-label="↓"
                      >
                        ↓
                      </button>
                      <button
                        className="btn-edit"
                        onClick={() => {
                          setEmpForm({
                            ...emp,
                            amount: emp.salary_type === 'monthly' ? emp.monthly_salary : emp.hourly_rate,
                          });
                          setIsFormOpen(true);
                        }}
                        aria-label={t('common.edit')}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteItem('employees', emp.id, emp.name)}
                        aria-label={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ================= CHARGES ================= */}
      {view === 'costs' && (
        <div className="section-container">
          <button
            className="btn-primary full-width"
            onClick={() => {
              setCostForm({ id: null, name: '', amount: '', frequency: 'monthly' });
              setIsFormOpen(true);
            }}
          >
            + {t('team.addFixedCost')}
          </button>
          {dataset.fixed_costs.length === 0 ? (
            <EmptyState
              emoji="💳"
              title={t('team.emptyFixedCosts')}
              desc={t('team.addFixedCost')}
            />
          ) : (
            <div className="list">
              {[...dataset.fixed_costs]
                .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
                .map((cost, idx, arr) => (
                  <div key={cost.id} className="list-item">
                    <div className="list-item-info">
                      <h4>{cost.name}</h4>
                      <p>
                        {formatCurrency(cost.amount)} /{' '}
                        {t(`team.freq.${cost.frequency}`).toLowerCase()}
                      </p>
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="btn-icon"
                        onClick={() => moveItem('fixed_costs', cost, 'up')}
                        disabled={idx === 0}
                        aria-label="↑"
                      >
                        ↑
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => moveItem('fixed_costs', cost, 'down')}
                        disabled={idx === arr.length - 1}
                        aria-label="↓"
                      >
                        ↓
                      </button>
                      <button
                        className="btn-edit"
                        onClick={() => {
                          setCostForm(cost);
                          setIsFormOpen(true);
                        }}
                        aria-label={t('common.edit')}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteItem('fixed_costs', cost.id, cost.name)}
                        aria-label={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ================= INGRÉDIENTS (v9) ================= */}
      {view === 'ingredients' && (
        <div className="section-container">
          <button
            className="btn-primary full-width"
            onClick={() => openIngredientForm()}
          >
            + {t('menu.ingredients.add')}
          </button>

          <SearchBar
            value={ingredientSearch}
            onChange={setIngredientSearch}
            placeholder={t('menu.ingredients.name')}
            className="team-searchbar"
          />

          {renderCategoryFilterPills(
            ingredientFilter,
            setIngredientFilter,
            INGREDIENT_CATEGORIES,
            INGREDIENT_CATEGORY_EMOJI,
            'ingredientCategories'
          )}

          {filteredIngredients.length === 0 ? (
            <EmptyState
              emoji="🥗"
              title={t('menu.ingredients.empty')}
              desc={t('menu.ingredients.add')}
            />
          ) : (
            <div className="list">
              {filteredIngredients.map((ing, idx) => {
                const category = ing.category || '';
                const emoji = INGREDIENT_CATEGORY_EMOJI[category] || '🍽️';
                const categoryLabel = t(`ingredientCategories.${category}`);
                const baseUnit = ing.base_unit || 'g';
                const baseUnitShort = t(`common.baseUnits.${baseUnit}.short`);
                const refCost = ing.reference_unit_cost != null ? ing.reference_unit_cost : (ing.unit_cost || 0);
                const yieldPct = Math.round((ing.yield_factor || 1) * 100);
                const supplier = dataset.suppliers.find((s) => s.id === ing.preferred_supplier_id);
                return (
                  <div key={ing.id} className="list-item ingredient-card">
                    <div className="list-item-info">
                      <h4>
                        <span className="category-badge" aria-hidden="true">{emoji}</span>
                        {ing.name}
                      </h4>
                      <p>
                        {categoryLabel} · {formatCurrency(refCost)} / {baseUnitShort}
                        {supplier && ` · ${supplier.name}`}
                      </p>
                      <div className="ingredient-badges">
                        <Badge variant="info">
                          {t('team.ingredientV9.baseUnit')} : {baseUnitShort}
                        </Badge>
                        {yieldPct < 100 && (
                          <Badge variant="warning">
                            {t('team.ingredientV9.yieldFactor')} {yieldPct}%
                          </Badge>
                        )}
                        {ing.track_stock === false && (
                          <Badge variant="default">
                            {t('team.stockManagement.nonTracked')}
                          </Badge>
                        )}
                        {ing.purchase_options && ing.purchase_options.length > 0 && (
                          <Badge variant="success">
                            {ing.purchase_options.length} {t('team.ingredientV9.purchaseOptions').toLowerCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="btn-icon"
                        onClick={() => moveItem('ingredients', ing, 'up')}
                        disabled={idx === 0}
                        aria-label="↑"
                      >
                        ↑
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => moveItem('ingredients', ing, 'down')}
                        disabled={idx === filteredIngredients.length - 1}
                        aria-label="↓"
                      >
                        ↓
                      </button>
                      <button
                        className="btn-edit"
                        onClick={() => openIngredientForm(ing)}
                        aria-label={t('common.edit')}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteItem('ingredients', ing.id, ing.name)}
                        aria-label={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= FOURNISSEURS ================= */}
      {view === 'suppliers' && (
        <div className="section-container">
          <button
            className="btn-primary full-width"
            onClick={() => {
              setSupForm({ id: null, name: '', phone: '', notes: '' });
              setIsFormOpen(true);
            }}
          >
            + {t('team.addSupplier')}
          </button>

          <SearchBar
            value={supplierSearch}
            onChange={setSupplierSearch}
            placeholder={t('team.name')}
            className="team-searchbar"
          />

          {filteredSuppliers.length === 0 ? (
            <EmptyState
              emoji="🚚"
              title={t('team.noSupplier')}
              desc={t('team.addSupplier')}
            />
          ) : (
            <div className="list">
              {filteredSuppliers.map((sup) => (
                <div key={sup.id} className="list-item">
                  <div className="list-item-info">
                    <h4>{sup.name}</h4>
                    <p>
                      {sup.phone} {sup.notes && `· ${sup.notes}`}
                    </p>
                  </div>
                  <div className="list-item-actions">
                    <a
                      href={`tel:${sup.phone}`}
                      className="btn-icon"
                      aria-label={t('team.phone')}
                    >
                      📞
                    </a>
                    <button
                      className="btn-edit"
                      onClick={() => {
                        setSupForm(sup);
                        setIsFormOpen(true);
                      }}
                      aria-label={t('common.edit')}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteItem('suppliers', sup.id, sup.name)}
                      aria-label={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= DÉPENSES ================= */}
      {view === 'expenses' && (
        <div className="section-container">
          <button
            className="btn-primary full-width"
            onClick={() => {
              setExpForm({ id: null, name: '', amount: '', category: 'material', note: '' });
              setIsFormOpen(true);
            }}
          >
            + {t('team.addExpense')}
          </button>
          {dataset.expenses.length === 0 ? (
            <EmptyState
              emoji="💸"
              title={t('team.expenses')}
              desc={t('team.addExpense')}
            />
          ) : (
            <div className="list">
              {dataset.expenses.map((exp) => (
                <div key={exp.id} className="list-item">
                  <div className="list-item-info">
                    <h4>{exp.note || t(`team.expenseCats.${exp.category}`)}</h4>
                    <p>
                      {exp.date} · {t(`team.expenseCats.${exp.category}`)}
                    </p>
                    <span className="expense-amount">-{formatCurrency(exp.amount)}</span>
                  </div>
                  <div className="list-item-actions">
                    <button
                      className="btn-delete"
                      onClick={() =>
                        handleDeleteItem('expenses', exp.id, exp.note || t('team.expenses'))
                      }
                      aria-label={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= PROMOTIONS ================= */}
      {view === 'promotions' && (
        <div className="section-container">
          <button
            className="btn-primary full-width"
            onClick={() => {
              setPromoForm({ id: null, dish_id: '', type: 'percentage', value: '', start_date: '', end_date: '' });
              setIsFormOpen(true);
            }}
          >
            + {t('team.addPromo')}
          </button>
          {dataset.promotions.length === 0 ? (
            <EmptyState
              emoji="🏷️"
              title={t('team.promotions')}
              desc={t('team.addPromo')}
            />
          ) : (
            <div className="list">
              {dataset.promotions.map((promo) => {
                const dish = dataset.dishes.find((d) => d.id === promo.dish_id);
                return (
                  <div
                    key={promo.id}
                    className={`list-item ${promo.active ? 'promo-active' : 'promo-inactive'}`}
                  >
                    <div className="list-item-info">
                      <h4>🏷️ {dish ? dish.name : '?'}</h4>
                      <p>
                        {promo.type === 'percentage'
                          ? `-${promo.value}%`
                          : `-${formatCurrency(promo.value)}`}
                        {promo.start_date && ` · ${promo.start_date}`}{' '}
                        {promo.end_date && `→ ${promo.end_date}`}
                      </p>
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="btn-delete"
                        onClick={() =>
                          handleDeleteItem('promotions', promo.id, dish?.name || t('team.promotions'))
                        }
                        aria-label={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= STOCK ================= */}
      {view === 'stock' && (
        <div className="section-container">
          {renderCategoryFilterPills(
            stockFilter,
            setStockFilter,
            MENU_CATEGORIES,
            MENU_CATEGORY_EMOJI,
            'menu.sections'
          )}

          {filteredStock.length === 0 ? (
            <EmptyState emoji="📦" title={t('menu.ingredients.empty')} />
          ) : (
            <div className="list">
              {filteredStock.map((ing) => {
                const stock = ing.stock_quantity || 0;
                const min = ing.min_stock || 0;
                const pct =
                  min > 0
                    ? Math.min(100, (stock / (min * 2)) * 100)
                    : stock > 0
                    ? 100
                    : 0;
                const color =
                  stock <= min ? '#E53935' : stock <= min * 1.5 ? '#FF9800' : '#43A047';
                const unit = ing.base_unit
                  ? t(`common.baseUnits.${ing.base_unit}.short`)
                  : unitLabel(t, ing.unit);
                return (
                  <div key={ing.id} className="list-item stock-item">
                    <div className="list-item-info stock-info">
                      <div className="stock-header">
                        <h4>
                          <span className="category-badge" aria-hidden="true">
                            {MENU_CATEGORY_EMOJI[ing.category] || INGREDIENT_CATEGORY_EMOJI[ing.category] || '🍽️'}
                          </span>
                          {ing.name}
                        </h4>
                        <span className="stock-qty">
                          {stock} {unit}
                        </span>
                      </div>
                      <div className="stock-bar">
                        <div
                          className="stock-bar__fill"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                    <div className="list-item-actions">
                      <button
                        className="btn-icon"
                        onClick={() => adjustStock(ing, -1)}
                        aria-label="−"
                      >
                        −
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => adjustStock(ing, 1)}
                        aria-label="+"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= PLANNING ================= */}
      {view === 'planning' && (
        <div className="section-container">
          <CalendarStrip
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
          />

          <button
            className="btn-primary full-width"
            onClick={() => setTaskSheetOpen(true)}
          >
            + {t('team.addTask')}
          </button>

          <div className="card planning-content planning-hours-card">
            <div className="planning-row">
              <label htmlFor="open-time">{t('team.openTime')}</label>
              <input
                id="open-time"
                type="time"
                defaultValue="08:00"
                className="form-input"
              />
            </div>
            <div className="planning-row">
              <label htmlFor="close-time">{t('team.closeTime')}</label>
              <input
                id="close-time"
                type="time"
                defaultValue="20:00"
                className="form-input"
              />
            </div>
          </div>

          {tasksByType.map(({ type, tasks }) => {
            const title =
              type === 'day'
                ? `${t('team.taskTypes.day')} · ${t('team.days')[selectedDayOfWeek]}`
                : t(`team.taskTypes.${type}`);

            return (
              <div key={type} className="card planning-content planning-section">
                <div className="planning-section-header">
                  <label>{title}</label>
                  <Badge variant="info">{tasks.length}</Badge>
                </div>
                {tasks.length === 0 ? (
                  <p className="planning-empty">{t('team.noTasks')}</p>
                ) : (
                  <div className="tasks-list">
                    {tasks.map((task, idx) => (
                      <div key={task.id} className="task-item">
                        <label className="task-item-label">
                          <input
                            type="checkbox"
                            checked={!!task.done}
                            onChange={() => toggleTask(task.id)}
                          />
                          <span className={task.done ? 'task-done' : ''}>
                            {task.text}
                          </span>
                        </label>
                        <div className="list-item-actions">
                          <button
                            className="btn-icon"
                            onClick={() => moveTask(task, 'up')}
                            disabled={idx === 0}
                            aria-label="↑"
                          >
                            ↑
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => moveTask(task, 'down')}
                            disabled={idx === tasks.length - 1}
                            aria-label="↓"
                          >
                            ↓
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => requestDeleteTask(task)}
                            aria-label={t('common.delete')}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= BOTTOM SHEET AJOUT TÂCHE ================= */}
      <BottomSheet
        open={taskSheetOpen}
        onClose={() => setTaskSheetOpen(false)}
        title={t('team.addTask')}
      >
        <form className="task-form" onSubmit={handleAddTask}>
          <input
            className="form-input"
            type="text"
            placeholder={t('team.taskPlaceholder')}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            required
            autoFocus
          />
          <PillSelector
            value={newTaskType}
            options={taskTypeOptions}
            onChange={(val) => setNewTaskType(val)}
            ariaLabel={t('team.taskTypes.day')}
          />
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </BottomSheet>

      {/* ================= BOTTOM SHEET INGRÉDIENT v9 ================= */}
      <BottomSheet
        open={ingredientSheetOpen}
        onClose={() => setIngredientSheetOpen(false)}
        title={ingForm.id ? t('common.edit') : t('menu.ingredients.add')}
      >
        <form className="form-card" onSubmit={saveIngredient}>
          {/* Nom */}
          <input
            className="form-input"
            type="text"
            placeholder={t('menu.ingredients.name')}
            value={ingForm.name}
            onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })}
            required
          />

          {/* Catégorie + bouton presets */}
          <div className="ingredient-form-row">
            <select
              className="form-select"
              value={ingForm.category}
              onChange={(e) => setIngForm({ ...ingForm, category: e.target.value })}
            >
              {INGREDIENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {INGREDIENT_CATEGORY_EMOJI[cat]} {t(`ingredientCategories.${cat}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="preset-btn"
              onClick={applyPresets}
              aria-label={t('team.ingredientV9.purchaseOptions')}
            >
              {t('common.add')}
            </button>
          </div>

          {/* Unité de base + Coût de référence */}
          <div className="ingredient-form-row">
            <select
              className="form-select"
              value={ingForm.base_unit}
              onChange={(e) => setIngForm({ ...ingForm, base_unit: e.target.value })}
            >
              {BASE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`common.baseUnits.${u}.label`)}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              type="number"
              step="0.01"
              min="0"
              placeholder={`${t('team.ingredientV9.referenceUnitCost')} / ${t(`common.baseUnits.${ingForm.base_unit}.short`)}`}
              value={ingForm.reference_unit_cost}
              onChange={(e) => setIngForm({ ...ingForm, reference_unit_cost: e.target.value })}
              required
            />
          </div>

          {/* Fournisseur préféré */}
          <select
            className="form-select"
            value={ingForm.preferred_supplier_id}
            onChange={(e) => setIngForm({ ...ingForm, preferred_supplier_id: e.target.value })}
          >
            <option value="">{t('team.noSupplier')}</option>
            {dataset.suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Type de stockage + Conservation */}
          <div className="ingredient-form-row">
            <select
              className="form-select"
              value={ingForm.storage_type}
              onChange={(e) => setIngForm({ ...ingForm, storage_type: e.target.value })}
            >
              {STORAGE_TYPES.map((st) => (
                <option key={st} value={st}>{t(`storageTypes.${st}`)}</option>
              ))}
            </select>
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder={t('team.ingredientV9.shelfLifeDays')}
              value={ingForm.shelf_life_days}
              onChange={(e) => setIngForm({ ...ingForm, shelf_life_days: e.target.value })}
            />
          </div>

          {/* Stock + Stock minimum */}
          <div className="ingredient-form-row">
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder={t('team.ingredientV9.stockQuantity')}
              value={ingForm.stock_quantity}
              onChange={(e) => setIngForm({ ...ingForm, stock_quantity: e.target.value })}
            />
            <input
              className="form-input"
              type="number"
              min="0"
              placeholder={t('team.ingredientV9.minStock')}
              value={ingForm.min_stock}
              onChange={(e) => setIngForm({ ...ingForm, min_stock: e.target.value })}
            />
          </div>

          {/* Suivi du stock */}
          <div className="checkbox-row">
            <input
              id="track-stock"
              type="checkbox"
              checked={ingForm.track_stock}
              onChange={(e) => setIngForm({ ...ingForm, track_stock: e.target.checked })}
            />
            <label htmlFor="track-stock">{t('team.ingredientV9.trackStock')}</label>
          </div>

          {/* Rendement */}
          <div className="ingredient-form-row">
            <input
              className="form-input"
              type="number"
              min="1"
              max="100"
              placeholder={t('team.ingredientV9.yieldFactor')}
              value={ingForm.yield_factor_pct}
              onChange={(e) => setIngForm({ ...ingForm, yield_factor_pct: e.target.value })}
            />
            <span style={{ fontSize: '0.85rem', color: '#8A8A8A', flex: '0 0 auto' }}>
              %
            </span>
          </div>

          {/* Conditionnements d'achat */}
          <div className="ingredient-form-section">
            <span className="ingredient-form-section-title">
              {t('team.ingredientV9.purchaseOptions')}
            </span>
            <div className="dynamic-list">
              {ingForm.purchase_options.map((opt) => (
                <div key={opt.id} className="dynamic-row">
                  <div className="dynamic-row-inputs">
                    <input
                      className="form-input"
                      type="text"
                      placeholder={t('team.ingredientV9.purchaseOptions')}
                      value={opt.label}
                      onChange={(e) => updatePurchaseOption(opt.id, 'label', e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t(`common.baseUnits.${ingForm.base_unit}.short`)}
                      value={opt.quantity_in_base}
                      onChange={(e) => updatePurchaseOption(opt.id, 'quantity_in_base', e.target.value)}
                    />
                  </div>
                  <div className="dynamic-row-actions">
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => removePurchaseOption(opt.id)}
                      aria-label={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="dynamic-add-btn" onClick={addPurchaseOption}>
              + {t('team.ingredientV9.addPurchaseOption')}
            </button>
          </div>

          {/* Unités de recette */}
          <div className="ingredient-form-section">
            <span className="ingredient-form-section-title">
              {t('team.ingredientV9.recipeUnits')}
            </span>
            <div className="dynamic-list">
              {ingForm.recipe_units.map((unit) => (
                <div key={unit.id} className="dynamic-row">
                  <div className="dynamic-row-inputs">
                    <input
                      className="form-input"
                      type="text"
                      placeholder={t('team.ingredientV9.recipeUnits')}
                      value={unit.label}
                      onChange={(e) => updateRecipeUnit(unit.id, 'label', e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={t(`common.baseUnits.${ingForm.base_unit}.short`)}
                      value={unit.quantity_in_base}
                      onChange={(e) => updateRecipeUnit(unit.id, 'quantity_in_base', e.target.value)}
                    />
                    <input
                      className="default-radio"
                      type="radio"
                      name="default-recipe-unit"
                      checked={unit.is_default === true}
                      onChange={() => setDefaultRecipeUnit(unit.id)}
                      aria-label={t('common.save')}
                    />
                  </div>
                  <div className="dynamic-row-actions">
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => removeRecipeUnit(unit.id)}
                      aria-label={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="dynamic-add-btn" onClick={addRecipeUnit}>
              + {t('team.ingredientV9.addRecipeUnit')}
            </button>
          </div>

          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </BottomSheet>

      {/* ================= TOAST ================= */}
      <Toast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={closeToast}
      />

      {/* ================= MODALES FORMULAIRES (autres vues) ================= */}
      <FormModal
        isOpen={isFormOpen && view === 'employees'}
        onClose={() => setIsFormOpen(false)}
        title={empForm.id ? t('common.edit') : t('team.addEmployee')}
      >
        <form className="form-card" onSubmit={saveEmployee}>
          <input
            className="form-input"
            type="text"
            placeholder={t('team.name')}
            value={empForm.name}
            onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
            required
          />
          <input
            className="form-input"
            type="text"
            placeholder={t('team.role')}
            value={empForm.role}
            onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
          />
          <div className="row-inputs">
            <select
              className="form-select"
              value={empForm.salary_type}
              onChange={(e) => setEmpForm({ ...empForm, salary_type: e.target.value })}
            >
              <option value="monthly">{t('team.monthly')}</option>
              <option value="hourly">{t('team.hourly')}</option>
            </select>
            <input
              className="form-input"
              type="number"
              placeholder={t('team.amount')}
              value={empForm.amount}
              onChange={(e) => setEmpForm({ ...empForm, amount: e.target.value })}
              required
            />
          </div>
          <input
            className="form-input"
            type="number"
            min="1"
            max="7"
            placeholder={t('team.employeeDays')}
            value={empForm.days_per_week}
            onChange={(e) => setEmpForm({ ...empForm, days_per_week: e.target.value })}
            required
          />
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </FormModal>

      <FormModal
        isOpen={isFormOpen && view === 'costs'}
        onClose={() => setIsFormOpen(false)}
        title={costForm.id ? t('common.edit') : t('team.addFixedCost')}
      >
        <form className="form-card" onSubmit={saveCost}>
          <input
            className="form-input"
            type="text"
            placeholder={t('team.name')}
            value={costForm.name}
            onChange={(e) => setCostForm({ ...costForm, name: e.target.value })}
            required
          />
          <div className="row-inputs">
            <input
              className="form-input"
              type="number"
              placeholder={t('team.amount')}
              value={costForm.amount}
              onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
              required
            />
            <select
              className="form-select"
              value={costForm.frequency}
              onChange={(e) => setCostForm({ ...costForm, frequency: e.target.value })}
            >
              <option value="monthly">{t('team.freq.monthly')}</option>
              <option value="weekly">{t('team.freq.weekly')}</option>
              <option value="daily">{t('team.freq.daily')}</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </FormModal>

      <FormModal
        isOpen={isFormOpen && view === 'suppliers'}
        onClose={() => setIsFormOpen(false)}
        title={supForm.id ? t('common.edit') : t('team.addSupplier')}
      >
        <form className="form-card" onSubmit={saveSupplier}>
          <input
            className="form-input"
            type="text"
            placeholder={t('team.name')}
            value={supForm.name}
            onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
            required
          />
          <input
            className="form-input"
            type="tel"
            placeholder={t('team.phone')}
            value={supForm.phone}
            onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
          />
          <input
            className="form-input"
            type="text"
            placeholder={t('team.notes')}
            value={supForm.notes}
            onChange={(e) => setSupForm({ ...supForm, notes: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </FormModal>

      <FormModal
        isOpen={isFormOpen && view === 'expenses'}
        onClose={() => setIsFormOpen(false)}
        title={t('team.addExpense')}
      >
        <form className="form-card" onSubmit={saveExpense}>
          <input
            className="form-input"
            type="number"
            placeholder={t('team.amount')}
            value={expForm.amount}
            onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
            required
          />
          <select
            className="form-select"
            value={expForm.category}
            onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`team.expenseCats.${cat}`)}
              </option>
            ))}
          </select>
          <input
            className="form-input"
            type="text"
            placeholder={t('team.notes')}
            value={expForm.name}
            onChange={(e) => setExpForm({ ...expForm, name: e.target.value })}
          />
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </FormModal>

      <FormModal
        isOpen={isFormOpen && view === 'promotions'}
        onClose={() => setIsFormOpen(false)}
        title={t('team.addPromo')}
      >
        <form className="form-card" onSubmit={savePromotion}>
          <select
            className="form-select"
            value={promoForm.dish_id}
            onChange={(e) => setPromoForm({ ...promoForm, dish_id: e.target.value })}
            required
          >
            <option value="">{t('team.selectDish')}</option>
            {dataset.dishes.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div className="row-inputs">
            <select
              className="form-select"
              value={promoForm.type}
              onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value })}
            >
              <option value="percentage">%</option>
              <option value="fixed_amount">VND</option>
            </select>
            <input
              className="form-input"
              type="number"
              placeholder={t('team.amount')}
              value={promoForm.value}
              onChange={(e) => setPromoForm({ ...promoForm, value: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary">
            {t('common.save')}
          </button>
        </form>
      </FormModal>

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((c) => ({ ...c, isOpen: false }))}
        confirmText={t('common.delete')}
        isDestructive={true}
      />
    </div>
  );
}