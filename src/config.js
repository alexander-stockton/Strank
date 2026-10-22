/**
 * Feature 11 - Config, Accessibility & Backup (global settings)
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 *
 * Landing day-focus options live in landing-config.txt (Feature 14 / landingConfig.js).
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const i18n = require('./i18n');

function resolveConfigPath(options = {}) {
  if (options.filePath) return options.filePath;
  if (typeof paths.configTxtPath === 'function') return paths.configTxtPath();
  return path.join(paths.getDataDir(), 'config.txt');
}

let cached = null;

const CONFIG_HEADER = [
  '# ---------------------------------------------------- STRANK CONFIG (global) ----------------------------------------------------',
  '# Possible values:',
  '#   language: en, zh-Hans, hi, es, ar, fr, de, pt, ru, ja',
  '#   font size: 8, 9, 10, … 24 (no decimals) - or small, medium, large',
  '#   accent color: #000000 -> #FFFFFF',
  '#   background color: #000000 -> #FFFFFF',
  '#   panel color: #000000 -> #FFFFFF',
  '#   text color: #000000 -> #FFFFFF',
  '#   muted color: #000000 -> #FFFFFF',
  '#   danger color: #000000 -> #FFFFFF',
  '#   ok color: #000000 -> #FFFFFF',
  '#   glow color: #000000 -> #FFFFFF',
  '#   alert color: #000000 -> #FFFFFF',
  '#   colorblind filter: none, protanopia, deuteranopia, tritanopia',
  '#   screen reader mode: true, false',
  '#   navbar alignment: left, top',
  '#   24hr: t, f  (t = 24-hour clock, f = 12-hour clock)',
  '#   notifications enabled: true, false',
  '#   completion sounds enabled: true, false',
  '#   logging: true, false',
  '#   fullscreen: true, false',
  '#   data directory: (empty = ./data) absolute path to ranks/format/badges root',
  '#   store path: (empty = [data directory]/store.json) absolute path to store.json',
  '#   weight units: lbs, kgs, st',
  '#   distance units: mi, km, m, yd, ft, in',
  '#   onboarding completed: true, false',
  '#   tour completed: true, false',
  '#   tour stored step id: (empty = none)',
  '#   animation workout start: true, false',
  '#   animation click ripple: true, false',
  '#   animation view slides: true, false',
  '#   animation content reveal: true, false',
  '#   animation flyout fade: true, false',
  '#   animation elevated buttons: true, false',
  '#   animation outline buttons: true, false',
  '#   animation accordions: true, false',
  '#   animation smooth card scroll: true, false',
  '# --------------------------------------------------------------------------------------------------------------------------------',
  '',
].join('\n');

const ANIMATION_BOOL_KEYS = [
  'animation workout start',
  'animation click ripple',
  'animation view slides',
  'animation content reveal',
  'animation flyout fade',
  'animation elevated buttons',
  'animation outline buttons',
  'animation accordions',
  'animation smooth card scroll',
];

/** Preset labels -> px (Config Appearance dropdown). */
const FONT_SIZE_PRESETS = {
  small: 8,
  medium: 16,
  large: 24,
};

/** Theme colors -> CSS custom properties (everything except rank badges). */
const THEME_COLOR_MAP = [
  ['accent color', '--accent'],
  ['background color', '--bg'],
  ['panel color', '--panel'],
  ['text color', '--text'],
  ['muted color', '--muted'],
  ['danger color', '--danger'],
  ['ok color', '--ok'],
  ['glow color', '--bg-glow'],
  ['alert color', '--alert'],
];

const SIMPLE_COLOR_KEYS = ['accent color', 'background color', 'text color'];

const ADVANCED_COLOR_KEYS = THEME_COLOR_MAP.map(([k]) => k);

function defaults() {
  return {
    language: 'en',
    'font size': '16',
    'accent color': '#3D8BFD',
    'background color': '#0F1720',
    'panel color': '#1A2430',
    'text color': '#E8EEF4',
    'muted color': '#9AA8B6',
    'danger color': '#E35D6A',
    'ok color': '#3ECF8E',
    'glow color': '#1E3A5F',
    'alert color': '#C9A227',
    'colorblind filter': 'none',
    'screen reader mode': false,
    'navbar alignment': 'left',
    '24hr': true,
    'notifications enabled': false,
    'completion sounds enabled': true,
    logging: false,
    fullscreen: false,
    'data directory': '',
    'store path': '',
    'weight units': 'lbs',
    'distance units': 'mi',
    'onboarding completed': false,
    'tour completed': false,
    'tour stored step id': '',
    'animation workout start': true,
    'animation click ripple': true,
    'animation view slides': true,
    'animation content reveal': true,
    'animation flyout fade': true,
    'animation elevated buttons': true,
    'animation outline buttons': true,
    'animation accordions': true,
    'animation smooth card scroll': true,
  };
}

