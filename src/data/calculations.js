// src/data/calculations.js

export function getDishFoodCost(dish, ingredients) {
  if (!dish || !dish.recipe || !Array.isArray(dish.recipe)) return 0;
  return dish.recipe.reduce((total, item) => {
    const ingredient = ingredients.find((ing) => ing.id === item.ingredient_id);
    if (!ingredient) return total;
    return total + (ingredient.unit_cost * item.quantity);
  }, 0);
}

// Retourne le prix de vente réel (prend en compte les promotions actives à la date donnée)
export function getDishSellingPrice(dataset, dish, dateStr = new Date().toISOString().slice(0, 10)) {
  if (!dish) return 0;
  const basePrice = Number(dish.price) || 0;
  if (!dataset || !Array.isArray(dataset.promotions)) return basePrice;

  const activePromo = dataset.promotions.find((p) => {
    if (!p || p.dish_id !== dish.id || !p.active) return false;
    if (p.start_date && dateStr < p.start_date) return false;
    if (p.end_date && dateStr > p.end_date) return false;
    return true;
  });

  if (!activePromo) return basePrice;

  if (activePromo.type === 'percentage') {
    const discount = (basePrice * activePromo.value) / 100;
    return Math.max(0, basePrice - discount);
  }
  if (activePromo.type === 'fixed_amount') {
    return Math.max(0, basePrice - activePromo.value);
  }
  return basePrice;
}

export function getDishMargin(dish, ingredients, dataset = null, dateStr = null) {
  if (!dish) return 0;
  const foodCost = getDishFoodCost(dish, ingredients);
  const sellingPrice = dataset ? getDishSellingPrice(dataset, dish, dateStr) : (Number(dish.price) || 0);
  return sellingPrice - foodCost;
}

export function getDishMarginPercent(dish, ingredients, dataset = null, dateStr = null) {
  if (!dish) return 0;
  const sellingPrice = dataset ? getDishSellingPrice(dataset, dish, dateStr) : (Number(dish.price) || 0);
  if (sellingPrice === 0) return 0;
  const margin = getDishMargin(dish, ingredients, dataset, dateStr);
  return (margin / sellingPrice) * 100;
}

export function getDailyLaborCost(date, shifts, employees) {
  if (!Array.isArray(shifts) || !Array.isArray(employees)) return 0;
  return shifts
    .filter((s) => s.date === date)
    .reduce((total, shift) => {
      const emp = employees.find((e) => e.id === shift.employee_id);
      if (!emp) return total;
      if (emp.salary_type === 'monthly') return total;
      return total + (emp.hourly_rate * shift.hours_worked);
    }, 0);
}

// Retourne le prix au kg (unités de poids) ou au litre (unités de volume),
// ou null si l'unité n'est pas convertible.
export function getIngredientPricePerKg(ingredient) {
  if (!ingredient) return null;
  const unit = String(ingredient.unit || '').trim().toLowerCase();
  const cost = Number(ingredient.unit_cost);
  if (!Number.isFinite(cost)) return null;

  // Poids
  if (unit === 'kg') return cost;
  if (unit === 'g') return cost * 1000;
  if (unit === 't') return cost / 1000; 

  // Volume
  if (unit === 'l' || unit === 'lit' || unit === 'lít') return cost;
  if (unit === 'ml') return cost * 1000;
  if (unit === 'cl') return cost * 100;

  return null;
}

// Décrit le prix à afficher pour un ingrédient
export function getIngredientDisplayPrice(ingredient) {
  if (!ingredient) return null;
  const cost = Number(ingredient.unit_cost) || 0;
  const unit = String(ingredient.unit || '').trim();
  const perKg = getIngredientPricePerKg(ingredient);
  if (perKg != null) {
    // Si c'est un volume, on affiche /L, sinon /kg
    const isVolume = ['ml', 'cl', 'l', 'lit', 'lít'].includes(unit.toLowerCase());
    return { value: perKg, unit: isVolume ? 'L' : 'kg' };
  }
  return { value: cost, unit };
}