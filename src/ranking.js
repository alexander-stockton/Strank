/**
 * Feature 4 - Weekly Ranking
 * Spec: features/feature-4-Weekly-Ranking.md
 */

const storage = require('./storage');
const ranks = require('./ranks');
const catalog = require('./catalog');
const dayFocus = require('./dayFocus');
const { isUnrankedName, unrankedDisplayName } = require('./rankTokens');
const { formatLocalDate } = require('./appDate');

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

function parseLocalDate(iso) {
  const [y, m, d] = String(iso)
    .split('-')
    .map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

function addDays(iso, delta) {
  const dt = parseLocalDate(iso);
  dt.setDate(dt.getDate() + delta);
  return formatLocalDate(dt);
}

function compareIso(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Monday of the week containing localDate (Mon-Sun weeks). */
function mondayOf(localDate) {
  const dt = parseLocalDate(localDate);
  const day = dt.getDay(); // 0 Sun ... 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + offset);
  return formatLocalDate(dt);
}

function weekRange(weekStartMonday) {
  return {
    start: weekStartMonday,
    end: addDays(weekStartMonday, 6),
  };
}

function roundMean(value) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10) / 10;
}

function ensureRanks() {
  const loaded = ranks.loadRanks();
  if (!loaded.ok) return { ok: false, message: loaded.message, tiers: [] };
  return { ok: true, tiers: loaded.data };
}

function readEntries() {
  const read = storage.readStore();
  if (!read.ok) return { ok: false, message: read.message, entries: [] };
  return { ok: true, entries: read.data.entries || [] };
}

/**
 * Eligible local dates for a week given "today".
 */
function eligibleDaysForWeek(weekStartMonday, today = currentLocalDate()) {
  const { start, end } = weekRange(weekStartMonday);
  if (compareIso(end, today) < 0) {
    // fully past
    const days = [];
    for (let i = 0; i < 7; i += 1) days.push(addDays(start, i));
    return days;
  }
  if (compareIso(start, today) > 0) {
    // entirely future
    return [];
  }
  // in progress: Mon ... today
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(start, i);
    if (compareIso(d, today) > 0) break;
    days.push(d);
  }
  return days;
}

function isWeekInProgress(weekStartMonday, today = currentLocalDate()) {
  const { start, end } = weekRange(weekStartMonday);
  return compareIso(start, today) <= 0 && compareIso(today, end) <= 0;
}

const travelPace = require('./travelPace');

const HIGHER_BETTER = new Set([
  'weight',
  'distance',
  'reps',
  'sets',
  'durationSeconds',
  'durationGoSeconds',
  'durationSteps',
]);

function meetsThreshold(averages, targets) {
  if (!targets || typeof targets !== 'object') return true;
  const avg = averages || {};
  // Travel: pace (time-per-unit, lower better) AND scale (load×volume×distance).
  const useTravel =
    travelPace.hasTravelPair(targets) && travelPace.hasTravelPair(avg);
  const absorbed = useTravel
    ? travelPace.travelAbsorbedKeys(targets)
    : new Set();
  if (useTravel) {
    const aPace = travelPace.timePerUnit(avg);
    const tPace = travelPace.timePerUnit(targets);
    if (aPace == null || tPace == null || !(aPace <= tPace)) return false;
    const aScale = travelPace.travelScale(avg);
    const tScale = travelPace.travelScale(targets);
    if (aScale == null || tScale == null || !(aScale >= tScale)) return false;
  }
  for (const [key, threshold] of Object.entries(targets)) {
    if (absorbed.has(key)) continue;
    const mean = avg[key];
    if (mean == null || !Number.isFinite(mean)) return false;
    if (key === 'durationRestSeconds') {
      if (!(mean <= threshold)) return false;
    } else if (HIGHER_BETTER.has(key)) {
      if (!(threshold <= mean)) return false;
    } else {
      // default higher-is-better
      if (!(threshold <= mean)) return false;
    }
  }
  return true;
}

function exerciseDisplayName(exerciseId) {
  const ex = catalog.getActiveExercise
    ? catalog.getActiveExercise(exerciseId)
    : catalog.getExerciseById(exerciseId);
  return ex ? ex.name : exerciseId;
}

