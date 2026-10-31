// src/data/stats.js
// Couche de calculs pure pour l'onglet Statistiques.
// Aucune dépendance UI. Aucun texte en dur.
import { getDishFoodCost } from './calculations.js';

function filterByRestaurant(dataset, restaurantId) {
  if (!dataset) {
    return { rid: null, closings: [], dishes: [], ingredients: [], fixedCosts: [] };
  }
  const rid = restaurantId || dataset.active_restaurant_id;
  return {
    rid,
    closings: (dataset.daily_closings || []).filter((c) => c && c.restaurant_id === rid),
    dishes: (dataset.dishes || []).filter((d) => d && d.restaurant_id === rid),
    ingredients: (dataset.ingredients || []).filter((i) => i && i.restaurant_id === rid),
    fixedCosts: (dataset.fixed_costs || []).filter((c) => c && c.restaurant_id === rid),
  };
}

function closingRevenue(closing, dishesById) {
  if (!closing || !Array.isArray(closing.sales)) return 0;
  return closing.sales.reduce((sum, s) => {
    const dish = dishesById[s && s.dish_id];
    if (!dish) return sum;
    return sum + (Number(dish.price) || 0) * (Number(s.quantity_sold) || 0);
  }, 0);
}

function closingFoodCost(closing, dishesById, ingredients) {
  if (!closing || !Array.isArray(closing.sales)) return 0;
  return closing.sales.reduce((sum, s) => {
    const dish = dishesById[s && s.dish_id];
    if (!dish) return sum;
    const unitCost = getDishFoodCost(dish, ingredients);
    return sum + unitCost * (Number(s.quantity_sold) || 0);
  }, 0);
}

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Série d'évolution du CA.
// period : 'week' (7 derniers jours) | 'month' (30 derniers jours) | 'year' (12 derniers mois)
export function getRevenueSeries(dataset, period = 'week') {
  const { closings, dishes } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = [];

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.push({ key: toLocalISODate(d), date: d });
    }
  } else if (period === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.push({ key: toLocalISODate(d), date: d });
    }
  } else if (period === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key, date: d });
    }
  } else {
    return [];
  }

  const revenueByKey = {};
  for (const c of closings) {
    if (!c || typeof c.date !== 'string') continue;
    const key = period === 'year' ? c.date.slice(0, 7) : c.date;
    if (!revenueByKey[key]) revenueByKey[key] = 0;
    revenueByKey[key] += closingRevenue(c, dishesById);
  }

  return buckets.map((b) => ({
    key: b.key,
    date: b.date,
    revenue: revenueByKey[b.key] || 0,
  }));
}

// Classement Top / Flop par quantité vendue.
export function getDishesRanking(dataset, limit = 5) {
  const { closings, dishes, ingredients } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  const stats = {};

  for (const c of closings) {
    if (!c || !Array.isArray(c.sales)) continue;
    for (const s of c.sales) {
      const dish = dishesById[s && s.dish_id];
      if (!dish) continue;
      const qty = Number(s.quantity_sold) || 0;
      if (qty <= 0) continue;
      if (!stats[dish.id]) {
        stats[dish.id] = { dish, qty: 0, revenue: 0, foodCost: 0 };
      }
      stats[dish.id].qty += qty;
      stats[dish.id].revenue += qty * (Number(dish.price) || 0);
      stats[dish.id].foodCost += qty * getDishFoodCost(dish, ingredients);
    }
  }

  const arr = Object.values(stats).map((s) => ({
    ...s,
    margin: s.revenue - s.foodCost,
    marginPct: s.revenue > 0 ? ((s.revenue - s.foodCost) / s.revenue) * 100 : 0,
  }));

  const sorted = [...arr].sort((a, b) => b.qty - a.qty);
  const top = sorted.slice(0, limit);
  const topIds = new Set(top.map((x) => x.dish.id));
  const flopCandidates = sorted.filter((x) => !topIds.has(x.dish.id));
  const flop = flopCandidates.slice(-limit).reverse();

  return { top, flop };
}

// Sommaire global (CA, food cost, marge, ticket moyen, charges fixes mensuelles).
export function getGlobalSummary(dataset) {
  const { closings, dishes, ingredients, fixedCosts } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  let totalRevenue = 0;
  let totalFoodCost = 0;
  let totalItems = 0;
  let dayCount = 0;

  for (const c of closings) {
    totalRevenue += closingRevenue(c, dishesById);
    totalFoodCost += closingFoodCost(c, dishesById, ingredients);
    if (Array.isArray(c.sales)) {
      for (const s of c.sales) totalItems += Number(s.quantity_sold) || 0;
    }
    dayCount += 1;
  }

  const margin = totalRevenue - totalFoodCost;
  const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
  const foodCostPct = totalRevenue > 0 ? (totalFoodCost / totalRevenue) * 100 : 0;
  const avgDailyRevenue = dayCount > 0 ? totalRevenue / dayCount : 0;
  const avgTicket = totalItems > 0 ? totalRevenue / totalItems : 0;

  const monthlyFixedCosts = fixedCosts.reduce((sum, c) => {
    const amt = Number(c.amount) || 0;
    if (c.frequency === 'monthly') return sum + amt;
    if (c.frequency === 'weekly') return sum + amt * 4;
    if (c.frequency === 'daily') return sum + amt * 30;
    return sum;
  }, 0);

  return {
    totalRevenue,
    totalFoodCost,
    margin,
    marginPct,
    foodCostPct,
    avgDailyRevenue,
    avgTicket,
    dayCount,
    totalItems,
    monthlyFixedCosts,
  };
}

/**
 * Drill-down par catégorie pour un KPI donné.
 * @param {object} dataset - Le dataset complet
 * @param {string} kpiType - 'revenue' | 'profit' | 'items'
 * @returns {{ total: number, categories: Array<{ key: string, value: number, percentage: number }> }}
 */
export function getCategoryBreakdown(dataset, kpiType = 'revenue') {
  const { closings, dishes, ingredients } = filterByRestaurant(dataset);
  const dishesById = Object.fromEntries(dishes.map((d) => [d.id, d]));

  const categories = { dish: 0, drink: 0, dessert: 0, sauce: 0 };
  let total = 0;

  for (const c of closings) {
    if (!c || !Array.isArray(c.sales)) continue;
    for (const s of c.sales) {
      const dish = dishesById[s && s.dish_id];
      if (!dish) continue;
      const qty = Number(s.quantity_sold) || 0;
      if (qty <= 0) continue;

      let value = 0;
      if (kpiType === 'revenue') {
        value = qty * (Number(dish.price) || 0);
      } else if (kpiType === 'profit') {
        const unitCost = getDishFoodCost(dish, ingredients);
        value = qty * ((Number(dish.price) || 0) - unitCost);
      } else if (kpiType === 'items') {
        value = qty;
      }

      if (categories[dish.category] !== undefined) {
        categories[dish.category] += value;
        total += value;
      }
    }
  }

  const catList = Object.entries(categories).map(([key, value]) => ({
    key,
    value,
    percentage: total > 0 ? (value / total) * 100 : 0,
  }));

  return { total, categories: catList };
}