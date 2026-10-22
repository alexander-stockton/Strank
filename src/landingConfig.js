/**
 * Feature 15 — Landing Layout & Day Focus
 * Landing-only settings live in landing-config.txt (not config.txt).
 * Spec: features/feature-15-Landing-Layout-Day-Focus.md
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');

function resolveLandingConfigPath(options = {}) {
  if (options.filePath) return options.filePath;
  if (typeof paths.landingConfigTxtPath === 'function') return paths.landingConfigTxtPath();
  return path.join(paths.getDataDir(), 'landing-config.txt');
}

let cached = null;

function defaults() {
  return {
    'landing expectations visible': true,
    'landing next rank visible': true,
    'landing get started visible': true,
    'landing skill progress visible': true,
    'landing component order': 'today-expectations,next-rank,skill-progress',
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

function writeDefaultsFile(filePath) {
  const d = defaults();
  const header = [
    '# ---------------------------------------------------- STRANK LANDING CONFIG (Feature 15) ----------------------------------------',
    '# Possible values:',
    '#   landing expectations visible: true, false',
    '#   landing next rank visible: true, false',
    '#   landing get started visible: true, false',
    '#   landing skill progress visible: true, false',
    '#   landing component order: comma-separated ids (today-expectations, next-rank, skill-progress, get-started)',
    '#   focus arms days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus core days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus lungs days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus legs days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '# --------------------------------------------------------------------------------------------------------------------------------',
    '',
  ].join('\n');
  const body = Object.entries(d)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(filePath, `${header}${body}\n`, 'utf8');
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
    cached = parsed.data;
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

function isLandingPanelVisible(key) {
  const s = get();
  const v = s[key];
  if (v === false || v === 'false') return false;
  return true;
}

function serializeSettings(settings) {
  const d = defaults();
  const keys = Object.keys(d);
  const header = [
    '# ---------------------------------------------------- STRANK LANDING CONFIG (Feature 15) ----------------------------------------',
    '# Possible values:',
    '#   landing expectations visible: true, false',
    '#   landing next rank visible: true, false',
    '#   landing get started visible: true, false',
    '#   landing skill progress visible: true, false',
    '#   landing component order: comma-separated ids (today-expectations, next-rank, skill-progress, get-started)',
    '#   focus arms days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus core days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus lungs days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '#   focus legs days: comma-separated weekdays (mon, tue, wed, thu, fri, sat, sun)',
    '# --------------------------------------------------------------------------------------------------------------------------------',
    '',
  ].join('\n');
  const body = keys.map((k) => `${k}: ${settings[k] != null ? settings[k] : d[k]}`).join('\n');
  return `${header}${body}\n`;
}

function update(patch, options = {}) {
  if (!cached) load(options);
  const next = { ...cached };
  for (const [k, v] of Object.entries(patch || {})) {
    const key = String(k)
      .trim()
      .toLowerCase();
    if (!key) continue;
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
  isLandingPanelVisible,
  clearLandingConfigCache,
};