function muscleGroupForExerciseId(exerciseId) {
  const ex = catalog.getActiveExercise
    ? catalog.getActiveExercise(exerciseId)
    : catalog.getExerciseById
      ? catalog.getExerciseById(exerciseId)
      : null;
  return dayFocus.muscleGroupFromHeaders(ex && ex.headers);
}

/** Mean metrics across one day's entries for a single exercise. */
function meanDayMetrics(entriesForDay) {
  const metricList = (entriesForDay || []).map((e) => e.metrics || {});
  if (!metricList.length) return null;
  const keys = new Set();
  for (const m of metricList) Object.keys(m).forEach((k) => keys.add(k));
  const avg = {};
  for (const key of keys) {
    const values = metricList
      .map((m) => (m[key] != null ? Number(m[key]) : null))
      .filter((v) => v != null && Number.isFinite(v));
    if (!values.length) continue;
    avg[key] = roundMean(values.reduce((a, b) => a + b, 0) / values.length);
  }
  return Object.keys(avg).length ? avg : null;
}

/**
 * Average a focus-day buffer. Each sample is a day-metrics object, or `null` for
 * a skipped focus day (all-zero contribution for every key seen in the buffer).
 */
function averageBufferSamples(samples) {
  const list = Array.isArray(samples) ? samples : [];
  if (!list.length) return null;
  const keys = new Set();
  for (const s of list) {
    if (s) Object.keys(s).forEach((k) => keys.add(k));
  }
  if (!keys.size) return null;
  const avg = {};
  for (const key of keys) {
    const values = list.map((s) => {
      if (!s || s[key] == null) return 0;
      const n = Number(s[key]);
      return Number.isFinite(n) ? n : 0;
    });
    avg[key] = roundMean(values.reduce((a, b) => a + b, 0) / values.length);
  }
  return avg;
}

/**
 * Per-exercise weekly buffer:
 * - One slot per passed focus day for the exercise's muscle group (day mean, or
 *   null/zero if skipped). Buffer length is 0 until focus days have passed.
 * - Extra real day-means from off-plan / other-group focus days are appended.
 * - No flat min-3 zero fill.
 *
 * @returns {{ averages: object|null, bufferDays: string[], padCount: number, recordedFocusDays: number }|null}
 */
function compileExerciseWeekBuffer(exerciseId, weekStartMonday, options = {}) {
  const today = options.today || currentLocalDate();
  const focusMap = options.focusMap || dayFocus.getSchedule();
  const eligible = eligibleDaysForWeek(weekStartMonday, today);
  const eligibleSet = new Set(eligible);
  const entries = Array.isArray(options.entries)
    ? options.entries
    : (() => {
        const store = readEntries();
        return store.ok ? store.entries : [];
      })();

  const weekEntries = entries.filter((e) => {
    if (e.exerciseId !== exerciseId) return false;
    if (!eligibleSet.has(e.localDate)) return false;
    if (e.localDate < weekStartMonday) return false;
    if (e.localDate > addDays(weekStartMonday, 6)) return false;
    // Empty-focus weekdays never contribute (same as Feature 13 FR-006a).
    const dayKey = dayFocus.weekdayKeyForDate(e.localDate);
    return dayFocus.MUSCLE_GROUPS.some((g) =>
      (focusMap[g] || []).includes(dayKey),
    );
  });

  const byDay = new Map();
  for (const entry of weekEntries) {
    if (!byDay.has(entry.localDate)) byDay.set(entry.localDate, []);
    byDay.get(entry.localDate).push(entry);
  }
  if (!byDay.size) return null;

  const muscleGroup =
    options.muscleGroup != null
      ? options.muscleGroup
      : muscleGroupForExerciseId(exerciseId);

  const focusDays =
    muscleGroup && dayFocus.isFocusGroupActive(muscleGroup, focusMap)
      ? eligible.filter((d) => {
          const dayKey = dayFocus.weekdayKeyForDate(d);
          return (focusMap[muscleGroup] || []).includes(dayKey);
        })
      : [];

  const samples = [];
  let padCount = 0;
  let recordedFocusDays = 0;
  for (const day of focusDays) {
    if (byDay.has(day)) {
      samples.push(meanDayMetrics(byDay.get(day)));
      recordedFocusDays += 1;
    } else {
      samples.push(null);
      padCount += 1;
    }
  }

  const focusSet = new Set(focusDays);
  for (const day of [...byDay.keys()].sort()) {
    if (focusSet.has(day)) continue;
    samples.push(meanDayMetrics(byDay.get(day)));
  }

  const averages = averageBufferSamples(samples);
  if (!averages) return null;
  return {
    averages,
    bufferDays: focusDays,
    padTarget: focusDays.length,
    padCount,
    recordedFocusDays,
    recordedDays: [...byDay.keys()].sort(),
  };
}

