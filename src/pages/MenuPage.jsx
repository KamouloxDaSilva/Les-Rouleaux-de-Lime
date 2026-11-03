// src/pages/MenuPage.jsx
// Chantier 19 — Menu v3 : page + cartes + formules
// (préserve le formulaire plat + recipe builder + promos du Chantier 12 Partie 2)
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { getActiveRestaurant, createDish, MENU_CATEGORIES } from '../data/model.js';
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
import './MenuPage.css';

const EMPTY_DISH = {
  id: null,
  name: '',
  category: 'dish',
  subcategory: '',
  price: '',
  active: true,
  recipe: [],
};

const CATEGORY_EMOJI = {
  dish: '🥗',
  drink: '🥤',
  dessert: '🍰',
  sauce: '🥫',
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
  else if (unit === 'kg' && rawUnit !== 'g' && rawUnit !== 'kg') unit = rawUnit;

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
    const sp = getDishSellingPrice(dish, promotions, todayIso);
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

export default function MenuPage() {
  const { t, formatCurrency } = useI18n();
  const [dataset, setDataset] = useState(null);
  const [activeCategory, setActiveCategory] = useState('dish');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingDish, setIsEditingDish] = useState(false);
  const [dishForm, setDishForm] = useState(EMPTY_DISH);
  const [sheetType, setSheetType] = useState(null);
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

  const today = getTodayString();
  const dishesById = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);

  function commit(next) {
    setDataset(next);
    try {
      saveDataset(next);
      setToast({ open: true, message: t('common.success'), variant: 'success' });
    } catch {
      setToast({ open: true, message: t('common.error'), variant: 'error' });
    }
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
    () =>
      getDishFoodCost(
        { recipe: dishForm.recipe, price: Number(dishForm.price) || 0 },
        ingredients
      ),
    [dishForm.recipe, dishForm.price, ingredients]
  );

  // ==== Form plat ====
  function handleOpenNewDish() {
    setDishForm({ ...EMPTY_DISH, category: activeCategory });
    setIsEditingDish(true);
  }

  function handleOpenEditDish(dish) {
    setDishForm({
      ...dish,
      category: dish.category || 'dish',
      subcategory: dish.subcategory || '',
      price: String(dish.price),
      recipe: dish.recipe ? JSON.parse(JSON.stringify(dish.recipe)) : [],
    });
    setIsEditingDish(true);
  }

  function handleDeleteDish(id) {
    if (!window.confirm(t('menu.confirmDelete'))) return;
    commit({ ...dataset, dishes: dishes.filter((d) => d.id !== id) });
  }

  function addRecipeItem() {
    setDishForm((prev) => ({
      ...prev,
      recipe: [...prev.recipe, { ingredient_id: '', quantity: 0 }],
    }));
  }
  function updateRecipeItem(index, field, value) {
    const nextRecipe = [...dishForm.recipe];
    nextRecipe[index] = { ...nextRecipe[index], [field]: value };
    setDishForm({ ...dishForm, recipe: nextRecipe });
  }
  function removeRecipeItem(index) {
    setDishForm({ ...dishForm, recipe: dishForm.recipe.filter((_, i) => i !== index) });
  }

  function handleSubmitDish(e) {
    e.preventDefault();
    if (!restaurant) return;
    const price = Number(dishForm.price);
    if (!dishForm.name.trim() || !Number.isFinite(price) || price <= 0) return;

    const cleanRecipe = dishForm.recipe
      .filter((r) => r.ingredient_id && Number(r.quantity) > 0)
      .map((r) => ({ ...r, quantity: Number(r.quantity) }));

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

  if (!dataset || !restaurant) {
    return <div className="menu-page">{t('common.loading')}</div>;
  }

  const sheetTitles = {
    addIngredient: t('menu.addIngredient'),
    addFormula: t('menu.formulas.add'),
  };

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
            onClick={() => setSheetType('addIngredient')}
          >
            <span className="menu-action-btn__icon" aria-hidden="true">🥬</span>
            <span className="menu-action-btn__label">{t('menu.addIngredient')}</span>
          </button>
          <button
            type="button"
            className="menu-action-btn menu-action-btn--formula"
            onClick={() => setSheetType('addFormula')}
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
              onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })}
            />
          </div>

          <div className="form-row">
            <label>{t('menu.dish.category')}</label>
            <select
              value={dishForm.category}
              onChange={(e) => setDishForm({ ...dishForm, category: e.target.value })}
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
              onChange={(e) => setDishForm({ ...dishForm, subcategory: e.target.value })}
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
              onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })}
            />
          </div>

          <div className="form-row form-row--checkbox">
            <label>
              <input
                type="checkbox"
                checked={dishForm.active}
                onChange={(e) => setDishForm({ ...dishForm, active: e.target.checked })}
              />
              {t('menu.dish.active')}
            </label>
          </div>

          <div className="menu-recipe-builder">
            <h3>{t('menu.recipe.title')}</h3>
            <div className="recipe-list">
              {dishForm.recipe.map((item, index) => {
                const ing = ingredients.find((i) => i.id === item.ingredient_id);
                return (
                  <div key={index} className="recipe-item">
                    <select
                      required
                      value={item.ingredient_id}
                      onChange={(e) =>
                        updateRecipeItem(index, 'ingredient_id', e.target.value)
                      }
                    >
                      <option value="">{t('menu.recipe.selectIngredient')}</option>
                      {ingredients.map((i) => {
                        const info = getIngredientDisplayInfo(i);
                        return (
                          <option key={i.id} value={i.id}>
                            {i.name} ({formatCurrency(info.price)}/{info.unit})
                          </option>
                        );
                      })}
                    </select>
                    <div className="recipe-qty">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={item.quantity}
                        onChange={(e) =>
                          updateRecipeItem(index, 'quantity', e.target.value)
                        }
                      />
                      <span>{ing ? ing.unit : ''}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger"
                      onClick={() => removeRecipeItem(index)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn btn-secondary" onClick={addRecipeItem}>
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
                  const sp = getDishSellingPrice(dish, promotions, today);
                  const hasPromo =
                    Number.isFinite(sp) && sp > 0 && sp < Number(dish.price);
                  const effectivePrice = hasPromo ? sp : Number(dish.price) || 0;
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
                          onClick={() => handleDeleteDish(dish.id)}
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
        onClose={() => setSheetType(null)}
        title={sheetType ? sheetTitles[sheetType] : ''}
      >
        <EmptyState emoji="🚧" title={t('placeholder.comingSoon')} />
      </BottomSheet>

      <Toast
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}