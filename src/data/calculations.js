// src/data/calculations.js
// SCHEMA_VERSION 9 - Chantier 15 (Calculations v9)
// Backward compatible v8 : signatures publiques inchangees.
//
// Changements v9 :
// - getDishFoodCost : quantity_in_base * reference_unit_cost / yield_factor
//   (fallback v8 : quantity * unit_cost)
// - track_stock === false -> cout = 0 (R4.5 SPEC_UNITES)
// - Nouveaux helpers : getIngredientRealUnitCost, convertToBase
// - getIngredientPricePerKg / getIngredientDisplayPrice gerent base_unit v9

// ---------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function getYieldFactor(ingredient) {
  if (!ingredient) return 1;
  const y = Number(ingredient.yield_factor);
  return Number.isFinite(y) && y > 0 ? y : 1;
}

// ---------------------------------------------------------------------
// Conversions d'unites (v9)
// ---------------------------------------------------------------------

/**
 * Convertit une quantite exprimee dans l'unite libre de l'ingredient
 * (ingredient.unit : 'kg', 'L', 'to', ...) vers son unite canonique
 * (ingredient.base_unit : 'g', 'ml', 'piece').
 *
 * v9 - Replique cote UI de getUnitToBaseFactor (storage.js).
 * Retourne la quantite inchangee si l'ingredient est inconnu ou si
 * l'unite n'est pas convertible.
 */
export function convertToBase(quantity, ingredient) {
  const qty = safeNumber(quantity);
  if (!ingredient) return qty;
  const unit = String(ingredient.unit || '').trim().toLowerCase();
  const baseUnit = ingredient.base_unit;

  if (baseUnit === 'g') {
    if (unit === 'kg') return qty * 1000;
    if (unit === 't') return qty * 1000000;
    return qty;
  }
  if (baseUnit === 'ml') {
    if (unit === 'l' || unit === 'lit' || unit === 'lít') return qty * 1000;
    if (unit === 'cl') return qty * 10;
    return qty;
  }
  return qty;
}

// ---------------------------------------------------------------------
// Cout reel d'un ingredient (v9 - R4.4 + R4.5)
// ---------------------------------------------------------------------

/**
 * Cout reel d'UNE base_unit de l'ingredient, rendement inclus.
 *
 * - v9 : reference_unit_cost / yield_factor
 * - v8 fallback : unit_cost / yield_factor
 * - track_stock === false -> 0 (R4.5)
 */
export function getIngredientRealUnitCost(ingredient) {
  if (!ingredient) return 0;
  if (ingredient.track_stock === false) return 0;

  const refCost = Number.isFinite(ingredient.reference_unit_cost)
    ? ingredient.reference_unit_cost
    : safeNumber(ingredient.unit_cost);

  return refCost / getYieldFactor(ingredient);
}

// ---------------------------------------------------------------------
// Cout food d'un plat (v9)
// ---------------------------------------------------------------------

/**
 * Cout food d'un plat.
 *
 * v9  : somme de (quantity_in_base * reference_unit_cost) / yield_factor
 * v8  : somme de quantity * unit_cost (fallback si quantity_in_base absent)
 * R4.5 : ingredient track_stock === false -> cout = 0
 */
export function getDishFoodCost(dish, ingredients) {
  if (!dish || !dish.recipe || !Array.isArray(dish.recipe)) return 0;
  if (!Array.isArray(ingredients)) return 0;

  return dish.recipe.reduce((total, item) => {
    if (!item) return total;
    const ingredient = ingredients.find((ing) => ing && ing.id === item.ingredient_id);
    if (!ingredient) return total;

    // R4.5 - ingredient non suivi -> cout = 0
    if (ingredient.track_stock === false) return total;

    // v9 - quantity_in_base * reference_unit_cost / yield_factor
    if (Number.isFinite(item.quantity_in_base)
        && Number.isFinite(ingredient.reference_unit_cost)) {
      const yf = getYieldFactor(ingredient);
      return total + (item.quantity_in_base * ingredient.reference_unit_cost) / yf;
    }

    // v8 fallback - quantity * unit_cost
    return total + safeNumber(item.quantity) * safeNumber(ingredient.unit_cost);
  }, 0);
}