/**
 * Compile weekly averages using per-exercise focus-day buffers (not a flat
 * min-3 zero pad across all 7 calendar days).
 */
function compileWeek(weekStartMonday, options = {}) {
  const today = options.today || currentLocalDate();
  const store = readEntries();
  if (!store.ok) return { ok: false, message: store.message };

  const eligible = eligibleDaysForWeek(weekStartMonday, today);
  const eligibleSet = new Set(eligible);
  const daysElapsed = eligible.length;
  const focusMap = options.focusMap || dayFocus.getSchedule();

  const weekEntries = store.entries.filter(
    (e) =>
      eligibleSet.has(e.localDate) &&
      e.localDate >= weekStartMonday &&
      e.localDate <= addDays(weekStartMonday, 6),
  );

  const recordedDays = new Set(weekEntries.map((e) => e.localDate));
  const exerciseIds = [...new Set(weekEntries.map((e) => e.exerciseId))];

  const averages = {};
  let padCount = 0;
  let padTarget = 0;
  for (const exerciseId of exerciseIds) {
    const compiled = compileExerciseWeekBuffer(exerciseId, weekStartMonday, {
      today,
      focusMap,
      entries: store.entries,
    });
    if (!compiled || !compiled.averages) continue;
    averages[exerciseId] = compiled.averages;
    padCount = Math.max(padCount, compiled.padCount);
    padTarget = Math.max(padTarget, compiled.padTarget);
  }

  return {
    ok: true,
    data: {
      weekStart: weekStartMonday,
      weekEnd: addDays(weekStartMonday, 6),
      inProgress: isWeekInProgress(weekStartMonday, today),
      daysElapsed,
      padTarget,
      recordedDayCount: recordedDays.size,
      padCount,
      averages,
      recordedDays: [...recordedDays].sort(),
    },
  };
}

/**
 * Drop averages for muscle groups with every focus day cleared so they do not
 * gate overall / next-tier rank-up. Unmapped exercises still count.
 */
function averagesForActiveFocusGroups(averages, options = {}) {
  const schedule = options.focusSchedule || dayFocus.getSchedule();
  const active = new Set(dayFocus.activeFocusGroups(schedule));
  const out = {};
  for (const [exerciseId, avg] of Object.entries(averages || {})) {
    const group = muscleGroupForExerciseId(exerciseId);
    if (group && !active.has(group)) continue;
    out[exerciseId] = avg;
  }
  return out;
}

function compareAveragesToTiers(averages, tiers, options = {}) {
  const nonUnranked = tiers
    .filter((t) => !isUnrankedName(t.name))
    .slice()
    .sort((a, b) => a.order - b.order);

  const rankedAverages = averagesForActiveFocusGroups(averages, options);
  const loggedIds = Object.keys(rankedAverages);
  // FR-005: highest tier such that every logged exercise with a threshold on that tier meets it
  let overall = null;
  for (const tier of nonUnranked) {
    const considered = loggedIds.filter(
      (id) => tier.thresholds && tier.thresholds[id],
    );
    if (considered.length === 0) continue;
    if (
      considered.every((id) =>
        meetsThreshold(rankedAverages[id], tier.thresholds[id]),
      )
    ) {
      overall = tier;
    }
  }

  return { overall, nonUnranked, loggedIds, rankedAverages };
}

function buildExerciseResults(averages, overall, nextTier, tiers) {
  const exercises = [];
  for (const [exerciseId, avg] of Object.entries(averages)) {
    const overallTargets =
      overall && overall.thresholds && overall.thresholds[exerciseId]
        ? overall.thresholds[exerciseId]
        : null;
    const nextTargets =
      nextTier && nextTier.thresholds && nextTier.thresholds[exerciseId]
        ? nextTier.thresholds[exerciseId]
        : null;
    exercises.push({
      exerciseId,
      name: exerciseDisplayName(exerciseId),
      averages: avg,
      targetTierName: overall ? overall.name : unrankedDisplayName(tiers),
      targets: overallTargets || {},
      meetsOverallTier: overall
        ? meetsThreshold(avg, overallTargets || {})
        : false,
      meetsNextTier: nextTier ? meetsThreshold(avg, nextTargets || {}) : false,
    });
  }
  return exercises;
}

