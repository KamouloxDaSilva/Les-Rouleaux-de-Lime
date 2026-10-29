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
      return total + (emp ? emp.hourly_rate * shift.hours_worked : 0);
    }, 0);
}