// ---------------------------------------------------------------------
// Prix de vente (inchange v8)
// ---------------------------------------------------------------------

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

// ---------------------------------------------------------------------
// Marge (inchange v8 - profite de getDishFoodCost v9)
// ---------------------------------------------------------------------

export function getDishMargin(dish, ingredients, dataset = null, dateStr = null) {
  if (!dish) return 0;
  const foodCost = getDishFoodCost(dish, ingredients);
  const sellingPrice = dataset
    ? getDishSellingPrice(dataset, dish, dateStr)
    : (Number(dish.price) || 0);
  return sellingPrice - foodCost;
}

export function getDishMarginPercent(dish, ingredients, dataset = null, dateStr = null) {
  if (!dish) return 0;
  const sellingPrice = dataset
    ? getDishSellingPrice(dataset, dish, dateStr)
    : (Number(dish.price) || 0);
  if (sellingPrice === 0) return 0;
  const margin = getDishMargin(dish, ingredients, dataset, dateStr);
  return (margin / sellingPrice) * 100;
}

// ---------------------------------------------------------------------
// Cout main-d'oeuvre journalier (inchange v8)
// ---------------------------------------------------------------------

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

// ---------------------------------------------------------------------
// Prix ingredient - /kg ou /L (v9 + fallback v8)
// ---------------------------------------------------------------------

/**
 * Prix ramene au kg (base_unit = 'g') ou au litre (base_unit = 'ml').
 * Retourne null si l'ingredient n'est pas convertible (ex : piece).
 */
export function getIngredientPricePerKg(ingredient) {
  if (!ingredient) return null;

  // v9 branch
  if (Number.isFinite(ingredient.reference_unit_cost) && ingredient.base_unit) {
    if (ingredient.base_unit === 'g') return ingredient.reference_unit_cost * 1000;
    if (ingredient.base_unit === 'ml') return ingredient.reference_unit_cost * 1000;
    // piece -> pas de conversion /kg (on retombe sur le fallback v8)
  }

  // v8 fallback
  const unit = String(ingredient.unit || '').trim().toLowerCase();
  const cost = Number(ingredient.unit_cost);
  if (!Number.isFinite(cost)) return null;

  if (unit === 'kg') return cost;
  if (unit === 'g') return cost * 1000;
  if (unit === 't') return cost / 1000;

  if (unit === 'l' || unit === 'lit' || unit === 'lít') return cost;
  if (unit === 'ml') return cost * 1000;
  if (unit === 'cl') return cost * 100;

  return null;
}

/**
 * Prix a afficher pour un ingredient : { value, unit }.
 *
 * v9 : base_unit 'g' -> /kg, 'ml' -> /L, 'piece' -> prix unitaire.
 * v8 : ancienne logique (perKg si convertible, sinon unit_cost).
 */
export function getIngredientDisplayPrice(ingredient) {
  if (!ingredient) return null;

  // v9 branch
  if (Number.isFinite(ingredient.reference_unit_cost) && ingredient.base_unit) {
    if (ingredient.base_unit === 'g') {
      return { value: ingredient.reference_unit_cost * 1000, unit: 'kg' };
    }
    if (ingredient.base_unit === 'ml') {
      return { value: ingredient.reference_unit_cost * 1000, unit: 'L' };
    }
    if (ingredient.base_unit === 'piece') {
      const label = String(ingredient.unit || '').trim() || 'piece';
      return { value: ingredient.reference_unit_cost, unit: label };
    }
  }

  // v8 fallback
  const cost = Number(ingredient.unit_cost) || 0;
  const unit = String(ingredient.unit || '').trim();
  const perKg = getIngredientPricePerKg(ingredient);
  if (perKg != null) {
    const isVolume = ['ml', 'cl', 'l', 'lit', 'lít'].includes(unit.toLowerCase());
    return { value: perKg, unit: isVolume ? 'L' : 'kg' };
  }
  return { value: cost, unit };
}