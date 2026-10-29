// src/data/storage.js
import { SCHEMA_VERSION, createEmptyDataset, validateDataset } from './model.js';
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

export function loadDataset() {
  const storage = getStorage();
  if (!storage) return createEmptyDataset();
  let raw = null;
  try { raw = storage.getItem(STORAGE_KEY); } catch (e) { return createEmptyDataset(); }
  if (!raw) return createEmptyDataset();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { return createEmptyDataset(); }
  const { ok, errors } = validateDataset(parsed);
  if (!ok) return createEmptyDataset();
  return parsed;
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
  return { filename: `rouleaux-de-lime-${date}.json`, content: JSON.stringify(data, null, 2) };
}

export function importDatasetFromJSON(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['contenu vide'] };
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON invalide'] }; }
  const { ok, errors } = validateDataset(parsed);
  if (!ok) return { ok: false, errors };
  return { ok: true, dataset: parsed };
}