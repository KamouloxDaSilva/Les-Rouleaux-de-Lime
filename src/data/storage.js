// src/data/storage.js
import { SCHEMA_VERSION, createEmptyDataset, validateDataset, MENU_CATEGORIES } from './model.js';

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

// Migration v4 → v5 : anciens plats (category = texte libre type "Gỏi cuốn")
// deviennent section "dish" + subcategory = ancien libellé.
// Les ingrédients n'avaient pas de catégorie → "dish" par défaut.
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

// Migration v5 → v6 : ajout de "days_per_week" pour les employés
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

// Migration v6 → v7 : Chantier 12 (Refonte Gestion)
// Ajout des collections suppliers, expenses, promotions
// Ajout des champs sort_order, stock_quantity, min_stock, supplier_id
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

/**
 * Réassigne des sort_order séquentiels (0, 1, 2, …) à une collection triable.
 * Conserve l'ordre courant basé sur les sort_order existants puis sur l'index.
 * Résout le bug historique où tous les sort_order étaient `0` (swap → no-op).
 */
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

// Migration v7 → v8 : Chantier 12 — Fixes UI
// Ajout de la collection `tasks` (Planning avec 3 types)
// Renumérotation des sort_order (fix boutons ↑ / ↓)
function migrateFromV7(dataset) {
  if (!dataset || typeof dataset !== 'object') return dataset;
  const next = { ...dataset };

  next.tasks = Array.isArray(next.tasks) ? next.tasks : [];

  // Fix tri : on renumérote proprement toutes les collections triables
  next.employees = resequenceSortOrders(next.employees || []);
  next.fixed_costs = resequenceSortOrders(next.fixed_costs || []);
  next.ingredients = resequenceSortOrders(next.ingredients || []);
  next.suppliers = resequenceSortOrders(next.suppliers || []);
  next.planning = resequenceSortOrders(next.planning || []);
  next.tasks = resequenceSortOrders(next.tasks);

  next.schema_version = 8;
  return next;
}

export function loadDataset() {
  const storage = getStorage();
  if (!storage) return createEmptyDataset();

  let raw = null;

  // 1) Version courante (v8)
  try { raw = storage.getItem(STORAGE_KEY); } catch (e) { return createEmptyDataset(); }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.planning) parsed.planning = [];
      if (!parsed.suppliers) parsed.suppliers = [];
      if (!parsed.expenses) parsed.expenses = [];
      if (!parsed.promotions) parsed.promotions = [];
      if (!parsed.tasks) parsed.tasks = [];

      const { ok } = validateDataset(parsed);
      if (ok) return parsed;
    } catch (e) { /* corrupted → continue */ }
    raw = null;
  }

  // 2) Migration depuis v7
  try { raw = storage.getItem('rdl.dataset.v7'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV7(parsed);
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 3) Migration depuis v6
  try { raw = storage.getItem('rdl.dataset.v6'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV7(migrateFromV6(parsed));
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 4) Migration depuis v5
  try { raw = storage.getItem('rdl.dataset.v5'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV7(migrateFromV6(migrateFromV5(parsed)));
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 5) Migration depuis v4
  try { raw = storage.getItem('rdl.dataset.v4'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV7(migrateFromV6(migrateFromV5(migrateFromV4(parsed))));
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 6) Migration depuis v3
  try { raw = storage.getItem('rdl.dataset.v3'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV7(migrateFromV6(migrateFromV5(migrateFromV4(parsed))));
      if (!migrated.planning) migrated.planning = [];
      if (!migrated.tasks) migrated.tasks = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { return createEmptyDataset(); }
  }

  return createEmptyDataset();
}

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
  if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['contenu vide'] };
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON invalide'] }; }

  // Chaîne de migration selon la version d'origine du fichier importé
  const v = Number(parsed?.schema_version) || 0;
  let migrated = parsed;
  if (v < 5) migrated = migrateFromV4(migrated);
  if (v < 6) migrated = migrateFromV5(migrated);
  if (v < 7) migrated = migrateFromV6(migrated);
  if (v < 8) migrated = migrateFromV7(migrated);

  if (!migrated.planning) migrated.planning = [];
  if (!migrated.suppliers) migrated.suppliers = [];
  if (!migrated.expenses) migrated.expenses = [];
  if (!migrated.promotions) migrated.promotions = [];
  if (!migrated.tasks) migrated.tasks = [];

  const { ok, errors } = validateDataset(migrated);
  if (!ok) return { ok: false, errors };
  return { ok: true, dataset: migrated };
}