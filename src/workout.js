/**
 * Feature 8 - Active Workout
 * Spec: features/feature-8-Active-Workout.md
 */

const storage = require('./storage');
const landing = require('./landing');
const dailyLog = require('./dailyLog');
const catalog = require('./catalog');
const { parseDurationToSeconds } = require('./parse/duration');
const {
  createTimerState,
  pauseTimer,
  resumeTimer,
  readElapsedMs,
} = require('./workoutTimer');
const { defaultMetricsForSchema } = require('./historyDayAdd');
const i18n = require('./i18n');

const CUSTOM_HEADER = 'Custom';

function isCustomItem(item) {
  if (!item) return false;
  if (item.custom === true) return true;
  return (item.headers || []).some((h) => String(h).trim().toLowerCase() === 'custom');
}

function buildItemFromExpectation(exp, prior) {
  const targets = { ...(exp.targets || {}) };
  const metrics = prior && prior.metrics ? { ...prior.metrics } : { ...targets };
  const checked = Boolean(prior) || Boolean(exp.completed);
  return {
    exerciseId: exp.exerciseId,
    name: exp.name || exp.exerciseId,
    headers: Array.isArray(exp.headers) ? [...exp.headers] : [],
    notes: exp.notes != null ? exp.notes : null,
    targets,
    metrics,
    checked,
    entryId: prior ? prior.entryId : null,
    baselineChecked: checked,
    baselineMetrics: { ...metrics },
    completedAt: prior ? prior.completedAt || prior.updatedAt || prior.createdAt || null : null,
    custom: false,
  };
}

function buildCustomItem(exercise, prior) {
  const schemaKeys =
    exercise && Array.isArray(exercise.metrics) && exercise.metrics.length
      ? [...exercise.metrics]
      : prior && prior.metrics
        ? Object.keys(prior.metrics)
        : [];
  const targets = {};
  for (const key of schemaKeys) targets[key] = prior && prior.metrics && prior.metrics[key] != null ? prior.metrics[key] : 0;
  const metrics =
    prior && prior.metrics
      ? { ...prior.metrics }
      : defaultMetricsForSchema(schemaKeys);
  const checked = Boolean(prior);
  return {
    exerciseId: exercise.exerciseId,
    name: exercise.name || exercise.exerciseId,
    headers: [CUSTOM_HEADER],
    notes: exercise.notes != null ? exercise.notes : null,
    targets,
    metrics,
    checked,
    entryId: prior ? prior.entryId : null,
    baselineChecked: checked,
    baselineMetrics: { ...metrics },
    completedAt: prior ? prior.completedAt || prior.updatedAt || prior.createdAt || null : null,
    custom: true,
  };
}

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
 * Resumes the same-day draft (and its timer) if one is already active.
 */
