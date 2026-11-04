// src/utils/theme.js
// Chantier 32-A — Résolution et application du thème (mode sombre)
// Valeurs supportées : 'light' | 'dark' | 'system' (défaut).
// Persistance : localStorage.rdl.theme
export const THEME_STORAGE_KEY = 'rdl.theme';
export const THEME_VALUES = ['light', 'dark', 'system'];

export function readTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEME_VALUES.includes(v)) return v;
  } catch (e) { /* ignore */ }
  return 'system';
}

export function writeTheme(value) {
  if (!THEME_VALUES.includes(value)) return;
  try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch (e) { /* ignore */ }
}

export function resolveTheme(value) {
  if (value === 'dark') return 'dark';
  if (value === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function applyThemeClass(value) {
  if (typeof document === 'undefined' || !document.body) return;
  const resolved = resolveTheme(value);
  document.body.classList.toggle('theme-dark', resolved === 'dark');
}

export function hapticPulse(ms = 8) {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
}