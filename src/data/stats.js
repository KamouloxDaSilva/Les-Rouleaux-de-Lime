// src/data/stats.js
// =====================================================================
// Burihagio — Statistiques approfondies
// Refonte v5 (Chantier 11-F4) + Chantier 12 + Chantier 30 + Chantier 31
// + Chantier 39 FUSION (39+40+41)
//
// Chantier 39 FUSION :
//   • getDonutData accepte les contextes métriques :
//     'revenue' | 'margin' | 'items' | 'expenses'
//   • getDishIndividualSeries accepte un 4ᵉ paramètre `metric`
//     ('qty' | 'revenue' | 'margin').
//   • 3 nouveaux helpers pour les drill-downs :
//     getEmployeeShiftsDetail, getWeatherDetail, getWeekdayDetail.
// =====================================================================
import { getDishFoodCost, getDishSellingPrice } from './calculations.js';

// ---------------------------------------------------------------------
// CONSTANTES EXPORTÉES
// ---------------------------------------------------------------------
export const PERIODS = ['day', 'week', 'month', 'year'];
export const CHART_TYPES = ['line', 'donut', 'bar', 'groupedBar'];

export const DEFAULT_PERIODS = {
  overview: 'week',
  sales: 'week',
  costs: 'month',
  staff: 'month',
  weather: 'month',
  comparison: 'month',
  weekdaySales: 'month',
};

export const CATEGORY_COLORS = { dish: '#3C91A6', drink: '#FF9800', dessert: '#E91E63', sauce: '#9C27B0' };
export const EXPENSE_COLORS = { fixed: '#3C91A6', ingredients: '#FF9800', employees: '#9C27B0', expenses: '#E91E63' };
export const WEATHER_COLORS = { sunny: '#FF9800', cloudy: '#90A4AE', rainy: '#3C91A6', stormy: '#5E35B1', unknown: '#BDBDBD' };
export const CYCLE_COLORS = ['#3C91A6', '#FF9800', '#E91E63', '#9C27B0', '#43A047', '#5E35B1', '#00ACC1', '#F4511E'];
export const WEEKDAY_COLORS = ['#3C91A6', '#3C91A6', '#3C91A6', '#3C91A6', '#3C91A6', '#FF9800', '#FF9800'];

// ---------------------------------------------------------------------
// HELPERS INTERNES
// ---------------------------------------------------------------------
function filterByRestaurant(dataset, restaurantId) {
  if (!dataset) {
    return {
      rid: null,
      closings: [], dishes: [], ingredients: [], fixedCosts: [],
      employees: [], shifts: [], expenses: [],
      formulas: [], suppliers: [], supplierOffers: [],
    };
  }
  const rid = restaurantId || dataset.active_restaurant_id;
  return {
    rid,
    closings: (dataset.daily_closings || []).filter((c) => c && c.restaurant_id === rid),
    dishes: (dataset.dishes || []).filter((d) => d && d.restaurant_id === rid),
    ingredients: (dataset.ingredients || []).filter((i) => i && i.restaurant_id === rid),
    fixedCosts: (dataset.fixed_costs || []).filter((c) => c && c.restaurant_id === rid),
    employees: (dataset.employees || []).filter((e) => e && e.restaurant_id === rid),
    shifts: (dataset.shifts || []).filter((s) => s && s.restaurant_id === rid),
    expenses: (dataset.expenses || []).filter((e) => e && e.restaurant_id === rid),
    formulas: (dataset.formulas || []).filter((f) => f && f.restaurant_id === rid),
    suppliers: (dataset.suppliers || []).filter((s) => s && s.restaurant_id === rid),
    supplierOffers: (dataset.supplier_offers || []).filter((o) => o && o.restaurant_id === rid),
  };
}

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(iso) {
  if (typeof iso !== 'string') return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function getFixedCostDailyAmount(cost) {
  if (!cost) return 0;
  const amt = Number(cost.amount) || 0;
  if (cost.frequency === 'monthly') return amt / 30;
  if (cost.frequency === 'weekly') return amt / 7;
  if (cost.frequency === 'daily') return amt;
  if (cost.frequency === 'yearly') return amt / 365;
  return 0;
}

function getFixedCostYearlyAmount(cost) {
  if (!cost) return 0;
  const amt = Number(cost.amount) || 0;
  if (cost.frequency === 'monthly') return amt * 12;
  if (cost.frequency === 'weekly') return amt * 52;
  if (cost.frequency === 'daily') return amt * 365;
  if (cost.frequency === 'yearly') return amt;
  return 0;
}

function getExpenseTotalInDateRange(dataset, startIso, endIso) {
  const rid = dataset && dataset.active_restaurant_id;
  return (dataset.expenses || [])
    .filter((e) => {
      if (!e || e.restaurant_id !== rid) return false;
      if (startIso && e.date < startIso) return false;
      if (endIso && e.date > endIso) return false;
      return true;
    })
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

// ---------------------------------------------------------------------
// CHANTIER 31 — OPTION B
// ---------------------------------------------------------------------
export function expandFormulaSales(closing, formulas) {
  if (!closing || !Array.isArray(closing.sales)) return [];
  const formulasById = {};
  (formulas || []).forEach((f) => { if (f && f.id) formulasById[f.id] = f; });

  const out = [];
  for (const sale of closing.sales) {
    if (!sale) continue;
    const qty = Number(sale.quantity_sold) || 0;
    if (qty <= 0) continue;

    let formula = null;
    if (sale.formula_id && formulasById[sale.formula_id]) {
      formula = formulasById[sale.formula_id];
    } else if (sale.dish_id && formulasById[sale.dish_id]) {
      formula = formulasById[sale.dish_id];
    }

    if (formula && Array.isArray(formula.composition)) {
      for (const comp of formula.composition) {
        if (!comp || !comp.dish_id) continue;
        const compQty = (Number(comp.quantity) || 0) * qty;
        if (compQty > 0) out.push({ dish_id: comp.dish_id, quantity_sold: compQty });
      }
      continue;
    }

    if (sale.dish_id) out.push({ dish_id: sale.dish_id, quantity_sold: qty });
  }
  return out;
}

// ---------------------------------------------------------------------
// HELPERS MÉTIER
// ---------------------------------------------------------------------
function closingRevenue(closing, dishesById, category = null, dataset = null) {
  if (!closing || !Array.isArray(closing.sales)) return 0;
  const formulas = (dataset && dataset.formulas) || [];
  const expanded = expandFormulaSales(closing, formulas);
  return expanded.reduce((sum, s) => {
    const dish = dishesById[s.dish_id];
    if (!dish || (category && dish.category !== category)) return sum;
    const price = dataset ? getDishSellingPrice(dataset, dish, closing.date) : (Number(dish.price) || 0);
    return sum + price * (Number(s.quantity_sold) || 0);
  }, 0);
}

function closingFoodCost(closing, dishesById, ingredients, category = null, formulas = []) {
  if (!closing || !Array.isArray(closing.sales)) return 0;
  const expanded = expandFormulaSales(closing, formulas);
  return expanded.reduce((sum, s) => {
    const dish = dishesById[s.dish_id];
    if (!dish || (category && dish.category !== category)) return sum;
    return sum + getDishFoodCost(dish, ingredients) * (Number(s.quantity_sold) || 0);
  }, 0);
}

function closingItemsCount(closing, dishesById, category = null, formulas = []) {
  if (!closing || !Array.isArray(closing.sales)) return 0;
  const expanded = expandFormulaSales(closing, formulas);
  return expanded.reduce((sum, s) => {
    const dish = dishesById[s.dish_id];
    if (!dish || (category && dish.category !== category)) return sum;
    return sum + (Number(s.quantity_sold) || 0);
  }, 0);
}

// ---------------------------------------------------------------------
// PÉRIODES
// ---------------------------------------------------------------------
export function getEffectiveDays(closings, period) {
  if (period === 'day') return 1;
  if (period === 'week') return 7;
  if (period === 'month') return 30;
  if (period === 'year') return 365;
  return 1;
}

export function getPreviousPeriodRange(period) {
  if (!period) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let days = 1;
  if (period === 'week') days = 7;
  else if (period === 'month') days = 30;
  else if (period === 'year') days = 365;
  const end = new Date(today);
  end.setDate(today.getDate() - days);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return { startIso: toLocalISODate(start), endIso: toLocalISODate(end) };
}

export function filterClosingsByPeriod(closings, period) {
  if (!period) return closings || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cutoff;
  if (period === 'day') {
    cutoff = new Date(today);
  } else if (period === 'week') {
    cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 6);
  } else if (period === 'month') {
    cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 29);
  } else if (period === 'year') {
    cutoff = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  } else {
    return closings || [];
  }
  const cutoffKey = toLocalISODate(cutoff);
  return (closings || []).filter((c) => c && typeof c.date === 'string' && c.date >= cutoffKey);
}

export function filterClosingsByDateRange(closings, startIso, endIso) {
  if (!Array.isArray(closings)) return [];
  return closings.filter(
    (c) => c && typeof c.date === 'string' && (!startIso || c.date >= startIso) && (!endIso || c.date <= endIso)
  );
}

