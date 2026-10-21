/**
 * Feature 11 — Config, Accessibility & Backup
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 *
 * Data backup is a binary `.dat` holding exercise history (+ skills placeholder).
 * Config backup is a plain `config.txt` copy.
 * Ranks backup is a plain `ranks.txt` copy.
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const catalog = require('./catalog');
const config = require('./config');
const storage = require('./storage');
const ranks = require('./ranks');
const landingConfig = require('./landingConfig');
const { t } = require('./i18n');

const SEPARATOR = '--------------';

/** BRONZE I → bronze-i (badge file stem). */
function rankNameToBadgeSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Set each tier's badge path to `badges/<slug(name)>.svg` (e.g. BRONZE I → badges/bronze-i.svg).
 */
function remapRankBadgePathsInText(text) {
  const blocks = ranks.splitTierBlocks(text);
  if (!blocks.length) return String(text || '');
  const out = [];
  for (let b = 0; b < blocks.length; b += 1) {
    if (b > 0) out.push('');
    const block = blocks[b];
    const slug = rankNameToBadgeSlug(block.name) || 'unranked';
    out.push(`${block.name}:`);
    out.push(`{badges/${slug}.svg}`);
    out.push(SEPARATOR);
    const bodyLines = String(block.body || '').split('\n');
    while (bodyLines.length && bodyLines[0].trim() === '') bodyLines.shift();
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
    for (const bodyLine of bodyLines) {
      if (bodyLine.trim() === '') continue;
      out.push(bodyLine);
    }
  }
  return `${out.join('\n')}\n`;
}

function defaultsDir() {
  if (typeof paths.defaultsDir === 'function') return paths.defaultsDir();
  return path.join(paths.getDataDir(), 'defaults');
}

/**
 * Fully restart the NW.js process so file handles from the old window are released.
 * Window.reload() / reloadIgnoringCache leave the process (and locks) alive and can
 * orphan a half-updated window — spawn a new instance, then quit this one.
 * @param {{ reload?: () => void, spawn?: Function, execPath?: string, cwd?: string, args?: string[] }} [options]
 */
function restartApp(options = {}) {
  if (typeof options.reload === 'function') {
    options.reload();
    return;
  }
  try {
    const nwApi =
      (typeof nw !== 'undefined' && nw) ||
      (typeof global !== 'undefined' && global.nw) ||
      null;
    if (nwApi && nwApi.App && typeof process !== 'undefined' && process.execPath) {
      const spawnFn =
        typeof options.spawn === 'function'
          ? options.spawn
          : require('child_process').spawn;
      const cwd =
        options.cwd ||
        (typeof nwApi.App.startPath === 'string' && nwApi.App.startPath) ||
        process.cwd();
      let args = Array.isArray(options.args) ? options.args.slice() : null;
      if (!args) {
        if (Array.isArray(nwApi.App.fullArgv) && nwApi.App.fullArgv.length) {
          args = nwApi.App.fullArgv.slice();
        } else if (Array.isArray(nwApi.App.argv) && nwApi.App.argv.length) {
          args = nwApi.App.argv.slice();
        } else {
          args = ['.'];
        }
      }
      const child = spawnFn(options.execPath || process.execPath, args, {
        cwd,
        detached: true,
        stdio: 'ignore',
        env: process.env,
      });
      if (child && typeof child.unref === 'function') child.unref();
      nwApi.App.quit();
      return;
    }
  } catch (_) {
    /* fall through */
  }
  if (typeof location !== 'undefined' && typeof location.reload === 'function') {
    location.reload();
  }
}

/**
 * Restore shipped defaults from `data/defaults/`, then remap rank badge paths by tier name.
 * Caller should restart the app after a successful reset (see `restartApp`).
 */
