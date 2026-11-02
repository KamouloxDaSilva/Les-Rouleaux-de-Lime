// src/data/model.js
// SCHEMA_VERSION 9 — Chantier 13 (SPEC_UNITES v1.0)
// Backward compatible avec v8 : createIngredient / createDish / createEmptyDataset
// continuent de fonctionner sans modification pour storage.js, fixtures.js et .jsx.

export const SCHEMA_VERSION = 9;

export const CURRENCY_DEFAULT = 'VND';
export const TIMEZONE_DEFAULT = 'Asia/Ho_Chi_Minh';
export const FIXED_COST_FREQUENCIES = ['daily', 'weekly', 'monthly'];
export const WEATHER_OPTIONS = ['sunny', 'cloudy', 'rainy', 'stormy'];

// Les 4 grandes catégories du Menu (plats, boissons, desserts, sauces).
export const MENU_CATEGORIES = ['dish', 'drink', 'dessert', 'sauce'];

// ── v9 — Catégories d'ingrédients (SPEC_UNITES section 5) ─────────────
export const INGREDIENT_CATEGORIES = [
  'meat', 'fish', 'vegetable', 'fruit', 'staple', 'dairy',
  'spice', 'sauce', 'oil', 'beverage', 'packaging', 'cleaning',
];

// ── v9 — Unités canoniques (SPEC_UNITES section 1) ────────────────────
export const BASE_UNITS = ['g', 'ml', 'piece'];

// ── v9 — Types de stockage ────────────────────────────────────────────
export const STORAGE_TYPES = ['fresh', 'frozen', 'ambient', 'refrigerated'];

// ── v9 — Modes de tarification des formules ───────────────────────────
export const FORMULA_PRICING_MODES = ['fixed', 'calculated', 'discounted'];

// ── v9 — Types de bons de réception ───────────────────────────────────
export const RECEIPT_TYPES = ['receipt', 'return', 'correction'];

// Catégories pour les dépenses ponctuelles (Chantier 12)
export const EXPENSE_CATEGORIES = ['material', 'repair', 'transport', 'marketing', 'other'];

// Types de promotions (Chantier 12)
export const PROMO_TYPES = ['percentage', 'fixed_amount'];

// Types de tâches du planning (Chantier 12 — SCHEMA v8)
export const TASK_TYPES = ['day', 'week', 'permanent'];

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO() { return new Date().toISOString(); }

// Utilisé pour les plats : n'accepte que MENU_CATEGORIES (inchangé v8)
function normalizeCategory(value) {
  return MENU_CATEGORIES.includes(value) ? value : 'dish';
}

// v9 — accepte les anciennes catégories Menu (rétrocompat fixtures v8)
// ET les nouvelles catégories d'ingrédients (SPEC_UNITES section 5).
function normalizeIngredientCategory(value) {
  if (MENU_CATEGORIES.includes(value)) return value;
  if (INGREDIENT_CATEGORIES.includes(value)) return value;
  return 'dish'; // défaut historique — préserve le filtrage UI existant
}

// v9 — dérive base_unit depuis l'ancienne `unit` libre (kg, g, ml, tờ, …)
function deriveBaseUnit(unit) {
  if (!unit) return 'g';
  const u = String(unit).trim().toLowerCase();
  if (['g', 'kg', 't', 'gam', 'gram', 'grams'].includes(u)) return 'g';
  if (['ml', 'cl', 'l', 'lit', 'lít', 'liter', 'litre'].includes(u)) return 'ml';
  return 'piece';
}

// v9 — dérive reference_unit_cost (coût par base_unit) depuis (unit_cost, unit)
function deriveReferenceUnitCost(unitCost, unit, baseUnit) {
  if (!Number.isFinite(unitCost) || unitCost === 0) return 0;
  if (!unit) return unitCost;
  const u = String(unit).trim().toLowerCase();
  if (baseUnit === 'g') {
    if (u === 'kg') return unitCost / 1000;
    if (u === 't') return unitCost / 1000000;
    if (u === 'g') return unitCost;
  }
  if (baseUnit === 'ml') {
    if (u === 'l' || u === 'lit' || u === 'lít') return unitCost / 1000;
    if (u === 'cl') return unitCost / 10;
    if (u === 'ml') return unitCost;
  }
  return unitCost;
}