function compareToRanks(weekStartMonday, options = {}) {
  const today = options.today || currentLocalDate();
  const compiled = compileWeek(weekStartMonday, { today });
  if (!compiled.ok) return compiled;

  const ranksResult = ensureRanks();
  if (!ranksResult.ok) return { ok: false, message: ranksResult.message };

  const { averages, recordedDayCount, inProgress } = compiled.data;
  const range = weekRange(weekStartMonday);

  if (recordedDayCount === 0) {
    return {
      ok: true,
      data: {
        weekStart: weekStartMonday,
        weekEnd: range.end,
        inProgress,
        overallTierId: 'UNRANKED',
        overallTierName: unrankedDisplayName(ranksResult.tiers),
        reason: 'No exercises logged this week.',
        nextTierName: null,
        nextTierMetCount: 0,
        nextTierTotalLogged: 0,
        exercises: [],
        padCount: compiled.data.padCount,
        recordedDayCount: 0,
      },
    };
  }

  const { overall, nonUnranked, loggedIds, rankedAverages } =
    compareAveragesToTiers(averages, ranksResult.tiers);

  let nextTier = null;
  if (overall) {
    nextTier = nonUnranked.find((t) => t.order === overall.order + 1) || null;
  } else {
    nextTier = nonUnranked[0] || null;
  }

  let nextTierMetCount = 0;
  let nextTierTotalLogged = 0;
  if (nextTier) {
    const considered = loggedIds.filter(
      (id) => nextTier.thresholds && nextTier.thresholds[id],
    );
    nextTierTotalLogged = considered.length;
    nextTierMetCount = considered.filter((id) =>
      meetsThreshold(rankedAverages[id], nextTier.thresholds[id]),
    ).length;
  }

  const exercises = buildExerciseResults(
    rankedAverages,
    overall,
    nextTier,
    ranksResult.tiers,
  );

  return {
    ok: true,
    data: {
      weekStart: weekStartMonday,
      weekEnd: range.end,
      inProgress,
      overallTierId: overall ? overall.tierId : 'UNRANKED',
      overallTierName: overall
        ? overall.name
        : unrankedDisplayName(ranksResult.tiers),
      reason: overall ? null : null,
      nextTierName: nextTier ? nextTier.name : null,
      nextTierMetCount,
      nextTierTotalLogged,
      exercises,
      recordedDayCount,
      padCount: compiled.data.padCount,
    },
  };
}

function compareDay(localDate, options = {}) {
  const store = readEntries();
  if (!store.ok) return { ok: false, message: store.message };
  const ranksResult = ensureRanks();
  if (!ranksResult.ok) return { ok: false, message: ranksResult.message };

  const dayEntries = store.entries.filter((e) => e.localDate === localDate);
  if (dayEntries.length === 0) {
    return {
      ok: true,
      data: {
        localDate,
        overallTierId: 'UNRANKED',
        overallTierName: unrankedDisplayName(ranksResult.tiers),
        reason: 'No exercises logged this week.',
        exercises: [],
      },
    };
  }

  const byExercise = new Map();
  for (const entry of dayEntries) {
    if (!byExercise.has(entry.exerciseId)) byExercise.set(entry.exerciseId, []);
    byExercise.get(entry.exerciseId).push(entry.metrics || {});
  }
  const averages = {};
  for (const [exerciseId, metricList] of byExercise.entries()) {
    const keys = new Set();
    metricList.forEach((m) => Object.keys(m).forEach((k) => keys.add(k)));
    const avg = {};
    for (const key of keys) {
      const values = metricList
        .map((m) => Number(m[key]))
        .filter((v) => Number.isFinite(v));
      if (!values.length) continue;
      avg[key] = roundMean(values.reduce((a, b) => a + b, 0) / values.length);
    }
    averages[exerciseId] = avg;
  }

  const { overall, nonUnranked, loggedIds, rankedAverages } =
    compareAveragesToTiers(averages, ranksResult.tiers);
  let nextTier = null;
  if (overall)
    nextTier = nonUnranked.find((t) => t.order === overall.order + 1) || null;
  else nextTier = nonUnranked[0] || null;

  return {
    ok: true,
    data: {
      localDate,
      overallTierId: overall ? overall.tierId : 'UNRANKED',
      overallTierName: overall
        ? overall.name
        : unrankedDisplayName(ranksResult.tiers),
      reason: overall ? null : null,
      nextTierName: nextTier ? nextTier.name : null,
      exercises: buildExerciseResults(
        rankedAverages,
        overall,
        nextTier,
        ranksResult.tiers,
      ),
      loggedIds,
    },
  };
}

