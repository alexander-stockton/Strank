/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const fs = require('fs');
const { getDataDir, storePath } = require('./paths');

const EMPTY_STORE = Object.freeze({ schemaVersion: 1, entries: [] });

function ensureInitialized() {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = storePath();
    if (!fs.existsSync(file)) {
      writeStore({ schemaVersion: 1, entries: [] });
    }
    return { ok: true, data: readStore().data };
  } catch (err) {
    return { ok: false, message: err.message || String(err) };
  }
}

function readStore() {
  try {
    const file = storePath();
    if (!fs.existsSync(file)) {
      return { ok: false, message: 'Local data could not be read.', code: 'MISSING' };
    }
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed == null ||
      typeof parsed.schemaVersion !== 'number' ||
      !Array.isArray(parsed.entries)
    ) {
      return { ok: false, message: 'Local data could not be read.', code: 'CORRUPT' };
    }
    return { ok: true, data: parsed };
  } catch (_) {
    return { ok: false, message: 'Local data could not be read.', code: 'CORRUPT' };
  }
}

function writeStore(store) {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = storePath();
    const tmp = `${file}.${process.pid}.tmp`;
    const payload = {
      schemaVersion: store.schemaVersion,
      entries: Array.isArray(store.entries) ? store.entries : [],
    };
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return { ok: true, data: payload };
  } catch (err) {
    return { ok: false, message: err.message || String(err) };
  }
}

function resetStore() {
  return writeStore({ schemaVersion: 1, entries: [] });
}

module.exports = {
  EMPTY_STORE,
  ensureInitialized,
  readStore,
  writeStore,
  resetStore,
  storePath,
};