function buildTimeBuckets(period, closings = [], anchorDate = null) {
  const today = anchorDate ? new Date(anchorDate) : new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];

  if (period === 'day') {
    const key = toLocalISODate(today);
    buckets.push({ key, date: new Date(today), startIso: key, endIso: key, days: 1 });
    return buckets;
  }

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = toLocalISODate(d);
      buckets.push({ key, date: d, startIso: key, endIso: key, days: 1 });
    }
  } else if (period === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = toLocalISODate(d);
      buckets.push({ key, date: d, startIso: key, endIso: key, days: 1 });
    }
  } else if (period === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      buckets.push({ key, date: d, startIso: `${key}-01`, endIso: `${key}-${lastDay}`, days: lastDay });
    }
  }
  return buckets;
}

// ---------------------------------------------------------------------
// MAIN D'ŒUVRE
// ---------------------------------------------------------------------
function getLaborCostInDateRange(dataset, startIso, endIso) {
  const rid = dataset && dataset.active_restaurant_id;
  const employeesById = Object.fromEntries(
    (dataset.employees || [])
      .filter((e) => e && e.restaurant_id === rid)
      .map((e) => [e.id, e])
  );
  return (dataset.shifts || [])
    .filter((s) => {
      if (!s || s.restaurant_id !== rid) return false;
      if (startIso && s.date < startIso) return false;
      if (endIso && s.date > endIso) return false;
      return true;
    })
    .reduce((sum, s) => {
      const emp = employeesById[s.employee_id];
      if (!emp) return sum;
      if (Number(emp.hourly_rate) > 0) {
        return sum + Number(emp.hourly_rate) * (Number(s.hours_worked) || 0);
      }
      if (Number(emp.monthly_salary) > 0) {
        const daysPerWeek = Number(emp.days_per_week) || 5;
        const monthlyHours = daysPerWeek * 4.33 * 8;
        const impliedHourly = Number(emp.monthly_salary) / monthlyHours;
        return sum + impliedHourly * (Number(s.hours_worked) || 0);
      }
      return sum;
    }, 0);
}

// ---------------------------------------------------------------------
// CORE — Vue d'ensemble
// ---------------------------------------------------------------------
export function getGlobalSummary(dataset, period = null) {
  const { closings, dishes, ingredients, fixedCosts, formulas } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  let totalRevenue = 0;
  let totalFoodCost = 0;
  let totalItems = 0;
  for (const c of filteredClosings) {
    totalRevenue += closingRevenue(c, dishesById, null, dataset);
    totalFoodCost += closingFoodCost(c, dishesById, ingredients, null, formulas);
    totalItems += closingItemsCount(c, dishesById, null, formulas);
  }

  const days = getEffectiveDays(filteredClosings, period);
  const fixedCostsProrated = fixedCosts.reduce((sum, c) => sum + getFixedCostDailyAmount(c), 0) * days;

  let laborCost = 0;
  let expensesTotal = 0;
  if (filteredClosings.length > 0) {
    const dates = filteredClosings.map((c) => c.date).sort();
    laborCost = getLaborCostInDateRange(dataset, dates[0], dates[dates.length - 1]);
    expensesTotal = getExpenseTotalInDateRange(dataset, dates[0], dates[dates.length - 1]);
  }

  const totalExpenses = fixedCostsProrated + totalFoodCost + laborCost + expensesTotal;

  return {
    totalRevenue,
    totalFoodCost,
    grossMargin: totalRevenue - totalFoodCost,
    netProfit: totalRevenue - totalExpenses,
    margin: totalRevenue - totalFoodCost,
    totalItems,
    totalExpenses,
    fixedCosts: fixedCostsProrated,
    ingredientCost: totalFoodCost,
    laborCost,
    expensesTotal,
    daysCount: days,
    closingsCount: filteredClosings.length,
  };
}

export function getDailyAverages(dataset, period = null) {
  const s = getGlobalSummary(dataset, period);
  const days = Math.max(1, s.daysCount);
  return {
    revenuePerDay: s.totalRevenue / days,
    marginPerDay: s.grossMargin / days,
    profitPerDay: s.netProfit / days,
    itemsPerDay: s.totalItems / days,
    expensesPerDay: s.totalExpenses / days,
    foodCostPerDay: s.totalFoodCost / days,
    daysCount: days,
  };
}

// ---------------------------------------------------------------------
// TIME SERIES
// ---------------------------------------------------------------------
export function getKpiSeries(dataset, kpiType, period = 'week', filter = null) {
  const { closings, dishes, ingredients, fixedCosts, formulas } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const buckets = buildTimeBuckets(period, closings);
  const filteredClosings = filterClosingsByPeriod(closings, period);

  return buckets.map((bucket) => {
    let value = 0;
    if (kpiType === 'revenue') {
      for (const c of filteredClosings)
        if (c.date >= bucket.startIso && c.date <= bucket.endIso)
          value += closingRevenue(c, dishesById, filter, dataset);
    } else if (kpiType === 'profit') {
      for (const c of filteredClosings) {
        if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
        const expanded = expandFormulaSales(c, formulas);
        for (const s of expanded) {
          const dish = dishesById[s.dish_id];
          if (!dish || (filter && dish.category !== filter)) continue;
          const price = getDishSellingPrice(dataset, dish, c.date);
          value += (Number(s.quantity_sold) || 0) * (price - getDishFoodCost(dish, ingredients));
        }
      }
    } else if (kpiType === 'items') {
      for (const c of filteredClosings) {
        if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
        const expanded = expandFormulaSales(c, formulas);
        for (const s of expanded) {
          const dish = dishesById[s.dish_id];
          if (!dish || (filter && dish.category !== filter)) continue;
          value += Number(s.quantity_sold) || 0;
        }
      }
    } else if (kpiType === 'expenses') {
      const comp = filter || 'total';
      if (comp === 'fixed' || comp === 'total') {
        const dailyFixed = fixedCosts.reduce((sum, c) => sum + getFixedCostDailyAmount(c), 0);
        value += dailyFixed * bucket.days;
      }
      if (comp === 'ingredients' || comp === 'total') {
        for (const c of filteredClosings)
          if (c.date >= bucket.startIso && c.date <= bucket.endIso)
            value += closingFoodCost(c, dishesById, ingredients, null, formulas);
      }
      if (comp === 'employees' || comp === 'total') {
        value += getLaborCostInDateRange(dataset, bucket.startIso, bucket.endIso);
      }
      if (comp === 'expenses' || comp === 'total') {
        value += getExpenseTotalInDateRange(dataset, bucket.startIso, bucket.endIso);
      }
    }
    return { key: bucket.key, date: bucket.date, value };
  });
}

export function getMultiMetricSeries(dataset, period = 'week') {
  const { closings, dishes, ingredients, fixedCosts, formulas } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const buckets = buildTimeBuckets(period, closings);
  const filteredClosings = filterClosingsByPeriod(closings, period);

  const series = { revenue: [], margin: [], expenses: [], items: [] };

  for (const bucket of buckets) {
    let revenue = 0;
    let foodCost = 0;
    let items = 0;
    for (const c of filteredClosings) {
      if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
      revenue += closingRevenue(c, dishesById, null, dataset);
      foodCost += closingFoodCost(c, dishesById, ingredients, null, formulas);
      items += closingItemsCount(c, dishesById, null, formulas);
    }
    const fixed = fixedCosts.reduce((sum, c) => sum + getFixedCostDailyAmount(c), 0) * bucket.days;
    const labor = getLaborCostInDateRange(dataset, bucket.startIso, bucket.endIso);
    const exp = getExpenseTotalInDateRange(dataset, bucket.startIso, bucket.endIso);
    const expenses = fixed + foodCost + labor + exp;

    series.revenue.push({ key: bucket.key, date: bucket.date, value: revenue });
    series.margin.push({ key: bucket.key, date: bucket.date, value: revenue - foodCost });
    series.expenses.push({ key: bucket.key, date: bucket.date, value: expenses });
    series.items.push({ key: bucket.key, date: bucket.date, value: items });
  }

  const buildMeta = (points, labelKey) => {
    const maxValue = points.reduce((m, p) => Math.max(m, p.value), 0);
    const total = points.reduce((s, p) => s + p.value, 0);
    return { labelKey, points, maxValue, total, average: points.length ? total / points.length : 0 };
  };

  return {
    buckets: buckets.map((b) => ({ key: b.key, date: b.date })),
    series: [
      { key: 'revenue', color: '#FF9800', unit: 'currency', ...buildMeta(series.revenue, 'stats.series.revenue') },
      { key: 'margin', color: '#3C91A6', unit: 'currency', ...buildMeta(series.margin, 'stats.series.margin') },
      { key: 'expenses', color: '#E91E63', unit: 'currency', ...buildMeta(series.expenses, 'stats.series.expenses') },
      { key: 'items', color: '#9C27B0', unit: 'number', ...buildMeta(series.items, 'stats.series.items') },
    ],
  };
}

