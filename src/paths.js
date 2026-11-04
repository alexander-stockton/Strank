/**
 * Feature 19 - Packaging & Distribution
 * Spec: features/feature-19-Packaging-Distribution.md
 *
 * Install vs user-data path resolver. Features 1–16 read/write live definition
 * files and history under the user data directory; bundled defaults ship from
 * the install tree and are copy-on-first-run seeded when missing.
 *
 * `config.txt` always lives under the canonical user-data root so path overrides
 * can be discovered. Optional Config keys `data directory` and `store path`
 * redirect the live data root and store.json location.
 *
 * Live `ranks.txt` / `format.txt` always resolve under `getDataDir()` (never the
 * install localization tree). Localization copies are seed templates only.
 * `data-locations.json` in the canonical root records wipe targets for uninstall.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

/** @type {string|null} */
let overrideDataDir = null;
/** @type {string|null} */
let overrideStorePath = null;

const DATA_LOCATIONS_FILE = 'data-locations.json';

/** Test/prod override: '1' packaged, '0' unpackaged, unset = auto-detect. */
function packagedOverride() {
  const v = process.env.STRANK_PACKAGED;
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return null;
}

/**
 * Detect packaged Strank.exe vs `nw .` / Node / Jest.
 * @returns {boolean}
 */
function isPackaged() {
  const forced = packagedOverride();
  if (forced != null) return forced;
  if (process.env.JEST_WORKER_ID != null) return false;
  try {
    const exe = path.basename(process.execPath || '').toLowerCase();
    if (exe === 'strank.exe' || exe === 'strank') return true;
    if (
      exe === 'nw.exe' ||
      exe === 'nw' ||
      exe === 'node.exe' ||
      exe === 'node'
    )
      return false;
  } catch (_) {
    /* ignore */
  }
  return false;
}

/** Packaged / repo root (directory that contains package.json + data/). */
function getInstallDir() {
  return path.resolve(__dirname, '..');
}

/** Bundled install data (defaults, localization, shipped templates). */
function getInstallDataDir() {
  return path.join(getInstallDir(), 'data');
}

/** @deprecated Alias - install `data/` templates (not the writable user root). */
function getBootstrapDataDir() {
  return getInstallDataDir();
}

function getProjectRoot() {
  return getInstallDir();
}

/**
 * Canonical writable user-data root (ignores Config path overrides).
 * Packaged: %APPDATA%\Strank\
 * Dev: <repo>/.strank-user-data/
 */
function getCanonicalUserDataDir() {
  if (isPackaged()) {
    // STRANK_APPDATA is for tests; APPDATA is the Windows default.
    const appData =
      process.env.STRANK_APPDATA ||
      process.env.APPDATA ||
      path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Strank');
  }
  return path.join(getInstallDir(), '.strank-user-data');
}

/**
 * Live data root for ranks/format/badges/store (Features 1–16).
 * Honors Config `data directory` / `store path` overrides.
 */
function getDataDir() {
  if (overrideDataDir) return path.resolve(overrideDataDir);
  return getCanonicalUserDataDir();
}

/** Writable user-data root (directory that owns the store file when overridden). */
function getUserDataDir() {
  if (overrideStorePath) return path.dirname(path.resolve(overrideStorePath));
  return getDataDir();
}

function getDefaultStorePath() {
  return path.join(getCanonicalUserDataDir(), 'store.json');
}

function dataLocationsPath() {
  return path.join(getCanonicalUserDataDir(), DATA_LOCATIONS_FILE);
}

/**
 * Persist wipe targets for uninstall.exe (canonical + optional overrides).
 * Safe to call often; never throws to callers.
 * @param {{ installDir?: string } } [extra]
 */
function recordDataLocations(extra = {}) {
  try {
    const canonical = getCanonicalUserDataDir();
    if (!fs.existsSync(canonical)) fs.mkdirSync(canonical, { recursive: true });
    let prev = {};
    try {
      if (fs.existsSync(dataLocationsPath())) {
        prev = JSON.parse(fs.readFileSync(dataLocationsPath(), 'utf8')) || {};
      }
    } catch (_) {
      prev = {};
    }
    const liveData = getDataDir();
    const store = storePath();
    const payload = {
      canonicalUserDataDir: canonical,
      dataDirectory: liveData,
      storePath: store,
      installDir:
        extra.installDir != null && String(extra.installDir).trim()
          ? path.resolve(String(extra.installDir).trim())
          : prev.installDir || null,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      dataLocationsPath(),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8',
    );
    return payload;
  } catch (_) {
    return null;
  }
}