/** Normalize to integer px string in 8-24 (presets map to 8 / 16 / 24). */
function normalizeFontSize(raw) {
  const v = String(raw == null ? '' : raw)
    .toLowerCase()
    .trim();
  if (Object.prototype.hasOwnProperty.call(FONT_SIZE_PRESETS, v)) {
    return String(FONT_SIZE_PRESETS[v]);
  }
  const n = Number(v);
  if (Number.isFinite(n)) {
    const clamped = Math.min(24, Math.max(8, Math.round(n)));
    return String(clamped);
  }
  return '16';
}

function fontSizeToPx(raw) {
  return parseInt(normalizeFontSize(raw), 10);
}

/** Reverse map: 8->small, 16->medium, 24->large; else ''. */
function fontSizePresetLabel(raw) {
  const px = fontSizeToPx(raw);
  if (px === FONT_SIZE_PRESETS.small) return 'small';
  if (px === FONT_SIZE_PRESETS.medium) return 'medium';
  if (px === FONT_SIZE_PRESETS.large) return 'large';
  return '';
}

/**
 * Nudge `font size` by ±1px (clamped 8–24). Persists via set().
 * @param {number} delta
 * @returns {{ changed: boolean, px: number }}
 */
function nudgeFontSize(delta) {
  const step = Math.trunc(Number(delta));
  if (!Number.isFinite(step) || step === 0) {
    return { changed: false, px: fontSizeToPx(get()['font size']) };
  }
  const current = fontSizeToPx(get()['font size']);
  const next = Math.min(24, Math.max(8, current + step));
  if (next === current) return { changed: false, px: current };
  set('font size', String(next));
  return { changed: true, px: next };
}

function normalizeHexColor(raw, fallback) {
  const v = String(raw == null ? '' : raw).trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
  return fallback;
}

function normalizeColorblind(raw) {
  const v = String(raw == null ? '' : raw)
    .toLowerCase()
    .trim();
  if (v === 'protanopia' || v === 'deuteranopia' || v === 'tritanopia') return v;
  return 'none';
}

/** Normalized weight display unit from config (`lbs` | `kg` | `st`). */
function normalizeWeightUnits(raw) {
  const u = String(raw == null ? '' : raw)
    .toLowerCase()
    .trim();
  if (u === 'kg' || u === 'kgs' || u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return 'lbs';
  if (u === 'st' || u === 'stone' || u === 'stones') return 'st';
  return 'lbs';
}

/**
 * Normalized distance display unit from config.
 * Built-ins: `mi` | `km` | `m` | `yd` | `ft` | `in`.
 * Legacy `steps` (removed from Config) maps to `mi`.
 */
function normalizeDistanceUnits(raw) {
  const u = String(raw == null ? '' : raw)
    .toLowerCase()
    .trim();
  if (!u) return 'mi';
  if (u === 'mi' || u === 'mile' || u === 'miles') return 'mi';
  if (u === 'km' || u === 'kilometer' || u === 'kilometers') return 'km';
  if (u === 'm' || u === 'meter' || u === 'meters') return 'm';
  if (u === 'yd' || u === 'yrd' || u === 'yard' || u === 'yards') return 'yd';
  if (u === 'ft' || u === 'foot' || u === 'feet') return 'ft';
  if (u === 'in' || u === 'inch' || u === 'inches') return 'in';
  if (u === 'steps' || u === 'step' || u === 'custom') return 'mi';
  return 'mi';
}

function getWeightUnits() {
  const s = get();
  return normalizeWeightUnits(s['weight units']);
}

function getDistanceUnits() {
  const s = get();
  return normalizeDistanceUnits(s['distance units']);
}

function coerceValue(raw) {
  const v = String(raw == null ? '' : raw).trim();
  if (v === 'true' || v === 't' || v === 'T') return true;
  if (v === 'false' || v === 'f' || v === 'F') return false;
  return v;
}

/** `24hr: t` -> 24-hour clock; `24hr: f` -> 12-hour clock. Default t. */
function normalize24hr(raw) {
  if (raw === true || raw === 'true' || raw === 't' || raw === 'T') return true;
  if (raw === false || raw === 'false' || raw === 'f' || raw === 'F') return false;
  return true;
}

function parseConfigText(text) {
  const settings = { ...defaults() };
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(': ');
    if (idx === -1) {
      const colon = trimmed.indexOf(':');
      if (colon === -1) {
        return { ok: false, message: 'Failed to load config.' };
      }
      const name = trimmed.slice(0, colon).trim().toLowerCase();
      const value = coerceValue(trimmed.slice(colon + 1));
      if (!name) return { ok: false, message: 'Failed to load config.' };
      settings[name] = value;
      continue;
    }
    const name = trimmed.slice(0, idx).trim().toLowerCase();
    const value = coerceValue(trimmed.slice(idx + 2));
    if (!name) return { ok: false, message: 'Failed to load config.' };
    settings[name] = value;
  }
  return { ok: true, data: settings };
}

