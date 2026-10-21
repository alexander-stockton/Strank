/**
 * Feature 14 — Landing Day Focus
 * Landing-only settings live in landing-config.txt (not config.txt).
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const i18n = require('./i18n');

function resolveLandingConfigPath(options = {}) {
  if (options.filePath) return options.filePath;
  if (typeof paths.landingConfigTxtPath === 'function') return paths.landingConfigTxtPath();
  return path.join(paths.getDataDir(), 'landing-config.txt');
}

let cached = null;

function defaults() {
  return {
    'focus arms days': 'mon,thu',
    'focus core days': 'tue,fri',
    'focus lungs days': 'mon,wed,fri',
    'focus legs days': 'wed,sat',
  };
}

function coerceValue(raw) {
  const v = String(raw == null ? '' : raw).trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function parseLandingConfigText(text) {
  const settings = { ...defaults() };
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(': ');
    if (idx === -1) {
      const colon = trimmed.indexOf(':');
      if (colon === -1) {
        return { ok: false, message: 'Failed to load landing config.' };
      }
      const name = trimmed.slice(0, colon).trim().toLowerCase();
      const value = coerceValue(trimmed.slice(colon + 1));
      if (!name) return { ok: false, message: 'Failed to load landing config.' };
      settings[name] = value;
      continue;
    }
    const name = trimmed.slice(0, idx).trim().toLowerCase();
    const value = coerceValue(trimmed.slice(idx + 2));
    if (!name) return { ok: false, message: 'Failed to load landing config.' };
    settings[name] = value;
  }
  return { ok: true, data: settings };
}

function configHeader() {
  if (i18n.getLanguage() !== i18n.DEFAULT_LANGUAGE) {
    const localized = i18n.languageFileHeader('landing-config.default');
    if (localized) return localized;
  }
  return [
    '# ---------------------------------------------------- STRANK LANDING CONFIG (Feature 14) ----------------------------------------',
    '# Possible values:',
    '#   focus arms days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus core days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus lungs days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus legs days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '# --------------------------------------------------------------------------------------------------------------------------------',
    '',
  ].join('\n');
}

function writeDefaultsFile(filePath) {
  const d = defaults();
  const body = Object.entries(d)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(filePath, `${configHeader()}${body}\n`, 'utf8');
}

function load(options = {}) {
  const filePath = resolveLandingConfigPath(options);
  try {
    if (!fs.existsSync(filePath)) {
      writeDefaultsFile(filePath);
      cached = defaults();
      return { ok: true, data: cached, resetToDefaults: true };
    }
    const text = fs.readFileSync(filePath, 'utf8');
    if (!String(text).trim()) {
      writeDefaultsFile(filePath);
      cached = defaults();
      return { ok: true, data: cached, resetToDefaults: true };
    }
    const parsed = parseLandingConfigText(text);
    if (!parsed.ok) {
      writeDefaultsFile(filePath);
      cached = defaults();
      return { ok: true, data: cached, resetToDefaults: true };
    }
    // Keep only known day-focus keys; drop canceled layout/visibility leftovers.
    const d = defaults();
    const next = { ...d };
    for (const key of Object.keys(d)) {
      if (parsed.data[key] != null) next[key] = parsed.data[key];
    }
    cached = next;
    return { ok: true, data: cached };
  } catch (_) {
    try {
      writeDefaultsFile(filePath);
    } catch (__) {
      /* ignore */
    }
    cached = defaults();
    return { ok: true, data: cached, resetToDefaults: true };
  }
}

function get() {
  if (!cached) load();
  return { ...cached };
}

function serializeSettings(settings) {
  const d = defaults();
  const keys = Object.keys(d);
  const body = keys.map((k) => `${k}: ${settings[k] != null ? settings[k] : d[k]}`).join('\n');
  return `${configHeader()}${body}\n`;
}

function update(patch, options = {}) {
  if (!cached) load(options);
  const next = { ...cached };
  const known = new Set(Object.keys(defaults()));
  for (const [k, v] of Object.entries(patch || {})) {
    const key = String(k)
      .trim()
      .toLowerCase();
    if (!key || !known.has(key)) continue;
    next[key] = v;
  }
  cached = next;
  fs.writeFileSync(resolveLandingConfigPath(options), serializeSettings(cached), 'utf8');
  return { ok: true, data: get() };
}

function set(optionName, value, options = {}) {
  const key = String(optionName || '')
    .trim()
    .toLowerCase();
  if (!key) return { ok: false, message: 'Invalid option name.' };
  return update({ [key]: value }, options);
}

function clearLandingConfigCache() {
  cached = null;
}

module.exports = {
  defaults,
  parseLandingConfigText,
  load,
  get,
  set,
  update,
  clearLandingConfigCache,
};
