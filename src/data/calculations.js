// src/data/calculations.js
export function getDishFoodCost(dish, ingredients) {
  if (!dish || !dish.recipe || !Array.isArray(dish.recipe)) return 0;
  return dish.recipe.reduce((total, item) => {
    const ingredient = ingredients.find((ing) => ing.id === item.ingredient_id);
    if (!ingredient) return total;
    return total + (ingredient.unit_cost * item.quantity);
  }, 0);
}

export function getDishMargin(dish, ingredients) {
  if (!dish) return 0;
  const foodCost = getDishFoodCost(dish, ingredients);
  return dish.price - foodCost;
}

export function getDishMarginPercent(dish, ingredients) {
  if (!dish || !dish.price || dish.price === 0) return 0;
  const margin = getDishMargin(dish, ingredients);
  return (margin / dish.price) * 100;
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
// ou null si l'unité n'est pas convertible (ex: "tờ", "cái", "pièce").
export function getIngredientPricePerKg(ingredient) {
  if (!ingredient) return null;
  const unit = String(ingredient.unit || '').trim().toLowerCase();
  const cost = Number(ingredient.unit_cost);
  if (!Number.isFinite(cost)) return null;
  if (unit === 'kg') return cost;
  if (unit === 'g') return cost * 1000;
  if (unit === 'l' || unit === 'lit' || unit === 'lít') return cost;
  if (unit === 'ml') return cost * 1000;
  return null;
}

// Décrit le prix à afficher pour un ingrédient :
// - si l'unité est convertible → { value: prixKg, unit: 'kg' }
// - sinon → { value: prixUnitaire, unit: unité d'origine }
export function getIngredientDisplayPrice(ingredient) {
  if (!ingredient) return null;
  const cost = Number(ingredient.unit_cost) || 0;
  const unit = String(ingredient.unit || '').trim();
  const perKg = getIngredientPricePerKg(ingredient);
  if (perKg != null) {
    return { value: perKg, unit: 'kg' };
  }
  return { value: cost, unit };
}