/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const fs = require('fs');
const { getDataDir, storePath } = require('./paths');
const { t } = require('./i18n');

const EMPTY_STORE = Object.freeze({ schemaVersion: 1, entries: [], workouts: [] });

function ensureInitialized() {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = storePath();
    if (!fs.existsSync(file)) {
      writeStore({ schemaVersion: 1, entries: [], workouts: [] });
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
      return { ok: false, message: t('error.localDataUnreadable'), code: 'MISSING' };
    }
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed == null ||
      typeof parsed.schemaVersion !== 'number' ||
      !Array.isArray(parsed.entries)
    ) {
      return { ok: false, message: t('error.localDataUnreadable'), code: 'CORRUPT' };
    }
    if (!Array.isArray(parsed.workouts)) {
      parsed.workouts = [];
    }
    return { ok: true, data: parsed };
  } catch (_) {
    return { ok: false, message: t('error.localDataUnreadable'), code: 'CORRUPT' };
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

    let workouts;
    if (Array.isArray(store.workouts)) {
      workouts = store.workouts;
    } else if (fs.existsSync(file)) {
      try {
        const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
        workouts = Array.isArray(prev.workouts) ? prev.workouts : [];
      } catch (_) {
        workouts = [];
      }
    } else {
      workouts = [];
    }

    const payload = {
      schemaVersion: store.schemaVersion,
      entries: Array.isArray(store.entries) ? store.entries : [],
      workouts,
    };
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return { ok: true, data: payload };
  } catch (err) {
    return { ok: false, message: err.message || String(err) };
  }
}

function resetStore() {
  return writeStore({ schemaVersion: 1, entries: [], workouts: [] });
}

module.exports = {
  EMPTY_STORE,
  ensureInitialized,
  readStore,
  writeStore,
  resetStore,
  storePath,
};
