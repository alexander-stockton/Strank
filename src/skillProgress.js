/**
 * Feature 13 - Skill Progress Landing
 * Spec: features/feature-13-Skill-Progress-Landing.md
 */

const storage = require('./storage');
const ranks = require('./ranks');
const ranking = require('./ranking');
const landingConfig = require('./landingConfig');
const catalog = require('./catalog');
const config = require('./config');
const { formatLocalDate } = require('./appDate');
const { formatDurationSeconds, isTimeDurationKey } = require('./parse/duration');
const travelPace = require('./travelPace');
const i18n = require('./i18n');
const { isUnrankedName, unrankedDisplayName, muscleGroupFromHeader, GROUP_ALIASES } = require('./rankTokens');

const MUSCLE_GROUPS = ['arms', 'core', 'lungs', 'legs'];
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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

function roundMean(value) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10) / 10;
}

function roundHalfUp(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value + 0.5);
}

function ensureRanks() {
  const loaded = ranks.loadRanks();
  if (!loaded.ok) return { ok: false, message: loaded.message, tiers: [] };
  return { ok: true, tiers: loaded.data || [] };
}

function nonUnrankedTiers(tiers) {
  return (tiers || [])
    .filter((t) => !isUnrankedName(t.name))
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function ladderIndexForName(tiers, tierName) {
  const name = String(tierName || 'UNRANKED').trim();
  if (!name || isUnrankedName(name)) return 0;
  const ordered = nonUnrankedTiers(tiers);
  const idx = ordered.findIndex((t) => String(t.name).toUpperCase() === name.toUpperCase());
  return idx >= 0 ? idx + 1 : 0;
}

function tierNameForIndex(tiers, index) {
  if (!index || index <= 0) return unrankedDisplayName(tiers);
  const ordered = nonUnrankedTiers(tiers);
  const tier = ordered[index - 1];
  return tier ? tier.name : ordered.length ? ordered[ordered.length - 1].name : unrankedDisplayName(tiers);
}

function muscleGroupFromHeaders(headers) {
  for (const h of headers || []) {
    const group = muscleGroupFromHeader(h);
    if (group) return group;
  }
  return null;
}

/**
 * Union of leaf exercises across non-UNRANKED tiers, keyed by exerciseId.
 */
function collectSkills(tiers) {
  const byId = new Map();
  for (const tier of nonUnrankedTiers(tiers)) {
    for (const ex of tier.exercises || []) {
      const exerciseId = ex.exerciseId || null;
      if (!exerciseId) continue;
      const muscleGroup = muscleGroupFromHeaders(ex.headers);
      if (!muscleGroup) continue;
      if (byId.has(exerciseId)) continue;
      byId.set(exerciseId, {
        exerciseId,
        name: ex.name || exerciseId,
        muscleGroup,
        headers: Array.isArray(ex.headers) ? [...ex.headers] : [],
      });
    }
  }
  return [...byId.values()];
}

function thresholdsForExercise(tier, exerciseId) {
  if (!tier) return null;
  if (tier.thresholds && tier.thresholds[exerciseId]) return tier.thresholds[exerciseId];
  const ex = (tier.exercises || []).find((e) => e.exerciseId === exerciseId);
  return ex && ex.thresholds ? ex.thresholds : null;
}

function parseFocusDays(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function focusDaysByGroup() {
  landingConfig.load();
  const s = landingConfig.get();
  return {
    arms: parseFocusDays(s['focus arms days']),
    core: parseFocusDays(s['focus core days']),
    lungs: parseFocusDays(s['focus lungs days']),
    legs: parseFocusDays(s['focus legs days']),
  };
}

function weekdayKey(isoDate) {
  const day = parseLocalDate(isoDate).getDay();
  return WEEKDAY_KEYS[day];
}

function dayHasFocusForGroup(isoDate, muscleGroup, focusMap) {
  const map = focusMap || focusDaysByGroup();
  const group = GROUP_ALIASES[String(muscleGroup || '').toLowerCase()] || muscleGroup;
  const days = map[group] || [];
  return days.includes(weekdayKey(isoDate));
}

/**
 * Feature 4 eligible days for the week, further restricted to focus days for `muscleGroup`.
 */
function focusEligibleDays(weekStartMonday, muscleGroup, today, focusMap) {
  const base = ranking.eligibleDaysForWeek(weekStartMonday, today);
  return base.filter((d) => dayHasFocusForGroup(d, muscleGroup, focusMap));
}

function readEntries() {
  const read = storage.readStore();
  if (!read.ok) return [];
  return read.data.entries || [];
}

/**
 * Weekly average for one skill on focus-filtered days (FR-006 / FR-006a).
 * Returns null when the week has no eligible recorded day for this skill.
 */
function compileSkillWeekAverage(exerciseId, muscleGroup, weekStartMonday, options = {}) {
  const today = options.today || ranking.currentLocalDate();
  const focusMap = options.focusMap || focusDaysByGroup();
  const eligible = focusEligibleDays(weekStartMonday, muscleGroup, today, focusMap);
  const daysElapsed = eligible.length;
  const padTarget = Math.min(3, daysElapsed);
  const eligibleSet = new Set(eligible);

  const entries = readEntries().filter(
    (e) => e.exerciseId === exerciseId && eligibleSet.has(e.localDate)
  );
  const recordedDays = new Set(entries.map((e) => e.localDate));
  if (recordedDays.size === 0) return null;

  const padCount = Math.max(0, padTarget - recordedDays.size);
  const metricList = entries.map((e) => e.metrics || {});
  const keys = new Set();
  for (const m of metricList) Object.keys(m).forEach((k) => keys.add(k));

  const avg = {};
  for (const key of keys) {
    const values = metricList
      .map((m) => (m[key] != null ? Number(m[key]) : null))
      .filter((v) => v != null && Number.isFinite(v));
    const padded = values.concat(Array(padCount).fill(0));
    if (!padded.length) continue;
    const sum = padded.reduce((a, b) => a + b, 0);
    avg[key] = roundMean(sum / padded.length);
  }
  return avg;
}

/**
 * Most recent weekly average: current week first, then walk prior weeks.
 */
function mostRecentWeeklyAverage(exerciseId, muscleGroup, options = {}) {
  const today = options.today || ranking.currentLocalDate();
  const focusMap = options.focusMap || focusDaysByGroup();
  let weekStart = options.weekStartMonday || ranking.mondayOf(today);

  for (let i = 0; i < 104; i += 1) {
    const avg = compileSkillWeekAverage(exerciseId, muscleGroup, weekStart, {
      today,
      focusMap,
    });
    if (avg) return { averages: avg, weekStart };
    weekStart = addDays(weekStart, -7);
  }
  return { averages: null, weekStart: null };
}

/**
 * Highest met tier for one skill (FR-007).
 */
function localRankForExercise(exerciseId, averages, options = {}) {
  const ranksResult = options.tiers ? { ok: true, tiers: options.tiers } : ensureRanks();
  if (!ranksResult.ok) {
    return { name: unrankedDisplayName(), index: 0, tier: null };
  }
  if (!averages || typeof averages !== 'object') {
    return { name: unrankedDisplayName(ranksResult.tiers), index: 0, tier: null };
  }

  const ordered = nonUnrankedTiers(ranksResult.tiers);
  let best = null;
  for (const tier of ordered) {
    const targets = thresholdsForExercise(tier, exerciseId);
    if (!targets || !Object.keys(targets).length) continue;
    if (ranking.meetsThreshold(averages, targets)) best = tier;
  }
  if (!best) return { name: unrankedDisplayName(ranksResult.tiers), index: 0, tier: null };
  return {
    name: best.name,
    index: ladderIndexForName(ranksResult.tiers, best.name),
    tier: best,
  };
}

function metricProgress(a, tCur, tNext, key) {
  const A = Number(a);
  const cur = Number(tCur);
  const next = Number(tNext);
  if (!Number.isFinite(A) || !Number.isFinite(cur) || !Number.isFinite(next)) return 0;
  if (key === 'durationRestSeconds') {
    // Lower rest is better; T_next should be < T_cur when progressing
    if (cur === next) return A <= next ? 1 : 0;
    if (next < cur) return Math.min(1, Math.max(0, (cur - A) / (cur - next)));
    return Math.min(1, Math.max(0, (A - cur) / (next - cur)));
  }
  if (cur === next) return A >= next ? 1 : 0;
  return Math.min(1, Math.max(0, (A - cur) / (next - cur)));
}

/** Absolute amount still needed on one metric to hit T_next (0 when met). */
function metricRemaining(a, tNext, key) {
  const A = Number(a);
  const next = Number(tNext);
  if (!Number.isFinite(next)) return null;
  if (!Number.isFinite(A)) {
    return Math.abs(next);
  }
  if (key === 'durationRestSeconds') {
    // Need to get rest down to `next`
    return Math.max(0, A - next);
  }
  return Math.max(0, next - A);
}

function formatRemainingAmount(key, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (key === 'pace') {
    // Remaining time-per-unit (seconds per distance unit) → show as duration / unit
    const unit = config.getDistanceUnits ? config.getDistanceUnits() : 'mi';
    const dur = formatDurationSeconds(amount);
    return dur ? `${dur}/${unit}` : null;
  }
  if (key === 'travelScale') {
    // Scale deficit in distance-units (load×vol folded in); show as distance.
    const unit = config.getDistanceUnits ? config.getDistanceUnits() : 'mi';
    const n = Math.round(amount * 100) / 100;
    return `${n} ${unit}`;
  }
  if (isTimeDurationKey(key)) {
    return formatDurationSeconds(amount);
  }
  if (key === 'weight') {
    const unit = config.getWeightUnits ? config.getWeightUnits() : 'lbs';
    const n = Math.round(amount * 10) / 10;
    return `${n} ${unit}`;
  }
  if (key === 'distance') {
    const unit = config.getDistanceUnits ? config.getDistanceUnits() : 'mi';
    const n = Math.round(amount * 100) / 100;
    return `${n} ${unit}`;
  }
  if (key === 'reps' || key === 'sets' || key === 'durationSteps') {
    const n = Math.ceil(amount - 1e-9);
    return String(n);
  }
  const n = Math.round(amount * 10) / 10;
  return String(n);
}

/**
 * Compact “X to go!” for the metric with the most still needed toward T_next.
 */
function remainingToGoLabel(averages, tNext) {
  if (!tNext || typeof tNext !== 'object') return null;
  let bestKey = null;
  let bestRem = 0;
  for (const key of Object.keys(tNext)) {
    const A = averages && averages[key] != null ? Number(averages[key]) : NaN;
    const rem = metricRemaining(A, tNext[key], key);
    if (rem != null && rem > bestRem) {
      bestRem = rem;
      bestKey = key;
    }
  }
  if (!bestKey || !(bestRem > 0)) return null;
  const formatted = formatRemainingAmount(bestKey, bestRem);
  return formatted ? i18n.t('skill.toGo', { amount: formatted }) : null;
}

/**
 * Progress 0..1 toward the next local-rank threshold (FR-008-FR-009).
 */
function progressTowardNext(exerciseId, averages, options = {}) {
  const ranksResult = options.tiers ? { ok: true, tiers: options.tiers } : ensureRanks();
  if (!ranksResult.ok) {
    return {
      progress: 0,
      nextRankName: null,
      localRankName: unrankedDisplayName(ranksResult.tiers),
      localRankIndex: 0,
      remainingLabel: null,
    };
  }

  const ordered = nonUnrankedTiers(ranksResult.tiers).filter((t) => {
    const targets = thresholdsForExercise(t, exerciseId);
    return targets && Object.keys(targets).length > 0;
  });

  const local = localRankForExercise(exerciseId, averages, { tiers: ranksResult.tiers });
  if (!ordered.length) {
    return {
      progress: averages ? 1 : 0,
      nextRankName: null,
      localRankName: local.name,
      localRankIndex: local.index,
      remainingLabel: null,
    };
  }

  let curIdx = -1;
  if (local.index > 0) {
    curIdx = ordered.findIndex((t) => String(t.name).toUpperCase() === String(local.name).toUpperCase());
  }
  const nextTier = curIdx < 0 ? ordered[0] : ordered[curIdx + 1] || null;

  if (!nextTier) {
    return {
      progress: 1,
      nextRankName: null,
      localRankName: local.name,
      localRankIndex: local.index,
      remainingLabel: null,
    };
  }

  const tNext = thresholdsForExercise(nextTier, exerciseId) || {};
  let tCur = {};
  if (curIdx >= 0) {
    tCur = thresholdsForExercise(ordered[curIdx], exerciseId) || {};
  } else {
    // UNRANKED: progress from below first tier (T_cur = 0 for each next key)
    for (const key of Object.keys(tNext)) tCur[key] = 0;
  }

  if (!averages) {
    return {
      progress: 0,
      nextRankName: nextTier.name,
      localRankName: local.name,
      localRankIndex: local.index,
      remainingLabel: remainingToGoLabel({}, tNext),
    };
  }

  const keys = Object.keys(tNext);
  if (!keys.length) {
    return {
      progress: 1,
      nextRankName: nextTier.name,
      localRankName: local.name,
      localRankIndex: local.index,
      remainingLabel: null,
    };
  }

  let minProg = 1;
  let gateKey = null;
  let gateRemaining = null;

  const useTravel = travelPace.hasTravelPair(tNext);
  const absorbed = useTravel ? travelPace.travelAbsorbedKeys(tNext) : new Set();

  if (useTravel) {
    const nextPace = travelPace.timePerUnit(tNext);
    let curPace = travelPace.hasTravelPair(tCur) ? travelPace.timePerUnit(tCur) : null;
    // UNRANKED / missing cur: start from a slower pace (2× next) so the bar can fill.
    if (curPace == null || !Number.isFinite(curPace) || !(curPace > 0)) {
      curPace = nextPace != null ? nextPace * 2 : null;
    }
    const aPace = travelPace.timePerUnit(averages);
    const paceP = travelPace.paceProgress(aPace, curPace, nextPace);

    const nextScale = travelPace.travelScale(tNext);
    let curScale = travelPace.travelScale(tCur);
    if (curScale == null || !Number.isFinite(curScale) || !(curScale >= 0)) {
      curScale = 0;
    }
    const aScale = travelPace.travelScale(averages);
    const scaleP = travelPace.scaleProgress(aScale, curScale, nextScale);

    if (paceP <= scaleP) {
      minProg = paceP;
      gateKey = 'pace';
      gateRemaining = travelPace.paceRemaining(aPace, nextPace);
    } else {
      minProg = scaleP;
      gateKey = 'travelScale';
      gateRemaining = travelPace.scaleRemaining(aScale, nextScale);
    }
  }

  for (const key of keys) {
    if (absorbed.has(key)) continue;
    const p = metricProgress(averages[key], tCur[key] != null ? tCur[key] : 0, tNext[key], key);
    if (p < minProg) {
      minProg = p;
      gateKey = key;
      gateRemaining = metricRemaining(averages[key], tNext[key], key);
    } else if (gateKey == null) {
      gateKey = key;
      gateRemaining = metricRemaining(averages[key], tNext[key], key);
    }
  }

  let remainingLabel = null;
  if (gateKey != null && gateRemaining > 0) {
    const formatted = formatRemainingAmount(gateKey, gateRemaining);
    if (formatted) remainingLabel = i18n.t('skill.toGo', { amount: formatted });
  }

  return {
    progress: minProg,
    nextRankName: nextTier.name,
    localRankName: local.name,
    localRankIndex: local.index,
    remainingLabel,
  };
}

/**
 * Average-of-locals overall (FR-011).
 * @param {Array<{ name?: string, index?: number }|string|number>} localRanks
 * @param {object[]} [tiers]
 */
function getOverallFromLocals(localRanks, tiers) {
  const ranksResult = tiers ? { ok: true, tiers } : ensureRanks();
  const allTiers = ranksResult.ok ? ranksResult.tiers : [];
  const list = Array.isArray(localRanks) ? localRanks : [];
  if (!list.length) {
    return { overallRankName: unrankedDisplayName(allTiers), overallRankIndex: 0 };
  }

  const indices = list.map((item) => {
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (typeof item === 'string') return ladderIndexForName(allTiers, item);
    if (item && typeof item.index === 'number') return item.index;
    if (item && item.name != null) return ladderIndexForName(allTiers, item.name);
    return 0;
  });

  const mean = indices.reduce((a, b) => a + b, 0) / indices.length;
  const overallRankIndex = roundHalfUp(mean);
  const overallRankName = tierNameForIndex(allTiers, overallRankIndex);
  return { overallRankName, overallRankIndex, mean };
}

/**
 * Four-column skill progress model + overall (FR-001-FR-012).
 */
function getSkillProgressModel(weekStartMonday, options = {}) {
  const today = options.today || ranking.currentLocalDate();
  const ranksResult = ensureRanks();
  if (!ranksResult.ok) {
    return { ok: false, message: ranksResult.message };
  }

  const focusMap = focusDaysByGroup();
  const skills = collectSkills(ranksResult.tiers);
  const columns = { arms: [], core: [], lungs: [], legs: [] };
  const localRanks = [];

  for (const skill of skills) {
    const recent = mostRecentWeeklyAverage(skill.exerciseId, skill.muscleGroup, {
      today,
      weekStartMonday: weekStartMonday || ranking.mondayOf(today),
      focusMap,
    });
    const averages = recent.averages;
    const prog = progressTowardNext(skill.exerciseId, averages, { tiers: ranksResult.tiers });
    const row = {
      exerciseId: skill.exerciseId,
      name: skill.name,
      muscleGroup: skill.muscleGroup,
      weeklyAverage: averages,
      localRankName: prog.localRankName,
      localRankIndex: prog.localRankIndex,
      nextRankName: prog.nextRankName,
      progress: prog.progress,
      remainingLabel: prog.remainingLabel || null,
    };
    columns[skill.muscleGroup].push(row);
    localRanks.push({ name: row.localRankName, index: row.localRankIndex });
  }

  const overall = getOverallFromLocals(localRanks, ranksResult.tiers);
  const empty =
    !columns.arms.length && !columns.core.length && !columns.lungs.length && !columns.legs.length;

  return {
    ok: true,
    data: {
      columns,
      overallRankName: overall.overallRankName,
      overallRankIndex: overall.overallRankIndex,
      empty,
      skills,
    },
  };
}

function displayName(exerciseId) {
  const ex = catalog.getActiveExercise
    ? catalog.getActiveExercise(exerciseId)
    : catalog.getExerciseById(exerciseId);
  return ex ? ex.name : exerciseId;
}

module.exports = {
  getSkillProgressModel,
  localRankForExercise,
  progressTowardNext,
  getOverallFromLocals,
  collectSkills,
  muscleGroupFromHeaders,
  compileSkillWeekAverage,
  mostRecentWeeklyAverage,
  focusEligibleDays,
  dayHasFocusForGroup,
  focusDaysByGroup,
  ladderIndexForName,
  tierNameForIndex,
  displayName,
  remainingToGoLabel,
  formatRemainingAmount,
  metricRemaining,
  MUSCLE_GROUPS,
};
