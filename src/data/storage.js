// src/data/storage.js
import {
  SCHEMA_VERSION,
  createEmptyDataset,
  createIngredient,
  validateDataset,
  MENU_CATEGORIES,
} from './model.js';

export const STORAGE_KEY = `rdl.dataset.v${SCHEMA_VERSION}`;

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__rdl_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers de migration
// ─────────────────────────────────────────────────────────────────────

/**
 * Retourne le facteur de conversion `unit` → `base_unit` d'un ingrédient.
 * Utilisé pour convertir `recipe[].quantity` (v8, exprimée dans l'unité
 * libre de l'ingrédient) vers `recipe[].quantity_in_base` (v9).
 * Si l'ingrédient est inconnu ou l'unité non convertible, facteur = 1.
 */
function getUnitToBaseFactor(ingredient) {
  if (!ingredient) return 1;
  const unit = String(ingredient.unit || '').trim().toLowerCase();
  const baseUnit = ingredient.base_unit;
  if (baseUnit === 'g') {
    if (unit === 'kg') return 1000;
    if (unit === 't') return 1000000;
    return 1;
  }
  if (baseUnit === 'ml') {
    if (unit === 'l' || unit === 'lit' || unit === 'lít') return 1000;
    if (unit === 'cl') return 10;
    return 1;
  }
  return 1; // piece et unités inconnues
}

// ─────────────────────────────────────────────────────────────────────
// Migrations v4 → v9
// ─────────────────────────────────────────────────────────────────────

// v4 → v5 : anciens plats (category texte libre) → section 'dish' + subcategory
function migrateFromV4(dataset) {
  if (!dataset || typeof dataset !== 'object') return dataset;
  const next = { ...dataset };

  next.dishes = (next.dishes || []).map((d) => {
    if (!d || typeof d !== 'object') return d;
    if (MENU_CATEGORIES.includes(d.category)) return d;
    return {
      ...d,
      category: 'dish',
      subcategory: d.subcategory || d.category || '',
    };
  });

  next.ingredients = (next.ingredients || []).map((i) => {
    if (!i || typeof i !== 'object') return i;
    return {
      ...i,
      category: MENU_CATEGORIES.includes(i.category) ? i.category : 'dish',
    };
  });

  next.schema_version = 5;
  return next;
}

// v5 → v6 : ajout days_per_week employés
function migrateFromV5(dataset) {
  if (!dataset || typeof dataset !== 'object') return dataset;
  const next = { ...dataset };

  next.employees = (next.employees || []).map(emp => {
    if (!emp || typeof emp !== 'object') return emp;
    return {
      ...emp,
      days_per_week: Number.isFinite(emp.days_per_week) ? emp.days_per_week : 5,
    };
  });

  next.schema_version = 6;
  return next;
}

// v6 → v7 : collections suppliers / expenses / promotions + sort_order
function migrateFromV6(dataset) {
  if (!dataset || typeof dataset !== 'object') return dataset;
  const next = { ...dataset };

  next.suppliers = next.suppliers || [];
  next.expenses = next.expenses || [];
  next.promotions = next.promotions || [];

  next.ingredients = (next.ingredients || []).map(ing => {
    if (!ing || typeof ing !== 'object') return ing;
    return {
      ...ing,
      stock_quantity: Number.isFinite(ing.stock_quantity) ? ing.stock_quantity : 0,
      min_stock: Number.isFinite(ing.min_stock) ? ing.min_stock : 0,
      supplier_id: ing.supplier_id || '',
      sort_order: Number.isFinite(ing.sort_order) ? ing.sort_order : 0,
    };
  });

  next.employees = (next.employees || []).map(emp => {
    if (!emp || typeof emp !== 'object') return emp;
    return {
      ...emp,
      sort_order: Number.isFinite(emp.sort_order) ? emp.sort_order : 0,
    };
  });

  next.fixed_costs = (next.fixed_costs || []).map(cost => {
    if (!cost || typeof cost !== 'object') return cost;
    return {
      ...cost,
      sort_order: Number.isFinite(cost.sort_order) ? cost.sort_order : 0,
    };
  });

  next.schema_version = 7;
  return next;
}

