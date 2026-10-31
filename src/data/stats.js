// src/data/stats.js
// =====================================================================
// Burihagio — Statistiques approfondies (Refonte v5 — Chantier 11-F4)
// Couche données pure, sans dépendance UI.
// Plan v5 :
//   - 4 périodes : day / week / month / year  (plus de "all")
//   - Nouveaux rendus : getDonutData + getGroupedBarData
//   - getBubbleData marqué @deprecated (remplacé par Donut côté UI)
//   - Correction : getPreviousPeriodRange('day'), getComparison('day')
//   - Couleurs et defaults centralisés (exportés)
// =====================================================================
import { getDishFoodCost } from './calculations.js';

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
};

export const CATEGORY_COLORS = { dish: '#3C91A6', drink: '#FF9800', dessert: '#E91E63', sauce: '#9C27B0' };
export const EXPENSE_COLORS = { fixed: '#3C91A6', ingredients: '#FF9800', employees: '#9C27B0' };
export const WEATHER_COLORS = { sunny: '#FF9800', cloudy: '#90A4AE', rainy: '#3C91A6', stormy: '#5E35B1', unknown: '#BDBDBD' };
export const CYCLE_COLORS = ['#3C91A6', '#FF9800', '#E91E63', '#9C27B0', '#43A047', '#5E35B1', '#00ACC1', '#F4511E'];

