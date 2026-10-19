/**
 * Feature 7 — Landing Page (config read for navbar / visibility)
 * Feature 11 — Config (minimal load/get; full UI out of scope for Feature 7)
 * Spec: features/feature-7-Landing-Page.md
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');

function resolveConfigPath(options = {}) {
  if (options.filePath) return options.filePath;
  if (typeof paths.configTxtPath === 'function') return paths.configTxtPath();
  return path.join(paths.getDataDir(), 'config.txt');
}

let cached = null;

function defaults() {
  return {
    'font size': 'medium',
    'accent color': '#1565C0',
    'background color': '#FFFFFF',
    'text color': '#102A43',
    'colorblind filter': 'none',
    'screen reader mode': false,
    'navbar alignment': 'left',
    'landing expectations visible': true,
    'landing next rank visible': true,
    'landing get started visible': true,
    'landing skill progress visible': true,
    'notifications enabled': false,
    'completion sounds enabled': true,
    logging: false,
  };
}

function coerceValue(raw) {
  const v = String(raw == null ? '' : raw).trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function parseConfigText(text) {
  const settings = { ...defaults() };
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(': ');
    if (idx === -1) {
      // also allow `name:value` with single colon
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

function writeDefaultsFile(filePath) {
  const d = defaults();
  const body = Object.entries(d)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(filePath, `${body}\n`, 'utf8');
}

function load(options = {}) {
  const filePath = resolveConfigPath(options);
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
    const parsed = parseConfigText(text);
    if (!parsed.ok) {
      writeDefaultsFile(filePath);
      cached = defaults();
      return { ok: true, data: cached, resetToDefaults: true };
    }
    // Coerce navbar alignment
    const align = String(parsed.data['navbar alignment'] || 'left').toLowerCase();
    parsed.data['navbar alignment'] = align === 'top' ? 'top' : 'left';
    if (parsed.data.logging == null) parsed.data.logging = false;
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

function getNavbarAlignment() {
  const s = get();
  return s['navbar alignment'] === 'top' ? 'top' : 'left';
}

function isLandingPanelVisible(key) {
  const s = get();
  const v = s[key];
  if (v === false || v === 'false') return false;
  return true;
}

function clearConfigCache() {
  cached = null;
}

module.exports = {
  defaults,
  parseConfigText,
  load,
  get,
  getNavbarAlignment,
  isLandingPanelVisible,
  clearConfigCache,
};