function start(localDate) {
  const date = localDate || dailyLog.currentLocalDate();
  if (activeDraft && activeDraft.sessionLocalDate === date) {
    return { ok: true, data: activeDraft };
  }

  const expectations = landing.getTodayExpectations(date);
  if (!expectations.ok) {
    return { ok: false, message: expectations.message || i18n.t('workout.loadExpectationsFailed') };
  }

  const read = storage.readStore();
  if (!read.ok) return { ok: false, message: read.message };
  const entries = read.data.entries || [];

  const items = (expectations.data || []).map((exp) => {
    const prior = existingEntryFor(entries, date, exp.exerciseId);
    return buildItemFromExpectation(exp, prior);
  });

  // Same-day log rows that are not on today's focus plan → Custom (day-local only).
  const plannedIds = new Set(items.map((i) => i.exerciseId));
  for (const entry of entries) {
    if (!entry || entry.localDate !== date) continue;
    if (plannedIds.has(entry.exerciseId)) continue;
    const ex =
      typeof catalog.getActiveExercise === 'function'
        ? catalog.getActiveExercise(entry.exerciseId)
        : catalog.getExerciseById(entry.exerciseId);
    if (!ex) continue;
    items.push(buildCustomItem(ex, entry));
    plannedIds.add(entry.exerciseId);
  }

  const timer = createTimerState();
  // Returning to the same day's workout after a partial Complete continues the clock.
  try {
    const prior = getSessionForDate(date);
    if (prior.ok && prior.data && Number.isFinite(prior.data.durationMs)) {
      timer.elapsedMs = Math.max(0, Math.floor(prior.data.durationMs));
    }
  } catch (_) {
    /* ignore */
  }

  activeDraft = {
    sessionLocalDate: date,
    startedAt: dailyLog.toIsoWithOffset(dailyLog.now()),
    items,
    dirty: false,
    timer,
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
  if (!activeDraft) return { ok: false, message: i18n.t('workout.noActive') };
  const item = activeDraft.items.find((i) => i.exerciseId === exerciseId);
  if (!item) return { ok: false, message: i18n.t('validation.exerciseNotAllowed') };
  if (patch && typeof patch.checked === 'boolean') {
    const wasChecked = item.checked;
    item.checked = patch.checked;
    if (item.checked && !wasChecked) {
      item.completedAt = dailyLog.toIsoWithOffset(dailyLog.now());
    } else if (!item.checked) {
      item.completedAt = null;
    }
  }
  if (patch && patch.metrics && typeof patch.metrics === 'object') {
    item.metrics = { ...item.metrics, ...patch.metrics };
  }
  activeDraft.dirty = isDirty(activeDraft);
  return { ok: true, data: activeDraft };
}

/**
 * Add a catalog exercise to the active draft under the day-local Custom section.
 * Does not change focus plans or other days' workouts.
 */
function addCustomExercise(exerciseId) {
  if (!activeDraft) return { ok: false, message: i18n.t('workout.noActive') };
  if (!exerciseId) {
    return { ok: false, message: i18n.t('validation.exerciseNotAllowed') };
  }
  const existing = activeDraft.items.find((i) => i.exerciseId === exerciseId);
  if (existing) {
    // Already on this day's list — keep as-is (do not move planned rows into Custom).
    return { ok: true, data: activeDraft, alreadyPresent: true, item: existing };
  }
  const exercise =
    typeof catalog.getActiveExercise === 'function'
      ? catalog.getActiveExercise(exerciseId)
      : catalog.getExerciseById(exerciseId);
  if (!exercise) {
    return { ok: false, message: i18n.t('validation.exerciseNotAllowed') };
  }
  const item = buildCustomItem(exercise, null);
  activeDraft.items.push(item);
  activeDraft.dirty = true;
  return { ok: true, data: activeDraft, item };
}

/** Resume the draft timer while Active Workout is on screen. */
function resumeSessionTimer(now = Date.now()) {
  if (!activeDraft) return { ok: false, message: i18n.t('workout.noActive') };
  if (!activeDraft.timer) activeDraft.timer = createTimerState();
  resumeTimer(activeDraft.timer, now);
  return { ok: true, data: activeDraft.timer };
}

/** Pause the draft timer when leaving Active Workout. */
function pauseSessionTimer(now = Date.now()) {
  if (!activeDraft || !activeDraft.timer) return { ok: true, data: null };
  pauseTimer(activeDraft.timer, now);
  return { ok: true, data: activeDraft.timer };
}

function getSessionElapsedMs(now = Date.now()) {
  if (!activeDraft || !activeDraft.timer) return 0;
  return readElapsedMs(activeDraft.timer, now);
}

/** Latest completed workout session for a local calendar date (if any). */
function getSessionForDate(localDate) {
  const read = storage.readStore();
  if (!read.ok) return { ok: false, message: read.message, data: null };
  const date = localDate || dailyLog.currentLocalDate();
  const sessions = (read.data.workouts || []).filter((w) => w && w.localDate === date);
  if (!sessions.length) return { ok: true, data: null };
  sessions.sort((a, b) => String(a.completedAt || '').localeCompare(String(b.completedAt || '')));
  return { ok: true, data: sessions[sessions.length - 1] };
}

/**
 * Persist checked rows via Feature 2 validation + store workouts[] session (FR-005-FR-006, FR-009).
 * Unchecked rows that already had a same-day entry are removed so Landing shows them incomplete
 * (resume / mistaken complete correction).
 */
function complete(draft) {
  const d = draft || activeDraft;
  if (!d) return { ok: false, message: i18n.t('workout.noActive') };

  const items = d.items || [];
  const checked = items.filter((i) => i.checked);
  const unchecked = items.filter((i) => !i.checked);
  // Step Away / Complete may persist with zero checked rows (timer + session only).

  const validatedRows = [];
  for (const item of checked) {
    const schemaKeys = schemaKeysForItem(item);
    const extras = dailyLog.findExtraMetricKeys({ metrics: item.metrics }, schemaKeys);
    if (extras.length) {
      return { ok: false, message: i18n.invalidMessage(extras[0]) };
    }
    const raw = dailyLog.extractMetricsInput({ metrics: item.metrics }, schemaKeys);
    const validated = dailyLog.validateMetrics(raw, schemaKeys, {
      parseDuration: parseDurationToSeconds,
    });
    if (!validated.ok) {
      return { ok: false, message: validated.message || i18n.t('workout.metricsInvalid') };
    }
    validatedRows.push({ item, metrics: validated.metrics, schemaKeys });
  }

  const read = storage.readStore();
  if (!read.ok) return { ok: false, message: read.message };

  const stamp = dailyLog.now();
  const iso = dailyLog.toIsoWithOffset(stamp);
  if (d.timer) pauseTimer(d.timer, stamp.getTime());
  const durationMs = d.timer ? readElapsedMs(d.timer, stamp.getTime()) : 0;

  let entries = (read.data.entries || []).slice();
  const exerciseIds = [];

  for (const row of validatedRows) {
    const { item, metrics } = row;
    const completedAt = item.completedAt || iso;
    const idx = entries.findIndex(
      (e) => e.localDate === d.sessionLocalDate && e.exerciseId === item.exerciseId
    );
    if (idx >= 0) {
      entries[idx] = {
        ...entries[idx],
        metrics,
        updatedAt: iso,
        completedAt,
      };
    } else {
      entries.push({
        entryId: dailyLog.generateEntryId(),
        exerciseId: item.exerciseId,
        localDate: d.sessionLocalDate,
        createdAt: iso,
        updatedAt: iso,
        completedAt,
        metrics,
      });
    }
    exerciseIds.push(item.exerciseId);
  }

  // Drop same-day entries for exercises the user unchecked while editing
  const uncheckedIds = new Set(unchecked.map((i) => i.exerciseId));
  if (uncheckedIds.size) {
    entries = entries.filter(
      (e) => !(e.localDate === d.sessionLocalDate && uncheckedIds.has(e.exerciseId))
    );
  }

  const session = {
    workoutId: generateWorkoutId(),
    localDate: d.sessionLocalDate,
    completedAt: iso,
    exerciseIds,
    durationMs,
  };
  // Replace any prior session for this localDate so each day keeps one workout timer.
  const prior = Array.isArray(read.data.workouts) ? read.data.workouts : [];
  const workouts = [...prior.filter((w) => w && w.localDate !== d.sessionLocalDate), session];

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
  addCustomExercise,
  isDirty,
  isCustomItem,
  CUSTOM_HEADER,
  resumeSessionTimer,
  pauseSessionTimer,
  getSessionElapsedMs,
  getSessionForDate,
  __resetTestHooks,
};
