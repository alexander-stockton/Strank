/**
 * Feature 8 — Active Workout
 * Spec: features/feature-8-Active-Workout.md
 */

const storage = require('./storage');
const landing = require('./landing');
const dailyLog = require('./dailyLog');
const catalog = require('./catalog');
const { parseDurationToSeconds } = require('./parse/duration');

/** @type {null | object} */
let activeDraft = null;

function generateWorkoutId() {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `w_${time}${rand}`;
}

function schemaKeysForItem(item) {
  const ex =
    typeof catalog.getActiveExercise === 'function'
      ? catalog.getActiveExercise(item.exerciseId)
      : catalog.getExerciseById(item.exerciseId);
  if (ex && Array.isArray(ex.metrics) && ex.metrics.length) return [...ex.metrics];
  return Object.keys(item.targets || {});
}

function existingEntryFor(entries, localDate, exerciseId) {
  return entries.find((e) => e.localDate === localDate && e.exerciseId === exerciseId) || null;
}

/**
 * Build an in-memory draft from Feature 7 expectations (FR-002, FR-004, FR-010).
 */
function start(localDate) {
  const date = localDate || dailyLog.currentLocalDate();
  const expectations = landing.getTodayExpectations(date);
  if (!expectations.ok) {
    return { ok: false, message: expectations.message || 'Failed to load expectations.' };
  }

  const read = storage.readStore();
  if (!read.ok) return { ok: false, message: read.message };
  const entries = read.data.entries || [];

  const items = (expectations.data || []).map((exp) => {
    const prior = existingEntryFor(entries, date, exp.exerciseId);
    const targets = { ...(exp.targets || {}) };
    const metrics = prior && prior.metrics ? { ...prior.metrics } : { ...targets };
    const checked = Boolean(prior) || Boolean(exp.completed);
    return {
      exerciseId: exp.exerciseId,
      name: exp.name || exp.exerciseId,
      headers: Array.isArray(exp.headers) ? [...exp.headers] : [],
      targets,
      metrics,
      checked,
      entryId: prior ? prior.entryId : null,
      baselineChecked: checked,
      baselineMetrics: { ...metrics },
    };
  });

  activeDraft = {
    sessionLocalDate: date,
    startedAt: dailyLog.toIsoWithOffset(dailyLog.now()),
    items,
    dirty: false,
  };

  return { ok: true, data: activeDraft };
}

function getDraft() {
  return activeDraft;
}

function isDirty(draft) {
  const d = draft || activeDraft;
  if (!d) return false;
  if (d.dirty) return true;
  return (d.items || []).some((item) => {
    if (item.checked !== item.baselineChecked) return true;
    const keys = new Set([...Object.keys(item.metrics || {}), ...Object.keys(item.baselineMetrics || {})]);
    for (const key of keys) {
      if (String(item.metrics[key] ?? '') !== String(item.baselineMetrics[key] ?? '')) return true;
    }
    return false;
  });
}

function updateDraftItem(exerciseId, patch) {
  if (!activeDraft) return { ok: false, message: 'No active workout.' };
  const item = activeDraft.items.find((i) => i.exerciseId === exerciseId);
  if (!item) return { ok: false, message: 'Exercise is not allowed.' };
  if (patch && typeof patch.checked === 'boolean') item.checked = patch.checked;
  if (patch && patch.metrics && typeof patch.metrics === 'object') {
    item.metrics = { ...item.metrics, ...patch.metrics };
  }
  activeDraft.dirty = isDirty(activeDraft);
  return { ok: true, data: activeDraft };
}

/**
 * Persist checked rows via Feature 2 validation + store workouts[] session (FR-005–FR-006, FR-009).
 */
function complete(draft) {
  const d = draft || activeDraft;
  if (!d) return { ok: false, message: 'No active workout.' };

  const checked = (d.items || []).filter((i) => i.checked);
  if (checked.length === 0) {
    return { ok: false, message: 'Select at least one exercise.' };
  }

  const validatedRows = [];
  for (const item of checked) {
    const schemaKeys = schemaKeysForItem(item);
    const extras = dailyLog.findExtraMetricKeys({ metrics: item.metrics }, schemaKeys);
    if (extras.length) {
      return { ok: false, message: `${extras[0]} is invalid.` };
    }
    const raw = dailyLog.extractMetricsInput({ metrics: item.metrics }, schemaKeys);
    const validated = dailyLog.validateMetrics(raw, schemaKeys, {
      parseDuration: parseDurationToSeconds,
    });
    if (!validated.ok) {
      return { ok: false, message: validated.message || 'Metrics are invalid.' };
    }
    validatedRows.push({ item, metrics: validated.metrics, schemaKeys });
  }

  const read = storage.readStore();
  if (!read.ok) return { ok: false, message: read.message };

  const stamp = dailyLog.now();
  const iso = dailyLog.toIsoWithOffset(stamp);
  const entries = (read.data.entries || []).slice();
  const exerciseIds = [];

  for (const row of validatedRows) {
    const { item, metrics } = row;
    const idx = entries.findIndex(
      (e) => e.localDate === d.sessionLocalDate && e.exerciseId === item.exerciseId
    );
    if (idx >= 0) {
      entries[idx] = {
        ...entries[idx],
        metrics,
        updatedAt: iso,
      };
    } else {
      entries.push({
        entryId: dailyLog.generateEntryId(),
        exerciseId: item.exerciseId,
        localDate: d.sessionLocalDate,
        createdAt: iso,
        updatedAt: iso,
        metrics,
      });
    }
    exerciseIds.push(item.exerciseId);
  }

  const session = {
    workoutId: generateWorkoutId(),
    localDate: d.sessionLocalDate,
    completedAt: iso,
    exerciseIds,
  };
  const workouts = [...(Array.isArray(read.data.workouts) ? read.data.workouts : []), session];

  const written = storage.writeStore({
    schemaVersion: read.data.schemaVersion,
    entries,
    workouts,
  });
  if (!written.ok) return { ok: false, message: written.message };

  activeDraft = null;
  return { ok: true, data: session };
}

/**
 * Discard draft; write nothing (FR-007).
 */
function cancel() {
  activeDraft = null;
  return { ok: true };
}

function __resetTestHooks() {
  activeDraft = null;
}

module.exports = {
  start,
  complete,
  cancel,
  getDraft,
  updateDraftItem,
  isDirty,
  __resetTestHooks,
};