function resetUserData(options = {}) {
  const confirm = typeof options.confirm === 'function' ? options.confirm : () => true;
  if (!confirm(t('config.advanced.resetUserDataConfirm'))) {
    return { ok: false, cancelled: true };
  }

  const dir = defaultsDir();
  if (!fs.existsSync(dir)) {
    return { ok: false, message: t('config.advanced.resetUserDataFailed') };
  }

  const copies = [
    { name: 'config.txt', dest: paths.configTxtPath() },
    { name: 'landing-config.txt', dest: paths.landingConfigTxtPath() },
    { name: 'ranks.txt', dest: paths.ranksTxtPath() },
    { name: 'store.json', dest: paths.storePath() },
  ];

  try {
    for (const item of copies) {
      const src = path.join(dir, item.name);
      if (!fs.existsSync(src)) {
        return { ok: false, message: t('config.advanced.resetUserDataFailed') };
      }
      fs.copyFileSync(src, item.dest);
    }

    const ranksPath = paths.ranksTxtPath();
    const ranksText = fs.readFileSync(ranksPath, 'utf8');
    const remapped = remapRankBadgePathsInText(ranksText);
    fs.writeFileSync(ranksPath, remapped, 'utf8');

    config.clearConfigCache();
    config.load();
    landingConfig.clearLandingConfigCache();
    landingConfig.load();
    ranks.clearRanksCache();
    ranks.loadRanks();
    try {
      storage.ensureInitialized();
    } catch (_) {
      /* ignore */
    }
    try {
      catalog.reloadFromDisk(options);
    } catch (_) {
      /* best-effort */
    }
    return { ok: true };
  } catch (_) {
    return { ok: false, message: t('config.advanced.resetUserDataFailed') };
  }
}

const HISTORY_MAGIC = Buffer.from('STRKHIST');
const HISTORY_VERSION = 1;

function readStorePayload() {
  const storeFile = paths.storePath();
  if (fs.existsSync(storeFile)) {
    return fs.readFileSync(storeFile);
  }
  return Buffer.from(JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2), 'utf8');
}

/**
 * Build binary history backup:
 * magic(8) | version(u32le) | storeLen(u32le) | storeBytes | skillsLen(u32le) | skillsBytes
 * skillsBytes reserved for local skills (empty for now).
 */
function buildHistoryDatBuffer(options = {}) {
  const storeBuf = Buffer.isBuffer(options.storeBuffer)
    ? options.storeBuffer
    : readStorePayload();
  const skillsBuf = Buffer.isBuffer(options.skillsBuffer) ? options.skillsBuffer : Buffer.alloc(0);

  const header = Buffer.alloc(8 + 4 + 4);
  HISTORY_MAGIC.copy(header, 0);
  header.writeUInt32LE(HISTORY_VERSION, 8);
  header.writeUInt32LE(storeBuf.length, 12);

  const skillsHeader = Buffer.alloc(4);
  skillsHeader.writeUInt32LE(skillsBuf.length, 0);

  return Buffer.concat([header, storeBuf, skillsHeader, skillsBuf]);
}

function parseHistoryDatBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) {
    return { ok: false, message: t('backup.invalidData') };
  }
  if (!buf.subarray(0, 8).equals(HISTORY_MAGIC)) {
    return { ok: false, message: t('backup.invalidData') };
  }
  const version = buf.readUInt32LE(8);
  if (version !== HISTORY_VERSION) {
    return { ok: false, message: t('backup.invalidData') };
  }
  const storeLen = buf.readUInt32LE(12);
  let offset = 16;
  if (storeLen < 0 || offset + storeLen + 4 > buf.length) {
    return { ok: false, message: t('backup.invalidData') };
  }
  const storeBuf = buf.subarray(offset, offset + storeLen);
  offset += storeLen;
  const skillsLen = buf.readUInt32LE(offset);
  offset += 4;
  if (skillsLen < 0 || offset + skillsLen > buf.length) {
    return { ok: false, message: t('backup.invalidData') };
  }
  const skillsBuf = buf.subarray(offset, offset + skillsLen);

  let store;
  try {
    store = JSON.parse(storeBuf.toString('utf8'));
  } catch (_) {
    return { ok: false, message: t('backup.invalidData') };
  }
  if (!store || typeof store !== 'object' || !Array.isArray(store.entries)) {
    return { ok: false, message: t('backup.invalidData') };
  }

  return { ok: true, store, storeBuf, skillsBuf, version };
}

/**
 * Export exercise history (+ empty skills section) to a `.dat` path.
 */
function exportHistoryDat(targetPath) {
  if (!targetPath) return { ok: false, message: t('backup.invalidData'), cancelled: true };
  try {
    const buffer = buildHistoryDatBuffer();
    fs.writeFileSync(targetPath, buffer);
    return { ok: true, path: targetPath };
  } catch (_) {
    return { ok: false, message: t('backup.invalidData') };
  }
}

/**
 * Import exercise history from a `.dat` backup.
 */