function listAvailableWeeks(options = {}) {
  const today = options.today || currentLocalDate();
  const store = readEntries();
  if (!store.ok) return { ok: false, message: store.message };
  const mondays = new Set();
  for (const e of store.entries) {
    mondays.add(mondayOf(e.localDate));
  }
  mondays.add(mondayOf(today));
  return { ok: true, data: [...mondays].sort().reverse() };
}

/**
 * Target tier for workout / expectations (Feature 7 FR-007).
 *
 * Today’s workout shows the expectations needed to **maintain the current rank**
 * (not the next tier). Unranked users get the first ladder tier (Bronze I).
 *
 * When `forDayExpectations` is true, standing is evaluated as of the **start of
 * `today`** (week compile uses yesterday as the as-of date) so mid-day rank-ups
 * from today’s logs do not swap today’s expected list. Feature 14 may further
 * gate when that lock refreshes by day-focus selection.
 */
function getTargetTier(options = {}) {
  const today = options.today || currentLocalDate();
  const weekStart = mondayOf(today);
  const compareAsOf = options.forDayExpectations ? addDays(today, -1) : today;
  const compared = compareToRanks(weekStart, { today: compareAsOf });
  if (!compared.ok) return compared;
  const ranksResult = ensureRanks();
  if (!ranksResult.ok) return { ok: false, message: ranksResult.message };

  const nonUnranked = ranksResult.tiers
    .filter((t) => !isUnrankedName(t.name))
    .slice()
    .sort((a, b) => a.order - b.order);

  const overallName = compared.data.overallTierName;
  if (!overallName || isUnrankedName(overallName)) {
    return { ok: true, data: nonUnranked[0] || null };
  }
  const current = nonUnranked.find((t) => t.name === overallName);
  return { ok: true, data: current || nonUnranked[0] || null };
}

function lastCompletedWeekEndingBefore(dateIso) {
  // Last Sunday strictly before dateIso, then that week's Monday
  const dt = parseLocalDate(dateIso);
  // Walk back until we find a Sunday < dateIso
  let cursor = addDays(dateIso, -1);
  while (true) {
    const d = parseLocalDate(cursor);
    if (d.getDay() === 0) {
      return mondayOf(cursor);
    }
    cursor = addDays(cursor, -1);
    // safety
    if (cursor < '1970-01-01') return null;
  }
}

function weeksIntersectingMonth(year, month) {
  // month 1-12
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const weeks = [];
  let mon = mondayOf(first);
  while (
    compareIso(mon, last) <= 0 ||
    compareIso(addDays(mon, 6), first) >= 0
  ) {
    const end = addDays(mon, 6);
    if (compareIso(end, first) >= 0 && compareIso(mon, last) <= 0) {
      weeks.push(mon);
    }
    mon = addDays(mon, 7);
    if (compareIso(mon, addDays(last, 7)) > 0) break;
  }
  return weeks;
}

function getMonthProgression(year, month, options = {}) {
  const today = options.today || currentLocalDate();
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const monthComplete = compareIso(today, last) > 0;

  const startMonday = lastCompletedWeekEndingBefore(first);
  let startTierName = 'UNRANKED';
  if (startMonday) {
    const startCompare = compareToRanks(startMonday, { today });
    if (startCompare.ok) startTierName = startCompare.data.overallTierName;
  }

  let endTierName = 'UNRANKED';
  let endKind = 'latestFinishedWeek';

  if (monthComplete) {
    const lastWeekMon = mondayOf(last);
    const finish = compareToRanks(lastWeekMon, { today });
    if (finish.ok) endTierName = finish.data.overallTierName;
    endKind = 'periodComplete';
  } else {
    // most recently finished week intersecting month (Sunday <= today)
    const weeks = weeksIntersectingMonth(year, month);
    let best = null;
    for (const mon of weeks) {
      const end = addDays(mon, 6);
      if (compareIso(end, today) <= 0) {
        best = mon;
      }
    }
    if (best) {
      const cmp = compareToRanks(best, { today });
      if (cmp.ok) endTierName = cmp.data.overallTierName;
      endKind = 'latestFinishedWeek';
    } else {
      // no finished week yet - in-progress current week if it intersects
      const currentMon = mondayOf(today);
      if (weeks.includes(currentMon)) {
        const cmp = compareToRanks(currentMon, { today });
        if (cmp.ok) endTierName = cmp.data.overallTierName;
        endKind = 'inProgress';
      } else {
        endTierName = startTierName;
        endKind = 'latestFinishedWeek';
      }
    }
  }

  return {
    ok: true,
    data: {
      startTierName,
      endTierName,
      endKind,
      year,
      month,
    },
  };
}

