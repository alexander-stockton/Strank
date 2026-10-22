/**
 * Feature 2 - Daily Exercise Log
 * Spec: features/feature-2-Daily-Exercise-Log.md
 */

const storage = require('./storage');
const catalog = require('./catalog');
const { formatLocalDate } = require('./appDate');
const i18n = require('./i18n');

/** @type {null | (() => Date)} */
let clockOverride = null;
/** @type {null | string} */
let localDateOverride = null;

function now() {
  return clockOverride ? clockOverride() : new Date();
}

function currentLocalDate() {
  if (localDateOverride) return localDateOverride;
  return formatLocalDate(now());
}

/**
 * Test helpers - not part of the public service API.
 */
function __setClock(fnOrNull) {
  clockOverride = fnOrNull;
}

function __setLocalDate(dateOrNull) {
  localDateOverride = dateOrNull;
}

function __resetTestHooks() {
  clockOverride = null;
  localDateOverride = null;
}

function toIsoWithOffset(d) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const tzo = -d.getTimezoneOffset();
  const sign = tzo >= 0 ? '+' : '-';
  const abs = Math.abs(tzo);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}${sign}${oh}:${om}`;
}

function generateEntryId() {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `e_${time}${rand}`;
}

const DURATION_KEYS = new Set([
  'durationSeconds',
  'durationGoSeconds',
  'durationRestSeconds',
  'durationSteps',
]);

/**
 * Pull metric values from a flat create/update payload or nested `metrics`.
 */
function extractMetricsInput(input, schemaKeys) {
  const source = input && typeof input.metrics === 'object' && input.metrics != null ? input.metrics : input;
  const metrics = {};
  for (const key of schemaKeys) {
    if (source && Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== '') {
      metrics[key] = source[key];
    }
  }
  return metrics;
}

function findExtraMetricKeys(input, schemaKeys) {
  const schema = new Set(schemaKeys);
  const source =
    input && typeof input.metrics === 'object' && input.metrics != null
      ? input.metrics
      : Object.fromEntries(
          Object.entries(input || {}).filter(([k]) => !['exerciseId', 'metrics', 'entryId', 'localDate', 'createdAt', 'updatedAt'].includes(k))
        );
  const extras = [];
  for (const key of Object.keys(source || {})) {
    if (!schema.has(key)) extras.push(key);
  }
  return extras;
}

function coerceNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Allow duration-style strings for duration fields; callers decide when to parse.
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(trimmed)) return asNum;
  }
  return null;
}

/**
 * Validate and normalize metrics against catalog schema keys.
 * @returns {{ ok: true, metrics: object } | { ok: false, message: string }}
 */
function validateMetrics(rawMetrics, schemaKeys, options = {}) {
  const { parseDuration } = options;
  const extras = Object.keys(rawMetrics).filter((k) => !schemaKeys.includes(k));
  if (extras.length) {
    return { ok: false, message: i18n.invalidMessage(extras[0]) };
  }

  const metrics = {};
  for (const key of schemaKeys) {
    if (!Object.prototype.hasOwnProperty.call(rawMetrics, key)) {
      return { ok: false, message: i18n.requiredMessage(key) };
    }
    let value = rawMetrics[key];
    if (DURATION_KEYS.has(key) && typeof value === 'string' && parseDuration) {
      const parsed = parseDuration(value);
      if (parsed == null) {
        return { ok: false, message: i18n.invalidMessage(key) };
      }
      value = parsed;
    } else {
      value = coerceNumber(value);
      if (value == null) {
        return { ok: false, message: i18n.invalidMessage(key) };
      }
    }

    if (key === 'weight' || key === 'distance') {
      if (value < 0) return { ok: false, message: i18n.invalidMessage(key) };
      const unitConversion = require('./unitConversion');
      if (value > unitConversion.MEASURE_MAX) {
        return { ok: false, message: i18n.invalidMessage(key) };
      }
      if (key === 'weight') {
        const config = require('./config');
        value = unitConversion.roundWeightForUnit(value, config.getWeightUnits());
      } else {
        value = unitConversion.roundMeasure(value);
      }
    } else if (key === 'reps' || key === 'sets') {
      if (value < 1) return { ok: false, message: i18n.invalidMessage(key) };
    } else if (DURATION_KEYS.has(key)) {
      if (value < 1) return { ok: false, message: i18n.invalidMessage(key) };
    }

    metrics[key] = value;
  }

  return { ok: true, metrics };
}

function readEntries() {
  const read = storage.readStore();
  if (!read.ok) {
    return { ok: false, message: read.message || i18n.t('error.localDataUnreadable') };
  }
  return { ok: true, data: read.data, store: read.data };
}

function listToday() {
  const today = currentLocalDate();
  const read = readEntries();
  if (!read.ok) return { ok: false, message: read.message };
  const entries = read.data.entries.filter((e) => e.localDate === today);
  return { ok: true, data: entries };
}

function createToday(input) {
  const exerciseId = input && input.exerciseId;
  if (!exerciseId) {
    return { ok: false, message: i18n.t('validation.exerciseNotAllowed') };
  }

  const exercise = catalog.getActiveExercise
    ? catalog.getActiveExercise(exerciseId)
    : catalog.getExerciseById(exerciseId);
  if (!exercise) {
    return { ok: false, message: i18n.t('validation.exerciseNotAllowed') };
  }

  const schemaKeys = exercise.metrics || [];
  const extras = findExtraMetricKeys(input, schemaKeys);
  if (extras.length) {
    return { ok: false, message: i18n.invalidMessage(extras[0]) };
  }

  const rawMetrics = extractMetricsInput(input, schemaKeys);
  const { parseDurationToSeconds } = require('./parse/duration');
  const validated = validateMetrics(rawMetrics, schemaKeys, { parseDuration: parseDurationToSeconds });
  if (!validated.ok) return validated;

  const read = readEntries();
  if (!read.ok) return { ok: false, message: read.message };

  const stamp = now();
  const iso = toIsoWithOffset(stamp);
  const entry = {
    entryId: generateEntryId(),
    exerciseId,
    localDate: currentLocalDate(),
    createdAt: iso,
    updatedAt: iso,
    metrics: validated.metrics,
  };

  const next = {
    schemaVersion: read.store.schemaVersion,
    entries: [...read.store.entries, entry],
  };
  const written = storage.writeStore(next);
  if (!written.ok) return { ok: false, message: written.message };

  return { ok: true, data: entry };
}

function updateToday(entryId, patch) {
  const read = readEntries();
  if (!read.ok) return { ok: false, message: read.message };

  const idx = read.store.entries.findIndex((e) => e.entryId === entryId);
  if (idx === -1) {
    return { ok: false, message: i18n.t('validation.entryMissing') };
  }

  const existing = read.store.entries[idx];
  const today = currentLocalDate();
  if (existing.localDate !== today) {
    return { ok: false, message: i18n.t('validation.entryNotToday') };
  }

  const exerciseId = patch && patch.exerciseId != null ? patch.exerciseId : existing.exerciseId;
  const exercise = catalog.getActiveExercise
    ? catalog.getActiveExercise(exerciseId)
    : catalog.getExerciseById(exerciseId);

  // Feature 5 FR-008: orphan may edit existing metric values; cannot switch to unknown id
  const orphanEdit = !exercise && exerciseId === existing.exerciseId;
  if (!exercise && !orphanEdit) {
    return { ok: false, message: i18n.t('validation.exerciseNotAllowed') };
  }

  const schemaKeys = exercise ? exercise.metrics || [] : Object.keys(existing.metrics || {});
  const mergedInput = {
    ...existing.metrics,
    ...(patch && typeof patch.metrics === 'object' && patch.metrics != null ? patch.metrics : {}),
  };
  // Flat keys on patch override
  if (patch) {
    for (const key of schemaKeys) {
      if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
        mergedInput[key] = patch[key];
      }
    }
  }

  if (patch) {
    const allowed = new Set([...schemaKeys, 'exerciseId', 'metrics']);
    for (const key of Object.keys(patch)) {
      if (!allowed.has(key)) {
        return { ok: false, message: i18n.invalidMessage(key) };
      }
    }
  }

  const { parseDurationToSeconds } = require('./parse/duration');
  const validated = validateMetrics(mergedInput, schemaKeys, { parseDuration: parseDurationToSeconds });
  if (!validated.ok) return validated;

  const updated = {
    ...existing,
    exerciseId,
    metrics: validated.metrics,
    updatedAt: toIsoWithOffset(now()),
  };

  const entries = read.store.entries.slice();
  entries[idx] = updated;
  const written = storage.writeStore({
    schemaVersion: read.store.schemaVersion,
    entries,
  });
  if (!written.ok) return { ok: false, message: written.message };

  return { ok: true, data: updated };
}

function deleteToday(entryId) {
  const read = readEntries();
  if (!read.ok) return { ok: false, message: read.message };

  const idx = read.store.entries.findIndex((e) => e.entryId === entryId);
  if (idx === -1) {
    return { ok: false, message: i18n.t('validation.entryMissing') };
  }

  const existing = read.store.entries[idx];
  if (existing.localDate !== currentLocalDate()) {
    return { ok: false, message: i18n.t('validation.entryNotToday') };
  }

  const entries = read.store.entries.slice();
  entries.splice(idx, 1);
  const written = storage.writeStore({
    schemaVersion: read.store.schemaVersion,
    entries,
  });
  if (!written.ok) return { ok: false, message: written.message };

  return { ok: true, data: existing };
}

module.exports = {
  listToday,
  createToday,
  updateToday,
  deleteToday,
  currentLocalDate,
  validateMetrics,
  extractMetricsInput,
  findExtraMetricKeys,
  generateEntryId,
  toIsoWithOffset,
  now,
  __setClock,
  __setLocalDate,
  __resetTestHooks,
};