/** Réassigne sort_order séquentiellement (fix historique tous à 0). */
function resequenceSortOrders(items) {
  if (!Array.isArray(items)) return [];
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const so = Number(a.item?.sort_order) || 0;
      const sb = Number(b.item?.sort_order) || 0;
      if (so !== sb) return so - sb;
      return a.index - b.index;
    })
    .map(({ item }, idx) => ({ ...item, sort_order: idx }));
}

// v7 → v8 : collection tasks + renumérotation sort_order
function migrateFromV7(dataset) {
  if (!dataset || typeof dataset !== 'object') return dataset;
  const next = { ...dataset };

  next.tasks = Array.isArray(next.tasks) ? next.tasks : [];

  next.employees = resequenceSortOrders(next.employees || []);
  next.fixed_costs = resequenceSortOrders(next.fixed_costs || []);
  next.ingredients = resequenceSortOrders(next.ingredients || []);
  next.suppliers = resequenceSortOrders(next.suppliers || []);
  next.planning = resequenceSortOrders(next.planning || []);
  next.tasks = resequenceSortOrders(next.tasks);

  next.schema_version = 8;
  return next;
}

/**
 * v8 → v9 — Chantier 14
 * - Ajoute les collections v9 : supplier_offers, formulas, purchase_receipts
 * - Complète chaque ingredient avec tous les champs v9 (via createIngredient)
 * - Convertit chaque dish.recipe[].quantity → .quantity_in_base (en conservant quantity)
 * - Préserve TOUTES les données v8 existantes
 */
function migrateFromV8(dataset) {
  if (!dataset || typeof dataset !== 'object') return dataset;
  const next = { ...dataset };

  // 1) Collections v9 (vides si absentes)
  next.supplier_offers = Array.isArray(next.supplier_offers) ? next.supplier_offers : [];
  next.formulas = Array.isArray(next.formulas) ? next.formulas : [];
  next.purchase_receipts = Array.isArray(next.purchase_receipts) ? next.purchase_receipts : [];

  // 2) Enrichissement des ingrédients via createIngredient
  //    → dérive automatiquement base_unit (depuis unit) et reference_unit_cost
  //      (depuis unit_cost + unit), et complète les champs v9 manquants.
  const ingredients = (next.ingredients || []).map((ing) => {
    if (!ing || typeof ing !== 'object') return ing;
    return createIngredient(ing);
  });
  next.ingredients = ingredients;

  const ingMap = new Map(ingredients.filter(Boolean).map((i) => [i.id, i]));

  // 3) Conversion dish.recipe[].quantity → quantity_in_base
  //    On conserve quantity pour backward compat (calculations.js l'utilise encore).
  next.dishes = (next.dishes || []).map((dish) => {
    if (!dish || typeof dish !== 'object') return dish;
    if (!Array.isArray(dish.recipe)) return dish;
    return {
      ...dish,
      recipe: dish.recipe.map((item) => {
        if (!item || typeof item !== 'object') return item;
        // Si déjà migré (v9 partiel), on ne touche pas
        if (Number.isFinite(item.quantity_in_base)) return item;
        const ing = ingMap.get(item.ingredient_id);
        const factor = getUnitToBaseFactor(ing);
        const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
        return { ...item, quantity_in_base: qty * factor };
      }),
    };
  });

  next.schema_version = 9;
  return next;
}

// ─────────────────────────────────────────────────────────────────────
// loadDataset — cascade v9 → v8 → v7 → … → v3
// ─────────────────────────────────────────────────────────────────────