// ---------------------------------------------------------------------
// CHANTIER 39 FUSION — getDishIndividualSeries étendu (metric)
// ---------------------------------------------------------------------
export function getDishIndividualSeries(dataset, period = 'week', dishId = null, metric = 'qty') {
  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const buckets = buildTimeBuckets(period, closings);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  let includedDishes = dishId ? [dishesById[dishId]] : dishes;
  includedDishes = includedDishes.filter(Boolean);

  const series = includedDishes.map((dish) => {
    const points = buckets.map((bucket) => {
      let value = 0;
      for (const c of filteredClosings) {
        if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
        const expanded = expandFormulaSales(c, formulas);
        for (const s of expanded) {
          if (s.dish_id !== dish.id) continue;
          const qty = Number(s.quantity_sold) || 0;
          if (metric === 'qty') {
            value += qty;
          } else if (metric === 'revenue') {
            value += qty * getDishSellingPrice(dataset, dish, c.date);
          } else if (metric === 'margin') {
            value += qty * (getDishSellingPrice(dataset, dish, c.date) - getDishFoodCost(dish, ingredients));
          } else {
            value += qty;
          }
        }
      }
      return { key: bucket.key, date: bucket.date, value };
    });
    return { dishId: dish.id, dishName: dish.name, category: dish.category, points };
  });

  return { buckets: buckets.map((b) => ({ key: b.key, date: b.date })), series, selectedDishId: dishId || null };
}

// ---------------------------------------------------------------------
// BREAKDOWNS
// ---------------------------------------------------------------------
export function getCategoryBreakdown(dataset, kpiType = 'revenue', period = null) {
  if (kpiType === 'expenses') return getExpensesBreakdown(dataset, period);
  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const categories = { dish: 0, drink: 0, dessert: 0, sauce: 0 };
  let total = 0;
  for (const c of filteredClosings) {
    const expanded = expandFormulaSales(c, formulas);
    for (const s of expanded) {
      const dish = dishesById[s.dish_id];
      if (!dish) continue;
      const qty = Number(s.quantity_sold) || 0;
      if (qty <= 0) continue;
      let value = 0;
      const price = getDishSellingPrice(dataset, dish, c.date);
      if (kpiType === 'revenue') value = qty * price;
      else if (kpiType === 'profit') value = qty * (price - getDishFoodCost(dish, ingredients));
      else if (kpiType === 'items') value = qty;
      if (categories[dish.category] !== undefined) {
        categories[dish.category] += value;
        total += value;
      }
    }
  }
  return {
    total,
    categories: Object.entries(categories).map(([key, value]) => ({
      key,
      value,
      percentage: total ? (value / total) * 100 : 0,
    })),
  };
}

export function getExpensesBreakdown(dataset, period = null) {
  const { closings, dishes, ingredients, fixedCosts, formulas } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const days = getEffectiveDays(filteredClosings, period);
  const fixed = fixedCosts.reduce((sum, c) => sum + getFixedCostDailyAmount(c), 0) * days;

  let ingredientsCost = 0;
  for (const c of filteredClosings)
    ingredientsCost += closingFoodCost(c, dishesById, ingredients, null, formulas);

  let labor = 0;
  let expensesTotal = 0;
  if (filteredClosings.length > 0) {
    const dates = filteredClosings.map((c) => c.date).sort();
    labor = getLaborCostInDateRange(dataset, dates[0], dates[dates.length - 1]);
    expensesTotal = getExpenseTotalInDateRange(dataset, dates[0], dates[dates.length - 1]);
  }

  const total = fixed + ingredientsCost + labor + expensesTotal;
  return {
    total,
    categories: [
      { key: 'fixed', value: fixed, percentage: total ? (fixed / total) * 100 : 0 },
      { key: 'ingredients', value: ingredientsCost, percentage: total ? (ingredientsCost / total) * 100 : 0 },
      { key: 'employees', value: labor, percentage: total ? (labor / total) * 100 : 0 },
      { key: 'expenses', value: expensesTotal, percentage: total ? (expensesTotal / total) * 100 : 0 },
    ],
  };
}