// ─────────────────────────────────────────────────────────────────────
// Restaurant (inchangé v8)
// ─────────────────────────────────────────────────────────────────────

export function createRestaurant(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    name: input.name || '',
    address: input.address || '',
    phone: input.phone || '',
    currency: input.currency || CURRENCY_DEFAULT,
    timezone: input.timezone || TIMEZONE_DEFAULT,
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

// ─────────────────────────────────────────────────────────────────────
// v9 — Sous-structures réutilisables
// ─────────────────────────────────────────────────────────────────────

export function createPurchaseOption(input = {}) {
  const src = input || {};
  return {
    id: src.id || newId(),
    label: src.label || '',
    quantity_in_base: Number.isFinite(src.quantity_in_base) ? src.quantity_in_base : 1,
  };
}

export function createRecipeUnit(input = {}) {
  const src = input || {};
  return {
    id: src.id || newId(),
    label: src.label || '',
    quantity_in_base: Number.isFinite(src.quantity_in_base) ? src.quantity_in_base : 1,
    is_default: src.is_default === true,
  };
}

export function createPreparedBatch(input = {}) {
  const src = input || {};
  const recipe = Array.isArray(src.recipe)
    ? src.recipe.filter(Boolean).map((r) => ({
        ingredient_id: r.ingredient_id || '',
        quantity_in_base: Number.isFinite(r.quantity_in_base) ? r.quantity_in_base : 0,
      }))
    : [];
  return {
    recipe,
    yield_in_base: Number.isFinite(src.yield_in_base) ? src.yield_in_base : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Ingredient — v9 (backward compatible v8 via dérivation)
// ─────────────────────────────────────────────────────────────────────

export function createIngredient(input = {}) {
  const src = input || {};
  const ts = nowISO();

  // Anciens champs v8 (conservés pour calculations.js / TeamPage / fixtures)
  const legacyUnit = typeof src.unit === 'string' ? src.unit : '';
  const legacyUnitCost = Number.isFinite(src.unit_cost) ? src.unit_cost : 0;

  // Nouveaux champs v9 avec dérivation intelligente
  const baseUnit = BASE_UNITS.includes(src.base_unit)
    ? src.base_unit
    : deriveBaseUnit(legacyUnit);

  const referenceUnitCost = Number.isFinite(src.reference_unit_cost)
    ? src.reference_unit_cost
    : deriveReferenceUnitCost(legacyUnitCost, legacyUnit, baseUnit);

  return {
    id: src.id || newId(),
    restaurant_id: src.restaurant_id,
    name: src.name || '',
    category: normalizeIngredientCategory(src.category),
    subcategory: src.subcategory || '',

    // ── v9 : unité canonique ────────────────────────────────────
    base_unit: baseUnit,
    purchase_options: Array.isArray(src.purchase_options)
      ? src.purchase_options.filter(Boolean).map((o) => createPurchaseOption(o))
      : [],
    recipe_units: Array.isArray(src.recipe_units)
      ? src.recipe_units.filter(Boolean).map((u) => createRecipeUnit(u))
      : [],

    // ── v9 : préparation maison ─────────────────────────────────
    is_prepared: src.is_prepared === true,
    prepared_batch: src.prepared_batch && typeof src.prepared_batch === 'object'
      ? createPreparedBatch(src.prepared_batch)
      : null,

    // ── v9 : rendement ──────────────────────────────────────────
    yield_factor: Number.isFinite(src.yield_factor) && src.yield_factor > 0
      ? src.yield_factor
      : 1,

    // ── v9 : poids variable ─────────────────────────────────────
    variable_weight: src.variable_weight === true,
    average_unit_weight: Number.isFinite(src.average_unit_weight)
      ? src.average_unit_weight
      : null,
    weight_range: src.weight_range || null,

    // ── v9 : stockage & péremption ──────────────────────────────
    storage_type: STORAGE_TYPES.includes(src.storage_type)
      ? src.storage_type
      : 'ambient',
    shelf_life_days: Number.isFinite(src.shelf_life_days)
      ? src.shelf_life_days
      : null,
    track_stock: src.track_stock !== false,

    // ── v9 : prix de référence ──────────────────────────────────
    reference_unit_cost: referenceUnitCost,
    preferred_supplier_id: src.preferred_supplier_id || '',

    // ── v9 : alerte stock (R4.2) ────────────────────────────────
    stock_alert: src.stock_alert === true,

    // ── Legacy v8 (conservé pour backward compat) ──────────────
    unit: legacyUnit,
    unit_cost: legacyUnitCost,
    supplier: src.supplier || '',
    supplier_id: src.supplier_id || '',
    stock_quantity: Number.isFinite(src.stock_quantity) ? src.stock_quantity : 0,
    min_stock: Number.isFinite(src.min_stock) ? src.min_stock : 0,
    sort_order: Number.isFinite(src.sort_order) ? src.sort_order : 0,

    createdAt: src.createdAt || ts,
    updatedAt: ts,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Dish — pass-through recipe (backward compat v8 : quantity conservé)
// Note : la migration quantity → quantity_in_base est faite au Chantier 14.
// ─────────────────────────────────────────────────────────────────────

export function createDish(input = {}) {
  const src = input || {};
  const ts = nowISO();
  const dish = {
    id: src.id || newId(),
    restaurant_id: src.restaurant_id,
    name: src.name || '',
    category: normalizeCategory(src.category),
    subcategory: src.subcategory || '',
    price: Number.isFinite(src.price) ? src.price : 0,
    active: src.active !== false,
    createdAt: src.createdAt || ts,
    updatedAt: ts,
  };
  if (Array.isArray(src.recipe)) {
    // Pass-through défensif : conserve quantity (v8) et/ou quantity_in_base (v9)
    dish.recipe = src.recipe.filter(Boolean).map((r) => {
      const item = { ingredient_id: r.ingredient_id || '' };
      if (Number.isFinite(r.quantity)) item.quantity = r.quantity;
      if (Number.isFinite(r.quantity_in_base)) item.quantity_in_base = r.quantity_in_base;
      return item;
    });
  }
  return dish;
}

// ─────────────────────────────────────────────────────────────────────
// Fixed cost (inchangé v8)
// ─────────────────────────────────────────────────────────────────────

export function createFixedCost(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    name: input.name || '',
    amount: Number.isFinite(input.amount) ? input.amount : 0,
    frequency: FIXED_COST_FREQUENCIES.includes(input.frequency) ? input.frequency : 'monthly',
    sort_order: Number.isFinite(input.sort_order) ? input.sort_order : 0,
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Daily closing (inchangé v8)
// ─────────────────────────────────────────────────────────────────────

export function createDailyClosing(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    date: input.date,
    weather: WEATHER_OPTIONS.includes(input.weather) ? input.weather : '',
    notes: input.notes || '',
    sales: Array.isArray(input.sales) ? input.sales : [],
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Employee / Shift / Planning (inchangés v8)
// ─────────────────────────────────────────────────────────────────────

export function createEmployee(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    name: input.name || '',
    role: input.role || '',
    salary_type: input.salary_type || 'monthly',
    hourly_rate: Number.isFinite(input.hourly_rate) ? input.hourly_rate : 0,
    monthly_salary: Number.isFinite(input.monthly_salary) ? input.monthly_salary : 0,
    days_per_week: Number.isFinite(input.days_per_week) ? input.days_per_week : 5,
    active: input.active !== false,
    sort_order: Number.isFinite(input.sort_order) ? input.sort_order : 0,
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

export function createShift(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    employee_id: input.employee_id,
    date: input.date,
    hours_worked: Number.isFinite(input.hours_worked) ? input.hours_worked : 0,
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

export function createPlanningDay(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    day_of_week: Number.isInteger(input.day_of_week) ? input.day_of_week : 0,
    open_time: input.open_time || '08:00',
    close_time: input.close_time || '20:00',
    tasks: input.tasks || '',
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Supplier / Expense / Promotion / Task (Chantier 12 — inchangés)
// ─────────────────────────────────────────────────────────────────────

export function createSupplier(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    name: input.name || '',
    phone: input.phone || '',
    notes: input.notes || '',
    sort_order: Number.isFinite(input.sort_order) ? input.sort_order : 0,
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

export function createExpense(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    date: input.date || new Date().toISOString().slice(0, 10),
    amount: Number.isFinite(input.amount) ? input.amount : 0,
    category: EXPENSE_CATEGORIES.includes(input.category) ? input.category : 'other',
    note: input.note || '',
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

export function createPromotion(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    dish_id: input.dish_id,
    type: PROMO_TYPES.includes(input.type) ? input.type : 'percentage',
    value: Number.isFinite(input.value) ? input.value : 0,
    start_date: input.start_date || new Date().toISOString().slice(0, 10),
    end_date: input.end_date || new Date().toISOString().slice(0, 10),
    active: input.active !== false,
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

export function createTask(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    text: input.text || '',
    done: input.done === true,
    type: TASK_TYPES.includes(input.type) ? input.type : 'day',
    day_of_week: Number.isInteger(input.day_of_week) ? input.day_of_week : null,
    sort_order: Number.isFinite(input.sort_order) ? input.sort_order : 0,
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

// ─────────────────────────────────────────────────────────────────────
// v9 — Nouvelles collections
// ─────────────────────────────────────────────────────────────────────

export function createSupplierOffer(input = {}) {
  const src = input || {};
  const ts = nowISO();
  return {
    id: src.id || newId(),
    restaurant_id: src.restaurant_id,
    ingredient_id: src.ingredient_id || '',
    supplier_id: src.supplier_id || '',
    purchase_option_id: src.purchase_option_id || '',
    cost: Number.isFinite(src.cost) ? src.cost : 0,
    is_available: src.is_available !== false,
    is_preferred: src.is_preferred === true,
    min_order_quantity: Number.isFinite(src.min_order_quantity) ? src.min_order_quantity : 1,
    lead_time_days: Number.isFinite(src.lead_time_days) ? src.lead_time_days : 0,
    last_purchase_date: src.last_purchase_date || null,
    notes: src.notes || '',
    createdAt: src.createdAt || ts,
    updatedAt: ts,
  };
}

export function createFormula(input = {}) {
  const src = input || {};
  const ts = nowISO();
  const composition = Array.isArray(src.composition)
    ? src.composition.filter(Boolean).map((c) => ({
        dish_id: c.dish_id || '',
        quantity: Number.isFinite(c.quantity) ? c.quantity : 1,
        slot: c.slot || 'main',
      }))
    : [];
  return {
    id: src.id || newId(),
    restaurant_id: src.restaurant_id,
    name: src.name || '',
    description: src.description || '',
    emoji: src.emoji || '✨',
    color: src.color || '#FF9800',
    composition,
    pricing_mode: FORMULA_PRICING_MODES.includes(src.pricing_mode)
      ? src.pricing_mode
      : 'fixed',
    fixed_price: Number.isFinite(src.fixed_price) ? src.fixed_price : 0,
    discount_pct: Number.isFinite(src.discount_pct) ? src.discount_pct : 0,
    active: src.active !== false,
    createdAt: src.createdAt || ts,
    updatedAt: ts,
  };
}

export function createPurchaseReceiptLine(input = {}) {
  const src = input || {};
  return {
    ingredient_id: src.ingredient_id || '',
    purchase_option_id: src.purchase_option_id || '',
    quantity: Number.isFinite(src.quantity) ? src.quantity : 0,
    cost: Number.isFinite(src.cost) ? src.cost : 0,
    stock_delta_in_base: Number.isFinite(src.stock_delta_in_base)
      ? src.stock_delta_in_base
      : 0,
  };
}

export function createPurchaseReceipt(input = {}) {
  const src = input || {};
  const ts = nowISO();
  const lines = Array.isArray(src.lines)
    ? src.lines.filter(Boolean).map((l) => createPurchaseReceiptLine(l))
    : [];
  const total = Number.isFinite(src.total)
    ? src.total
    : lines.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);
  return {
    id: src.id || newId(),
    restaurant_id: src.restaurant_id,
    type: RECEIPT_TYPES.includes(src.type) ? src.type : 'receipt',
    supplier_id: src.supplier_id || '',
    date: src.date || new Date().toISOString().slice(0, 10),
    lines,
    total,
    notes: src.notes || '',
    createdAt: src.createdAt || ts,
    updatedAt: ts,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Dataset racine
// ─────────────────────────────────────────────────────────────────────

export function createEmptyDataset() {
  const restaurant = createRestaurant({ name: 'Les Rouleaux de Lime' });
  return {
    schema_version: SCHEMA_VERSION,
    active_restaurant_id: restaurant.id,
    restaurants: [restaurant],
    ingredients: [],
    dishes: [],
    fixed_costs: [],
    daily_closings: [],
    employees: [],
    shifts: [],
    planning: [],
    suppliers: [],
    expenses: [],
    promotions: [],
    tasks: [],
    // ── v9 ─────────────────────────────────────────────
    supplier_offers: [],
    formulas: [],
    purchase_receipts: [],
  };
}

export function getActiveRestaurant(dataset) {
  if (!dataset || !Array.isArray(dataset.restaurants)) return null;
  return dataset.restaurants.find((r) => r && r.id === dataset.active_restaurant_id)
    || dataset.restaurants[0]
    || null;
}

export function validateDataset(dataset) {
  const errors = [];
  if (!dataset || typeof dataset !== 'object') {
    return { ok: false, errors: ['dataset: objet attendu'] };
  }
  if (typeof dataset.schema_version !== 'number') {
    errors.push('schema_version: nombre attendu');
  }
  if (!Array.isArray(dataset.restaurants) || dataset.restaurants.length === 0) {
    errors.push('restaurants: tableau non vide attendu');
  }
  if (!dataset.active_restaurant_id) {
    errors.push('active_restaurant_id: requis');
  }

  const checkCollection = (value, name) => {
    if (!Array.isArray(value)) {
      errors.push(`${name}: tableau attendu`);
      return;
    }
    value.forEach((item, i) => {
      if (!item || typeof item !== 'object') {
        errors.push(`${name}[${i}]: objet attendu`);
      } else if (item.restaurant_id === undefined) {
        errors.push(`${name}[${i}].restaurant_id: requis`);
      }
    });
  };

  // Collections v8 (toutes optionnelles via fallback || [])
  checkCollection(dataset.ingredients, 'ingredients');
  checkCollection(dataset.dishes, 'dishes');
  checkCollection(dataset.fixed_costs, 'fixed_costs');
  checkCollection(dataset.daily_closings, 'daily_closings');
  checkCollection(dataset.employees, 'employees');
  checkCollection(dataset.shifts, 'shifts');
  checkCollection(dataset.planning || [], 'planning');
  checkCollection(dataset.suppliers || [], 'suppliers');
  checkCollection(dataset.expenses || [], 'expenses');
  checkCollection(dataset.promotions || [], 'promotions');
  checkCollection(dataset.tasks || [], 'tasks');

  // ── Collections v9 ─────────────────────────────────
  checkCollection(dataset.supplier_offers || [], 'supplier_offers');
  checkCollection(dataset.formulas || [], 'formulas');
  checkCollection(dataset.purchase_receipts || [], 'purchase_receipts');

  return { ok: errors.length === 0, errors };
}