function readDataLocations() {
  try {
    const p = dataLocationsPath();
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return raw && typeof raw === 'object' ? raw : null;
  } catch (_) {
    return null;
  }
}

/**
 * Apply optional path overrides from config settings.
 * Empty / missing values clear the override (back to canonical user data).
 * @param {{ 'data directory'?: string, 'store path'?: string }|null|undefined} settings
 */
function applyPathOverridesFromSettings(settings) {
  const s = settings || {};
  const dataRaw = String(
    s['data directory'] != null ? s['data directory'] : '',
  ).trim();
  const storeRaw = String(
    s['store path'] != null ? s['store path'] : '',
  ).trim();
  overrideDataDir = dataRaw ? path.resolve(dataRaw) : null;
  overrideStorePath = storeRaw ? path.resolve(storeRaw) : null;
  recordDataLocations();
}

function getPathOverrides() {
  return {
    dataDirectory: overrideDataDir,
    storePath: overrideStorePath,
  };
}

/**
 * Bundled localization / defaults template path (read-only seed source).
 * Not used as the live editable ranks/format path.
 */
function localizedDataFile(fileName, fallback) {
  try {
    const i18n = require('./i18n');
    const located =
      typeof i18n.languageFilePath === 'function'
        ? i18n.languageFilePath(fileName)
        : null;
    if (located) return located;
  } catch (_) {
    /* i18n unavailable - use the data-dir fallback */
  }
  return fallback;
}

/** Active UI language tag when i18n is available. */
function activeLanguageTag() {
  try {
    const i18n = require('./i18n');
    if (typeof i18n.getLanguage === 'function') return i18n.getLanguage();
    if (typeof i18n.currentLanguage === 'function') return i18n.currentLanguage();
  } catch (_) {
    /* ignore */
  }
  return 'en';
}

/** Exercise format / formatting-rules text file (UTF-8) — live user copy. */
function formatTxtPath() {
  return path.join(getDataDir(), 'format.txt');
}

/** Live ranks ladder under the active data directory (honors Config override). */
function ranksTxtPath() {
  return path.join(getDataDir(), 'ranks.txt');
}

/** Shipped default files (config, ranks, format, store, landing-config). */
function defaultsDir() {
  return path.join(getInstallDataDir(), 'defaults');
}

/** Bundled starter ladder for Rank Editor “Restore to defaults” (Feature 12). */
function defaultRanksTxtPath() {
  const tag = activeLanguageTag();
  const fromLang = path.join(
    getInstallDataDir(),
    'localization',
    tag,
    'ranks.txt',
  );
  if (fs.existsSync(fromLang)) return fromLang;
  return localizedDataFile(
    'ranks.default',
    path.join(defaultsDir(), 'ranks.txt'),
  );
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
  return path.join(getCanonicalUserDataDir(), 'window-state.json');
}

/** Always canonical user data - path overrides are stored here. */
function configTxtPath() {
  return path.join(getCanonicalUserDataDir(), 'config.txt');
}

/** Landing day-focus settings (Feature 14 - landing-config.txt). */
function landingConfigTxtPath() {
  return path.join(getDataDir(), 'landing-config.txt');
}

/** Language folders: install data/localization/[tag]/ (Feature 16). */
function localizationDir() {
  return path.join(getInstallDataDir(), 'localization');
}

/**
 * Absolute paths for catalog / ranks / store / badges (Feature 19 PathResolver).
 * @returns {{
 *   installDir: string,
 *   userDataDir: string,
 *   formatTxt: string,
 *   ranksTxt: string,
 *   store: string,
 *   badgesDir: string,
 *   configTxt: string,
 * }}
 */
function getDefinitionPaths() {
  return {
    installDir: getInstallDir(),
    userDataDir: getUserDataDir(),
    formatTxt: formatTxtPath(),
    ranksTxt: ranksTxtPath(),
    store: storePath(),
    badgesDir: badgesDir(),
    configTxt: configTxtPath(),
  };
}