export function getWeatherBreakdown(dataset, period = null) {
  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  const weatherMap = {
    sunny: { key: 'sunny', days: 0, revenue: 0, foodCost: 0, items: 0, closings: 0 },
    cloudy: { key: 'cloudy', days: 0, revenue: 0, foodCost: 0, items: 0, closings: 0 },
    rainy: { key: 'rainy', days: 0, revenue: 0, foodCost: 0, items: 0, closings: 0 },
    stormy: { key: 'stormy', days: 0, revenue: 0, foodCost: 0, items: 0, closings: 0 },
    unknown: { key: 'unknown', days: 0, revenue: 0, foodCost: 0, items: 0, closings: 0 },
  };

  for (const c of filteredClosings) {
    const w = weatherMap[c.weather] || weatherMap.unknown;
    w.days += 1;
    w.closings += 1;
    w.revenue += closingRevenue(c, dishesById, null, dataset);
    w.foodCost += closingFoodCost(c, dishesById, ingredients, null, formulas);
    w.items += closingItemsCount(c, dishesById, null, formulas);
  }

  const totalDays = filteredClosings.length;
  const totalRevenue = Object.values(weatherMap).reduce((s, w) => s + w.revenue, 0);

  const weathers = Object.values(weatherMap)
    .filter((w) => w.days > 0)
    .map((w) => ({
      key: w.key,
      days: w.days,
      closings: w.closings,
      revenue: w.revenue,
      foodCost: w.foodCost,
      margin: w.revenue - w.foodCost,
      marginPct: w.revenue > 0 ? ((w.revenue - w.foodCost) / w.revenue) * 100 : 0,
      items: w.items,
      avgRevenuePerDay: w.days > 0 ? w.revenue / w.days : 0,
      avgItemsPerDay: w.days > 0 ? w.items / w.days : 0,
      revenuePct: totalRevenue > 0 ? (w.revenue / totalRevenue) * 100 : 0,
      daysPct: totalDays > 0 ? (w.days / totalDays) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    weathers,
    totalDays,
    totalRevenue,
    best: weathers[0] || null,
    worst: weathers.length > 1 ? weathers[weathers.length - 1] : null,
  };
}

export function getEmployeeStats(dataset, period = null) {
  const { employees, shifts, closings } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  let startIso = null;
  let endIso = null;
  if (filteredClosings.length > 0) {
    const dates = filteredClosings.map((c) => c.date).sort();
    startIso = dates[0];
    endIso = dates[dates.length - 1];
  }

  const statsByEmp = {};
  for (const emp of employees) {
    statsByEmp[emp.id] = { employee: emp, hours: 0, cost: 0, daysWorked: 0, shiftCount: 0 };
  }

  for (const shift of shifts) {
    if (!shift || !statsByEmp[shift.employee_id]) continue;
    if (startIso && shift.date < startIso) continue;
    if (endIso && shift.date > endIso) continue;
    const emp = statsByEmp[shift.employee_id].employee;
    const hours = Number(shift.hours_worked) || 0;
    const hourly = Number(emp.hourly_rate) || 0;
    statsByEmp[shift.employee_id].hours += hours;
    statsByEmp[shift.employee_id].cost += hours * hourly;
    statsByEmp[shift.employee_id].daysWorked += 1;
    statsByEmp[shift.employee_id].shiftCount += 1;
  }

  const list = Object.values(statsByEmp).map((row) => ({
    ...row,
    hourlyRate: Number(row.employee.hourly_rate) || 0,
    avgHoursPerShift: row.shiftCount > 0 ? row.hours / row.shiftCount : 0,
    costPerHour: row.hours > 0 ? row.cost / row.hours : 0,
  }));

  const totalHours = list.reduce((s, r) => s + r.hours, 0);
  const totalCost = list.reduce((s, r) => s + r.cost, 0);

  return {
    employees: list
      .map((r) => ({
        ...r,
        hoursPct: totalHours > 0 ? (r.hours / totalHours) * 100 : 0,
        costPct: totalCost > 0 ? (r.cost / totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours),
    totalHours,
    totalCost,
  };
}

export function getIngredientCosts(dataset, period = null) {
  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const ingById = Object.fromEntries(ingredients.map((i) => [i.id, i]));

  const usage = {};
  for (const c of filteredClosings) {
    const expanded = expandFormulaSales(c, formulas);
    for (const sale of expanded) {
      const dish = dishesById[sale.dish_id];
      if (!dish || !Array.isArray(dish.recipe)) continue;
      const soldQty = Number(sale.quantity_sold) || 0;
      if (soldQty <= 0) continue;
      for (const r of dish.recipe) {
        const ing = ingById[r.ingredient_id];
        if (!ing) continue;
        if (ing.track_stock === false) continue;
        if (!usage[ing.id]) {
          usage[ing.id] = { ingredient: ing, quantityUsed: 0, cost: 0 };
        }
        const qBase = Number.isFinite(r.quantity_in_base) ? r.quantity_in_base : (Number(r.quantity) || 0);
        const refCost = Number.isFinite(ing.reference_unit_cost) ? ing.reference_unit_cost : (Number(ing.unit_cost) || 0);
        const yf = Number.isFinite(ing.yield_factor) && ing.yield_factor > 0 ? ing.yield_factor : 1;
        usage[ing.id].quantityUsed += (soldQty * qBase) / yf;
        usage[ing.id].cost += (soldQty * qBase * refCost) / yf;
      }
    }
  }

  const totalCost = Object.values(usage).reduce((s, u) => s + u.cost, 0);
  const list = Object.values(usage)
    .map((u) => ({
      id: u.ingredient.id,
      name: u.ingredient.name,
      unit: u.ingredient.base_unit || u.ingredient.unit || '',
      unitCost: Number.isFinite(u.ingredient.reference_unit_cost) ? u.ingredient.reference_unit_cost : (Number(u.ingredient.unit_cost) || 0),
      supplier: u.ingredient.supplier || '',
      category: u.ingredient.category,
      quantityUsed: u.quantityUsed,
      cost: u.cost,
      costPct: totalCost > 0 ? (u.cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  return { ingredients: list, totalCost };
}

export function getFixedCostsBreakdown(dataset, period = null) {
  const { fixedCosts, closings } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const days = getEffectiveDays(filteredClosings, period);

  const list = fixedCosts.map((c) => {
    const daily = getFixedCostDailyAmount(c);
    const yearly = getFixedCostYearlyAmount(c);
    return {
      id: c.id, name: c.name, amount: Number(c.amount) || 0,
      frequency: c.frequency, dailyAmount: daily,
      periodAmount: daily * days, yearlyAmount: yearly, monthlyAmount: yearly / 12,
    };
  });

  const totalPeriod = list.reduce((s, c) => s + c.periodAmount, 0);
  const totalYearly = list.reduce((s, c) => s + c.yearlyAmount, 0);
  const totalMonthly = totalYearly / 12;

  return {
    costs: list.map((c) => ({
      ...c,
      periodPct: totalPeriod > 0 ? (c.periodAmount / totalPeriod) * 100 : 0,
      yearlyPct: totalYearly > 0 ? (c.yearlyAmount / totalYearly) * 100 : 0,
    })),
    totalPeriod, totalMonthly, totalYearly, days,
  };
}

// ---------------------------------------------------------------------
// RANKINGS
// ---------------------------------------------------------------------
export function getFullRanking(dataset, period = null, category = null) {
  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const stats = {};
  for (const c of filteredClosings) {
    const expanded = expandFormulaSales(c, formulas);
    for (const s of expanded) {
      const dish = dishesById[s.dish_id];
      if (!dish || (category && dish.category !== category)) continue;
      const qty = Number(s.quantity_sold) || 0;
      if (qty <= 0) continue;
      if (!stats[dish.id]) stats[dish.id] = { dish, qty: 0, revenue: 0, foodCost: 0 };
      const price = getDishSellingPrice(dataset, dish, c.date);
      stats[dish.id].qty += qty;
      stats[dish.id].revenue += qty * price;
      stats[dish.id].foodCost += qty * getDishFoodCost(dish, ingredients);
    }
  }
  return Object.values(stats)
    .map((s) => ({
      ...s,
      margin: s.revenue - s.foodCost,
      marginPct: s.revenue > 0 ? ((s.revenue - s.foodCost) / s.revenue) * 100 : 0,
      avgUnitPrice: s.qty > 0 ? s.revenue / s.qty : 0,
      avgUnitCost: s.qty > 0 ? s.foodCost / s.qty : 0,
    }))
    .sort((a, b) => b.qty - a.qty);
}

export function getDishesRanking(dataset, limit = 3, period = null) {
  const sorted = getFullRanking(dataset, period);
  const top = sorted.slice(0, limit);
  const flop = sorted
    .filter((x) => !top.some((t) => t.dish.id === x.dish.id))
    .slice(-limit)
    .reverse();
  return { top, flop };
}

export function getDishDetails(dataset, period = null, dishId = null) {
  if (!dishId) return null;
  const ranking = getFullRanking(dataset, period);
  const item = ranking.find((r) => r.dish.id === dishId);
  if (!item) return null;
  const series = getDishIndividualSeries(dataset, period || 'week', dishId);
  return { ...item, series: series.series[0] || null };
}

// ---------------------------------------------------------------------
// BUBBLE DATA (deprecated v5)
// ---------------------------------------------------------------------
export function getBubbleData(dataset, period = null, context = 'dishes') {
  if (context === 'overview') {
    const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
    const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
    const buckets = buildTimeBuckets(period, closings);
    const filteredClosings = filterClosingsByPeriod(closings, period);
    const points = [];
    let maxRevenue = 0;
    for (const bucket of buckets) {
      let revenue = 0, foodCost = 0, items = 0;
      for (const c of filteredClosings) {
        if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
        revenue += closingRevenue(c, dishesById, null, dataset);
        foodCost += closingFoodCost(c, dishesById, ingredients, null, formulas);
        items += closingItemsCount(c, dishesById, null, formulas);
      }
      const marginPct = revenue > 0 ? ((revenue - foodCost) / revenue) * 100 : 0;
      if (revenue > maxRevenue) maxRevenue = revenue;
      points.push({ id: bucket.key, label: bucket.key, x: revenue, y: marginPct, size: items, sizePct: 0, meta: { foodCost, margin: revenue - foodCost, items, date: bucket.date } });
    }
    return {
      xLabel: 'stats.bubble.x.overview.revenue',
      yLabel: 'stats.bubble.y.overview.marginPct',
      sizeLabel: 'stats.bubble.size.overview.items',
      bubbles: points.map((p) => ({ ...p, sizePct: maxRevenue > 0 ? (p.x / maxRevenue) * 100 : 0 })),
    };
  }
  if (context === 'dishes') {
    const ranking = getFullRanking(dataset, period);
    const maxRevenue = ranking.reduce((m, r) => Math.max(m, r.revenue), 0) || 1;
    return {
      xLabel: 'stats.bubble.x.dishes.qty',
      yLabel: 'stats.bubble.y.dishes.marginPct',
      sizeLabel: 'stats.bubble.size.revenue',
      bubbles: ranking.map((r) => ({
        id: r.dish.id, label: r.dish.name, category: r.dish.category,
        x: r.qty, y: r.marginPct, size: r.revenue,
        sizePct: (r.revenue / maxRevenue) * 100,
        meta: { price: r.dish.price, foodCost: r.foodCost / Math.max(1, r.qty), margin: r.margin, marginPct: r.marginPct },
      })),
    };
  }
  if (context === 'employees') {
    const stats = getEmployeeStats(dataset, period);
    const maxCost = stats.employees.reduce((m, r) => Math.max(m, r.cost), 0) || 1;
    return {
      xLabel: 'stats.bubble.x.employees.hours',
      yLabel: 'stats.bubble.y.employees.hourlyRate',
      sizeLabel: 'stats.bubble.size.cost',
      bubbles: stats.employees.map((r) => ({
        id: r.employee.id, label: r.employee.name,
        x: r.hours, y: r.hourlyRate, size: r.cost,
        sizePct: (r.cost / maxCost) * 100,
        meta: { daysWorked: r.daysWorked, avgHoursPerShift: r.avgHoursPerShift, costPct: r.costPct },
      })),
    };
  }
  if (context === 'weather') {
    const stats = getWeatherBreakdown(dataset, period);
    const maxRevenue = stats.weathers.reduce((m, w) => Math.max(m, w.revenue), 0) || 1;
    return {
      xLabel: 'stats.bubble.x.weather.days',
      yLabel: 'stats.bubble.y.weather.avgRevenuePerDay',
      sizeLabel: 'stats.bubble.size.revenue',
      bubbles: stats.weathers.map((w) => ({
        id: w.key, label: `stats.weather.${w.key}`,
        x: w.days, y: w.avgRevenuePerDay, size: w.revenue,
        sizePct: (w.revenue / maxRevenue) * 100,
        meta: { revenuePct: w.revenuePct, marginPct: w.marginPct, avgItemsPerDay: w.avgItemsPerDay },
      })),
    };
  }
  return { xLabel: '', yLabel: '', sizeLabel: '', bubbles: [] };
}

// ---------------------------------------------------------------------
// BAR METRICS
// ---------------------------------------------------------------------
export function getBarMetrics(dataset, period = null, mode = 'category') {
  if (mode === 'category') {
    const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
    const filteredClosings = filterClosingsByPeriod(closings, period);
    const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
    const acc = {};
    const CATS = ['dish', 'drink', 'dessert', 'sauce'];
    for (const cat of CATS) acc[cat] = { key: cat, label: `menu.sections.${cat}`, revenue: 0, items: 0, foodCost: 0, margin: 0 };
    for (const c of filteredClosings) {
      const expanded = expandFormulaSales(c, formulas);
      for (const s of expanded) {
        const dish = dishesById[s.dish_id];
        if (!dish || !acc[dish.category]) continue;
        const qty = Number(s.quantity_sold) || 0;
        if (qty <= 0) continue;
        const price = getDishSellingPrice(dataset, dish, c.date);
        const unitCost = getDishFoodCost(dish, ingredients);
        acc[dish.category].revenue += qty * price;
        acc[dish.category].items += qty;
        acc[dish.category].foodCost += qty * unitCost;
        acc[dish.category].margin += qty * (price - unitCost);
      }
    }
    const totalRevenue = Object.values(acc).reduce((s, a) => s + a.revenue, 0);
    const totalItems = Object.values(acc).reduce((s, a) => s + a.items, 0);
    return {
      mode,
      bars: Object.values(acc).map((a) => ({
        key: a.key, label: a.label, value: a.revenue,
        format: 'currency',
        color: a.key === 'dish' ? '#3C91A6' : a.key === 'drink' ? '#FF9800' : a.key === 'dessert' ? '#E91E63' : '#9C27B0',
        subMetrics: [
          { label: 'stats.metrics.items', value: a.items, format: 'number' },
          { label: 'stats.metrics.revenue', value: a.revenue, format: 'currency' },
          { label: 'stats.metrics.foodCost', value: a.foodCost, format: 'currency' },
          { label: 'stats.metrics.margin', value: a.margin, format: 'currency' },
          { label: 'stats.metrics.marginPct', value: a.revenue > 0 ? (a.margin / a.revenue) * 100 : 0, format: 'percent' },
          { label: 'stats.metrics.revenuePct', value: totalRevenue > 0 ? (a.revenue / totalRevenue) * 100 : 0, format: 'percent' },
          { label: 'stats.metrics.itemsPct', value: totalItems > 0 ? (a.items / totalItems) * 100 : 0, format: 'percent' },
          { label: 'stats.metrics.avgUnitPrice', value: a.items > 0 ? a.revenue / a.items : 0, format: 'currency' },
        ],
      })),
    };
  }

  if (mode === 'expenses') {
    const b = getExpensesBreakdown(dataset, period);
    return {
      mode,
      bars: b.categories.map((c) => ({
        key: c.key, label: `stats.expensesComponents.${c.key}`, value: c.value, format: 'currency',
        color: c.key === 'fixed' ? '#3C91A6' : c.key === 'ingredients' ? '#FF9800' : c.key === 'employees' ? '#9C27B0' : '#E91E63',
        subMetrics: [
          { label: 'stats.metrics.amount', value: c.value, format: 'currency' },
          { label: 'stats.metrics.share', value: c.percentage, format: 'percent' },
        ],
      })),
    };
  }

  if (mode === 'weather') {
    const w = getWeatherBreakdown(dataset, period);
    return {
      mode,
      bars: w.weathers.map((row) => ({
        key: row.key, label: `stats.weather.${row.key}`, value: row.revenue, format: 'currency',
        color: row.key === 'sunny' ? '#FF9800' : row.key === 'cloudy' ? '#90A4AE' : row.key === 'rainy' ? '#3C91A6' : row.key === 'stormy' ? '#5E35B1' : '#BDBDBD',
        subMetrics: [
          { label: 'stats.metrics.days', value: row.days, format: 'number' },
          { label: 'stats.metrics.revenue', value: row.revenue, format: 'currency' },
          { label: 'stats.metrics.revenuePerDay', value: row.avgRevenuePerDay, format: 'currency' },
          { label: 'stats.metrics.items', value: row.items, format: 'number' },
          { label: 'stats.metrics.margin', value: row.margin, format: 'currency' },
          { label: 'stats.metrics.marginPct', value: row.marginPct, format: 'percent' },
          { label: 'stats.metrics.revenuePct', value: row.revenuePct, format: 'percent' },
        ],
      })),
    };
  }

  if (mode === 'employees') {
    const e = getEmployeeStats(dataset, period);
    return {
      mode,
      bars: e.employees.map((row) => ({
        key: row.employee.id, label: row.employee.name, value: row.cost, format: 'currency',
        color: '#3C91A6',
        subMetrics: [
          { label: 'stats.metrics.hours', value: row.hours, format: 'number' },
          { label: 'stats.metrics.daysWorked', value: row.daysWorked, format: 'number' },
          { label: 'stats.metrics.avgHoursPerShift', value: row.avgHoursPerShift, format: 'number' },
          { label: 'stats.metrics.hourlyRate', value: row.hourlyRate, format: 'currency' },
          { label: 'stats.metrics.cost', value: row.cost, format: 'currency' },
          { label: 'stats.metrics.costPct', value: row.costPct, format: 'percent' },
          { label: 'stats.metrics.hoursPct', value: row.hoursPct, format: 'percent' },
        ],
      })),
    };
  }

  if (mode === 'ingredients') {
    const i = getIngredientCosts(dataset, period);
    return {
      mode,
      bars: i.ingredients.map((row) => ({
        key: row.id, label: row.name, value: row.cost, format: 'currency', color: '#FF9800',
        subMetrics: [
          { label: 'stats.metrics.quantityUsed', value: row.quantityUsed, format: 'number', unit: row.unit },
          { label: 'stats.metrics.unitCost', value: row.unitCost, format: 'currency', unit: row.unit },
          { label: 'stats.metrics.cost', value: row.cost, format: 'currency' },
          { label: 'stats.metrics.share', value: row.costPct, format: 'percent' },
        ],
      })),
    };
  }

  if (mode === 'fixedCosts') {
    const f = getFixedCostsBreakdown(dataset, period);
    return {
      mode,
      bars: f.costs.map((row) => ({
        key: row.id, label: row.name, value: row.periodAmount, format: 'currency', color: '#3C91A6',
        subMetrics: [
          { label: 'stats.metrics.amount', value: row.amount, format: 'currency', unit: `/${row.frequency}` },
          { label: 'stats.metrics.periodAmount', value: row.periodAmount, format: 'currency' },
          { label: 'stats.metrics.monthlyAmount', value: row.monthlyAmount, format: 'currency' },
          { label: 'stats.metrics.yearlyAmount', value: row.yearlyAmount, format: 'currency' },
          { label: 'stats.metrics.share', value: row.periodPct, format: 'percent' },
        ],
      })),
    };
  }

  return { mode, bars: [] };
}

// ---------------------------------------------------------------------
// COMPARAISON
// ---------------------------------------------------------------------
export function getComparison(dataset, period = 'week') {
  const prev = getPreviousPeriodRange(period);
  if (!prev) return { period, previousPeriod: null, metrics: [] };

  const { closings, dishes, ingredients, fixedCosts, formulas } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  function computePeriod(startIso, endIso) {
    const list = filterClosingsByDateRange(closings, startIso, endIso);
    let revenue = 0, foodCost = 0, items = 0;
    for (const c of list) {
      revenue += closingRevenue(c, dishesById, null, dataset);
      foodCost += closingFoodCost(c, dishesById, ingredients, null, formulas);
      items += closingItemsCount(c, dishesById, null, formulas);
    }

    const days = Math.max(1, (() => {
      const dates = list.map((c) => parseLocalDate(c.date)).filter((d) => d instanceof Date);
      if (dates.length === 0) {
        const startD = parseLocalDate(startIso);
        const endD = parseLocalDate(endIso);
        if (startD && endD) return Math.ceil((endD - startD) / (1000 * 60 * 60 * 24)) + 1;
        return 1;
      }
      const min = new Date(Math.min(...dates));
      const max = new Date(Math.max(...dates));
      return Math.ceil((max - min) / (1000 * 60 * 60 * 24)) + 1;
    })());

    const fixedProrated = fixedCosts.reduce((sum, c) => sum + getFixedCostDailyAmount(c), 0) * days;
    const labor = getLaborCostInDateRange(dataset, startIso, endIso);
    const exp = getExpenseTotalInDateRange(dataset, startIso, endIso);
    const expenses = fixedProrated + foodCost + labor + exp;
    const margin = revenue - foodCost;
    const netProfit = revenue - expenses;

    return {
      revenue, items, foodCost, expenses, margin, netProfit,
      fixedCosts: fixedProrated, laborCost: labor, expensesTotal: exp,
      avgRevenuePerDay: revenue / days,
      avgItemsPerDay: items / days,
      avgExpensesPerDay: expenses / days,
      closingsCount: list.length, daysCount: days,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentList = filterClosingsByPeriod(closings, period);
  const currentDates = currentList.map((c) => c.date).sort();
  const currentStartIso = currentDates[0] || toLocalISODate(today);
  const currentEndIso = currentDates[currentDates.length - 1] || toLocalISODate(today);
  const current = computePeriod(currentStartIso, currentEndIso);
  const previous = computePeriod(prev.startIso, prev.endIso);

  const buildMetric = (key, label, currentVal, previousVal) => {
    const delta = currentVal - previousVal;
    const deltaPct = previousVal !== 0 ? (delta / previousVal) * 100 : (currentVal !== 0 ? 100 : 0);
    return { key, label, current: currentVal, previous: previousVal, delta, deltaPct };
  };

  return {
    period,
    previousPeriod: prev,
    metrics: [
      buildMetric('revenue', 'stats.metrics.revenue', current.revenue, previous.revenue),
      buildMetric('items', 'stats.metrics.items', current.items, previous.items),
      buildMetric('foodCost', 'stats.metrics.foodCost', current.foodCost, previous.foodCost),
      buildMetric('margin', 'stats.metrics.margin', current.margin, previous.margin),
      buildMetric('expenses', 'stats.metrics.expenses', current.expenses, previous.expenses),
      buildMetric('netProfit', 'stats.metrics.netProfit', current.netProfit, previous.netProfit),
      buildMetric('avgRevenuePerDay', 'stats.metrics.revenuePerDay', current.avgRevenuePerDay, previous.avgRevenuePerDay),
      buildMetric('avgItemsPerDay', 'stats.metrics.itemsPerDay', current.avgItemsPerDay, previous.avgItemsPerDay),
    ],
    current,
    previous,
  };
}

// =====================================================================
// DONUT DATA (v5 + Chantier 39 FUSION — contextes métriques)
// =====================================================================
function buildDonut({ items, total, format, emptyLabel }) {
  const segments = items.filter((it) => it.value > 0).sort((a, b) => b.value - a.value);
  if (segments.length === 0) {
    return { segments: [], total: 0, topSegment: null, format, emptyLabel, empty: true };
  }
  return { segments, total, topSegment: segments[0], format, emptyLabel, empty: false };
}

export function getDonutData(dataset, period = 'month', context = 'category') {
  // ── CHANTIER 39 FUSION — contextes métriques ─────────────────────
  // 'margin' → getCategoryBreakdown attend 'profit'
  if (context === 'revenue' || context === 'margin' || context === 'items') {
    const kpiType = context === 'margin' ? 'profit' : context;
    const breakdown = getCategoryBreakdown(dataset, kpiType, period);
    return buildDonut({
      items: breakdown.categories.map((c) => ({
        key: c.key,
        label: `menu.sections.${c.key}`,
        value: c.value,
        pct: c.percentage,
        color: CATEGORY_COLORS[c.key] || '#3C91A6',
      })),
      total: breakdown.total,
      format: context === 'items' ? 'number' : 'currency',
      emptyLabel: `stats.metrics.${context}`,
    });
  }

  if (context === 'category' || context === 'overview' || context === 'sales') {
    const breakdown = getCategoryBreakdown(dataset, 'revenue', period);
    return buildDonut({
      items: breakdown.categories.map((c) => ({
        key: c.key,
        label: `menu.sections.${c.key}`,
        value: c.value,
        pct: c.percentage,
        color: CATEGORY_COLORS[c.key] || '#3C91A6',
      })),
      total: breakdown.total,
      format: 'currency',
      emptyLabel: 'stats.metrics.revenue',
    });
  }

  if (context === 'expenses' || context === 'costs') {
    const breakdown = getExpensesBreakdown(dataset, period);
    return buildDonut({
      items: breakdown.categories.map((c) => ({
        key: c.key,
        label: `stats.expensesComponents.${c.key}`,
        value: c.value,
        pct: c.percentage,
        color: EXPENSE_COLORS[c.key] || '#3C91A6',
      })),
      total: breakdown.total,
      format: 'currency',
      emptyLabel: 'stats.metrics.expenses',
    });
  }

  if (context === 'weather') {
    const breakdown = getWeatherBreakdown(dataset, period);
    return buildDonut({
      items: breakdown.weathers.map((w) => ({
        key: w.key, label: `stats.weather.${w.key}`, value: w.revenue,
        pct: w.revenuePct, color: WEATHER_COLORS[w.key] || '#BDBDBD',
      })),
      total: breakdown.totalRevenue,
      format: 'currency',
      emptyLabel: 'stats.metrics.revenue',
    });
  }

  if (context === 'staff' || context === 'employees') {
    const stats = getEmployeeStats(dataset, period);
    const items = stats.employees.map((e, i) => ({
      key: e.employee.id, label: e.employee.name, value: e.cost,
      pct: e.costPct, color: CYCLE_COLORS[i % CYCLE_COLORS.length],
    }));
    return buildDonut({ items, total: stats.totalCost, format: 'currency', emptyLabel: 'stats.metrics.cost' });
  }

  if (context === 'ingredients') {
    const stats = getIngredientCosts(dataset, period);
    const items = stats.ingredients.slice(0, 10).map((ing, i) => ({
      key: ing.id, label: ing.name, value: ing.cost,
      pct: ing.costPct, color: CYCLE_COLORS[i % CYCLE_COLORS.length],
    }));
    return buildDonut({ items, total: stats.totalCost, format: 'currency', emptyLabel: 'stats.metrics.foodCost' });
  }

  return { segments: [], total: 0, topSegment: null, format: 'currency', emptyLabel: '', empty: true };
}

// =====================================================================
// GROUPED BAR DATA (v5)
// =====================================================================
export function getGroupedBarData(dataset, period = 'week', context = 'revenue') {
  const { closings, dishes, ingredients, fixedCosts, employees, shifts, formulas } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const prev = getPreviousPeriodRange(period);
  if (!prev) return { buckets: [], trendPct: 0, currentLabel: '', previousLabel: '', format: 'currency', empty: true };

  const computeTrend = (buckets) => {
    const sumCur = buckets.reduce((s, b) => s + b.current, 0);
    const sumPrev = buckets.reduce((s, b) => s + b.previous, 0);
    return sumPrev > 0 ? ((sumCur - sumPrev) / sumPrev) * 100 : (sumCur > 0 ? 100 : 0);
  };

  if (['revenue', 'margin', 'expenses', 'items'].includes(context)) {
    let days = 1;
    if (period === 'week') days = 7;
    else if (period === 'month') days = 30;
    else if (period === 'year') days = 365;

    const anchorPrev = new Date();
    anchorPrev.setHours(0, 0, 0, 0);
    anchorPrev.setDate(anchorPrev.getDate() - days);

    const currentBuckets = buildTimeBuckets(period, closings);
    const previousBuckets = buildTimeBuckets(period, closings, anchorPrev);

    const computeValue = (bucket) => {
      const inRange = closings.filter((c) => c.date >= bucket.startIso && c.date <= bucket.endIso);
      if (context === 'revenue') return inRange.reduce((s, c) => s + closingRevenue(c, dishesById, null, dataset), 0);
      if (context === 'margin') return inRange.reduce((s, c) => s + closingRevenue(c, dishesById, null, dataset) - closingFoodCost(c, dishesById, ingredients, null, formulas), 0);
      if (context === 'expenses') {
        const foodCost = inRange.reduce((s, c) => s + closingFoodCost(c, dishesById, ingredients, null, formulas), 0);
        const fixed = fixedCosts.reduce((s, c) => s + getFixedCostDailyAmount(c), 0) * bucket.days;
        const labor = getLaborCostInDateRange(dataset, bucket.startIso, bucket.endIso);
        const exp = getExpenseTotalInDateRange(dataset, bucket.startIso, bucket.endIso);
        return fixed + foodCost + labor + exp;
      }
      if (context === 'items') return inRange.reduce((s, c) => s + closingItemsCount(c, dishesById, null, formulas), 0);
      return 0;
    };

    const buckets = currentBuckets.map((b, i) => {
      const cur = computeValue(b);
      const prvB = previousBuckets[i];
      const prv = prvB ? computeValue(prvB) : 0;
      return { key: b.key, label: b.key, current: cur, previous: prv };
    });

    return {
      buckets, trendPct: computeTrend(buckets),
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: context === 'items' ? 'number' : 'currency',
      empty: buckets.length === 0,
    };
  }

  if (context === 'category') {
    const CATS = ['dish', 'drink', 'dessert', 'sauce'];
    const categoryRevenue = (list) => {
      const acc = Object.fromEntries(CATS.map((k) => [k, 0]));
      for (const c of list) {
        const expanded = expandFormulaSales(c, formulas);
        for (const s of expanded) {
          const dish = dishesById[s.dish_id];
          if (!dish || acc[dish.category] === undefined) continue;
          const price = getDishSellingPrice(dataset, dish, c.date);
          acc[dish.category] += price * (Number(s.quantity_sold) || 0);
        }
      }
      return acc;
    };
    const curAcc = categoryRevenue(filterClosingsByPeriod(closings, period));
    const prevAcc = categoryRevenue(filterClosingsByDateRange(closings, prev.startIso, prev.endIso));
    const buckets = CATS
      .filter((k) => (curAcc[k] || 0) > 0 || (prevAcc[k] || 0) > 0)
      .map((k) => ({ key: k, label: `menu.sections.${k}`, current: curAcc[k] || 0, previous: prevAcc[k] || 0 }));
    return {
      buckets, trendPct: computeTrend(buckets),
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: 'currency', empty: buckets.length === 0,
    };
  }

  if (context === 'employees') {
    const employeesById = Object.fromEntries(employees.map((e) => [e.id, e]));
    const computeCosts = (startIso, endIso) => {
      const acc = {};
      for (const emp of employees) acc[emp.id] = { id: emp.id, name: emp.name, cost: 0 };
      for (const s of shifts) {
        if (!s || !employeesById[s.employee_id]) continue;
        if (startIso && s.date < startIso) continue;
        if (endIso && s.date > endIso) continue;
        const emp = employeesById[s.employee_id];
        const hours = Number(s.hours_worked) || 0;
        const rate = Number(emp.hourly_rate) || 0;
        acc[emp.id].cost += hours * rate;
      }
      return acc;
    };
    const curList = filterClosingsByPeriod(closings, period);
    const curStart = curList.length > 0 ? curList.map((c) => c.date).sort()[0] : toLocalISODate(new Date());
    const curEnd = curList.length > 0 ? curList.map((c) => c.date).sort().slice(-1)[0] : toLocalISODate(new Date());
    const curAcc = computeCosts(curStart, curEnd);
    const prevAcc = computeCosts(prev.startIso, prev.endIso);
    const allIds = new Set([...Object.keys(curAcc), ...Object.keys(prevAcc)]);
    const buckets = Array.from(allIds)
      .map((id) => ({ key: id, label: curAcc[id]?.name || prevAcc[id]?.name || id, current: curAcc[id]?.cost || 0, previous: prevAcc[id]?.cost || 0 }))
      .filter((b) => b.current > 0 || b.previous > 0);
    return {
      buckets, trendPct: computeTrend(buckets),
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: 'currency', empty: buckets.length === 0,
    };
  }

  if (context === 'weather') {
    const WEATHERS = ['sunny', 'cloudy', 'rainy', 'stormy', 'unknown'];
    const revenueByWeather = (list) => {
      const acc = Object.fromEntries(WEATHERS.map((k) => [k, 0]));
      for (const c of list) {
        const w = c.weather || 'unknown';
        if (acc[w] === undefined) acc[w] = 0;
        acc[w] += closingRevenue(c, dishesById, null, dataset);
      }
      return acc;
    };
    const curAcc = revenueByWeather(filterClosingsByPeriod(closings, period));
    const prevAcc = revenueByWeather(filterClosingsByDateRange(closings, prev.startIso, prev.endIso));
    const buckets = WEATHERS
      .filter((k) => (curAcc[k] || 0) > 0 || (prevAcc[k] || 0) > 0)
      .map((k) => ({ key: k, label: `stats.weather.${k}`, current: curAcc[k] || 0, previous: prevAcc[k] || 0 }));
    return {
      buckets, trendPct: computeTrend(buckets),
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: 'currency', empty: buckets.length === 0,
    };
  }

  if (context === 'metrics') {
    const comp = getComparison(dataset, period);
    if (!comp.metrics || comp.metrics.length === 0) {
      return { buckets: [], trendPct: 0, currentLabel: 'stats.groupedBar.current', previousLabel: 'stats.groupedBar.previous', format: 'currency', empty: true };
    }
    const pick = ['revenue', 'margin', 'expenses', 'items'];
    const buckets = comp.metrics
      .filter((m) => pick.includes(m.key))
      .map((m) => ({ key: m.key, label: `stats.metrics.${m.key}`, current: m.current, previous: m.previous, format: m.key === 'items' ? 'number' : 'currency' }));
    const rev = comp.metrics.find((m) => m.key === 'revenue');
    return {
      buckets, trendPct: rev ? rev.deltaPct : 0,
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: 'currency', empty: buckets.length === 0,
    };
  }

  return { buckets: [], trendPct: 0, currentLabel: '', previousLabel: '', format: 'currency', empty: true };
}

// =====================================================================
// CHANTIER 30 — Helpers HomePage
// =====================================================================
export function getLastClosings(dataset, limit = 3) {
  const { closings, dishes, formulas } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 3;
  return (closings || [])
    .filter((c) => c && typeof c.date === 'string')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, safeLimit)
    .map((c) => ({
      date: c.date, weather: c.weather || '',
      revenue: closingRevenue(c, dishesById, null, dataset),
      itemsSold: closingItemsCount(c, dishesById, null, formulas),
    }));
}

export function getTodayKPIs(dataset, dateStr) {
  const empty = { revenue: 0, margin: 0, itemsSold: 0, hasClosing: false };
  if (!dataset || !dateStr) return empty;
  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const closing = (closings || []).find((c) => c && c.date === dateStr);
  if (!closing || !Array.isArray(closing.sales)) return empty;
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  let revenue = 0, foodCost = 0, itemsSold = 0;
  const expanded = expandFormulaSales(closing, formulas);
  for (const s of expanded) {
    if (!s) continue;
    const dish = dishesById[s.dish_id];
    if (!dish) continue;
    const qty = Number(s.quantity_sold) || 0;
    if (qty <= 0) continue;
    itemsSold += qty;
    const price = getDishSellingPrice(dataset, dish, closing.date);
    revenue += qty * price;
    foodCost += qty * getDishFoodCost(dish, ingredients);
  }
  return { revenue, margin: revenue - foodCost, itemsSold, hasClosing: true };
}

export function getLowStockIngredients(dataset) {
  const { ingredients } = filterByRestaurant(dataset);
  return (ingredients || [])
    .filter((i) => i && i.track_stock !== false)
    .filter((i) => Number(i.stock_quantity) < 0 || i.stock_alert === true)
    .sort((a, b) => (Number(a.stock_quantity) || 0) - (Number(b.stock_quantity) || 0));
}

// =====================================================================
// CHANTIER 31 — NOUVEAUX HELPERS v9
// =====================================================================
export function getWeekdaySales(dataset, period = 'month') {
  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const filtered = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const acc = keys.map((key, idx) => ({ key, weekday: idx, closingsCount: 0, revenue: 0, foodCost: 0, items: 0 }));

  for (const c of filtered) {
    const d = parseLocalDate(c.date);
    if (!d) continue;
    const wd = (d.getDay() + 6) % 7;
    acc[wd].closingsCount += 1;
    acc[wd].revenue += closingRevenue(c, dishesById, null, dataset);
    acc[wd].foodCost += closingFoodCost(c, dishesById, ingredients, null, formulas);
    acc[wd].items += closingItemsCount(c, dishesById, null, formulas);
  }

  const totalRevenue = acc.reduce((s, a) => s + a.revenue, 0);
  const weekdays = acc.map((a, i) => ({
    ...a,
    margin: a.revenue - a.foodCost,
    marginPct: a.revenue > 0 ? ((a.revenue - a.foodCost) / a.revenue) * 100 : 0,
    revenuePct: totalRevenue > 0 ? (a.revenue / totalRevenue) * 100 : 0,
    avgRevenue: a.closingsCount > 0 ? a.revenue / a.closingsCount : 0,
    avgItems: a.closingsCount > 0 ? a.items / a.closingsCount : 0,
    color: WEEKDAY_COLORS[i],
  }));

  const active = weekdays.filter((w) => w.closingsCount > 0);
  const best = active.length ? active.reduce((m, w) => (w.revenue > m.revenue ? w : m), active[0]) : null;
  const worst = active.length ? active.reduce((m, w) => (w.revenue < m.revenue ? w : m), active[0]) : null;
  return { weekdays, totalRevenue, best, worst };
}

export function getStockValue(dataset) {
  const { ingredients } = filterByRestaurant(dataset);
  const tracked = ingredients.filter((i) => i && i.track_stock !== false);
  const rows = tracked.map((ing) => {
    const stock = Number(ing.stock_quantity) || 0;
    const refCost = Number.isFinite(ing.reference_unit_cost) ? ing.reference_unit_cost : (Number(ing.unit_cost) || 0);
    const yf = Number.isFinite(ing.yield_factor) && ing.yield_factor > 0 ? ing.yield_factor : 1;
    const realCost = refCost / yf;
    const value = stock > 0 ? stock * realCost : 0;
    return {
      id: ing.id, name: ing.name, base_unit: ing.base_unit || 'g',
      stock_quantity: stock, reference_unit_cost: refCost,
      real_unit_cost: realCost, value,
      alert: ing.stock_alert === true || stock < 0,
    };
  }).sort((a, b) => b.value - a.value);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  return { totalValue, trackedCount: tracked.length, ingredients: rows };
}

export function getTopConsumedIngredients(dataset, period = null, limit = 15) {
  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const ingById = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const usage = {};
  for (const c of filteredClosings) {
    const expanded = expandFormulaSales(c, formulas);
    for (const sale of expanded) {
      const dish = dishesById[sale.dish_id];
      if (!dish || !Array.isArray(dish.recipe)) continue;
      const soldQty = Number(sale.quantity_sold) || 0;
      if (soldQty <= 0) continue;
      for (const r of dish.recipe) {
        const ing = ingById[r.ingredient_id];
        if (!ing) continue;
        if (ing.track_stock === false) continue;
        if (!usage[ing.id]) usage[ing.id] = { ingredient: ing, quantityInBase: 0, cost: 0 };
        const qBase = Number.isFinite(r.quantity_in_base) ? r.quantity_in_base : (Number(r.quantity) || 0);
        const refCost = Number.isFinite(ing.reference_unit_cost) ? ing.reference_unit_cost : (Number(ing.unit_cost) || 0);
        const yf = Number.isFinite(ing.yield_factor) && ing.yield_factor > 0 ? ing.yield_factor : 1;
        usage[ing.id].quantityInBase += (soldQty * qBase) / yf;
        usage[ing.id].cost += (soldQty * qBase * refCost) / yf;
      }
    }
  }
  const totalCost = Object.values(usage).reduce((s, u) => s + u.cost, 0);
  const list = Object.values(usage)
    .map((u) => ({
      id: u.ingredient.id, name: u.ingredient.name,
      base_unit: u.ingredient.base_unit || 'g',
      quantityInBase: u.quantityInBase, cost: u.cost,
      costPct: totalCost > 0 ? (u.cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
  return { ingredients: list, totalCost };
}

export function getSupplierPriceComparison(dataset) {
  const { ingredients, suppliers, supplierOffers } = filterByRestaurant(dataset);
  const ingById = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const supById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const byIngredient = {};
  for (const offer of supplierOffers) {
    if (!offer || !offer.ingredient_id) continue;
    const ing = ingById[offer.ingredient_id];
    if (!ing) continue;
    const po = (ing.purchase_options || []).find((p) => p.id === offer.purchase_option_id);
    const qtyBase = po && Number.isFinite(po.quantity_in_base) && po.quantity_in_base > 0 ? po.quantity_in_base : 1;
    const costPerBase = (Number(offer.cost) || 0) / qtyBase;
    if (!byIngredient[ing.id]) byIngredient[ing.id] = { ingredient: ing, offers: [] };
    byIngredient[ing.id].offers.push({
      offerId: offer.id, supplierId: offer.supplier_id,
      supplierName: supById[offer.supplier_id]?.name || '—',
      purchaseOptionLabel: po?.label || '',
      quantityInBase: qtyBase, cost: Number(offer.cost) || 0, costPerBase,
      isPreferred: offer.is_preferred === true,
      isAvailable: offer.is_available !== false,
    });
  }
  const result = [];
  for (const ingId of Object.keys(byIngredient)) {
    const entry = byIngredient[ingId];
    if (entry.offers.length === 0) continue;
    const sorted = [...entry.offers].sort((a, b) => a.costPerBase - b.costPerBase);
    const best = sorted[0];
    const preferred = entry.offers.find((o) => o.isPreferred) || null;
    const offers = entry.offers.map((o) => ({
      ...o,
      isBest: o.offerId === best.offerId,
      diffPct: best.costPerBase > 0 ? ((o.costPerBase - best.costPerBase) / best.costPerBase) * 100 : 0,
    }));
    result.push({
      ingredient: entry.ingredient, offers, bestPrice: best.costPerBase,
      preferredPrice: preferred ? preferred.costPerBase : null,
      savingPct: preferred && best.costPerBase > 0 ? ((preferred.costPerBase - best.costPerBase) / preferred.costPerBase) * 100 : 0,
    });
  }
  return result.sort((a, b) => b.offers.length - a.offers.length);
}

export function getPromoImpact(dataset, period = 'month') {
  const { closings, dishes, formulas } = filterByRestaurant(dataset);
  const filtered = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const dishesImpact = {};
  for (const c of filtered) {
    const expanded = expandFormulaSales(c, formulas);
    for (const sale of expanded) {
      const dish = dishesById[sale.dish_id];
      if (!dish) continue;
      const qty = Number(sale.quantity_sold) || 0;
      if (qty <= 0) continue;
      const basePrice = Number(dish.price) || 0;
      const promoPrice = getDishSellingPrice(dataset, dish, c.date);
      const discountPerUnit = basePrice - promoPrice;
      if (discountPerUnit <= 0) continue;
      if (!dishesImpact[dish.id]) {
        dishesImpact[dish.id] = { dish, basePrice, promoPrice, discountPerUnit, qtySold: 0, discountTotal: 0, daysDiscounted: new Set() };
      }
      dishesImpact[dish.id].qtySold += qty;
      dishesImpact[dish.id].discountTotal += qty * discountPerUnit;
      dishesImpact[dish.id].daysDiscounted.add(c.date);
    }
  }
  const dishesList = Object.values(dishesImpact)
    .map((d) => ({
      dish: d.dish, basePrice: d.basePrice, promoPrice: d.promoPrice,
      discountPerUnit: d.discountPerUnit,
      discountPct: d.basePrice > 0 ? (d.discountPerUnit / d.basePrice) * 100 : 0,
      qtySold: d.qtySold, discountTotal: d.discountTotal,
      daysDiscounted: d.daysDiscounted.size,
    }))
    .sort((a, b) => b.discountTotal - a.discountTotal);
  const totalDiscount = dishesList.reduce((s, d) => s + d.discountTotal, 0);
  const totalQtySoldDiscounted = dishesList.reduce((s, d) => s + d.qtySold, 0);
  return { dishes: dishesList, totalDiscount, totalQtySoldDiscounted };
}

export function getStockAlertsByPeriod(dataset, period = null) {
  const { ingredients, closings } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dates = filteredClosings.map((c) => c.date).sort();
  const periodStart = dates[0] || null;
  const periodEnd = dates[dates.length - 1] || null;
  const alerts = ingredients
    .filter((i) => i && i.track_stock !== false)
    .filter((i) => i.stock_alert === true || Number(i.stock_quantity) < 0)
    .map((i) => ({
      id: i.id, name: i.name, base_unit: i.base_unit || 'g',
      stock_quantity: Number(i.stock_quantity) || 0,
      min_stock: Number(i.min_stock) || 0,
      alert: i.stock_alert === true,
      negative: Number(i.stock_quantity) < 0,
    }))
    .sort((a, b) => a.stock_quantity - b.stock_quantity);
  return { ingredients: alerts, count: alerts.length, periodStart, periodEnd };
}

export function getYieldImpact(dataset) {
  const { ingredients } = filterByRestaurant(dataset);
  return ingredients
    .filter((i) => i && i.track_stock !== false)
    .filter((i) => Number.isFinite(i.yield_factor) && i.yield_factor < 1)
    .map((i) => {
      const refCost = Number.isFinite(i.reference_unit_cost) ? i.reference_unit_cost : (Number(i.unit_cost) || 0);
      const yf = i.yield_factor;
      const realCost = refCost / yf;
      const delta = realCost - refCost;
      return {
        id: i.id, name: i.name, base_unit: i.base_unit || 'g',
        yield_factor: yf, yield_pct: yf * 100,
        theoretical_cost: refCost, real_cost: realCost,
        delta, deltaPct: refCost > 0 ? (delta / refCost) * 100 : 0,
      };
    })
    .sort((a, b) => b.deltaPct - a.deltaPct);
}

// =====================================================================
// CHANTIER 39 FUSION — Helpers pour drill-downs
// =====================================================================

/**
 * Détail des shifts d'un employé sur une période.
 * Renvoie : { employee, hoursPoints, costPoints, shiftRows, totalHours, totalCost }
 */
export function getEmployeeShiftsDetail(dataset, period = 'month', employeeId) {
  const { employees, shifts, closings } = filterByRestaurant(dataset);
  const emp = employees.find((e) => e.id === employeeId);
  if (!emp) {
    return { employee: null, hoursPoints: [], costPoints: [], shiftRows: [], totalHours: 0, totalCost: 0 };
  }
  const buckets = buildTimeBuckets(period, closings);
  const periodStartIso = buckets[0]?.startIso || null;
  const periodEndIso = buckets[buckets.length - 1]?.endIso || null;
  const rate = Number(emp.hourly_rate) || 0;

  const empShifts = shifts
    .filter((s) => s.employee_id === employeeId)
    .filter((s) => (!periodStartIso || s.date >= periodStartIso) && (!periodEndIso || s.date <= periodEndIso));

  const hoursPoints = buckets.map((b) => ({
    key: b.key,
    date: b.date,
    value: empShifts.filter((s) => s.date >= b.startIso && s.date <= b.endIso)
      .reduce((sum, s) => sum + (Number(s.hours_worked) || 0), 0),
  }));
  const costPoints = hoursPoints.map((p) => ({ ...p, value: p.value * rate }));

  const shiftRows = [...empShifts]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((s) => ({
      date: s.date,
      hours: Number(s.hours_worked) || 0,
      cost: (Number(s.hours_worked) || 0) * rate,
    }));

  return {
    employee: emp,
    hoursPoints,
    costPoints,
    shiftRows,
    totalHours: shiftRows.reduce((s, r) => s + r.hours, 0),
    totalCost: shiftRows.reduce((s, r) => s + r.cost, 0),
  };
}

/**
 * Détail d'une météo sur une période.
 * Renvoie : { revenuePoints, target, allWeathers, daysCount }
 */
export function getWeatherDetail(dataset, period = 'month', weatherKey) {
  const { closings, dishes } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const buckets = buildTimeBuckets(period, closings);

  const targetClosings = filteredClosings.filter((c) => (c.weather || 'unknown') === weatherKey);

  const revenuePoints = buckets.map((b) => {
    const matching = targetClosings.filter((c) => c.date >= b.startIso && c.date <= b.endIso);
    const rev = matching.reduce((s, c) => s + closingRevenue(c, dishesById, null, dataset), 0);
    return { key: b.key, date: b.date, value: rev };
  });

  const allWeather = getWeatherBreakdown(dataset, period);
  const target = allWeather.weathers.find((w) => w.key === weatherKey) || null;

  return { revenuePoints, target, allWeathers: allWeather.weathers, daysCount: targetClosings.length };
}

/**
 * Détail d'un jour de la semaine sur une période.
 * Renvoie : { dishes, evolution, target, daysCount }
 */
export function getWeekdayDetail(dataset, period = 'month', weekdayKey) {
  const weekdayIdx = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(weekdayKey);
  if (weekdayIdx === -1) {
    return { dishes: [], evolution: [], target: null, daysCount: 0 };
  }

  const { closings, dishes, ingredients, formulas } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const filteredClosings = filterClosingsByPeriod(closings, period);

  const dayClosings = filteredClosings.filter((c) => {
    const d = parseLocalDate(c.date);
    return d && ((d.getDay() + 6) % 7) === weekdayIdx;
  });

  const dishStats = {};
  for (const c of dayClosings) {
    const expanded = expandFormulaSales(c, formulas);
    for (const s of expanded) {
      const dish = dishesById[s.dish_id];
      if (!dish) continue;
      const qty = Number(s.quantity_sold) || 0;
      if (qty <= 0) continue;
      if (!dishStats[dish.id]) dishStats[dish.id] = { dish, qty: 0, revenue: 0, foodCost: 0 };
      const price = getDishSellingPrice(dataset, dish, c.date);
      dishStats[dish.id].qty += qty;
      dishStats[dish.id].revenue += qty * price;
      dishStats[dish.id].foodCost += qty * getDishFoodCost(dish, ingredients);
    }
  }

  const dishList = Object.values(dishStats)
    .map((s) => ({
      ...s,
      margin: s.revenue - s.foodCost,
      marginPct: s.revenue > 0 ? ((s.revenue - s.foodCost) / s.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const buckets = buildTimeBuckets(period, closings);
  const evolutionPoints = buckets.map((b) => {
    const matching = dayClosings.filter((c) => c.date >= b.startIso && c.date <= b.endIso);
    const rev = matching.reduce((s, c) => s + closingRevenue(c, dishesById, null, dataset), 0);
    return { key: b.key, date: b.date, value: rev };
  });

  const weekdayStats = getWeekdaySales(dataset, period);
  const target = weekdayStats.weekdays.find((w) => w.key === weekdayKey) || null;

  return { dishes: dishList, evolution: evolutionPoints, target, daysCount: dayClosings.length };
}