function getYearProgression(year, options = {}) {
  const today = options.today || currentLocalDate();
  const jan1 = `${year}-01-01`;
  const dec31 = `${year}-12-31`;
  const yearComplete = compareIso(today, dec31) > 0;

  const startMonday = lastCompletedWeekEndingBefore(jan1);
  let startTierName = 'UNRANKED';
  if (startMonday) {
    const startCompare = compareToRanks(startMonday, { today });
    if (startCompare.ok) startTierName = startCompare.data.overallTierName;
  }

  let endTierName = 'UNRANKED';
  let endKind = 'latestFinishedWeek';

  if (yearComplete) {
    const lastWeekMon = mondayOf(dec31);
    const finish = compareToRanks(lastWeekMon, { today });
    if (finish.ok) endTierName = finish.data.overallTierName;
    endKind = 'periodComplete';
  } else {
    let best = null;
    for (
      let mon = mondayOf(jan1);
      compareIso(mon, dec31) <= 0;
      mon = addDays(mon, 7)
    ) {
      const end = addDays(mon, 6);
      if (compareIso(end, today) <= 0 && compareIso(mon, dec31) <= 0) {
        best = mon;
      }
      if (compareIso(addDays(mon, 7), addDays(dec31, 14)) > 0) break;
    }
    if (best) {
      const cmp = compareToRanks(best, { today });
      if (cmp.ok) endTierName = cmp.data.overallTierName;
      endKind = 'latestFinishedWeek';
    } else if (String(year) === today.slice(0, 4)) {
      const cmp = compareToRanks(mondayOf(today), { today });
      if (cmp.ok) endTierName = cmp.data.overallTierName;
      endKind = 'inProgress';
    } else {
      endTierName = startTierName;
    }
  }

  return {
    ok: true,
    data: {
      startTierName,
      endTierName,
      endKind,
      year,
    },
  };
}

function listActiveYears(options = {}) {
  const today = options.today || currentLocalDate();
  const store = readEntries();
  if (!store.ok) return { ok: false, message: store.message };
  const years = new Set();
  years.add(parseInt(today.slice(0, 4), 10));
  for (const e of store.entries) {
    years.add(parseInt(e.localDate.slice(0, 4), 10));
  }
  return { ok: true, data: [...years].sort((a, b) => b - a) };
}

function defaultDiagnosticWeek(options = {}) {
  const today = options.today || currentLocalDate();
  const mon = mondayOf(today);
  // FR-011: most recently completed week if today is Monday before any logs, else current week
  if (today === mon) {
    const store = readEntries();
    const hasTodayLogs =
      store.ok && store.entries.some((e) => e.localDate === today);
    if (!hasTodayLogs) {
      return addDays(mon, -7);
    }
  }
  return mon;
}

/** Test whether averages meet a specific tier's thresholds for one exercise (US-4.2 rest scenario). */
function exerciseMeetsTier(averages, targets) {
  return meetsThreshold(averages, targets);
}

module.exports = {
  weekRange,
  compileWeek,
  compileExerciseWeekBuffer,
  averageBufferSamples,
  meanDayMetrics,
  compareToRanks,
  compareDay,
  averagesForActiveFocusGroups,
  listAvailableWeeks,
  getTargetTier,
  getMonthProgression,
  getYearProgression,
  listActiveYears,
  mondayOf,
  eligibleDaysForWeek,
  defaultDiagnosticWeek,
  currentLocalDate,
  exerciseMeetsTier,
  meetsThreshold,
  __setClock,
  __setLocalDate,
  __resetTestHooks,
};