// ---------------------------------------------------------------------
// HELPERS INTERNES
// ---------------------------------------------------------------------
function filterByRestaurant(dataset, restaurantId) {
  if (!dataset) return { rid: null, closings: [], dishes: [], ingredients: [], fixedCosts: [], employees: [], shifts: [] };
  const rid = restaurantId || dataset.active_restaurant_id;
  return {
    rid,
    closings: (dataset.daily_closings || []).filter((c) => c && c.restaurant_id === rid),
    dishes: (dataset.dishes || []).filter((d) => d && d.restaurant_id === rid),
    ingredients: (dataset.ingredients || []).filter((i) => i && i.restaurant_id === rid),
    fixedCosts: (dataset.fixed_costs || []).filter((c) => c && c.restaurant_id === rid),
    employees: (dataset.employees || []).filter((e) => e && e.restaurant_id === rid),
    shifts: (dataset.shifts || []).filter((s) => s && s.restaurant_id === rid),
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

// ---------------------------------------------------------------------
// PÉRIODES
// ---------------------------------------------------------------------
// "Jour" : 1 jour. "Semaine" : 7. "Mois" : 30. "Année" : 365.
export function getEffectiveDays(closings, period) {
  if (period === 'day') return 1;
  if (period === 'week') return 7;
  if (period === 'month') return 30;
  if (period === 'year') return 365;
  return 1;
}

// Renvoie { startIso, endIso } de la période PRÉCÉDENTE (pour comparaison).
// - day   : hier → hier
// - week  : il y a 7 à 13 jours
// - month : il y a 30 à 59 jours
// - year  : 365 à 730 jours en arrière
export function getPreviousPeriodRange(period) {
  if (!period) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let days = 1;
  if (period === 'week') days = 7;
  else if (period === 'month') days = 30;
  else if (period === 'year') days = 365;
  // 'day' → days = 1

  const end = new Date(today);
  end.setDate(today.getDate() - days);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return { startIso: toLocalISODate(start), endIso: toLocalISODate(end) };
}

// Filtre les clôtures selon la période (day/week/month/year).
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

// Construit les buckets temporels d'une période.
// anchorDate permet de décaler la fenêtre (utile pour la comparaison).
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
// HELPERS CALCULS
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

function closingRevenue(closing, dishesById, category = null) {
  if (!closing || !Array.isArray(closing.sales)) return 0;
  return closing.sales.reduce((sum, s) => {
    const dish = dishesById[s && s.dish_id];
    if (!dish || (category && dish.category !== category)) return sum;
    return sum + (Number(dish.price) || 0) * (Number(s.quantity_sold) || 0);
  }, 0);
}

function closingFoodCost(closing, dishesById, ingredients, category = null) {
  if (!closing || !Array.isArray(closing.sales)) return 0;
  return closing.sales.reduce((sum, s) => {
    const dish = dishesById[s && s.dish_id];
    if (!dish || (category && dish.category !== category)) return sum;
    return sum + getDishFoodCost(dish, ingredients) * (Number(s.quantity_sold) || 0);
  }, 0);
}

function closingItemsCount(closing, dishesById, category = null) {
  if (!closing || !Array.isArray(closing.sales)) return 0;
  return closing.sales.reduce((sum, s) => {
    const dish = dishesById[s && s.dish_id];
    if (!dish || (category && dish.category !== category)) return sum;
    return sum + (Number(s.quantity_sold) || 0);
  }, 0);
}

// ---------------------------------------------------------------------
// CORE — Vue d'ensemble
// ---------------------------------------------------------------------
export function getGlobalSummary(dataset, period = null) {
  const { closings, dishes, ingredients, fixedCosts } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  let totalRevenue = 0;
  let totalFoodCost = 0;
  let totalItems = 0;
  for (const c of filteredClosings) {
    totalRevenue += closingRevenue(c, dishesById);
    totalFoodCost += closingFoodCost(c, dishesById, ingredients);
    totalItems += closingItemsCount(c, dishesById);
  }

  const days = getEffectiveDays(filteredClosings, period);
  const fixedCostsProrated = fixedCosts.reduce((sum, c) => sum + getFixedCostDailyAmount(c), 0) * days;

  let laborCost = 0;
  if (filteredClosings.length > 0) {
    const dates = filteredClosings.map((c) => c.date).sort();
    laborCost = getLaborCostInDateRange(dataset, dates[0], dates[dates.length - 1]);
  }

  const totalExpenses = fixedCostsProrated + totalFoodCost + laborCost;

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
  const { closings, dishes, ingredients, fixedCosts } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const buckets = buildTimeBuckets(period, closings);
  const filteredClosings = filterClosingsByPeriod(closings, period);

  return buckets.map((bucket) => {
    let value = 0;
    if (kpiType === 'revenue') {
      for (const c of filteredClosings)
        if (c.date >= bucket.startIso && c.date <= bucket.endIso) value += closingRevenue(c, dishesById, filter);
    } else if (kpiType === 'profit') {
      for (const c of filteredClosings) {
        if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
        if (!Array.isArray(c.sales)) continue;
        for (const s of c.sales) {
          const dish = dishesById[s.dish_id];
          if (!dish || (filter && dish.category !== filter)) continue;
          value += (Number(s.quantity_sold) || 0) * ((Number(dish.price) || 0) - getDishFoodCost(dish, ingredients));
        }
      }
    } else if (kpiType === 'items') {
      for (const c of filteredClosings) {
        if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
        if (!Array.isArray(c.sales)) continue;
        for (const s of c.sales) {
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
          if (c.date >= bucket.startIso && c.date <= bucket.endIso) value += closingFoodCost(c, dishesById, ingredients);
      }
      if (comp === 'employees' || comp === 'total') {
        value += getLaborCostInDateRange(dataset, bucket.startIso, bucket.endIso);
      }
    }
    return { key: bucket.key, date: bucket.date, value };
  });
}

// 4 courbes comparables (CA / Marge / Charges / Articles) sur la même période.
export function getMultiMetricSeries(dataset, period = 'week') {
  const { closings, dishes, ingredients, fixedCosts } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const buckets = buildTimeBuckets(period, closings);
  const filteredClosings = filterClosingsByPeriod(closings, period);

  const series = {
    revenue: [],
    margin: [],
    expenses: [],
    items: [],
  };

  for (const bucket of buckets) {
    let revenue = 0;
    let foodCost = 0;
    let items = 0;
    for (const c of filteredClosings) {
      if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
      revenue += closingRevenue(c, dishesById);
      foodCost += closingFoodCost(c, dishesById, ingredients);
      items += closingItemsCount(c, dishesById);
    }
    const fixed = fixedCosts.reduce((sum, c) => sum + getFixedCostDailyAmount(c), 0) * bucket.days;
    const labor = getLaborCostInDateRange(dataset, bucket.startIso, bucket.endIso);
    const expenses = fixed + foodCost + labor;

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

export function getDishIndividualSeries(dataset, period = 'week', dishId = null) {
  const { closings, dishes } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const buckets = buildTimeBuckets(period, closings);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  let includedDishes = dishId ? [dishesById[dishId]] : dishes;
  includedDishes = includedDishes.filter(Boolean);

  const series = includedDishes.map((dish) => {
    const points = buckets.map((bucket) => {
      let value = 0;
      for (const c of filteredClosings) {
        if (c.date < bucket.startIso || c.date > bucket.endIso || !Array.isArray(c.sales)) continue;
        for (const s of c.sales) if (s.dish_id === dish.id) value += Number(s.quantity_sold) || 0;
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
  const { closings, dishes, ingredients } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const categories = { dish: 0, drink: 0, dessert: 0, sauce: 0 };
  let total = 0;
  for (const c of filteredClosings) {
    if (!Array.isArray(c.sales)) continue;
    for (const s of c.sales) {
      const dish = dishesById[s.dish_id];
      if (!dish) continue;
      const qty = Number(s.quantity_sold) || 0;
      if (qty <= 0) continue;
      let value = 0;
      if (kpiType === 'revenue') value = qty * (Number(dish.price) || 0);
      else if (kpiType === 'profit') value = qty * ((Number(dish.price) || 0) - getDishFoodCost(dish, ingredients));
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
  const { closings, dishes, ingredients, fixedCosts } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const days = getEffectiveDays(filteredClosings, period);
  const fixed = fixedCosts.reduce((sum, c) => sum + getFixedCostDailyAmount(c), 0) * days;

  let ingredientsCost = 0;
  for (const c of filteredClosings) ingredientsCost += closingFoodCost(c, dishesById, ingredients);

  let labor = 0;
  if (filteredClosings.length > 0) {
    const dates = filteredClosings.map((c) => c.date).sort();
    labor = getLaborCostInDateRange(dataset, dates[0], dates[dates.length - 1]);
  }

  const total = fixed + ingredientsCost + labor;
  return {
    total,
    categories: [
      { key: 'fixed', value: fixed, percentage: total ? (fixed / total) * 100 : 0 },
      { key: 'ingredients', value: ingredientsCost, percentage: total ? (ingredientsCost / total) * 100 : 0 },
      { key: 'employees', value: labor, percentage: total ? (labor / total) * 100 : 0 },
    ],
  };
}

// Stats par météo (uniquement les clôtures avec météo renseignée).
export function getWeatherBreakdown(dataset, period = null) {
  const { closings, dishes, ingredients } = filterByRestaurant(dataset);
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
    w.revenue += closingRevenue(c, dishesById);
    w.foodCost += closingFoodCost(c, dishesById, ingredients);
    w.items += closingItemsCount(c, dishesById);
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

// Heures + coûts par employé sur la période.
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
    statsByEmp[emp.id] = {
      employee: emp,
      hours: 0,
      cost: 0,
      daysWorked: 0,
      shiftCount: 0,
    };
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

// Consommation réelle par ingrédient (décompose chaque vente en ingrédients).
export function getIngredientCosts(dataset, period = null) {
  const { closings, dishes, ingredients } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const ingById = Object.fromEntries(ingredients.map((i) => [i.id, i]));

  const usage = {};
  for (const c of filteredClosings) {
    if (!Array.isArray(c.sales)) continue;
    for (const sale of c.sales) {
      const dish = dishesById[sale.dish_id];
      if (!dish || !Array.isArray(dish.recipe)) continue;
      const soldQty = Number(sale.quantity_sold) || 0;
      if (soldQty <= 0) continue;
      for (const r of dish.recipe) {
        const ing = ingById[r.ingredient_id];
        if (!ing) continue;
        if (!usage[ing.id]) {
          usage[ing.id] = {
            ingredient: ing,
            quantityUsed: 0,
            cost: 0,
          };
        }
        const q = Number(r.quantity) || 0;
        usage[ing.id].quantityUsed += soldQty * q;
        usage[ing.id].cost += soldQty * q * (Number(ing.unit_cost) || 0);
      }
    }
  }

  const totalCost = Object.values(usage).reduce((s, u) => s + u.cost, 0);
  const list = Object.values(usage)
    .map((u) => ({
      id: u.ingredient.id,
      name: u.ingredient.name,
      unit: u.ingredient.unit,
      unitCost: Number(u.ingredient.unit_cost) || 0,
      supplier: u.ingredient.supplier || '',
      category: u.ingredient.category,
      quantityUsed: u.quantityUsed,
      cost: u.cost,
      costPct: totalCost > 0 ? (u.cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  return { ingredients: list, totalCost };
}

// Charges fixes détaillées + projections.
export function getFixedCostsBreakdown(dataset, period = null) {
  const { fixedCosts, closings } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const days = getEffectiveDays(filteredClosings, period);

  const list = fixedCosts.map((c) => {
    const daily = getFixedCostDailyAmount(c);
    const yearly = getFixedCostYearlyAmount(c);
    return {
      id: c.id,
      name: c.name,
      amount: Number(c.amount) || 0,
      frequency: c.frequency,
      dailyAmount: daily,
      periodAmount: daily * days,
      yearlyAmount: yearly,
      monthlyAmount: yearly / 12,
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
    totalPeriod,
    totalMonthly,
    totalYearly,
    days,
  };
}

// ---------------------------------------------------------------------
// RANKINGS
// ---------------------------------------------------------------------
export function getFullRanking(dataset, period = null, category = null) {
  const { closings, dishes, ingredients } = filterByRestaurant(dataset);
  const filteredClosings = filterClosingsByPeriod(closings, period);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const stats = {};
  for (const c of filteredClosings) {
    if (!Array.isArray(c.sales)) continue;
    for (const s of c.sales) {
      const dish = dishesById[s.dish_id];
      if (!dish || (category && dish.category !== category)) continue;
      const qty = Number(s.quantity_sold) || 0;
      if (qty <= 0) continue;
      if (!stats[dish.id]) stats[dish.id] = { dish, qty: 0, revenue: 0, foodCost: 0 };
      stats[dish.id].qty += qty;
      stats[dish.id].revenue += qty * (Number(dish.price) || 0);
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

// Fiche complète d'un plat : ranking + série temporelle.
export function getDishDetails(dataset, period = null, dishId = null) {
  if (!dishId) return null;
  const ranking = getFullRanking(dataset, period);
  const item = ranking.find((r) => r.dish.id === dishId);
  if (!item) return null;
  const series = getDishIndividualSeries(dataset, period || 'week', dishId);
  return { ...item, series: series.series[0] || null };
}

// ---------------------------------------------------------------------
// BUBBLE DATA (générique) — 4 contextes
// @deprecated depuis v5 : remplacé côté UI par getDonutData + getGroupedBarData.
// Conservé pour compatibilité tant que StatsPage.jsx n'est pas mis à jour.
// À supprimer dans une prochaine session.
// ---------------------------------------------------------------------
export function getBubbleData(dataset, period = null, context = 'dishes') {
  if (context === 'overview') {
    const { closings, dishes, ingredients } = filterByRestaurant(dataset);
    const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
    const buckets = buildTimeBuckets(period, closings);
    const filteredClosings = filterClosingsByPeriod(closings, period);
    const points = [];
    let maxRevenue = 0;

    for (const bucket of buckets) {
      let revenue = 0;
      let foodCost = 0;
      let items = 0;
      for (const c of filteredClosings) {
        if (c.date < bucket.startIso || c.date > bucket.endIso) continue;
        revenue += closingRevenue(c, dishesById);
        foodCost += closingFoodCost(c, dishesById, ingredients);
        items += closingItemsCount(c, dishesById);
      }
      const marginPct = revenue > 0 ? ((revenue - foodCost) / revenue) * 100 : 0;
      if (revenue > maxRevenue) maxRevenue = revenue;
      points.push({
        id: bucket.key,
        label: bucket.key,
        x: revenue,
        y: marginPct,
        size: items,
        sizePct: 0,
        meta: { foodCost, margin: revenue - foodCost, items, date: bucket.date },
      });
    }

    return {
      xLabel: 'stats.bubble.x.overview.revenue',
      yLabel: 'stats.bubble.y.overview.marginPct',
      sizeLabel: 'stats.bubble.size.overview.items',
      bubbles: points.map((p) => ({
        ...p,
        sizePct: maxRevenue > 0 ? (p.x / maxRevenue) * 100 : 0,
      })),
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
        id: r.dish.id,
        label: r.dish.name,
        category: r.dish.category,
        x: r.qty,
        y: r.marginPct,
        size: r.revenue,
        sizePct: (r.revenue / maxRevenue) * 100,
        meta: {
          price: r.dish.price,
          foodCost: r.foodCost / Math.max(1, r.qty),
          margin: r.margin,
          marginPct: r.marginPct,
        },
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
        id: r.employee.id,
        label: r.employee.name,
        x: r.hours,
        y: r.hourlyRate,
        size: r.cost,
        sizePct: (r.cost / maxCost) * 100,
        meta: {
          daysWorked: r.daysWorked,
          avgHoursPerShift: r.avgHoursPerShift,
          costPct: r.costPct,
        },
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
        id: w.key,
        label: `stats.weather.${w.key}`,
        x: w.days,
        y: w.avgRevenuePerDay,
        size: w.revenue,
        sizePct: (w.revenue / maxRevenue) * 100,
        meta: {
          revenuePct: w.revenuePct,
          marginPct: w.marginPct,
          avgItemsPerDay: w.avgItemsPerDay,
        },
      })),
    };
  }

  return { xLabel: '', yLabel: '', sizeLabel: '', bubbles: [] };
}

// ---------------------------------------------------------------------
// BAR METRICS (avec sous-métriques) — inchangé v5
// ---------------------------------------------------------------------
export function getBarMetrics(dataset, period = null, mode = 'category') {
  if (mode === 'category') {
    const { closings, dishes, ingredients } = filterByRestaurant(dataset);
    const filteredClosings = filterClosingsByPeriod(closings, period);
    const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
    const acc = {};
    const CATS = ['dish', 'drink', 'dessert', 'sauce'];
    for (const cat of CATS) {
      acc[cat] = { key: cat, label: `menu.sections.${cat}`, revenue: 0, items: 0, foodCost: 0, margin: 0 };
    }
    for (const c of filteredClosings) {
      if (!Array.isArray(c.sales)) continue;
      for (const s of c.sales) {
        const dish = dishesById[s.dish_id];
        if (!dish || !acc[dish.category]) continue;
        const qty = Number(s.quantity_sold) || 0;
        if (qty <= 0) continue;
        const price = Number(dish.price) || 0;
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
        key: a.key,
        label: a.label,
        value: a.revenue,
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
        key: c.key,
        label: `stats.expensesComponents.${c.key}`,
        value: c.value,
        color: c.key === 'fixed' ? '#3C91A6' : c.key === 'ingredients' ? '#FF9800' : '#9C27B0',
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
        key: row.key,
        label: `stats.weather.${row.key}`,
        value: row.revenue,
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
        key: row.employee.id,
        label: row.employee.name,
        value: row.cost,
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
        key: row.id,
        label: row.name,
        value: row.cost,
        color: '#FF9800',
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
        key: row.id,
        label: row.name,
        value: row.periodAmount,
        color: '#3C91A6',
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
// COMPARAISON vs période précédente
// ---------------------------------------------------------------------
export function getComparison(dataset, period = 'week') {
  const prev = getPreviousPeriodRange(period);
  if (!prev) return { period, previousPeriod: null, metrics: [] };

  const { closings, dishes, ingredients, fixedCosts } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  function computePeriod(startIso, endIso) {
    const list = filterClosingsByDateRange(closings, startIso, endIso);
    let revenue = 0;
    let foodCost = 0;
    let items = 0;
    for (const c of list) {
      revenue += closingRevenue(c, dishesById);
      foodCost += closingFoodCost(c, dishesById, ingredients);
      items += closingItemsCount(c, dishesById);
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
    const expenses = fixedProrated + foodCost + labor;
    const margin = revenue - foodCost;
    const netProfit = revenue - expenses;

    return {
      revenue,
      items,
      foodCost,
      expenses,
      margin,
      netProfit,
      fixedCosts: fixedProrated,
      laborCost: labor,
      avgRevenuePerDay: revenue / days,
      avgItemsPerDay: items / days,
      avgExpensesPerDay: expenses / days,
      closingsCount: list.length,
      daysCount: days,
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
// 🆕 DONUT DATA (v5) — Remplace la bulle pour les répartitions.
// Contexte : 'category' | 'expenses' | 'costs' | 'weather' | 'staff'
//            | 'employees' | 'ingredients' | 'overview' | 'sales'
// Retourne :
//   {
//     segments: [{ key, label, value, pct, color }],
//     total,
//     topSegment,   // le plus gros segment (ou null)
//     format: 'currency' | 'number',
//     empty: boolean,
//   }
// =====================================================================
function buildDonut({ items, total, format, emptyLabel }) {
  const segments = items.filter((it) => it.value > 0).sort((a, b) => b.value - a.value);
  if (segments.length === 0) {
    return {
      segments: [],
      total: 0,
      topSegment: null,
      format,
      emptyLabel,
      empty: true,
    };
  }
  return {
    segments,
    total,
    topSegment: segments[0],
    format,
    emptyLabel,
    empty: false,
  };
}

export function getDonutData(dataset, period = 'month', context = 'category') {
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
        key: w.key,
        label: `stats.weather.${w.key}`,
        value: w.revenue,
        pct: w.revenuePct,
        color: WEATHER_COLORS[w.key] || '#BDBDBD',
      })),
      total: breakdown.totalRevenue,
      format: 'currency',
      emptyLabel: 'stats.metrics.revenue',
    });
  }

  if (context === 'staff' || context === 'employees') {
    const stats = getEmployeeStats(dataset, period);
    const items = stats.employees.map((e, i) => ({
      key: e.employee.id,
      label: e.employee.name,
      value: e.cost,
      pct: e.costPct,
      color: CYCLE_COLORS[i % CYCLE_COLORS.length],
    }));
    return buildDonut({
      items,
      total: stats.totalCost,
      format: 'currency',
      emptyLabel: 'stats.metrics.cost',
    });
  }

  if (context === 'ingredients') {
    const stats = getIngredientCosts(dataset, period);
    const items = stats.ingredients.slice(0, 10).map((ing, i) => ({
      key: ing.id,
      label: ing.name,
      value: ing.cost,
      pct: ing.costPct,
      color: CYCLE_COLORS[i % CYCLE_COLORS.length],
    }));
    return buildDonut({
      items,
      total: stats.totalCost,
      format: 'currency',
      emptyLabel: 'stats.metrics.foodCost',
    });
  }

  // Comparaison : pas de donut pertinent → vide, l'UI fallback sur Barre.
  return {
    segments: [],
    total: 0,
    topSegment: null,
    format: 'currency',
    emptyLabel: '',
    empty: true,
  };
}

// =====================================================================
// 🆕 GROUPED BAR DATA (v5) — 2 barres/bucket : Actuel vs Précédent.
// Contexte : 'revenue' | 'margin' | 'expenses' | 'items'  (time-series)
//            | 'category' | 'employees' | 'weather'      (entités)
//            | 'metrics'                                 (comparaison tab)
// Retourne :
//   {
//     buckets: [{ key, label, current, previous, format? }],
//     trendPct,
//     currentLabel, previousLabel,  // clés i18n
//     format,                       // format par défaut
//     empty,
//   }
// =====================================================================
export function getGroupedBarData(dataset, period = 'week', context = 'revenue') {
  const { closings, dishes, ingredients, fixedCosts, employees, shifts } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const prev = getPreviousPeriodRange(period);
  if (!prev) {
    return { buckets: [], trendPct: 0, currentLabel: '', previousLabel: '', format: 'currency', empty: true };
  }

  const computeTrend = (buckets) => {
    const sumCur = buckets.reduce((s, b) => s + b.current, 0);
    const sumPrev = buckets.reduce((s, b) => s + b.previous, 0);
    return sumPrev > 0 ? ((sumCur - sumPrev) / sumPrev) * 100 : (sumCur > 0 ? 100 : 0);
  };

  // ---------- Time-series (revenue / margin / expenses / items) ----------
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
      if (context === 'revenue') {
        return inRange.reduce((s, c) => s + closingRevenue(c, dishesById), 0);
      }
      if (context === 'margin') {
        return inRange.reduce(
          (s, c) => s + closingRevenue(c, dishesById) - closingFoodCost(c, dishesById, ingredients),
          0
        );
      }
      if (context === 'expenses') {
        const foodCost = inRange.reduce((s, c) => s + closingFoodCost(c, dishesById, ingredients), 0);
        const fixed = fixedCosts.reduce((s, c) => s + getFixedCostDailyAmount(c), 0) * bucket.days;
        const labor = getLaborCostInDateRange(dataset, bucket.startIso, bucket.endIso);
        return fixed + foodCost + labor;
      }
      if (context === 'items') {
        return inRange.reduce((s, c) => s + closingItemsCount(c, dishesById), 0);
      }
      return 0;
    };

    const buckets = currentBuckets.map((b, i) => {
      const cur = computeValue(b);
      const prvB = previousBuckets[i];
      const prv = prvB ? computeValue(prvB) : 0;
      return { key: b.key, label: b.key, current: cur, previous: prv };
    });

    return {
      buckets,
      trendPct: computeTrend(buckets),
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: context === 'items' ? 'number' : 'currency',
      empty: buckets.length === 0,
    };
  }

  // ---------- Catégorie (entités) ----------
  if (context === 'category') {
    const CATS = ['dish', 'drink', 'dessert', 'sauce'];
    const categoryRevenue = (list) => {
      const acc = Object.fromEntries(CATS.map((k) => [k, 0]));
      for (const c of list) {
        if (!Array.isArray(c.sales)) continue;
        for (const s of c.sales) {
          const dish = dishesById[s.dish_id];
          if (!dish || acc[dish.category] === undefined) continue;
          acc[dish.category] += (Number(dish.price) || 0) * (Number(s.quantity_sold) || 0);
        }
      }
      return acc;
    };

    const curAcc = categoryRevenue(filterClosingsByPeriod(closings, period));
    const prevAcc = categoryRevenue(filterClosingsByDateRange(closings, prev.startIso, prev.endIso));
    const buckets = CATS
      .filter((k) => (curAcc[k] || 0) > 0 || (prevAcc[k] || 0) > 0)
      .map((k) => ({
        key: k,
        label: `menu.sections.${k}`,
        current: curAcc[k] || 0,
        previous: prevAcc[k] || 0,
      }));

    return {
      buckets,
      trendPct: computeTrend(buckets),
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: 'currency',
      empty: buckets.length === 0,
    };
  }

  // ---------- Employés (entités) ----------
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
      .map((id) => ({
        key: id,
        label: curAcc[id]?.name || prevAcc[id]?.name || id,
        current: curAcc[id]?.cost || 0,
        previous: prevAcc[id]?.cost || 0,
      }))
      .filter((b) => b.current > 0 || b.previous > 0);

    return {
      buckets,
      trendPct: computeTrend(buckets),
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: 'currency',
      empty: buckets.length === 0,
    };
  }

  // ---------- Météo (entités) ----------
  if (context === 'weather') {
    const WEATHERS = ['sunny', 'cloudy', 'rainy', 'stormy', 'unknown'];
    const revenueByWeather = (list) => {
      const acc = Object.fromEntries(WEATHERS.map((k) => [k, 0]));
      for (const c of list) {
        const w = c.weather || 'unknown';
        if (acc[w] === undefined) acc[w] = 0;
        acc[w] += closingRevenue(c, dishesById);
      }
      return acc;
    };

    const curAcc = revenueByWeather(filterClosingsByPeriod(closings, period));
    const prevAcc = revenueByWeather(filterClosingsByDateRange(closings, prev.startIso, prev.endIso));
    const buckets = WEATHERS
      .filter((k) => (curAcc[k] || 0) > 0 || (prevAcc[k] || 0) > 0)
      .map((k) => ({
        key: k,
        label: `stats.weather.${k}`,
        current: curAcc[k] || 0,
        previous: prevAcc[k] || 0,
      }));

    return {
      buckets,
      trendPct: computeTrend(buckets),
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: 'currency',
      empty: buckets.length === 0,
    };
  }

  // ---------- Métriques agrégées (onglet Comparaison) ----------
  if (context === 'metrics') {
    const comp = getComparison(dataset, period);
    if (!comp.metrics || comp.metrics.length === 0) {
      return {
        buckets: [],
        trendPct: 0,
        currentLabel: 'stats.groupedBar.current',
        previousLabel: 'stats.groupedBar.previous',
        format: 'currency',
        empty: true,
      };
    }
    const pick = ['revenue', 'margin', 'expenses', 'items'];
    const buckets = comp.metrics
      .filter((m) => pick.includes(m.key))
      .map((m) => ({
        key: m.key,
        label: `stats.metrics.${m.key}`,
        current: m.current,
        previous: m.previous,
        format: m.key === 'items' ? 'number' : 'currency',
      }));
    const rev = comp.metrics.find((m) => m.key === 'revenue');
    return {
      buckets,
      trendPct: rev ? rev.deltaPct : 0,
      currentLabel: 'stats.groupedBar.current',
      previousLabel: 'stats.groupedBar.previous',
      format: 'currency',
      empty: buckets.length === 0,
    };
  }

  return {
    buckets: [],
    trendPct: 0,
    currentLabel: '',
    previousLabel: '',
    format: 'currency',
    empty: true,
  };
}