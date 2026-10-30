// src/pages/MenuPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { getActiveRestaurant, createDish, MENU_CATEGORIES } from '../data/model.js'
import { loadDataset, saveDataset } from '../data/storage.js'
import { createDefaultFixtures } from '../data/fixtures.js'
import {
  getDishFoodCost,
  getDishMargin,
  getDishMarginPercent,
} from '../data/calculations.js'
import './MenuPage.css'

const EMPTY_DISH = {
  id: null,
  name: '',
  category: 'dish',
  subcategory: '',
  price: '',
  active: true,
  recipe: [],
}

const CATEGORY_EMOJI = {
  dish: '🥗',
  drink: '🥤',
  dessert: '🍰',
  sauce: '🥫',
}

export default function MenuPage() {
  const { t, formatCurrency } = useI18n()
  const [dataset, setDataset] = useState(null)
  const [activeCategory, setActiveCategory] = useState('dish')

  const [isEditingDish, setIsEditingDish] = useState(false)
  const [dishForm, setDishForm] = useState(EMPTY_DISH)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    const loaded = loadDataset()
    const isEmpty = loaded.dishes.length === 0
    const initial = isEmpty ? createDefaultFixtures() : loaded
    if (isEmpty) {
      try { saveDataset(initial) } catch (e) { console.warn(e) }
    }
    setDataset(initial)
  }, [])

  const restaurant = useMemo(() => (dataset ? getActiveRestaurant(dataset) : null), [dataset])
  const ingredients = dataset?.ingredients || []
  const dishes = dataset?.dishes || []

  function commit(next) {
    setDataset(next)
    try {
      saveDataset(next)
    } catch (e) {
      setFeedback({ type: 'error', message: e.message })
    }
  }

  const filteredDishes = useMemo(
    () => dishes.filter((d) => (d.category || 'dish') === activeCategory),
    [dishes, activeCategory]
  )

  const categoryCounts = useMemo(() => {
    const counts = {}
    MENU_CATEGORIES.forEach((c) => { counts[c] = 0 })
    dishes.forEach((d) => {
      const cat = d.category || 'dish'
      if (counts[cat] !== undefined) counts[cat] += 1
    })
    return counts
  }, [dishes])

  // ================= PLATS =================

  const currentFormFoodCost = useMemo(() => {
    return getDishFoodCost({ recipe: dishForm.recipe, price: Number(dishForm.price) || 0 }, ingredients)
  }, [dishForm.recipe, dishForm.price, ingredients])

  function handleOpenNewDish() {
    setDishForm({ ...EMPTY_DISH, category: activeCategory })
    setIsEditingDish(true)
    setFeedback(null)
  }

  function handleOpenEditDish(dish) {
    setDishForm({
      ...dish,
      category: dish.category || 'dish',
      subcategory: dish.subcategory || '',
      price: String(dish.price),
      recipe: dish.recipe ? JSON.parse(JSON.stringify(dish.recipe)) : [],
    })
    setIsEditingDish(true)
    setFeedback(null)
  }

  function handleDeleteDish(id) {
    if (!window.confirm(t('menu.confirmDelete'))) return
    commit({ ...dataset, dishes: dishes.filter((d) => d.id !== id) })
  }

  function addRecipeItem() {
    setDishForm((prev) => ({ ...prev, recipe: [...prev.recipe, { ingredient_id: '', quantity: 0 }] }))
  }
  function updateRecipeItem(index, field, value) {
    const nextRecipe = [...dishForm.recipe]
    nextRecipe[index] = { ...nextRecipe[index], [field]: value }
    setDishForm({ ...dishForm, recipe: nextRecipe })
  }
  function removeRecipeItem(index) {
    setDishForm({ ...dishForm, recipe: dishForm.recipe.filter((_, i) => i !== index) })
  }

  function handleSubmitDish(e) {
    e.preventDefault()
    if (!restaurant) return
    const price = Number(dishForm.price)
    if (!dishForm.name.trim() || !Number.isFinite(price) || price <= 0) return

    const cleanRecipe = dishForm.recipe
      .filter((r) => r.ingredient_id && r.quantity > 0)
      .map((r) => ({ ...r, quantity: Number(r.quantity) }))

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
      )
      commit({ ...dataset, dishes: nextDishes })
    } else {
      const newDish = createDish({
        restaurant_id: restaurant.id,
        name: dishForm.name,
        category: dishForm.category,
        subcategory: dishForm.subcategory,
        price,
        active: dishForm.active,
        recipe: cleanRecipe,
      })
      commit({ ...dataset, dishes: [...dishes, newDish] })
    }
    setIsEditingDish(false)
  }

  if (!dataset || !restaurant) return <div className="menu-page">{t('common.loading')}</div>

  return (
    <div className="menu-page">
      <header className="menu-header">
        <h1 className="menu-title">{t('menu.title')}</h1>
        {!isEditingDish && (
          <button className="menu-add-btn" onClick={handleOpenNewDish}>
            <span className="menu-add-plus">+</span>
            <span>{t('menu.addDish')}</span>
          </button>
        )}
      </header>

      {feedback && (
        <div className={`menu-feedback menu-feedback--${feedback.type}`}>{feedback.message}</div>
      )}

      {/* ===================== VUE PLATS ===================== */}
      {isEditingDish ? (
        <form className="menu-form" onSubmit={handleSubmitDish}>
          <h2 className="menu-section-title">
            {dishForm.id ? t('common.edit') : t('menu.addDish')}
          </h2>

          <div className="form-row">
            <label>{t('menu.dish.name')}</label>
            <input type="text" required value={dishForm.name} onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })} />
          </div>

          <div className="form-row">
            <label>{t('menu.dish.category')}</label>
            <select value={dishForm.category} onChange={(e) => setDishForm({ ...dishForm, category: e.target.value })}>
              {MENU_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_EMOJI[cat]} {t(`menu.sections.${cat}`)}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>{t('menu.dish.subcategory')}</label>
            <input type="text" value={dishForm.subcategory} onChange={(e) => setDishForm({ ...dishForm, subcategory: e.target.value })} />
          </div>

          <div className="form-row">
            <label>{t('menu.dish.price')}</label>
            <input type="number" min="0" step="1000" required value={dishForm.price} onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })} />
          </div>

          <div className="form-row form-row--checkbox">
            <label>
              <input type="checkbox" checked={dishForm.active} onChange={(e) => setDishForm({ ...dishForm, active: e.target.checked })} />
              {t('menu.dish.active')}
            </label>
          </div>

          <div className="menu-recipe-builder">
            <h3>{t('menu.recipe.title')}</h3>
            <div className="recipe-list">
              {dishForm.recipe.map((item, index) => {
                const ing = ingredients.find((i) => i.id === item.ingredient_id)
                return (
                  <div key={index} className="recipe-item">
                    <select required value={item.ingredient_id} onChange={(e) => updateRecipeItem(index, 'ingredient_id', e.target.value)}>
                      <option value="">{t('menu.recipe.selectIngredient')}</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>{i.name} ({formatCurrency(i.unit_cost)}/{i.unit})</option>
                      ))}
                    </select>
                    <div className="recipe-qty">
                      <input type="number" min="0" step="1" required value={item.quantity} onChange={(e) => updateRecipeItem(index, 'quantity', e.target.value)} />
                      <span>{ing ? ing.unit : ''}</span>
                    </div>
                    <button type="button" className="btn btn-ghost btn-danger" onClick={() => removeRecipeItem(index)}>✕</button>
                  </div>
                )
              })}
            </div>
            <button type="button" className="btn btn-secondary" onClick={addRecipeItem}>+ {t('menu.recipe.addIngredient')}</button>
            <div className="recipe-total">
              <span>{t('menu.recipe.totalCost')} :</span>
              <strong>{formatCurrency(currentFormFoodCost)}</strong>
            </div>
          </div>

          <div className="menu-form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsEditingDish(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">{t('common.save')}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="menu-categories">
            {MENU_CATEGORIES.map((cat) => (
              <button key={cat} className={`category-pill ${activeCategory === cat ? 'category-pill--active' : ''}`} onClick={() => setActiveCategory(cat)}>
                <span className="category-pill__emoji">{CATEGORY_EMOJI[cat]}</span>
                <span className="category-pill__label">{t(`menu.sections.${cat}`)}</span>
                <span className="category-pill__count">{categoryCounts[cat]}</span>
              </button>
            ))}
          </div>

          <div className="menu-list">
            {filteredDishes.length === 0 ? (
              <div className="menu-empty-card">
                <div className="menu-empty-emoji">{CATEGORY_EMOJI[activeCategory]}</div>
                <p className="menu-empty">{t('menu.empty')}</p>
              </div>
            ) : (
              filteredDishes.map((dish) => {
                const fc = getDishFoodCost(dish, ingredients)
                const margin = getDishMargin(dish, ingredients)
                const marginPct = getDishMarginPercent(dish, ingredients)
                return (
                  <article key={dish.id} className={`dish-card ${!dish.active ? 'dish-card--inactive' : ''}`}>
                    <div className="dish-card__header">
                      <div className="dish-card__title-block">
                        <span className="dish-card__emoji">{CATEGORY_EMOJI[dish.category] || '🍽️'}</span>
                        <div>
                          <h3 className="dish-card__name">{dish.name}</h3>
                          {dish.subcategory && <span className="dish-card__subcategory">{dish.subcategory}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="dish-card__stats">
                      <div className="dish-stat">
                        <span className="dish-stat__label">{t('menu.dish.price')}</span>
                        <strong className="dish-stat__value dish-stat__value--price">{formatCurrency(dish.price)}</strong>
                      </div>
                      <div className="dish-stat">
                        <span className="dish-stat__label">{t('menu.dish.foodCost')}</span>
                        <strong className="dish-stat__value dish-stat__value--cost">{formatCurrency(fc)}</strong>
                      </div>
                      <div className="dish-stat">
                        <span className="dish-stat__label">{t('menu.dish.margin')}</span>
                        <strong className={`dish-stat__value ${marginPct >= 60 ? 'dish-stat__value--good' : 'dish-stat__value--warn'}`}>
                          {formatCurrency(margin)}<small> ({marginPct.toFixed(0)}%)</small>
                        </strong>
                      </div>
                    </div>

                    <div className="dish-card__actions">
                      <button className="btn-action btn-action--edit" onClick={() => handleOpenEditDish(dish)} title={t('common.edit')}>✏️ {t('common.edit')}</button>
                      <button className="btn-action btn-action--delete" onClick={() => handleDeleteDish(dish.id)} title={t('common.delete')}>🗑️ {t('common.delete')}</button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}