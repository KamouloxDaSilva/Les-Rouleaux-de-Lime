// src/pages/MenuPage.jsx
// Chantier 20 — Menu v3 : formulaire + recettes
// (préserve Chantier 19 : PillSelector/SearchBar/Badge/EmptyState/BottomSheet/Toast + formules)
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import {
  getActiveRestaurant,
  createDish,
  createIngredient,
  createFormula,
  MENU_CATEGORIES,
  INGREDIENT_CATEGORIES,
  BASE_UNITS,
  STORAGE_TYPES,
  FORMULA_PRICING_MODES,
} from '../data/model.js';
import { loadDataset, saveDataset } from '../data/storage.js';
import { createDefaultFixtures } from '../data/fixtures.js';
import {
  getDishFoodCost,
  getDishSellingPrice,
  getIngredientPricePerKg,
  getIngredientDisplayPrice,
} from '../data/calculations.js';
import PillSelector from '../components/PillSelector';
import SearchBar from '../components/SearchBar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import BottomSheet from '../components/BottomSheet';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import './MenuPage.css';

const CATEGORY_EMOJI = {
  dish: '🥗',
  drink: '🥤',
  dessert: '🍰',
  sauce: '🥫',
};

const INGREDIENT_CATEGORY_EMOJI = {
  meat: '🥩',
  fish: '🐟',
  vegetable: '🥬',
  fruit: '🍎',
  staple: '🍚',
  dairy: '🧀',
  spice: '🌿',
  sauce: '🥫',
  oil: '🫒',
  beverage: '🥤',
  packaging: '📦',
  cleaning: '🧴',
};

const FORMULA_SLOTS = ['main', 'drink', 'sauce', 'dessert', 'side'];

const EMPTY_DISH = {
  id: null,
  name: '',
  category: 'dish',
  subcategory: '',
  price: '',
  active: true,
  recipe: [],
};

const EMPTY_RECIPE_ITEM = { ingredient_id: '', recipe_unit_id: '', quantity: '' };

const EMPTY_INGREDIENT_FORM = {
  id: null,
  name: '',
  category: 'vegetable',
  base_unit: 'g',
  reference_unit_cost: '',
  yield_factor: 1,
  track_stock: true,
  storage_type: 'ambient',
  shelf_life_days: '',
  stock_quantity: 0,
  min_stock: 0,
  purchase_options: [],
  recipe_units: [],
  preferred_supplier_id: '',
};

const EMPTY_FORMULA_FORM = {
  id: null,
  name: '',
  description: '',
  emoji: '✨',
  color: '#FF9800',
  composition: [],
  pricing_mode: 'fixed',
  fixed_price: '',
  discount_pct: 0,
  active: true,
};

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Wrapper défensif (préservé du Chantier 12 Partie 2). */
function getIngredientDisplayInfo(ing) {
  let price = null;
  let unit = ing.unit;

  try {
    const display = getIngredientDisplayPrice(ing);
    if (display && typeof display === 'object') {
      price = display.price ?? display.value ?? null;
      if (display.unit) unit = display.unit;
    } else if (typeof display === 'number') {
      price = display;
    }
  } catch {
    /* noop */
  }

  if (price == null) {
    try {
      price = getIngredientPricePerKg(ing);
    } catch {
      price = Number(ing.unit_cost) || 0;
    }
  }

  const rawUnit = ing.unit;
  if (rawUnit === 'ml' || rawUnit === 'l') unit = 'L';
  else if (rawUnit === 'g' || rawUnit === 'kg') unit = 'kg';

  return { price: Number(price) || 0, unit };
}

/** Calcule les totaux d'une formule selon son pricing_mode. */
function computeFormulaTotals(formula, dishesById, ingredients, promotions, todayIso) {
  const composition = Array.isArray(formula?.composition) ? formula.composition : [];
  let basePrice = 0;
  let totalCost = 0;
  const lines = [];

  for (const item of composition) {
    const dish = dishesById.get(item.dish_id);
    const qty = Number(item.quantity) || 0;
    if (!dish || qty <= 0) {
      lines.push({ item, dish: null, qty, sellingPrice: 0, foodCost: 0 });
      continue;
    }
    // Correction signature : getDishSellingPrice(dataset, dish, dateStr)
    const sp = getDishSellingPrice({ promotions }, dish, todayIso);
    const sellingPrice =
      Number.isFinite(sp) && sp > 0 && sp < Number(dish.price)
        ? sp
        : Number(dish.price) || 0;
    const foodCost = getDishFoodCost(dish, ingredients);
    basePrice += sellingPrice * qty;
    totalCost += foodCost * qty;
    lines.push({ item, dish, qty, sellingPrice, foodCost });
  }

  let finalPrice = basePrice;
  if (formula?.pricing_mode === 'fixed') {
    finalPrice = Number(formula.fixed_price) || basePrice;
  } else if (formula?.pricing_mode === 'discounted') {
    const pct = Number(formula.discount_pct) || 0;
    finalPrice = basePrice * (1 - pct / 100);
  }

  return { lines, basePrice, finalPrice, totalCost, totalMargin: finalPrice - totalCost };
}

/** Convertit un item de recette (form) en quantité de base (g / ml / piece). */
function recipeItemToBaseQty(item, ingredients) {
  const ing = ingredients.find((i) => i.id === item.ingredient_id);
  if (!ing) return 0;
  const ru = ing.recipe_units?.find((u) => u.id === item.recipe_unit_id);
  const factor = ru?.quantity_in_base ?? 1;
  return (Number(item.quantity) || 0) * factor;
}