export function loadDataset() {
  const storage = getStorage();
  if (!storage) return createEmptyDataset();

  // 1) Version courante (v9)
  let raw = null;
  try { raw = storage.getItem(STORAGE_KEY); } catch (e) { return createEmptyDataset(); }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.planning) parsed.planning = [];
      if (!parsed.suppliers) parsed.suppliers = [];
      if (!parsed.expenses) parsed.expenses = [];
      if (!parsed.promotions) parsed.promotions = [];
      if (!parsed.tasks) parsed.tasks = [];
      if (!parsed.supplier_offers) parsed.supplier_offers = [];
      if (!parsed.formulas) parsed.formulas = [];
      if (!parsed.purchase_receipts) parsed.purchase_receipts = [];

      const { ok } = validateDataset(parsed);
      if (ok) return parsed;
    } catch (e) { /* corrupted → continue */ }
    raw = null;
  }

  // 2) Migration depuis v8 → v9
  try { raw = storage.getItem('rdl.dataset.v8'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV8(parsed);
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 3) v7 → V7 → V8
  try { raw = storage.getItem('rdl.dataset.v7'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV8(migrateFromV7(parsed));
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 4) v6 → V6 → V7 → V8
  try { raw = storage.getItem('rdl.dataset.v6'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV8(migrateFromV7(migrateFromV6(parsed)));
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 5) v5 → V5 → V6 → V7 → V8
  try { raw = storage.getItem('rdl.dataset.v5'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV8(migrateFromV7(migrateFromV6(migrateFromV5(parsed))));
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 6) v4 → V4 → V5 → V6 → V7 → V8
  try { raw = storage.getItem('rdl.dataset.v4'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV8(
        migrateFromV7(migrateFromV6(migrateFromV5(migrateFromV4(parsed))))
      );
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 7) v3 → V4 → V5 → V6 → V7 → V8
  try { raw = storage.getItem('rdl.dataset.v3'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV8(
        migrateFromV7(migrateFromV6(migrateFromV5(migrateFromV4(parsed))))
      );
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { return createEmptyDataset(); }
  }

  return createEmptyDataset();
}

// ─────────────────────────────────────────────────────────────────────
// save / reset / export / import
// ─────────────────────────────────────────────────────────────────────

export function saveDataset(dataset) {
  const { ok, errors } = validateDataset(dataset);
  if (!ok) throw new Error('Dataset invalide : ' + errors.join('; '));
  const storage = getStorage();
  if (!storage) throw new Error('localStorage indisponible');
  const payload = JSON.stringify({ ...dataset, schema_version: SCHEMA_VERSION });
  storage.setItem(STORAGE_KEY, payload);
}

export function resetDataset() {
  const fresh = createEmptyDataset();
  try { saveDataset(fresh); } catch (e) {}
  return fresh;
}

export function exportDatasetAsJSON(dataset) {
  const data = dataset || loadDataset();
  const date = new Date().toISOString().slice(0, 10);
  return { filename: `burihagio-${date}.json`, content: JSON.stringify(data, null, 2) };
}

export function importDatasetFromJSON(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, errors: ['contenu vide'] };
  }
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) {
    return { ok: false, errors: ['JSON invalide'] };
  }

  const v = Number(parsed?.schema_version) || 0;
  let migrated = parsed;
  if (v < 5) migrated = migrateFromV4(migrated);
  if (v < 6) migrated = migrateFromV5(migrated);
  if (v < 7) migrated = migrateFromV6(migrated);
  if (v < 8) migrated = migrateFromV7(migrated);
  if (v < 9) migrated = migrateFromV8(migrated);

  // Filet de sécurité (au cas où l'import v9 partiel manquerait une collection)
  if (!migrated.planning) migrated.planning = [];
  if (!migrated.suppliers) migrated.suppliers = [];
  if (!migrated.expenses) migrated.expenses = [];
  if (!migrated.promotions) migrated.promotions = [];
  if (!migrated.tasks) migrated.tasks = [];
  if (!migrated.supplier_offers) migrated.supplier_offers = [];
  if (!migrated.formulas) migrated.formulas = [];
  if (!migrated.purchase_receipts) migrated.purchase_receipts = [];

  const { ok, errors } = validateDataset(migrated);
  if (!ok) return { ok: false, errors };
  return { ok: true, dataset: migrated };
}