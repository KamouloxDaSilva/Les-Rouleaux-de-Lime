// audit-i18n.mjs — à exécuter localement : node audit-i18n.mjs
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.cwd();
const I18N_DIR = path.join(ROOT, 'src', 'i18n');
const SRC_DIR = path.join(ROOT, 'src');

async function load(file) {
  const mod = await import(pathToFileURL(path.join(I18N_DIR, file)).href);
  return mod.default;
}

const vi = await load('vi.js');
const fr = await load('fr.js');
const en = await load('en.js');

function flatten(obj, prefix = '') {
  const keys = [];
  for (const k of Object.keys(obj || {})) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      keys.push(...flatten(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

const setVi = new Set(flatten(vi));
const setFr = new Set(flatten(fr));
const setEn = new Set(flatten(en));

const missing = {
  fr: [...setVi].filter((k) => !setFr.has(k)),
  en: [...setVi].filter((k) => !setEn.has(k)),
  vi_from_fr: [...setFr].filter((k) => !setVi.has(k)),
};

const used = new Set();
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (f.endsWith('.jsx') || f.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.matchAll(/t\(['"`]([^'"`]+)['"`]/g);
      for (const m of matches) used.add(m[1]);
    }
  }
}
walk(SRC_DIR);

const unknown = [...used].filter((k) => !setVi.has(k));

console.log('=== Clés manquantes ===');
console.log(JSON.stringify(missing, null, 2));
console.log('=== Clés utilisées mais inexistantes ===');
console.log(unknown);
console.log(`\nRésumé : fr manque ${missing.fr.length}, en manque ${missing.en.length}, vi manque ${missing.vi_from_fr.length}, inconnues ${unknown.length}`);