/** Food cost d'un plat en cours d'édition (form) — SPEC_UNITES R4.4/R4.5. */
function computeFormFoodCost(recipe, ingredients) {
  let total = 0;
  for (const item of recipe || []) {
    const ing = ingredients.find((i) => i.id === item.ingredient_id);
    if (!ing) continue;
    if (ing.track_stock === false) continue;
    const qib = recipeItemToBaseQty(item, ingredients);
    const refCost = Number(ing.reference_unit_cost) || 0;
    const yf = Number(ing.yield_factor) > 0 ? Number(ing.yield_factor) : 1;
    total += (qib * refCost) / yf;
  }
  return total;
}

/** Charge une recette existante en items de form (retrouve recipe_unit par défaut). */
function loadRecipeIntoForm(recipe, ingredients) {
  if (!Array.isArray(recipe)) return [];
  return recipe.map((r) => {
    const ing = ingredients.find((i) => i.id === r.ingredient_id);
    const defaultRU =
      ing?.recipe_units?.find((u) => u.is_default) || ing?.recipe_units?.[0];
    const factor = defaultRU?.quantity_in_base ?? 1;
    let qty = 0;
    if (Number.isFinite(r.quantity_in_base)) {
      qty = r.quantity_in_base / factor;
    } else if (Number.isFinite(r.quantity)) {
      qty = r.quantity / factor;
    }
    return {
      ingredient_id: r.ingredient_id,
      recipe_unit_id: defaultRU?.id || '',
      quantity: qty || '',
    };
  });
}