function normalizeSettings(data) {
  const d = defaults();
  const next = { ...d, ...data };
  next.language = i18n.resolveLanguageTag(next.language);
  next['font size'] = normalizeFontSize(next['font size']);
  for (const key of ADVANCED_COLOR_KEYS) {
    next[key] = normalizeHexColor(next[key], d[key]);
  }
  next['colorblind filter'] = normalizeColorblind(next['colorblind filter']);
  next['screen reader mode'] = next['screen reader mode'] === true || next['screen reader mode'] === 'true';
  const align = String(next['navbar alignment'] || 'left').toLowerCase();
  next['navbar alignment'] = align === 'top' ? 'top' : 'left';
  next['24hr'] = normalize24hr(next['24hr']);
  next['notifications enabled'] =
    next['notifications enabled'] === true || next['notifications enabled'] === 'true';
  next['completion sounds enabled'] =
    next['completion sounds enabled'] !== false && next['completion sounds enabled'] !== 'false';
  next.logging = next.logging === true || next.logging === 'true';
  next.fullscreen = next.fullscreen === true || next.fullscreen === 'true';
  next['data directory'] = String(next['data directory'] != null ? next['data directory'] : '')
    .trim();
  next['store path'] = String(next['store path'] != null ? next['store path'] : '').trim();
  next['onboarding completed'] =
    next['onboarding completed'] === true || next['onboarding completed'] === 'true';
  next['tour completed'] = next['tour completed'] === true || next['tour completed'] === 'true';
  next['tour stored step id'] = String(
    next['tour stored step id'] != null ? next['tour stored step id'] : ''
  ).trim();
  for (const key of ANIMATION_BOOL_KEYS) {
    // Defaults are true; only explicit false disables (FR-015a).
    next[key] = next[key] !== false && next[key] !== 'false';
  }
  next['weight units'] = normalizeWeightUnits(next['weight units']);
  // Legacy steps -> prefer prior linear unit when present, else mi.
  const rawDistance = String(data && data['distance units'] != null ? data['distance units'] : next['distance units'])
    .toLowerCase()
    .trim();
  if (rawDistance === 'steps' || rawDistance === 'step') {
    const prev = data && data['distance units previous'];
    next['distance units'] = normalizeDistanceUnits(prev != null && prev !== '' ? prev : 'mi');
  } else {
    next['distance units'] = normalizeDistanceUnits(next['distance units']);
  }
  delete next['distance units previous'];
  delete next['stride sex'];
  delete next['stride height ft'];
  return next;
}

function themeColorSnapshot(settings) {
  const s = settings || get();
  const out = {};
  for (const key of ADVANCED_COLOR_KEYS) out[key] = s[key];
  return out;
}

function serializeSettings(settings) {
  const d = defaults();
  const keys = Object.keys(d);
  const lines = keys.map((k) => {
    let v = settings[k];
    if (k === '24hr') v = normalize24hr(v) ? 't' : 'f';
    return `${k}: ${v}`;
  });
  const header =
    (settings.language && settings.language !== i18n.DEFAULT_LANGUAGE
      ? i18n.languageFileHeader('config.default', settings.language)
      : null) || CONFIG_HEADER;
  return `${header}${lines.join('\n')}\n`;
}

function writeSettingsFile(filePath, settings) {
  fs.writeFileSync(filePath, serializeSettings(settings), 'utf8');
}

function writeDefaultsFile(filePath) {
  writeSettingsFile(filePath, defaults());
}

function applyPathsFromCached() {
  try {
    if (typeof paths.applyPathOverridesFromSettings === 'function') {
      paths.applyPathOverridesFromSettings(cached || defaults());
    }
  } catch (_) {
    /* ignore */
  }
}

