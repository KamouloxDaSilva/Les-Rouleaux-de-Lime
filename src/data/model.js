// src/data/model.js
export const SCHEMA_VERSION = 5;

export const CURRENCY_DEFAULT = 'VND';
export const TIMEZONE_DEFAULT = 'Asia/Ho_Chi_Minh';
export const FIXED_COST_FREQUENCIES = ['daily', 'weekly', 'monthly'];
export const WEATHER_OPTIONS = ['sunny', 'cloudy', 'rainy', 'stormy'];

// Les 4 grandes catégories du Menu (plats, boissons, desserts, sauces).
// Utilisées à la fois par les plats et par les ingrédients.
export const MENU_CATEGORIES = ['dish', 'drink', 'dessert', 'sauce'];

export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowISO() { return new Date().toISOString(); }

function normalizeCategory(value) {
  return MENU_CATEGORIES.includes(value) ? value : 'dish';
}

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

export function createIngredient(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    name: input.name || '',
    category: normalizeCategory(input.category),
    unit: input.unit || '',
    unit_cost: Number.isFinite(input.unit_cost) ? input.unit_cost : 0,
    supplier: input.supplier || '',
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

export function createDish(input = {}) {
  const ts = nowISO();
  const dish = {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    name: input.name || '',
    category: normalizeCategory(input.category),
    subcategory: input.subcategory || '',
    price: Number.isFinite(input.price) ? input.price : 0,
    active: input.active !== false,
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
  if (Array.isArray(input.recipe)) dish.recipe = input.recipe;
  return dish;
}

export function createFixedCost(input = {}) {
  const ts = nowISO();
  return {
    id: input.id || newId(),
    restaurant_id: input.restaurant_id,
    name: input.name || '',
    amount: Number.isFinite(input.amount) ? input.amount : 0,
    frequency: FIXED_COST_FREQUENCIES.includes(input.frequency) ? input.frequency : 'monthly',
    createdAt: input.createdAt || ts,
    updatedAt: ts,
  };
}

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
    active: input.active !== false,
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
  };
}

export function getActiveRestaurant(dataset) {
  if (!dataset || !Array.isArray(dataset.restaurants)) return null;
  return dataset.restaurants.find((r) => r && r.id === dataset.active_restaurant_id) || dataset.restaurants[0] || null;
}

export function validateDataset(dataset) {
  const errors = [];
  if (!dataset || typeof dataset !== 'object') return { ok: false, errors: ['dataset: objet attendu'] };
  if (typeof dataset.schema_version !== 'number') errors.push('schema_version: nombre attendu');
  if (!Array.isArray(dataset.restaurants) || dataset.restaurants.length === 0) errors.push('restaurants: tableau non vide attendu');
  if (!dataset.active_restaurant_id) errors.push('active_restaurant_id: requis');

  const checkCollection = (value, name) => {
    if (!Array.isArray(value)) { errors.push(`${name}: tableau attendu`); return; }
    value.forEach((item, i) => {
      if (!item || typeof item !== 'object') errors.push(`${name}[${i}]: objet attendu`);
      else if (item.restaurant_id === undefined) errors.push(`${name}[${i}].restaurant_id: requis`);
    });
  };
  checkCollection(dataset.ingredients, 'ingredients');
  checkCollection(dataset.dishes, 'dishes');
  checkCollection(dataset.fixed_costs, 'fixed_costs');
  checkCollection(dataset.daily_closings, 'daily_closings');
  checkCollection(dataset.employees, 'employees');
  checkCollection(dataset.shifts, 'shifts');
  checkCollection(dataset.planning || [], 'planning');
  return { ok: errors.length === 0, errors };
}