function importHistoryDat(sourcePath, options = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, message: t('backup.invalidData') };
  }

  let parsed;
  try {
    parsed = parseHistoryDatBuffer(fs.readFileSync(sourcePath));
  } catch (_) {
    return { ok: false, message: t('backup.invalidData') };
  }
  if (!parsed.ok) return parsed;

  const confirm = typeof options.confirm === 'function' ? options.confirm : () => true;
  if (!confirm(t('backup.confirmImportData'))) {
    return { ok: false, cancelled: true };
  }

  try {
    fs.writeFileSync(paths.storePath(), parsed.storeBuf);
    // skillsBuf reserved for a later feature; ignored for now
    catalog.clearCatalogCache();
    catalog.reloadFromDisk();
    storage.readStore();
    return { ok: true };
  } catch (_) {
    return { ok: false, message: t('backup.invalidData') };
  }
}

/**
 * Export `config.txt` to the chosen path.
 */
function exportConfig(targetPath) {
  if (!targetPath) return { ok: false, message: t('backup.invalidConfig'), cancelled: true };
  try {
    config.load();
    const src = paths.configTxtPath();
    if (!fs.existsSync(src)) {
      config.rewrite();
    }
    fs.copyFileSync(paths.configTxtPath(), targetPath);
    return { ok: true, path: targetPath };
  } catch (_) {
    return { ok: false, message: t('backup.invalidConfig') };
  }
}

/**
 * Import `config.txt` from the chosen path (FR-014 on parse failure).
 */
function importConfig(sourcePath, options = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, message: t('backup.invalidConfig') };
  }

  const confirm = typeof options.confirm === 'function' ? options.confirm : () => true;
  if (!confirm(t('backup.confirmImportConfig'))) {
    return { ok: false, cancelled: true };
  }

  try {
    const text = fs.readFileSync(sourcePath, 'utf8');
    fs.writeFileSync(paths.configTxtPath(), text, 'utf8');
    config.clearConfigCache();
    const loaded = config.load();
    return { ok: true, resetToDefaults: Boolean(loaded.resetToDefaults) };
  } catch (_) {
    config.clearConfigCache();
    config.load();
    return { ok: false, message: t('backup.invalidConfig') };
  }
}

/**
 * Export `ranks.txt` to the chosen path.
 */
function exportRanks(targetPath) {
  if (!targetPath) return { ok: false, message: t('backup.invalidRanks'), cancelled: true };
  try {
    const src = paths.ranksTxtPath();
    if (!fs.existsSync(src)) {
      return { ok: false, message: t('backup.invalidRanks') };
    }
    fs.copyFileSync(src, targetPath);
    return { ok: true, path: targetPath };
  } catch (_) {
    return { ok: false, message: t('backup.invalidRanks') };
  }
}

/**
 * Import `ranks.txt` from the chosen path (replaces local ladder after confirm).
 */
function importRanks(sourcePath, options = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, message: t('backup.invalidRanks') };
  }

  let text;
  try {
    text = fs.readFileSync(sourcePath, 'utf8');
  } catch (_) {
    return { ok: false, message: t('backup.invalidRanks') };
  }

  const parsed = ranks.parseRanksText(text);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message || t('backup.invalidRanks') };
  }

  const confirm = typeof options.confirm === 'function' ? options.confirm : () => true;
  if (!confirm(t('backup.confirmImportRanks'))) {
    return { ok: false, cancelled: true };
  }

  try {
    fs.writeFileSync(paths.ranksTxtPath(), text, 'utf8');
    ranks.clearRanksCache();
    try {
      catalog.reloadFromDisk(options);
    } catch (_) {
      /* best-effort */
    }
    return { ok: true, tierCount: (parsed.data || []).length };
  } catch (_) {
    return { ok: false, message: t('backup.invalidRanks') };
  }
}

// Back-compat aliases used by older call sites / tests during transition
const exportZip = exportHistoryDat;
const importZip = importHistoryDat;

module.exports = {
  exportHistoryDat,
  importHistoryDat,
  exportConfig,
  importConfig,
  exportRanks,
  importRanks,
  resetUserData,
  restartApp,
  rankNameToBadgeSlug,
  remapRankBadgePathsInText,
  buildHistoryDatBuffer,
  parseHistoryDatBuffer,
  exportZip,
  importZip,
};
