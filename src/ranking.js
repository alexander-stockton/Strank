/**
 * Feature 4 — Weekly Ranking
 * Spec: features/feature-4-Weekly-Ranking.md
 */

const storage = require('./storage');
const ranks = require('./ranks');
const catalog = require('./catalog');
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
  const [y, m, d] = String(iso).split('-').map((n) => parseInt(n, 10));
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

/** Monday of the week containing localDate (Mon–Sun weeks). */
function mondayOf(localDate) {
  const dt = parseLocalDate(localDate);
  const day = dt.getDay(); // 0 Sun … 6 Sat
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
  // in progress: Mon … today
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

const HIGHER_BETTER = new Set([
  'weight',
  'reps',
  'sets',
  'durationSeconds',
  'durationGoSeconds',
  'durationSteps',
]);

function meetsThreshold(averages, targets) {
  if (!targets || typeof targets !== 'object') return true;
  for (const [key, threshold] of Object.entries(targets)) {
    const mean = averages[key];
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

/**
 * Compile weekly averages with passed-day window + zero padding (FR-002a–c, FR-003).
 */
function compileWeek(weekStartMonday, options = {}) {
  const today = options.today || currentLocalDate();
  const store = readEntries();
  if (!store.ok) return { ok: false, message: store.message };

  const eligible = new Set(eligibleDaysForWeek(weekStartMonday, today));
  const daysElapsed = eligible.size;
  const padTarget = Math.min(3, daysElapsed);

  const weekEntries = store.entries.filter(
    (e) => eligible.has(e.localDate) && e.localDate >= weekStartMonday && e.localDate <= addDays(weekStartMonday, 6)
  );

  const recordedDays = new Set(weekEntries.map((e) => e.localDate));
  const n = recordedDays.size;
  const padCount = Math.max(0, padTarget - n);

  // Group metric values per exercise
  const byExercise = new Map();
  for (const entry of weekEntries) {
    const id = entry.exerciseId;
    if (!byExercise.has(id)) byExercise.set(id, []);
    byExercise.get(id).push(entry.metrics || {});
  }

  const averages = {};
  for (const [exerciseId, metricList] of byExercise.entries()) {
    const keys = new Set();
    for (const m of metricList) {
      Object.keys(m).forEach((k) => keys.add(k));
    }
    const avg = {};
    for (const key of keys) {
      const values = metricList.map((m) => (m[key] != null ? Number(m[key]) : null)).filter((v) => v != null && Number.isFinite(v));
      // pad zeros for each real entry? Spec: padCount synthetic day contributions for that key
      // "all real entries ... plus padCount synthetic all-zeroes day contributions"
      const padded = values.concat(Array(padCount).fill(0));
      if (padded.length === 0) continue;
      const sum = padded.reduce((a, b) => a + b, 0);
      avg[key] = roundMean(sum / padded.length);
    }
    averages[exerciseId] = avg;
  }

  return {
    ok: true,
    data: {
      weekStart: weekStartMonday,
      weekEnd: addDays(weekStartMonday, 6),
      inProgress: isWeekInProgress(weekStartMonday, today),
      daysElapsed,
      padTarget,
      recordedDayCount: n,
      padCount,
      averages,
      recordedDays: [...recordedDays].sort(),
    },
  };
}

function exerciseDisplayName(exerciseId) {
  const ex = catalog.getActiveExercise
    ? catalog.getActiveExercise(exerciseId)
    : catalog.getExerciseById(exerciseId);
  return ex ? ex.name : exerciseId;
}

function compareAveragesToTiers(averages, tiers) {
  const nonUnranked = tiers
    .filter((t) => t.name.toUpperCase() !== 'UNRANKED')
    .slice()
    .sort((a, b) => a.order - b.order);

  const loggedIds = Object.keys(averages);
  // FR-005: highest tier such that every logged exercise with a threshold on that tier meets it
  let overall = null;
  for (const tier of nonUnranked) {
    const considered = loggedIds.filter((id) => tier.thresholds && tier.thresholds[id]);
    if (considered.length === 0) continue;
    if (considered.every((id) => meetsThreshold(averages[id], tier.thresholds[id]))) {
      overall = tier;
    }
  }

  return { overall, nonUnranked, loggedIds };
}

function buildExerciseResults(averages, overall, nextTier, tiers) {
  const exercises = [];
  for (const [exerciseId, avg] of Object.entries(averages)) {
    const overallTargets =
      overall && overall.thresholds && overall.thresholds[exerciseId] ? overall.thresholds[exerciseId] : null;
    const nextTargets =
      nextTier && nextTier.thresholds && nextTier.thresholds[exerciseId] ? nextTier.thresholds[exerciseId] : null;
    exercises.push({
      exerciseId,
      name: exerciseDisplayName(exerciseId),
      averages: avg,
      targetTierName: overall ? overall.name : 'UNRANKED',
      targets: overallTargets || {},
      meetsOverallTier: overall ? meetsThreshold(avg, overallTargets || {}) : false,
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
        overallTierName: 'UNRANKED',
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

  const { overall, nonUnranked, loggedIds } = compareAveragesToTiers(averages, ranksResult.tiers);

  let nextTier = null;
  if (overall) {
    nextTier = nonUnranked.find((t) => t.order === overall.order + 1) || null;
  } else {
    nextTier = nonUnranked[0] || null;
  }

  let nextTierMetCount = 0;
  let nextTierTotalLogged = 0;
  if (nextTier) {
    const considered = loggedIds.filter((id) => nextTier.thresholds && nextTier.thresholds[id]);
    nextTierTotalLogged = considered.length;
    nextTierMetCount = considered.filter((id) => meetsThreshold(averages[id], nextTier.thresholds[id])).length;
  }

  const exercises = buildExerciseResults(averages, overall, nextTier, ranksResult.tiers);

  return {
    ok: true,
    data: {
      weekStart: weekStartMonday,
      weekEnd: range.end,
      inProgress,
      overallTierId: overall ? overall.tierId : 'UNRANKED',
      overallTierName: overall ? overall.name : 'UNRANKED',
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
        overallTierName: 'UNRANKED',
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
      const values = metricList.map((m) => Number(m[key])).filter((v) => Number.isFinite(v));
      if (!values.length) continue;
      avg[key] = roundMean(values.reduce((a, b) => a + b, 0) / values.length);
    }
    averages[exerciseId] = avg;
  }

  const { overall, nonUnranked, loggedIds } = compareAveragesToTiers(averages, ranksResult.tiers);
  let nextTier = null;
  if (overall) nextTier = nonUnranked.find((t) => t.order === overall.order + 1) || null;
  else nextTier = nonUnranked[0] || null;

  return {
    ok: true,
    data: {
      localDate,
      overallTierId: overall ? overall.tierId : 'UNRANKED',
      overallTierName: overall ? overall.name : 'UNRANKED',
      reason: overall ? null : null,
      nextTierName: nextTier ? nextTier.name : null,
      exercises: buildExerciseResults(averages, overall, nextTier, ranksResult.tiers),
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

function getTargetTier(options = {}) {
  const today = options.today || currentLocalDate();
  const weekStart = mondayOf(today);
  const compared = compareToRanks(weekStart, { today });
  if (!compared.ok) return compared;
  const ranksResult = ensureRanks();
  if (!ranksResult.ok) return { ok: false, message: ranksResult.message };

  const nonUnranked = ranksResult.tiers
    .filter((t) => t.name.toUpperCase() !== 'UNRANKED')
    .slice()
    .sort((a, b) => a.order - b.order);

  const overallName = compared.data.overallTierName;
  if (!overallName || overallName.toUpperCase() === 'UNRANKED') {
    return { ok: true, data: nonUnranked[0] || null };
  }
  const current = nonUnranked.find((t) => t.name === overallName);
  if (!current) return { ok: true, data: nonUnranked[0] || null };
  const next = nonUnranked.find((t) => t.order === current.order + 1);
  return { ok: true, data: next || current };
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
  while (compareIso(mon, last) <= 0 || compareIso(addDays(mon, 6), first) >= 0) {
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
      // no finished week yet — in-progress current week if it intersects
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
    for (let mon = mondayOf(jan1); compareIso(mon, dec31) <= 0; mon = addDays(mon, 7)) {
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
    const hasTodayLogs = store.ok && store.entries.some((e) => e.localDate === today);
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
  compareToRanks,
  compareDay,
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
