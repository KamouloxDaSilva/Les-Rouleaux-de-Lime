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

  next.schema_version = SCHEMA_VERSION;
  return next;
}

export function loadDataset() {
  const storage = getStorage();
  if (!storage) return createEmptyDataset();

  let raw = null;

  // 1) Version courante (v5)
  try { raw = storage.getItem(STORAGE_KEY); } catch (e) { return createEmptyDataset(); }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.planning) parsed.planning = [];
      const { ok } = validateDataset(parsed);
      if (ok) return parsed;
    } catch (e) { /* corrupted → continue */ }
    raw = null;
  }

  // 2) Migration depuis v4
  try { raw = storage.getItem('rdl.dataset.v4'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const migrated = migrateFromV4(parsed);
      if (!migrated.planning) migrated.planning = [];
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (e) {}
      return migrated;
    } catch (e) { raw = null; }
  }

  // 3) Migration depuis v3
  try { raw = storage.getItem('rdl.dataset.v3'); } catch (e) { raw = null; }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.planning) parsed.planning = [];
      return migrateFromV4(parsed);
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
  if (!parsed.planning) parsed.planning = [];
  // Applique la même migration si l'utilisateur importe un vieux fichier
  const migrated = migrateFromV4(parsed);
  const { ok, errors } = validateDataset(migrated);
  if (!ok) return { ok: false, errors };
  return { ok: true, dataset: migrated };
}