function copyFileIfMissing(src, dest) {
  if (!src || !fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) return false;
  const parent = path.dirname(dest);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function resolveSeedSource(fileName, installData, defaultsRoot, languageTag) {
  const tag = String(languageTag || '').trim();
  if (tag) {
    const fromLang = path.join(installData, 'localization', tag, fileName);
    if (fs.existsSync(fromLang)) return fromLang;
  }
  const fromDefaults = path.join(defaultsRoot, fileName);
  if (fs.existsSync(fromDefaults)) return fromDefaults;
  const fromInstall = path.join(installData, fileName);
  if (fs.existsSync(fromInstall)) return fromInstall;
  return null;
}

/**
 * Copy default badge files from install into user badges dir without overwriting.
 * Skips `custom/` (user imports). Creates `badges/custom/` empty if needed.
 * @returns {number} count of files newly copied
 */
function seedBadges(installBadgesDir, userBadgesDir) {
  let copied = 0;
  if (!fs.existsSync(userBadgesDir))
    fs.mkdirSync(userBadgesDir, { recursive: true });
  const customDir = path.join(userBadgesDir, 'custom');
  if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
  if (!installBadgesDir || !fs.existsSync(installBadgesDir)) return copied;

  const entries = fs.readdirSync(installBadgesDir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === 'custom') continue;
    const src = path.join(installBadgesDir, ent.name);
    const dest = path.join(userBadgesDir, ent.name);
    if (ent.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
        copied += seedBadges(src, dest);
      } else {
        copied += seedBadges(src, dest);
      }
      continue;
    }
    if (!ent.isFile()) continue;
    if (copyFileIfMissing(src, dest)) copied += 1;
  }
  return copied;
}

/**
 * Copy-on-first-run: ensure the live data root has format.txt, ranks.txt, and
 * default badges. Never overwrites existing user copies (FR-007).
 *
 * Seeds `getDataDir()` (honors Config `data directory`) so a custom location is
 * the single live tree — not a second copy left only under AppData.
 * Always ensures the canonical root exists for config.txt / uninstall metadata.
 *
 * @param {{
 *   userDataDir?: string,
 *   installDataDir?: string,
 *   defaultsDir?: string,
 *   language?: string,
 * }} [options] - injectable roots for tests
 * @returns {{
 *   ok: boolean,
 *   userDataDir: string,
 *   copied: { format: boolean, ranks: boolean, badges: number },
 *   message?: string,
 * }}
 */
function ensureUserDataSeeded(options = {}) {
  const userDir = options.userDataDir || getDataDir();
  const installData = options.installDataDir || getInstallDataDir();
  const defaultsRoot =
    options.defaultsDir || path.join(installData, 'defaults');
  const language = options.language || activeLanguageTag();
  const copied = { format: false, ranks: false, badges: 0 };
  const skipCanonicalEnsure = Boolean(options.skipCanonicalEnsure);
  const skipRecordLocations = Boolean(options.skipRecordLocations);

  try {
    if (!skipCanonicalEnsure) {
      const canonical = getCanonicalUserDataDir();
      if (!fs.existsSync(canonical)) {
        fs.mkdirSync(canonical, { recursive: true });
      }
    }
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const formatSrc = resolveSeedSource(
      'format.txt',
      installData,
      defaultsRoot,
      language,
    );
    const ranksSrc = resolveSeedSource(
      'ranks.txt',
      installData,
      defaultsRoot,
      language,
    );
    copied.format = copyFileIfMissing(
      formatSrc,
      path.join(userDir, 'format.txt'),
    );
    copied.ranks = copyFileIfMissing(ranksSrc, path.join(userDir, 'ranks.txt'));

    const installBadges = path.join(installData, 'badges');
    const userBadges = path.join(userDir, 'badges');
    copied.badges = seedBadges(installBadges, userBadges);

    if (!skipRecordLocations) {
      recordDataLocations();
    }
    return { ok: true, userDataDir: userDir, copied };
  } catch (err) {
    return {
      ok: false,
      userDataDir: userDir,
      copied,
      message: err && err.message ? err.message : String(err),
    };
  }
}

/**
 * Ensure a data-directory path is usable (exists as a directory).
 * @returns {{ ok: boolean, path?: string, message?: string }}
 */
function validateDataDirectory(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { ok: true, path: getCanonicalUserDataDir() };
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
  isPackaged,
  getInstallDir,
  getInstallDataDir,
  getProjectRoot,
  getBootstrapDataDir,
  getCanonicalUserDataDir,
  getDefaultStorePath,
  getDataDir,
  getUserDataDir,
  getDefinitionPaths,
  applyPathOverridesFromSettings,
  getPathOverrides,
  DATA_LOCATIONS_FILE,
  dataLocationsPath,
  recordDataLocations,
  readDataLocations,
  localizedDataFile,
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
  ensureUserDataSeeded,
  validateDataDirectory,
  validateStorePath,
};
