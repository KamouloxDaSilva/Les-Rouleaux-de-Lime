// src/pages/MenuPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { getActiveRestaurant, createDish, createIngredient } from '../data/model.js'
import { loadDataset, saveDataset } from '../data/storage.js'
import { createDefaultFixtures } from '../data/fixtures.js'
import { getDishFoodCost, getDishMargin, getDishMarginPercent } from '../data/calculations.js'
import './MenuPage.css'

const EMPTY_DISH = {
  id: null, name: '', category: '', price: '', active: true, recipe: [],
}
const EMPTY_ING = {
  id: null, name: '', unit: 'g', unit_cost: '', supplier: '',
}

export default function MenuPage() {
  const { t, formatCurrency } = useI18n()
  const [dataset, setDataset] = useState(null)
  const [activeTab, setActiveTab] = useState('dishes') // 'dishes' | 'ingredients'
  
  // États pour l'édition
  const [isEditingDish, setIsEditingDish] = useState(false)
  const [dishForm, setDishForm] = useState(EMPTY_DISH)
  
  const [isEditingIng, setIsEditingIng] = useState(false)
  const [ingForm, setIngForm] = useState(EMPTY_ING)

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

  // ================= GESTION DES PLATS =================

  const currentFormFoodCost = useMemo(() => {
    return getDishFoodCost({ recipe: dishForm.recipe, price: Number(dishForm.price) || 0 }, ingredients)
  }, [dishForm.recipe, dishForm.price, ingredients])

  function handleOpenNewDish() {
    setDishForm(EMPTY_DISH)
    setIsEditingDish(true)
    setFeedback(null)
  }

  function handleOpenEditDish(dish) {
    setDishForm({
      ...dish,
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
          ? { ...d, name: dishForm.name, category: dishForm.category, price, active: dishForm.active, recipe: cleanRecipe, updatedAt: new Date().toISOString() }
          : d
      )
      commit({ ...dataset, dishes: nextDishes })
    } else {
      const newDish = createDish({
        restaurant_id: restaurant.id, name: dishForm.name, category: dishForm.category,
        price, active: dishForm.active, recipe: cleanRecipe,
      })
      commit({ ...dataset, dishes: [...dishes, newDish] })
    }
    setIsEditingDish(false)
  }

  // ================= GESTION DES INGRÉDIENTS =================

  function handleOpenNewIng() {
    setIngForm(EMPTY_ING)
    setIsEditingIng(true)
    setFeedback(null)
  }

  function handleOpenEditIng(ing) {
    setIngForm({ ...ing, unit_cost: String(ing.unit_cost) })
    setIsEditingIng(true)
    setFeedback(null)
  }

  function handleDeleteIng(id) {
    if (!window.confirm(t('menu.ingredients.confirmDelete'))) return
    commit({ ...dataset, ingredients: ingredients.filter((i) => i.id !== id) })
  }

  function handleSubmitIng(e) {
    e.preventDefault()
    if (!restaurant) return
    const cost = Number(ingForm.unit_cost)
    if (!ingForm.name.trim() || !ingForm.unit.trim() || !Number.isFinite(cost) || cost < 0) return

    if (ingForm.id) {
      const nextIngs = ingredients.map((i) =>
        i.id === ingForm.id
          ? { ...i, name: ingForm.name, unit: ingForm.unit, unit_cost: cost, supplier: ingForm.supplier, updatedAt: new Date().toISOString() }
          : i
      )
      commit({ ...dataset, ingredients: nextIngs })
    } else {
      const newIng = createIngredient({
        restaurant_id: restaurant.id, name: ingForm.name, unit: ingForm.unit, unit_cost: cost, supplier: ingForm.supplier,
      })
      commit({ ...dataset, ingredients: [...ingredients, newIng] })
    }
    setIsEditingIng(false)
  }

  if (!dataset || !restaurant) return <div className="menu-page">{t('common.loading')}</div>

  return (
    <div className="menu-page">
      <div className="menu-header">
        <h1 className="menu-title">{t('menu.title')}</h1>
        {!isEditingDish && !isEditingIng && (
          <button 
            className="btn btn-primary" 
            onClick={activeTab === 'dishes' ? handleOpenNewDish : handleOpenNewIng}
          >
            + {activeTab === 'dishes' ? t('menu.addDish') : t('menu.ingredients.add')}
          </button>
        )}
      </div>

      {feedback && (
        <div className={`menu-feedback menu-feedback--${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Sélecteur d'onglet (masqué si on édite) */}
      {!isEditingDish && !isEditingIng && (
        <div className="menu-tabs">
          <button 
            className={`menu-tab ${activeTab === 'dishes' ? 'menu-tab--active' : ''}`}
            onClick={() => setActiveTab('dishes')}
          >
            {t('menu.tabs.dishes')}
          </button>
          <button 
            className={`menu-tab ${activeTab === 'ingredients' ? 'menu-tab--active' : ''}`}
            onClick={() => setActiveTab('ingredients')}
          >
            {t('menu.tabs.ingredients')}
          </button>
        </div>
      )}

      {/* ================= VUE : PLATS ================= */}
      {activeTab === 'dishes' && (
        isEditingDish ? (
          <form className="menu-form" onSubmit={handleSubmitDish}>
            <h2 className="menu-section-title">{dishForm.id ? t('common.edit') : t('menu.addDish')}</h2>
            <div className="form-row">
              <label>{t('menu.dish.name')}</label>
              <input type="text" required value={dishForm.name} onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>{t('menu.dish.category')}</label>
              <input type="text" value={dishForm.category} onChange={(e) => setDishForm({ ...dishForm, category: e.target.value })} />
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
              <button type="button" className="btn btn-secondary" onClick={addRecipeItem}>
                + {t('menu.recipe.addIngredient')}
              </button>
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
          <div className="menu-list">
            {dishes.length === 0 ? (
              <p className="menu-empty">{t('menu.empty')}</p>
            ) : (
              dishes.map((dish) => {
                const fc = getDishFoodCost(dish, ingredients)
                const margin = getDishMargin(dish, ingredients)
                const marginPct = getDishMarginPercent(dish, ingredients)
                return (
                  <div key={dish.id} className={`menu-card ${!dish.active ? 'menu-card--inactive' : ''}`}>
                    <div className="menu-card-header">
                      <div>
                        <h3>{dish.name}</h3>
                        <span className="menu-card-category">{dish.category || '—'}</span>
                      </div>
                      <div className="menu-card-actions">
                        <button className="btn btn-ghost" onClick={() => handleOpenEditDish(dish)}>{t('common.edit')}</button>
                        <button className="btn btn-ghost btn-danger" onClick={() => handleDeleteDish(dish.id)}>{t('common.delete')}</button>
                      </div>
                    </div>
                    <div className="menu-card-stats">
                      <div className="stat"><span>{t('menu.dish.price')}</span><strong>{formatCurrency(dish.price)}</strong></div>
                      <div className="stat"><span>{t('menu.dish.foodCost')}</span><strong>{formatCurrency(fc)}</strong></div>
                      <div className="stat">
                        <span>{t('menu.dish.margin')}</span>
                        <strong className={marginPct >= 60 ? 'text-success' : 'text-warning'}>
                          {formatCurrency(margin)} ({marginPct.toFixed(0)}%)
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )
      )}

      {/* ================= VUE : INGRÉDIENTS ================= */}
      {activeTab === 'ingredients' && (
        isEditingIng ? (
          <form className="menu-form" onSubmit={handleSubmitIng}>
            <h2 className="menu-section-title">{ingForm.id ? t('common.edit') : t('menu.ingredients.add')}</h2>
            <div className="form-row">
              <label>{t('menu.ingredients.name')}</label>
              <input type="text" required value={ingForm.name} onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>{t('menu.ingredients.unit')}</label>
              <input type="text" required placeholder="g, kg, ml, cái..." value={ingForm.unit} onChange={(e) => setIngForm({ ...ingForm, unit: e.target.value })} />
            </div>
            <div className="form-row">
              <label>{t('menu.ingredients.unitCost')}</label>
              <input type="number" min="0" step="1" required value={ingForm.unit_cost} onChange={(e) => setIngForm({ ...ingForm, unit_cost: e.target.value })} />
            </div>
            <div className="form-row">
              <label>{t('menu.ingredients.supplier')}</label>
              <input type="text" value={ingForm.supplier} onChange={(e) => setIngForm({ ...ingForm, supplier: e.target.value })} />
            </div>
            <div className="menu-form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setIsEditingIng(false)}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary">{t('common.save')}</button>
            </div>
          </form>
        ) : (
          <div className="menu-list">
            {ingredients.length === 0 ? (
              <p className="menu-empty">{t('menu.ingredients.empty')}</p>
            ) : (
              ingredients.map((ing) => (
                <div key={ing.id} className="ingredient-card">
                  <div className="ingredient-main">
                    <h3>{ing.name}</h3>
                    <span className="ingredient-meta">
                      {formatCurrency(ing.unit_cost)} / {ing.unit}
                      {ing.supplier && ` · ${ing.supplier}`}
                    </span>
                  </div>
                  <div className="menu-card-actions">
                    <button className="btn btn-ghost" onClick={() => handleOpenEditIng(ing)}>{t('common.edit')}</button>
                    <button className="btn btn-ghost btn-danger" onClick={() => handleDeleteIng(ing.id)}>{t('common.delete')}</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )
      )}
    </div>
  )
}