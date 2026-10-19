/**
 * Feature 3 — Exercise History
 * Spec: features/feature-3-Exercise-History.md
 */

const storage = require('./storage');
const catalog = require('./catalog');
const dailyLog = require('./dailyLog');
const { parseDurationToSeconds } = require('./parse/duration');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidLocalDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function assertDateNotFuture(localDate) {
  if (!isValidLocalDateString(localDate)) {
    return { ok: false, message: 'localDate is invalid.' };
  }
  const today = dailyLog.currentLocalDate();
  if (localDate > today) {
    return { ok: false, message: 'Date cannot be in the future.' };
  }
  return { ok: true };
}

function readStore() {
  const read = storage.readStore();
  if (!read.ok) {
    return { ok: false, message: read.message || 'Local data could not be read.' };
  }
  return { ok: true, store: read.data };
}

function sortEntries(entries) {
  return entries.slice().sort((a, b) => {
    if (a.localDate !== b.localDate) {
      return a.localDate < b.localDate ? 1 : -1;
    }
    const ac = a.createdAt || '';
    const bc = b.createdAt || '';
    if (ac === bc) return 0;
    return ac < bc ? 1 : -1;
  });
}

/**
 * Region filter: match catalog exercise top-level (or any) header case-insensitively.
 */
function entryMatchesRegion(entry, region) {
  if (!region) return true;
  const exercise = catalog.getActiveExercise
    ? catalog.getActiveExercise(entry.exerciseId)
    : catalog.getExerciseById(entry.exerciseId);
  if (!exercise || !Array.isArray(exercise.headers)) return false;
  const target = String(region).trim().toLowerCase();
  return exercise.headers.some((h) => String(h).toLowerCase() === target);
}

function list(filters = {}) {
  const read = readStore();
  if (!read.ok) return { ok: false, message: read.message };

  let entries = read.store.entries.slice();
  const f = filters || {};

  if (f.localDate) {
    if (!isValidLocalDateString(f.localDate)) {
      return { ok: false, message: 'localDate is invalid.' };
    }
    entries = entries.filter((e) => e.localDate === f.localDate);
  }
  if (f.exerciseId) {
    entries = entries.filter((e) => e.exerciseId === f.exerciseId);
  }
  if (f.region) {
    entries = entries.filter((e) => entryMatchesRegion(e, f.region));
  }

  return { ok: true, data: sortEntries(entries) };
}

function create(input) {
  const exerciseId = input && input.exerciseId;
  if (!exerciseId) {
    return { ok: false, message: 'Exercise is not allowed.' };
  }

  const localDate =
    input.localDate != null && input.localDate !== ''
      ? input.localDate
      : dailyLog.currentLocalDate();

  const dateCheck = assertDateNotFuture(localDate);
  if (!dateCheck.ok) return dateCheck;

  const exercise = catalog.getActiveExercise
    ? catalog.getActiveExercise(exerciseId)
    : catalog.getExerciseById(exerciseId);
  if (!exercise) {
    return { ok: false, message: 'Exercise is not allowed.' };
  }

  const schemaKeys = exercise.metrics || [];
  const extras = dailyLog.findExtraMetricKeys(input, schemaKeys);
  if (extras.length) {
    return { ok: false, message: `${extras[0]} is invalid.` };
  }

  const rawMetrics = dailyLog.extractMetricsInput(input, schemaKeys);
  const validated = dailyLog.validateMetrics(rawMetrics, schemaKeys, {
    parseDuration: parseDurationToSeconds,
  });
  if (!validated.ok) return validated;

  const read = readStore();
  if (!read.ok) return { ok: false, message: read.message };

  const stamp = dailyLog.now();
  const iso = dailyLog.toIsoWithOffset(stamp);
  const entry = {
    entryId: dailyLog.generateEntryId(),
    exerciseId,
    localDate,
    createdAt: iso,
    updatedAt: iso,
    metrics: validated.metrics,
  };

  const written = storage.writeStore({
    schemaVersion: read.store.schemaVersion,
    entries: [...read.store.entries, entry],
  });
  if (!written.ok) return { ok: false, message: written.message };

  return { ok: true, data: entry };
}

function update(entryId, patch) {
  const read = readStore();
  if (!read.ok) return { ok: false, message: read.message };

  const idx = read.store.entries.findIndex((e) => e.entryId === entryId);
  if (idx === -1) {
    return { ok: false, message: 'Entry does not exist.' };
  }

  const existing = read.store.entries[idx];
  const patchObj = patch || {};

  const exerciseId =
    patchObj.exerciseId != null && patchObj.exerciseId !== ''
      ? patchObj.exerciseId
      : existing.exerciseId;

  let localDate = existing.localDate;
  if (Object.prototype.hasOwnProperty.call(patchObj, 'localDate')) {
    localDate = patchObj.localDate;
    const dateCheck = assertDateNotFuture(localDate);
    if (!dateCheck.ok) return dateCheck;
  }

  const exercise = catalog.getActiveExercise
    ? catalog.getActiveExercise(exerciseId)
    : catalog.getExerciseById(exerciseId);

  // Feature 5 FR-008: orphan may edit existing metric values; cannot switch to unknown id
  const orphanEdit = !exercise && exerciseId === existing.exerciseId;
  if (!exercise && !orphanEdit) {
    return { ok: false, message: 'Exercise is not allowed.' };
  }

  const schemaKeys = exercise ? exercise.metrics || [] : Object.keys(existing.metrics || {});
  const allowed = new Set([...schemaKeys, 'exerciseId', 'metrics', 'localDate']);
  for (const key of Object.keys(patchObj)) {
    if (!allowed.has(key)) {
      return { ok: false, message: `${key} is invalid.` };
    }
  }

  const exerciseChanged = exerciseId !== existing.exerciseId;
  let mergedInput;
  if (exerciseChanged) {
    // FR-006: client must send a full valid metrics object for the new exercise
    mergedInput = dailyLog.extractMetricsInput(patchObj, schemaKeys);
  } else {
    mergedInput = {
      ...existing.metrics,
      ...(typeof patchObj.metrics === 'object' && patchObj.metrics != null ? patchObj.metrics : {}),
    };
    for (const key of schemaKeys) {
      if (Object.prototype.hasOwnProperty.call(patchObj, key) && patchObj[key] !== undefined) {
        mergedInput[key] = patchObj[key];
      }
    }
  }

  const validated = dailyLog.validateMetrics(mergedInput, schemaKeys, {
    parseDuration: parseDurationToSeconds,
  });
  if (!validated.ok) return validated;

  const updated = {
    ...existing,
    exerciseId,
    localDate,
    metrics: validated.metrics,
    updatedAt: dailyLog.toIsoWithOffset(dailyLog.now()),
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

function deleteEntry(entryId) {
  const read = readStore();
  if (!read.ok) return { ok: false, message: read.message };

  const idx = read.store.entries.findIndex((e) => e.entryId === entryId);
  if (idx === -1) {
    return { ok: false, message: 'Entry does not exist.' };
  }

  const existing = read.store.entries[idx];
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
  list,
  create,
  update,
  delete: deleteEntry,
  isValidLocalDateString,
  sortEntries,
};