export default function MenuPage() {
  const { t, formatCurrency } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [activeCategory, setActiveCategory] = useState('dish');
  const [searchQuery, setSearchQuery] = useState('');

  // Dish form (full page, hérité Chantier 19)
  const [isEditingDish, setIsEditingDish] = useState(false);
  const [dishForm, setDishForm] = useState(EMPTY_DISH);

  // Ingredient / formula sheets
  const [sheetType, setSheetType] = useState(null); // 'ingredient' | 'formula' | null
  const [ingredientForm, setIngredientForm] = useState(EMPTY_INGREDIENT_FORM);
  const [formulaForm, setFormulaForm] = useState(EMPTY_FORMULA_FORM);

  // Confirm modal
  const [confirmState, setConfirmState] = useState(null);

  const [toast, setToast] = useState({ open: false, message: '', variant: 'info' });

  useEffect(() => {
    const loaded = loadDataset();
    const isEmpty = loaded.dishes.length === 0;
    const initial = isEmpty ? createDefaultFixtures() : loaded;
    if (isEmpty) {
      try {
        saveDataset(initial);
      } catch (e) {
        console.warn(e);
      }
    }
    setDataset(initial);
  }, []);

  const restaurant = useMemo(() => (dataset ? getActiveRestaurant(dataset) : null), [dataset]);
  const ingredients = dataset?.ingredients || [];
  const dishes = dataset?.dishes || [];
  const promotions = dataset?.promotions || [];
  const formulas = dataset?.formulas || [];
  const suppliers = dataset?.suppliers || [];

  const today = getTodayString();
  const dishesById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);

  function commit(next) {
    try {
      saveDataset(next);
      setDataset(next);
      setToast({ open: true, message: t('common.success'), variant: 'success' });
    } catch {
      setToast({ open: true, message: t('common.error'), variant: 'error' });
    }
  }

  function requestConfirm(title, message, onConfirm) {
    setConfirmState({ title, message, onConfirm });
  }

  const categoryOptions = useMemo(
    () =>
      MENU_CATEGORIES.map((cat) => ({
        value: cat,
        label: `${CATEGORY_EMOJI[cat]} ${t(`menu.sections.${cat}`)}`,
      })),
    [t]
  );

  const filteredDishes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dishes.filter((d) => {
      if ((d.category || 'dish') !== activeCategory) return false;
      if (q && !String(d.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dishes, activeCategory, searchQuery]);

  const activeFormulas = useMemo(
    () => formulas.filter((f) => f && f.active !== false),
    [formulas]
  );

  const currentFormFoodCost = useMemo(
    () => computeFormFoodCost(dishForm.recipe, ingredients),
    [dishForm.recipe, ingredients]
  );

  const suggestedPrice =
    currentFormFoodCost > 0
      ? Math.ceil((currentFormFoodCost * 2.5) / 1000) * 1000
      : 0;

  // ============ DISH handlers ============

  function handleOpenNewDish() {
    setDishForm({ ...EMPTY_DISH, category: activeCategory });
    setIsEditingDish(true);
  }

  function handleOpenEditDish(dish) {
    setDishForm({
      ...dish,
      category: dish.category || 'dish',
      subcategory: dish.subcategory || '',
      price: String(dish.price ?? ''),
      recipe: loadRecipeIntoForm(dish.recipe, ingredients),
    });
    setIsEditingDish(true);
  }

  function handleDeleteDish(dish) {
    requestConfirm(
      t('menu.confirmDelete'),
      dish.name,
      () => {
        commit({ ...dataset, dishes: dishes.filter((d) => d.id !== dish.id) });
      }
    );
  }

  function addRecipeItem() {
    setDishForm((prev) => ({
      ...prev,
      recipe: [...prev.recipe, { ...EMPTY_RECIPE_ITEM }],
    }));
  }

  function updateRecipeItem(index, field, value) {
    setDishForm((prev) => {
      const next = [...prev.recipe];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, recipe: next };
    });
  }

  function handleRecipeIngredientChange(index, newIngId) {
    const newIng = ingredients.find((i) => i.id === newIngId);
    const defaultRU =
      newIng?.recipe_units?.find((u) => u.is_default) ||
      newIng?.recipe_units?.[0];
    setDishForm((prev) => {
      const next = [...prev.recipe];
      next[index] = {
        ...next[index],
        ingredient_id: newIngId,
        recipe_unit_id: defaultRU?.id || '',
      };
      return { ...prev, recipe: next };
    });
  }

  function removeRecipeItem(index) {
    setDishForm((prev) => ({
      ...prev,
      recipe: prev.recipe.filter((_, i) => i !== index),
    }));
  }

  function handleSubmitDish(e) {
    e.preventDefault();
    if (!restaurant) return;
    const price = Number(dishForm.price);
    if (!dishForm.name.trim() || !Number.isFinite(price) || price <= 0) return;

    const cleanRecipe = dishForm.recipe
      .filter((r) => r.ingredient_id && Number(r.quantity) > 0)
      .map((r) => ({
        ingredient_id: r.ingredient_id,
        quantity_in_base: recipeItemToBaseQty(r, ingredients),
      }));

    if (dishForm.id) {
      const nextDishes = dishes.map((d) =>
        d.id === dishForm.id
          ? {
              ...d,
              name: dishForm.name,
              category: dishForm.category,
              subcategory: dishForm.subcategory,
              price,
              active: dishForm.active,
              recipe: cleanRecipe,
              updatedAt: new Date().toISOString(),
            }
          : d
      );
      commit({ ...dataset, dishes: nextDishes });
    } else {
      const newDish = createDish({
        restaurant_id: restaurant.id,
        name: dishForm.name,
        category: dishForm.category,
        subcategory: dishForm.subcategory,
        price,
        active: dishForm.active,
        recipe: cleanRecipe,
      });
      commit({ ...dataset, dishes: [...dishes, newDish] });
    }
    setIsEditingDish(false);
  }

  // ============ INGREDIENT handlers ============

  function openNewIngredient() {
    setIngredientForm({ ...EMPTY_INGREDIENT_FORM });
    setSheetType('ingredient');
  }

  function updateIngredientField(field, value) {
    setIngredientForm((prev) => ({ ...prev, [field]: value }));
  }

  function addPurchaseOption() {
    setIngredientForm((prev) => ({
      ...prev,
      purchase_options: [
        ...prev.purchase_options,
        { label: '', quantity_in_base: '' },
      ],
    }));
  }
  function updatePurchaseOption(idx, field, value) {
    setIngredientForm((prev) => {
      const next = [...prev.purchase_options];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, purchase_options: next };
    });
  }
  function removePurchaseOption(idx) {
    setIngredientForm((prev) => ({
      ...prev,
      purchase_options: prev.purchase_options.filter((_, i) => i !== idx),
    }));
  }

  function addRecipeUnit() {
    setIngredientForm((prev) => ({
      ...prev,
      recipe_units: [
        ...prev.recipe_units,
        { label: '', quantity_in_base: '', is_default: prev.recipe_units.length === 0 },
      ],
    }));
  }
  function updateRecipeUnit(idx, field, value) {
    setIngredientForm((prev) => {
      const next = [...prev.recipe_units];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, recipe_units: next };
    });
  }
  function removeRecipeUnit(idx) {
    setIngredientForm((prev) => ({
      ...prev,
      recipe_units: prev.recipe_units.filter((_, i) => i !== idx),
    }));
  }

  function handleSubmitIngredient(e) {
    e.preventDefault();
    if (!restaurant || !ingredientForm.name.trim()) return;

    const payload = {
      restaurant_id: restaurant.id,
      name: ingredientForm.name,
      category: ingredientForm.category,
      base_unit: ingredientForm.base_unit,
      reference_unit_cost: Number(ingredientForm.reference_unit_cost) || 0,
      yield_factor: Number(ingredientForm.yield_factor) || 1,
      track_stock: !!ingredientForm.track_stock,
      storage_type: ingredientForm.storage_type,
      shelf_life_days:
        ingredientForm.shelf_life_days === ''
          ? null
          : Number(ingredientForm.shelf_life_days),
      stock_quantity: Number(ingredientForm.stock_quantity) || 0,
      min_stock: Number(ingredientForm.min_stock) || 0,
      preferred_supplier_id: ingredientForm.preferred_supplier_id || '',
      purchase_options: ingredientForm.purchase_options
        .filter((po) => po.label && po.quantity_in_base !== '')
        .map((po) => ({
          label: po.label,
          quantity_in_base: Number(po.quantity_in_base) || 1,
        })),
      recipe_units: ingredientForm.recipe_units
        .filter((ru) => ru.label && ru.quantity_in_base !== '')
        .map((ru) => ({
          label: ru.label,
          quantity_in_base: Number(ru.quantity_in_base) || 1,
          is_default: !!ru.is_default,
        })),
    };

    const created = createIngredient(payload);
    commit({ ...dataset, ingredients: [...ingredients, created] });
    setSheetType(null);
    setIngredientForm({ ...EMPTY_INGREDIENT_FORM });
  }

  // ============ FORMULA handlers ============

  function openNewFormula() {
    setFormulaForm({ ...EMPTY_FORMULA_FORM });
    setSheetType('formula');
  }

  function handleEditFormula(formula) {
    setFormulaForm({
      id: formula.id,
      name: formula.name || '',
      description: formula.description || '',
      emoji: formula.emoji || '✨',
      color: formula.color || '#FF9800',
      composition: (formula.composition || []).map((c) => ({
        dish_id: c.dish_id || '',
        quantity: c.quantity ?? 1,
        slot: c.slot || 'main',
      })),
      pricing_mode: formula.pricing_mode || 'fixed',
      fixed_price: String(formula.fixed_price ?? ''),
      discount_pct: formula.discount_pct ?? 0,
      active: formula.active !== false,
    });
    setSheetType('formula');
  }

  function handleDeleteFormula(formula) {
    requestConfirm(
      t('menu.formulas.confirmDelete'),
      formula.name,
      () => {
        commit({
          ...dataset,
          formulas: formulas.filter((f) => f.id !== formula.id),
        });
      }
    );
  }

  function updateFormulaField(field, value) {
    setFormulaForm((prev) => ({ ...prev, [field]: value }));
  }

  function addCompositionItem() {
    setFormulaForm((prev) => ({
      ...prev,
      composition: [
        ...prev.composition,
        { dish_id: '', quantity: 1, slot: 'main' },
      ],
    }));
  }
  function updateCompositionItem(idx, field, value) {
    setFormulaForm((prev) => {
      const next = [...prev.composition];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, composition: next };
    });
  }
  function removeCompositionItem(idx) {
    setFormulaForm((prev) => ({
      ...prev,
      composition: prev.composition.filter((_, i) => i !== idx),
    }));
  }

  function handleSubmitFormula(e) {
    e.preventDefault();
    if (!restaurant || !formulaForm.name.trim()) return;

    const composition = formulaForm.composition
      .filter((c) => c.dish_id && Number(c.quantity) > 0)
      .map((c) => ({
        dish_id: c.dish_id,
        quantity: Number(c.quantity),
        slot: c.slot || 'main',
      }));

    const payload = {
      restaurant_id: restaurant.id,
      name: formulaForm.name,
      description: formulaForm.description || '',
      emoji: formulaForm.emoji || '✨',
      color: formulaForm.color || '#FF9800',
      composition,
      pricing_mode: formulaForm.pricing_mode || 'fixed',
      fixed_price: Number(formulaForm.fixed_price) || 0,
      discount_pct: Number(formulaForm.discount_pct) || 0,
      active: formulaForm.active !== false,
    };

    if (formulaForm.id) {
      const next = formulas.map((f) =>
        f.id === formulaForm.id
          ? { ...f, ...payload, updatedAt: new Date().toISOString() }
          : f
      );
      commit({ ...dataset, formulas: next });
    } else {
      commit({
        ...dataset,
        formulas: [...formulas, createFormula(payload)],
      });
    }
    setSheetType(null);
    setFormulaForm({ ...EMPTY_FORMULA_FORM });
  }

  // ============ PREVIEW totals (formule en édition) ============

  const formulaPreviewTotals = useMemo(() => {
    if (!formulaForm) return null;
    const tempFormula = {
      composition: formulaForm.composition.filter((c) => c.dish_id),
      pricing_mode: formulaForm.pricing_mode,
      fixed_price: Number(formulaForm.fixed_price) || 0,
      discount_pct: Number(formulaForm.discount_pct) || 0,
    };
    return computeFormulaTotals(
      tempFormula,
      dishesById,
      ingredients,
      promotions,
      today
    );
  }, [formulaForm, dishesById, ingredients, promotions, today]);

  // ============ RENDER ============

  if (!dataset || !restaurant) {
    return <div className="menu-page">{t('common.loading')}</div>;
  }

  const sheetTitles = {
    ingredient: ingredientForm.id
      ? t('common.edit')
      : t('menu.addIngredient'),
    formula: formulaForm.id ? t('menu.formulas.edit') : t('menu.formulas.add'),
  };

  function closeSheet() {
    setSheetType(null);
    setIngredientForm({ ...EMPTY_INGREDIENT_FORM });
    setFormulaForm({ ...EMPTY_FORMULA_FORM });
  }

  return (
    <div className="menu-page">
      <header className="menu-page__header">
        <h1 className="menu-page__title">{t('menu.title')}</h1>
      </header>

      {!isEditingDish && (
        <div className="menu-page__actions">
          <button
            type="button"
            className="menu-action-btn menu-action-btn--dish"
            onClick={handleOpenNewDish}
          >
            <span className="menu-action-btn__icon" aria-hidden="true">🍽️</span>
            <span className="menu-action-btn__label">{t('menu.addDish')}</span>
          </button>
          <button
            type="button"
            className="menu-action-btn menu-action-btn--ingredient"
            onClick={openNewIngredient}
          >
            <span className="menu-action-btn__icon" aria-hidden="true">🥬</span>
            <span className="menu-action-btn__label">{t('menu.addIngredient')}</span>
          </button>
          <button
            type="button"
            className="menu-action-btn menu-action-btn--formula"
            onClick={openNewFormula}
          >
            <span className="menu-action-btn__icon" aria-hidden="true">✨</span>
            <span className="menu-action-btn__label">{t('menu.formulas.add')}</span>
          </button>
        </div>
      )}

      {isEditingDish ? (
        <form className="menu-form" onSubmit={handleSubmitDish}>
          <h2 className="menu-section-title">
            {dishForm.id ? t('common.edit') : t('menu.addDish')}
          </h2>

          <div className="form-row">
            <label>{t('menu.dish.name')}</label>
            <input
              type="text"
              required
              value={dishForm.name}
              onChange={(e) =>
                setDishForm({ ...dishForm, name: e.target.value })
              }
            />
          </div>

          <div className="form-row">
            <label>{t('menu.dish.category')}</label>
            <select
              value={dishForm.category}
              onChange={(e) =>
                setDishForm({ ...dishForm, category: e.target.value })
              }
            >
              {MENU_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_EMOJI[cat]} {t(`menu.sections.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>{t('menu.dish.subcategory')}</label>
            <input
              type="text"
              value={dishForm.subcategory}
              onChange={(e) =>
                setDishForm({ ...dishForm, subcategory: e.target.value })
              }
            />
          </div>

          <div className="form-row">
            <label>{t('menu.dish.price')}</label>
            <input
              type="number"
              min="0"
              step="1000"
              required
              value={dishForm.price}
              onChange={(e) =>
                setDishForm({ ...dishForm, price: e.target.value })
              }
            />
            {currentFormFoodCost > 0 && (
              <p className="menu-form__hint">
                <span>
                  {t('menu.recipe.totalCost')} :{' '}
                  {formatCurrency(currentFormFoodCost)}
                </span>
                {suggestedPrice > 0 && (
                  <button
                    type="button"
                    className="menu-form__suggest"
                    onClick={() =>
                      setDishForm({
                        ...dishForm,
                        price: String(suggestedPrice),
                      })
                    }
                  >
                    → {formatCurrency(suggestedPrice)}
                  </button>
                )}
              </p>
            )}
          </div>

          <div className="form-row form-row--checkbox">
            <label>
              <input
                type="checkbox"
                checked={dishForm.active}
                onChange={(e) =>
                  setDishForm({ ...dishForm, active: e.target.checked })
                }
              />
              {t('menu.dish.active')}
            </label>
          </div>

          <div className="menu-recipe-builder">
            <h3>{t('menu.recipe.title')}</h3>
            <div className="recipe-list">
              {dishForm.recipe.map((item, index) => {
                const ing = ingredients.find(
                  (i) => i.id === item.ingredient_id
                );
                const recipeUnits = ing?.recipe_units || [];
                return (
                  <div key={index} className="recipe-item recipe-item--v9">
                    <select
                      required
                      className="recipe-ingredient"
                      value={item.ingredient_id}
                      onChange={(e) =>
                        handleRecipeIngredientChange(index, e.target.value)
                      }
                    >
                      <option value="">
                        {t('menu.recipe.selectIngredient')}
                      </option>
                      {ingredients.map((i) => {
                        const info = getIngredientDisplayInfo(i);
                        return (
                          <option key={i.id} value={i.id}>
                            {i.name} ({formatCurrency(info.price)}/
                            {info.unit})
                          </option>
                        );
                      })}
                    </select>
                    <select
                      className="recipe-unit"
                      value={item.recipe_unit_id}
                      onChange={(e) =>
                        updateRecipeItem(
                          index,
                          'recipe_unit_id',
                          e.target.value
                        )
                      }
                      disabled={!ing}
                    >
                      {recipeUnits.length === 0 ? (
                        <option value="">
                          {ing
                            ? t(`common.baseUnits.${ing.base_unit}.short`)
                            : '—'}
                        </option>
                      ) : (
                        recipeUnits.map((ru) => (
                          <option key={ru.id} value={ru.id}>
                            {ru.label}
                          </option>
                        ))
                      )}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      className="recipe-qty"
                      value={item.quantity}
                      onChange={(e) =>
                        updateRecipeItem(index, 'quantity', e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger recipe-remove"
                      onClick={() => removeRecipeItem(index)}
                      aria-label={t('common.delete')}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addRecipeItem}
            >
              + {t('menu.recipe.addIngredient')}
            </button>
            <div className="recipe-total">
              <span>{t('menu.recipe.totalCost')} :</span>
              <strong>{formatCurrency(currentFormFoodCost)}</strong>
            </div>
          </div>

          <div className="menu-form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsEditingDish(false)}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('common.save')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="menu-page__filters">
            <PillSelector
              value={activeCategory}
              options={categoryOptions}
              onChange={setActiveCategory}
              ariaLabel={t('menu.title')}
            />
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('menu.title')}
            />
          </div>

          <section className="menu-page__dishes">
            {filteredDishes.length === 0 ? (
              <EmptyState
                emoji={CATEGORY_EMOJI[activeCategory]}
                title={t('menu.empty')}
              />
            ) : (
              <ul className="menu-dish-list">
                {filteredDishes.map((dish) => {
                  const sp = getDishSellingPrice(dataset, dish, today);
                  const hasPromo =
                    Number.isFinite(sp) && sp > 0 && sp < Number(dish.price);
                  const effectivePrice = hasPromo
                    ? sp
                    : Number(dish.price) || 0;
                  const fc = getDishFoodCost(dish, ingredients);
                  const margin = effectivePrice - fc;
                  const marginPct =
                    effectivePrice > 0 ? (margin / effectivePrice) * 100 : 0;

                  return (
                    <li
                      key={dish.id}
                      className={`menu-dish-card ${
                        !dish.active ? 'menu-dish-card--inactive' : ''
                      }`}
                    >
                      <div className="menu-dish-card__head">
                        <div className="menu-dish-card__title-wrap">
                          <h3 className="menu-dish-card__name">
                            <span
                              className="menu-dish-card__emoji"
                              aria-hidden="true"
                            >
                              {CATEGORY_EMOJI[dish.category] || '🍽️'}
                            </span>
                            {dish.name}
                          </h3>
                          {dish.subcategory && (
                            <span className="menu-dish-card__sub">
                              {dish.subcategory}
                            </span>
                          )}
                        </div>
                        <div className="menu-dish-card__badges">
                          <Badge variant="info">
                            {t(`menu.sections.${dish.category || 'dish'}`)}
                          </Badge>
                          {hasPromo && <Badge variant="promo">PROMO</Badge>}
                        </div>
                      </div>

                      <div className="menu-dish-card__prices">
                        <div className="menu-dish-card__price-block">
                          <span className="menu-dish-card__label">
                            {t('menu.dish.price')}
                          </span>
                          {hasPromo ? (
                            <span className="menu-dish-card__price">
                              <s className="menu-dish-card__price-old">
                                {formatCurrency(dish.price)}
                              </s>
                              <span className="menu-dish-card__price-new">
                                {formatCurrency(effectivePrice)}
                              </span>
                            </span>
                          ) : (
                            <span className="menu-dish-card__price">
                              {formatCurrency(dish.price)}
                            </span>
                          )}
                        </div>
                        <div className="menu-dish-card__price-block">
                          <span className="menu-dish-card__label">
                            {t('menu.dish.foodCost')}
                          </span>
                          <span className="menu-dish-card__value">
                            {formatCurrency(fc)}
                          </span>
                        </div>
                        <div className="menu-dish-card__price-block">
                          <span className="menu-dish-card__label">
                            {t('menu.dish.margin')}
                          </span>
                          <span
                            className={`menu-dish-card__value ${
                              marginPct >= 60
                                ? 'menu-dish-card__value--good'
                                : 'menu-dish-card__value--warn'
                            }`}
                          >
                            {formatCurrency(margin)}
                            <small>({marginPct.toFixed(0)}%)</small>
                          </span>
                        </div>
                      </div>

                      <div className="menu-dish-card__actions">
                        <button
                          type="button"
                          className="btn-action btn-action--edit"
                          onClick={() => handleOpenEditDish(dish)}
                          title={t('common.edit')}
                        >
                          ✏️ {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-action--delete"
                          onClick={() => handleDeleteDish(dish)}
                          title={t('common.delete')}
                        >
                          🗑️ {t('common.delete')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            className="menu-page__formulas"
            aria-label={t('menu.formulas.title')}
          >
            <h2 className="menu-section-title">{t('menu.formulas.title')}</h2>
            {activeFormulas.length === 0 ? (
              <EmptyState emoji="✨" title={t('menu.formulas.empty')} />
            ) : (
              <ul className="menu-formula-list">
                {activeFormulas.map((formula) => {
                  const totals = computeFormulaTotals(
                    formula,
                    dishesById,
                    ingredients,
                    promotions,
                    today
                  );
                  const formulaColor = formula.color || '#FF9800';
                  return (
                    <li
                      key={formula.id}
                      className="menu-formula-card"
                      style={{ '--formula-color': formulaColor }}
                    >
                      <div className="menu-formula-card__head">
                        <div
                          className="menu-formula-card__emoji"
                          aria-hidden="true"
                        >
                          {formula.emoji || '✨'}
                        </div>
                        <div className="menu-formula-card__title-wrap">
                          <h3 className="menu-formula-card__name">
                            {formula.name}
                          </h3>
                          {formula.description && (
                            <p className="menu-formula-card__desc">
                              {formula.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="warning">
                          {t(
                            `menu.formulas.pricingModes.${
                              formula.pricing_mode || 'calculated'
                            }`
                          )}
                        </Badge>
                      </div>

                      <ul className="menu-formula-card__composition">
                        {totals.lines.length === 0 ? (
                          <li className="menu-formula-card__line menu-formula-card__line--empty">
                            {t('menu.formulas.composition.empty')}
                          </li>
                        ) : (
                          totals.lines.map((line, idx) => (
                            <li
                              key={`${formula.id}-${idx}`}
                              className="menu-formula-card__line"
                            >
                              <span className="menu-formula-card__line-slot">
                                {t(
                                  `menu.formulas.slots.${
                                    line.item.slot || 'main'
                                  }`
                                )}
                              </span>
                              <span className="menu-formula-card__line-name">
                                {line.dish ? line.dish.name : '—'}
                              </span>
                              <span className="menu-formula-card__line-qty">
                                ×{line.qty}
                              </span>
                              <span className="menu-formula-card__line-price">
                                {formatCurrency(line.sellingPrice * line.qty)}
                              </span>
                            </li>
                          ))
                        )}
                      </ul>

                      <div className="menu-formula-card__totals">
                        <div className="menu-formula-card__total-row">
                          <span>{t('menu.formulas.totalPrice')}</span>
                          <strong>{formatCurrency(totals.finalPrice)}</strong>
                        </div>
                        <div className="menu-formula-card__total-row">
                          <span>{t('menu.formulas.totalCost')}</span>
                          <span>{formatCurrency(totals.totalCost)}</span>
                        </div>
                        <div className="menu-formula-card__total-row menu-formula-card__total-row--margin">
                          <span>{t('menu.formulas.totalMargin')}</span>
                          <strong>{formatCurrency(totals.totalMargin)}</strong>
                        </div>
                      </div>

                      <div className="menu-formula-card__actions">
                        <button
                          type="button"
                          className="btn-action btn-action--edit"
                          onClick={() => handleEditFormula(formula)}
                        >
                          ✏️ {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn-action btn-action--delete"
                          onClick={() => handleDeleteFormula(formula)}
                        >
                          🗑️ {t('common.delete')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <BottomSheet
        open={!!sheetType}
        onClose={closeSheet}
        title={sheetType ? sheetTitles[sheetType] : ''}
      >
        {sheetType === 'ingredient' && (
          <form
            className="menu-form menu-form--sheet"
            onSubmit={handleSubmitIngredient}
          >
            <div className="menu-form__group">
              <div className="form-row">
                <label>{t('menu.ingredients.name')}</label>
                <input
                  type="text"
                  required
                  value={ingredientForm.name}
                  onChange={(e) =>
                    updateIngredientField('name', e.target.value)
                  }
                />
              </div>
              <div className="menu-form__row-2">
                <div className="form-row">
                  <label>{t('menu.ingredients.category')}</label>
                  <select
                    value={ingredientForm.category}
                    onChange={(e) =>
                      updateIngredientField('category', e.target.value)
                    }
                  >
                    {INGREDIENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {INGREDIENT_CATEGORY_EMOJI[cat]}{' '}
                        {t(`ingredientCategories.${cat}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>{t('menu.calculations.baseUnit')}</label>
                  <select
                    value={ingredientForm.base_unit}
                    onChange={(e) =>
                      updateIngredientField('base_unit', e.target.value)
                    }
                  >
                    {BASE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {t(`common.baseUnits.${u}.label`)} (
                        {t(`common.baseUnits.${u}.short`)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="menu-form__group">
              <div className="menu-form__row-2">
                <div className="form-row">
                  <label>{t('menu.calculations.referenceUnitCost')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={ingredientForm.reference_unit_cost}
                    onChange={(e) =>
                      updateIngredientField(
                        'reference_unit_cost',
                        e.target.value
                      )
                    }
                  />
                </div>
                <div className="form-row">
                  <label>{t('menu.calculations.yieldFactor')}</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={ingredientForm.yield_factor}
                    onChange={(e) =>
                      updateIngredientField('yield_factor', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="form-row form-row--checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={ingredientForm.track_stock}
                    onChange={(e) =>
                      updateIngredientField('track_stock', e.target.checked)
                    }
                  />
                  {t('menu.calculations.trackStock')}
                </label>
              </div>

              <div className="menu-form__row-2">
                <div className="form-row">
                  <label>{t('team.ingredientV9.storageType')}</label>
                  <select
                    value={ingredientForm.storage_type}
                    onChange={(e) =>
                      updateIngredientField('storage_type', e.target.value)
                    }
                  >
                    {STORAGE_TYPES.map((st) => (
                      <option key={st} value={st}>
                        {t(`storageTypes.${st}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>{t('menu.calculations.shelfLifeDays')}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={ingredientForm.shelf_life_days}
                    onChange={(e) =>
                      updateIngredientField('shelf_life_days', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="menu-form__row-2">
                <div className="form-row">
                  <label>{t('team.ingredientV9.stockQuantity')}</label>
                  <input
                    type="number"
                    step="any"
                    value={ingredientForm.stock_quantity}
                    onChange={(e) =>
                      updateIngredientField('stock_quantity', e.target.value)
                    }
                  />
                </div>
                <div className="form-row">
                  <label>{t('team.ingredientV9.minStock')}</label>
                  <input
                    type="number"
                    step="any"
                    value={ingredientForm.min_stock}
                    onChange={(e) =>
                      updateIngredientField('min_stock', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <label>{t('team.ingredientV9.preferredSupplier')}</label>
                <select
                  value={ingredientForm.preferred_supplier_id}
                  onChange={(e) =>
                    updateIngredientField(
                      'preferred_supplier_id',
                      e.target.value
                    )
                  }
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="menu-form__group">
              <div className="menu-form__subhead">
                <span>{t('team.ingredientV9.purchaseOptions')}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={addPurchaseOption}
                >
                  + {t('team.ingredientV9.addPurchaseOption')}
                </button>
              </div>
              {ingredientForm.purchase_options.map((po, idx) => (
                <div key={idx} className="menu-form__kv-row">
                  <input
                    type="text"
                    placeholder={t('menu.dish.name')}
                    value={po.label}
                    onChange={(e) =>
                      updatePurchaseOption(idx, 'label', e.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={t('menu.calculations.quantityInBase')}
                    value={po.quantity_in_base}
                    onChange={(e) =>
                      updatePurchaseOption(
                        idx,
                        'quantity_in_base',
                        e.target.value
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger"
                    onClick={() => removePurchaseOption(idx)}
                    aria-label={t('common.delete')}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="menu-form__group">
              <div className="menu-form__subhead">
                <span>{t('team.ingredientV9.recipeUnits')}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={addRecipeUnit}
                >
                  + {t('team.ingredientV9.addRecipeUnit')}
                </button>
              </div>
              {ingredientForm.recipe_units.map((ru, idx) => (
                <div key={idx} className="menu-form__kv-row">
                  <input
                    type="text"
                    placeholder={t('menu.dish.name')}
                    value={ru.label}
                    onChange={(e) =>
                      updateRecipeUnit(idx, 'label', e.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={t('menu.calculations.quantityInBase')}
                    value={ru.quantity_in_base}
                    onChange={(e) =>
                      updateRecipeUnit(
                        idx,
                        'quantity_in_base',
                        e.target.value
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger"
                    onClick={() => removeRecipeUnit(idx)}
                    aria-label={t('common.delete')}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="menu-form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeSheet}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                {t('common.save')}
              </button>
            </div>
          </form>
        )}

        {sheetType === 'formula' && (
          <form
            className="menu-form menu-form--sheet"
            onSubmit={handleSubmitFormula}
          >
            <div className="menu-form__group">
              <div className="form-row">
                <label>{t('menu.formulas.fields.name')}</label>
                <input
                  type="text"
                  required
                  value={formulaForm.name}
                  onChange={(e) =>
                    updateFormulaField('name', e.target.value)
                  }
                />
              </div>

              <div className="form-row">
                <label>{t('menu.formulas.fields.description')}</label>
                <input
                  type="text"
                  value={formulaForm.description}
                  onChange={(e) =>
                    updateFormulaField('description', e.target.value)
                  }
                />
              </div>

              <div className="menu-form__emoji-color">
                <div className="form-row">
                  <label>{t('menu.formulas.fields.emoji')}</label>
                  <input
                    type="text"
                    value={formulaForm.emoji}
                    onChange={(e) =>
                      updateFormulaField('emoji', e.target.value)
                    }
                  />
                </div>
                <div className="form-row">
                  <label>{t('menu.formulas.fields.color')}</label>
                  <input
                    type="text"
                    placeholder="#FF9800"
                    value={formulaForm.color}
                    onChange={(e) =>
                      updateFormulaField('color', e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div className="menu-form__group">
              <div className="menu-form__subhead">
                <span>{t('menu.formulas.fields.composition')}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={addCompositionItem}
                >
                  + {t('menu.formulas.composition.addDish')}
                </button>
              </div>
              {formulaForm.composition.length === 0 ? (
                <p className="menu-form__hint">
                  {t('menu.formulas.composition.empty')}
                </p>
              ) : (
                formulaForm.composition.map((c, idx) => (
                  <div key={idx} className="menu-form__composition-row">
                    <select
                      className="composition-dish"
                      value={c.dish_id}
                      onChange={(e) =>
                        updateCompositionItem(
                          idx,
                          'dish_id',
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        {t('menu.formulas.composition.selectDish')}
                      </option>
                      {dishes.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="composition-qty"
                      value={c.quantity}
                      aria-label={t('menu.formulas.composition.quantity')}
                      onChange={(e) =>
                        updateCompositionItem(
                          idx,
                          'quantity',
                          e.target.value
                        )
                      }
                    />
                    <select
                      className="composition-slot"
                      value={c.slot}
                      aria-label={t('menu.formulas.composition.slot')}
                      onChange={(e) =>
                        updateCompositionItem(
                          idx,
                          'slot',
                          e.target.value
                        )
                      }
                    >
                      {FORMULA_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {t(`menu.formulas.slots.${slot}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger composition-remove"
                      onClick={() => removeCompositionItem(idx)}
                      aria-label={t('common.delete')}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="menu-form__group">
              <div className="form-row">
                <label>{t('menu.formulas.fields.pricingMode')}</label>
                <select
                  value={formulaForm.pricing_mode}
                  onChange={(e) =>
                    updateFormulaField('pricing_mode', e.target.value)
                  }
                >
                  {FORMULA_PRICING_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {t(`menu.formulas.pricingModes.${mode}`)}
                    </option>
                  ))}
                </select>
              </div>

              {formulaForm.pricing_mode === 'fixed' && (
                <div className="form-row">
                  <label>{t('menu.formulas.fields.fixedPrice')}</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formulaForm.fixed_price}
                    onChange={(e) =>
                      updateFormulaField('fixed_price', e.target.value)
                    }
                  />
                </div>
              )}

              {formulaForm.pricing_mode === 'discounted' && (
                <div className="form-row">
                  <label>{t('menu.formulas.fields.discountPct')}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={formulaForm.discount_pct}
                    onChange={(e) =>
                      updateFormulaField('discount_pct', e.target.value)
                    }
                  />
                </div>
              )}

              <div className="form-row form-row--checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formulaForm.active}
                    onChange={(e) =>
                      updateFormulaField('active', e.target.checked)
                    }
                  />
                  {t('menu.formulas.fields.active')}
                </label>
              </div>
            </div>

            {formulaPreviewTotals && (
              <div className="menu-form__totals">
                <div className="menu-form__totals-row">
                  <span>{t('menu.formulas.totalPrice')}</span>
                  <strong>
                    {formatCurrency(formulaPreviewTotals.finalPrice)}
                  </strong>
                </div>
                <div className="menu-form__totals-row">
                  <span>{t('menu.formulas.totalCost')}</span>
                  <span>
                    {formatCurrency(formulaPreviewTotals.totalCost)}
                  </span>
                </div>
                <div className="menu-form__totals-row">
                  <span>{t('menu.formulas.totalMargin')}</span>
                  <strong>
                    {formatCurrency(formulaPreviewTotals.totalMargin)}
                  </strong>
                </div>
              </div>
            )}

            <div className="menu-form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeSheet}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                {t('common.save')}
              </button>
            </div>
          </form>
        )}
      </BottomSheet>

      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        danger
        onConfirm={() => {
          const fn = confirmState?.onConfirm;
          setConfirmState(null);
          if (fn) fn();
        }}
        onCancel={() => setConfirmState(null)}
      />

      <Toast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}