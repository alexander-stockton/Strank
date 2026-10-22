const path = require('path');
const fs = require('fs');

/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 *
 * Resolves bundled data paths. Feature 18 will add install vs user-data split.
 *
 * `config.txt` always lives under the bootstrap data dir so path overrides can be
 * discovered. Optional Config keys `data directory` and `store path` redirect
 * the live data root and store.json location.
 */

/** @type {string|null} */
let overrideDataDir = null;
/** @type {string|null} */
let overrideStorePath = null;

function getProjectRoot() {
  return path.resolve(__dirname, '..');
}

/** Fixed install/bootstrap data folder (always holds config.txt). */
function getBootstrapDataDir() {
  return path.join(getProjectRoot(), 'data');
}

function getDefaultStorePath() {
  return path.join(getBootstrapDataDir(), 'store.json');
}

function getDataDir() {
  if (overrideDataDir) return path.resolve(overrideDataDir);
  return getBootstrapDataDir();
}

/** Writable user-data root (directory that owns the store file). */
function getUserDataDir() {
  if (overrideStorePath) return path.dirname(path.resolve(overrideStorePath));
  return getDataDir();
}

/**
 * Apply optional path overrides from config settings.
 * Empty / missing values clear the override (back to bootstrap defaults).
 * @param {{ 'data directory'?: string, 'store path'?: string }|null|undefined} settings
 */
function applyPathOverridesFromSettings(settings) {
  const s = settings || {};
  const dataRaw = String(s['data directory'] != null ? s['data directory'] : '').trim();
  const storeRaw = String(s['store path'] != null ? s['store path'] : '').trim();
  overrideDataDir = dataRaw ? path.resolve(dataRaw) : null;
  overrideStorePath = storeRaw ? path.resolve(storeRaw) : null;
}

function getPathOverrides() {
  return {
    dataDirectory: overrideDataDir,
    storePath: overrideStorePath,
  };
}

/** Prefer `data/localization/<active-language>/<file>` when that file exists. */
function localizedDataFile(fileName, fallback) {
  try {
    const i18n = require('./i18n');
    const located = typeof i18n.languageFilePath === 'function' ? i18n.languageFilePath(fileName) : null;
    if (located) return located;
  } catch (_) {
    /* i18n unavailable — use the data-dir fallback */
  }
  return fallback;
}

/** Exercise format / formatting-rules text file (UTF-8). */
function formatTxtPath() {
  return localizedDataFile('format.txt', path.join(getDataDir(), 'format.txt'));
}

function ranksTxtPath() {
  return localizedDataFile('ranks.txt', path.join(getDataDir(), 'ranks.txt'));
}

/** Shipped default files (config, ranks, store, landing-config). */
function defaultsDir() {
  return path.join(getBootstrapDataDir(), 'defaults');
}

/** Bundled starter ladder for Rank Editor “Restore to defaults” (Feature 12). */
function defaultRanksTxtPath() {
  return localizedDataFile('ranks.default', path.join(defaultsDir(), 'ranks.txt'));
}

function badgesDir() {
  return path.join(getDataDir(), 'badges');
}

/** User-imported custom badges (Create Rank / form picker). */
function badgesCustomDir() {
  return path.join(badgesDir(), 'custom');
}

function storePath() {
  if (overrideStorePath) return path.resolve(overrideStorePath);
  return path.join(getDataDir(), 'store.json');
}

function windowStatePath() {
  return path.join(getBootstrapDataDir(), 'window-state.json');
}

/** Always bootstrap — path overrides are stored here. */
function configTxtPath() {
  return path.join(getBootstrapDataDir(), 'config.txt');
}

/** Landing day-focus settings (Feature 14 — landing-config.txt). */
function landingConfigTxtPath() {
  return path.join(getDataDir(), 'landing-config.txt');
}

/** Language folders: data/localization/<tag>/ (Feature 16). */
function localizationDir() {
  return path.join(getBootstrapDataDir(), 'localization');
}

/**
 * Ensure a data-directory path is usable (exists as a directory).
 * @returns {{ ok: boolean, path?: string, message?: string }}
 */
function validateDataDirectory(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { ok: true, path: getBootstrapDataDir() };
  }
  const resolved = path.resolve(trimmed);
  try {
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    const st = fs.statSync(resolved);
    if (!st.isDirectory()) {
      return { ok: false, message: 'data-directory-not-dir', path: resolved };
    }
    return { ok: true, path: resolved };
  } catch (_) {
    return { ok: false, message: 'data-directory-invalid', path: resolved };
  }
}

/**
 * Ensure a store file path is usable (parent dir exists).
 * @returns {{ ok: boolean, path?: string, message?: string }}
 */
function validateStorePath(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { ok: true, path: path.join(getDataDir(), 'store.json') };
  }
  const resolved = path.resolve(trimmed);
  try {
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    const st = fs.statSync(parent);
    if (!st.isDirectory()) {
      return { ok: false, message: 'store-parent-not-dir', path: resolved };
    }
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return { ok: false, message: 'store-is-directory', path: resolved };
    }
    return { ok: true, path: resolved };
  } catch (_) {
    return { ok: false, message: 'store-path-invalid', path: resolved };
  }
}

module.exports = {
  getProjectRoot,
  getBootstrapDataDir,
  getDefaultStorePath,
  getDataDir,
  getUserDataDir,
  applyPathOverridesFromSettings,
  getPathOverrides,
  formatTxtPath,
  ranksTxtPath,
  defaultsDir,
  defaultRanksTxtPath,
  badgesDir,
  badgesCustomDir,
  storePath,
  windowStatePath,
  configTxtPath,
  landingConfigTxtPath,
  localizationDir,
  validateDataDirectory,
  validateStorePath,
};
