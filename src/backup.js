/**
 * Feature 11 — Config, Accessibility & Backup
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 *
 * Data backup is a binary `.dat` holding exercise history (+ skills placeholder).
 * Config backup is a plain `config.txt` copy.
 * Ranks backup is a plain `ranks.txt` copy.
 */

const fs = require('fs');
const paths = require('./paths');
const catalog = require('./catalog');
const config = require('./config');
const storage = require('./storage');
const ranks = require('./ranks');

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
    return { ok: false, message: 'Backup file is invalid.' };
  }
  if (!buf.subarray(0, 8).equals(HISTORY_MAGIC)) {
    return { ok: false, message: 'Backup file is invalid.' };
  }
  const version = buf.readUInt32LE(8);
  if (version !== HISTORY_VERSION) {
    return { ok: false, message: 'Backup file is invalid.' };
  }
  const storeLen = buf.readUInt32LE(12);
  let offset = 16;
  if (storeLen < 0 || offset + storeLen + 4 > buf.length) {
    return { ok: false, message: 'Backup file is invalid.' };
  }
  const storeBuf = buf.subarray(offset, offset + storeLen);
  offset += storeLen;
  const skillsLen = buf.readUInt32LE(offset);
  offset += 4;
  if (skillsLen < 0 || offset + skillsLen > buf.length) {
    return { ok: false, message: 'Backup file is invalid.' };
  }
  const skillsBuf = buf.subarray(offset, offset + skillsLen);

  let store;
  try {
    store = JSON.parse(storeBuf.toString('utf8'));
  } catch (_) {
    return { ok: false, message: 'Backup file is invalid.' };
  }
  if (!store || typeof store !== 'object' || !Array.isArray(store.entries)) {
    return { ok: false, message: 'Backup file is invalid.' };
  }

  return { ok: true, store, storeBuf, skillsBuf, version };
}

/**
 * Export exercise history (+ empty skills section) to a `.dat` path.
 */
function exportHistoryDat(targetPath) {
  if (!targetPath) return { ok: false, message: 'Backup file is invalid.', cancelled: true };
  try {
    const buffer = buildHistoryDatBuffer();
    fs.writeFileSync(targetPath, buffer);
    return { ok: true, path: targetPath };
  } catch (_) {
    return { ok: false, message: 'Backup file is invalid.' };
  }
}

/**
 * Import exercise history from a `.dat` backup.
 */
function importHistoryDat(sourcePath, options = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, message: 'Backup file is invalid.' };
  }

  let parsed;
  try {
    parsed = parseHistoryDatBuffer(fs.readFileSync(sourcePath));
  } catch (_) {
    return { ok: false, message: 'Backup file is invalid.' };
  }
  if (!parsed.ok) return parsed;

  const confirm = typeof options.confirm === 'function' ? options.confirm : () => true;
  if (!confirm('Import replaces local exercise history. Continue?')) {
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
    return { ok: false, message: 'Backup file is invalid.' };
  }
}

/**
 * Export `config.txt` to the chosen path.
 */
function exportConfig(targetPath) {
  if (!targetPath) return { ok: false, message: 'Config file is invalid.', cancelled: true };
  try {
    config.load();
    const src = paths.configTxtPath();
    if (!fs.existsSync(src)) {
      config.rewrite();
    }
    fs.copyFileSync(paths.configTxtPath(), targetPath);
    return { ok: true, path: targetPath };
  } catch (_) {
    return { ok: false, message: 'Config file is invalid.' };
  }
}

/**
 * Import `config.txt` from the chosen path (FR-014 on parse failure).
 */
function importConfig(sourcePath, options = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, message: 'Config file is invalid.' };
  }

  const confirm = typeof options.confirm === 'function' ? options.confirm : () => true;
  if (!confirm('Import replaces local config.txt. Continue?')) {
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
    return { ok: false, message: 'Config file is invalid.' };
  }
}

/**
 * Export `ranks.txt` to the chosen path.
 */
function exportRanks(targetPath) {
  if (!targetPath) return { ok: false, message: 'Ranks file is invalid.', cancelled: true };
  try {
    const src = paths.ranksTxtPath();
    if (!fs.existsSync(src)) {
      return { ok: false, message: 'Ranks file is invalid.' };
    }
    fs.copyFileSync(src, targetPath);
    return { ok: true, path: targetPath };
  } catch (_) {
    return { ok: false, message: 'Ranks file is invalid.' };
  }
}

/**
 * Import `ranks.txt` from the chosen path (replaces local ladder after confirm).
 */
function importRanks(sourcePath, options = {}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, message: 'Ranks file is invalid.' };
  }

  let text;
  try {
    text = fs.readFileSync(sourcePath, 'utf8');
  } catch (_) {
    return { ok: false, message: 'Ranks file is invalid.' };
  }

  const parsed = ranks.parseRanksText(text);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message || 'Ranks file is invalid.' };
  }

  const confirm = typeof options.confirm === 'function' ? options.confirm : () => true;
  if (!confirm('Import replaces local ranks.txt. Continue?')) {
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
    return { ok: false, message: 'Ranks file is invalid.' };
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
  buildHistoryDatBuffer,
  parseHistoryDatBuffer,
  exportZip,
  importZip,
};