function load(options = {}) {
  const filePath = resolveConfigPath(options);
  try {
    if (!fs.existsSync(filePath)) {
      writeDefaultsFile(filePath);
      cached = defaults();
      applyPathsFromCached();
      return { ok: true, data: cached, resetToDefaults: true };
    }
    const text = fs.readFileSync(filePath, 'utf8');
    if (!String(text).trim()) {
      writeDefaultsFile(filePath);
      cached = defaults();
      applyPathsFromCached();
      return { ok: true, data: cached, resetToDefaults: true };
    }
    const parsed = parseConfigText(text);
    if (!parsed.ok) {
      writeDefaultsFile(filePath);
      cached = defaults();
      applyPathsFromCached();
      return { ok: true, data: cached, resetToDefaults: true };
    }
    cached = normalizeSettings(parsed.data);
    applyPathsFromCached();
    return { ok: true, data: cached };
  } catch (_) {
    try {
      writeDefaultsFile(filePath);
    } catch (__) {
      /* ignore */
    }
    cached = defaults();
    applyPathsFromCached();
    return { ok: true, data: cached, resetToDefaults: true };
  }
}

function get() {
  if (!cached) load();
  return { ...cached };
}

function getNavbarAlignment() {
  const s = get();
  return s['navbar alignment'] === 'top' ? 'top' : 'left';
}

/** True when clocks should use 24-hour format (`24hr: t`). */
function getUse24HourClock() {
  return normalize24hr(get()['24hr']);
}

function isLoggingEnabled() {
  try {
    if (!cached) load();
    return get().logging === true;
  } catch (_) {
    return false;
  }
}

function isScreenReaderMode() {
  return get()['screen reader mode'] === true;
}

function rewrite(options = {}) {
  const filePath = resolveConfigPath(options);
  if (!cached) load(options);
  writeSettingsFile(filePath, cached);
  return { ok: true, data: get() };
}

/**
 * Merge `patch` into the in-memory settings.
 * @param {object} patch
 * @param {{ filePath?: string, persist?: boolean }} [options]
 *   `persist: false` updates the cache only (no disk write) - used while dragging color pickers.
 */
function update(patch, options = {}) {
  if (!cached) load(options);
  const merged = normalizeSettings({ ...cached, ...patch });
  cached = merged;
  applyPathsFromCached();
  if (options.persist !== false) {
    writeSettingsFile(resolveConfigPath(options), cached);
  }
  return { ok: true, data: get() };
}

function set(optionName, value, options = {}) {
  const key = String(optionName || '')
    .trim()
    .toLowerCase();
  if (!key) return { ok: false, message: 'Invalid option name.' };
  return update({ [key]: value }, options);
}

function applyThemeVars(el, settings) {
  if (!el || !el.style) return;
  const s = settings || get();
  for (const [optionName, cssVar] of THEME_COLOR_MAP) {
    if (s[optionName]) el.style.setProperty(cssVar, s[optionName]);
  }
}

/**
 * Apply appearance / a11y settings to a document root (html element).
 * All theme tokens (except rank badge artwork) come from config colors.
 */
function applyToDocument(doc) {
  if (!doc || !doc.documentElement) return;
  const s = get();
  const root = doc.documentElement;
  const fontPx = fontSizeToPx(s['font size']);
  root.setAttribute('data-font-size', String(fontPx));
  root.style.fontSize = `${fontPx}px`;
  root.setAttribute('data-colorblind', String(s['colorblind filter'] || 'none'));
  root.setAttribute('data-screen-reader', s['screen reader mode'] ? 'true' : 'false');
  applyThemeVars(root, s);
  if (doc.body) {
    doc.body.setAttribute('data-font-size', String(fontPx));
    doc.body.style.fontSize = `${fontPx}px`;
    applyThemeVars(doc.body, s);
    doc.body.setAttribute('data-colorblind', String(s['colorblind filter'] || 'none'));
    doc.body.setAttribute('data-screen-reader', s['screen reader mode'] ? 'true' : 'false');
  }
}

function clearConfigCache() {
  cached = null;
}

module.exports = {
  defaults,
  parseConfigText,
  load,
  get,
  set,
  update,
  rewrite,
  getNavbarAlignment,
  getUse24HourClock,
  getWeightUnits,
  getDistanceUnits,
  normalizeWeightUnits,
  normalizeDistanceUnits,
  normalize24hr,
  normalizeFontSize,
  normalizeColorblind,
  fontSizeToPx,
  fontSizePresetLabel,
  nudgeFontSize,
  FONT_SIZE_PRESETS,
  THEME_COLOR_MAP,
  SIMPLE_COLOR_KEYS,
  ADVANCED_COLOR_KEYS,
  themeColorSnapshot,
  applyThemeVars,
  isLoggingEnabled,
  isScreenReaderMode,
  applyToDocument,
  clearConfigCache,
  serializeSettings,
};
