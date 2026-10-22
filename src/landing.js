/**
 * Feature 7 — Landing Page
 * Spec: features/feature-7-Landing-Page.md
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const ranking = require('./ranking');
const ranks = require('./ranks');
const catalog = require('./catalog');
const storage = require('./storage');
const config = require('./config');
const landingConfig = require('./landingConfig');
const { getDataDir } = require('./paths');

function nonUnrankedTiers(tiers) {
  return (tiers || [])
    .filter((t) => t.name.toUpperCase() !== 'UNRANKED')
    .slice()
    .sort((a, b) => a.order - b.order);
}

function resolveBadgeUrl(tier) {
  if (!tier || !tier.badgePath) return null;
  const rel = String(tier.badgePath).replace(/^\{|\}$/g, '').trim();
  if (!rel) return null;
  const abs = path.resolve(getDataDir(), rel);
  const root = path.resolve(getDataDir());
  if (!(abs === root || abs.startsWith(root + path.sep))) return null;
  if (!fs.existsSync(abs)) return null;
  try {
    return pathToFileURL(abs).href;
  } catch (_) {
    return null;
  }
}

function resolveNotes(exerciseId, tierNotes) {
  if (tierNotes != null && String(tierNotes).trim()) return String(tierNotes).trim();
  const catEx =
    typeof catalog.getActiveExercise === 'function'
      ? catalog.getActiveExercise(exerciseId)
      : catalog.getExerciseById(exerciseId);
  return catEx && catEx.notes != null && String(catEx.notes).trim()
    ? String(catEx.notes).trim()
    : null;
}

function tierExpectations(tier) {
  if (!tier) return [];
  const list = [];
  if (Array.isArray(tier.exercises) && tier.exercises.length) {
    for (const ex of tier.exercises) {
      list.push({
        exerciseId: ex.exerciseId,
        name: ex.name || ex.exerciseId,
        headers: Array.isArray(ex.headers) ? [...ex.headers] : [],
        targets: { ...(ex.thresholds || {}) },
        notes: resolveNotes(ex.exerciseId, ex.notes),
        completed: false,
      });
    }
    return list;
  }
  // Fallback: thresholds map only
  for (const [exerciseId, targets] of Object.entries(tier.thresholds || {})) {
    const catEx =
      typeof catalog.getActiveExercise === 'function'
        ? catalog.getActiveExercise(exerciseId)
        : catalog.getExerciseById(exerciseId);
    list.push({
      exerciseId,
      name: catEx ? catEx.name : exerciseId,
      headers: catEx && catEx.headers ? [...catEx.headers] : [],
      targets: { ...targets },
      notes: resolveNotes(exerciseId, catEx && catEx.notes),
      completed: false,
    });
  }
  return list;
}

function todayMetricsByExercise(localDate) {
  const read = storage.readStore();
  if (!read.ok) return { ok: false, message: read.message, byId: new Map() };
  const byId = new Map();
  for (const entry of read.data.entries || []) {
    if (entry.localDate !== localDate) continue;
    if (!byId.has(entry.exerciseId)) byId.set(entry.exerciseId, []);
    byId.get(entry.exerciseId).push(entry.metrics || {});
  }
  const averages = new Map();
  for (const [exerciseId, metricList] of byId.entries()) {
    const keys = new Set();
    metricList.forEach((m) => Object.keys(m).forEach((k) => keys.add(k)));
    const avg = {};
    for (const key of keys) {
      const values = metricList.map((m) => Number(m[key])).filter((v) => Number.isFinite(v));
      if (!values.length) continue;
      avg[key] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
    }
    averages.set(exerciseId, avg);
  }
  return { ok: true, byId: averages };
}

function markCompleted(expectations, localDate) {
  const metrics = todayMetricsByExercise(localDate);
  if (!metrics.ok) {
    return expectations.map((e) => ({ ...e, completed: false, savedMetrics: null }));
  }
  return expectations.map((e) => {
    const avg = metrics.byId.get(e.exerciseId) || null;
    const completed = avg ? ranking.meetsThreshold(avg, e.targets) : false;
    return { ...e, completed, savedMetrics: avg };
  });
}

function findTierByName(tiers, name) {
  if (!name) return null;
  const target = String(name).toLowerCase();
  return tiers.find((t) => t.name.toLowerCase() === target) || null;
}

function getNextTierAbove(overallName, tiers) {
  const ladder = nonUnrankedTiers(tiers);
  if (!ladder.length) return null;
  if (!overallName || String(overallName).toUpperCase() === 'UNRANKED') {
    return ladder[0];
  }
  const current = findTierByName(ladder, overallName);
  if (!current) return ladder[0];
  return ladder.find((t) => t.order === current.order + 1) || null;
}

/**
 * Today’s expected exercises for the target tier (FR-005, FR-007).
 * Target is locked to day-start standing so mid-day rank-ups do not replace the list.
 * Day-focus filtering / when the lock refreshes is Feature 15 — full tree until then (FR-008).
 */
function getTodayExpectations(localDate) {
  const date = localDate || ranking.currentLocalDate();
  const ranksResult = ranks.loadRanks();
  if (!ranksResult.ok) return { ok: false, message: ranksResult.message };

  const targetResult = ranking.getTargetTier({ today: date, forDayExpectations: true });
  if (!targetResult.ok) return targetResult;
  const target = targetResult.data;
  if (!target) {
    return { ok: true, data: [], targetTierName: null };
  }

  const tier = findTierByName(ranksResult.data, target.name) || target;
  const expectations = markCompleted(tierExpectations(tier), date);
  return { ok: true, data: expectations, targetTierName: tier.name };
}

/**
 * Next tier threshold list above current overall standing (FR-006).
 */
function getNextRankExpectations(options = {}) {
  const today = options.today || ranking.currentLocalDate();
  const ranksResult = ranks.loadRanks();
  if (!ranksResult.ok) return { ok: false, message: ranksResult.message };

  const weekStart = ranking.mondayOf(today);
  const compared = ranking.compareToRanks(weekStart, { today });
  if (!compared.ok) return compared;

  const overallName = compared.data.overallTierName;
  const nextTier = getNextTierAbove(overallName, ranksResult.data);
  if (!nextTier) {
    return {
      ok: true,
      data: [],
      nextTierName: null,
      atTop: true,
      overallRankName: overallName,
    };
  }

  return {
    ok: true,
    data: tierExpectations(nextTier).map((e) => ({ ...e, completed: false })),
    nextTierName: nextTier.name,
    atTop: false,
    overallRankName: overallName,
  };
}

function isWorkoutComplete(localDate) {
  const date = localDate || ranking.currentLocalDate();
  const today = getTodayExpectations(date);
  if (!today.ok) return { ok: false, message: today.message };
  if (!today.data.length) return { ok: true, data: false };
  return { ok: true, data: today.data.every((e) => e.completed) };
}

/**
 * Full landing model for a day (FR LandingModel).
 */
function getLandingModel(localDate) {
  const date = localDate || ranking.currentLocalDate();
  config.load();

  const ranksResult = ranks.loadRanks();
  if (!ranksResult.ok) {
    return { ok: false, message: ranksResult.message };
  }

  const weekStart = ranking.mondayOf(date);
  const compared = ranking.compareToRanks(weekStart, { today: date });
  if (!compared.ok) return compared;

  const overallRankName = compared.data.overallTierName || 'UNRANKED';
  const overallTier = findTierByName(ranksResult.data, overallRankName);
  const overallBadgePath = overallTier ? overallTier.badgePath || null : null;
  const overallBadgeUrl = resolveBadgeUrl(overallTier);

  const today = getTodayExpectations(date);
  if (!today.ok) return today;

  const next = getNextRankExpectations({ today: date });
  if (!next.ok) return next;

  const complete = isWorkoutComplete(date);
  if (!complete.ok) return complete;

  const alignment = config.getNavbarAlignment();
  landingConfig.load();

  return {
    ok: true,
    data: {
      localDate: date,
      overallRankName,
      overallBadgePath,
      overallBadgeUrl,
      targetTierName: today.targetTierName,
      nextTierName: next.nextTierName,
      atTopOfLadder: Boolean(next.atTop),
      todayExpectations: today.data,
      nextRankExpectations: next.data,
      workoutComplete: complete.data,
      navbarAlignment: alignment,
      visibility: {
        expectations: landingConfig.isLandingPanelVisible('landing expectations visible'),
        nextRank: landingConfig.isLandingPanelVisible('landing next rank visible'),
        getStarted: landingConfig.isLandingPanelVisible('landing get started visible'),
        skillProgress: landingConfig.isLandingPanelVisible('landing skill progress visible'),
      },
    },
  };
}

module.exports = {
  getLandingModel,
  getTodayExpectations,
  getNextRankExpectations,
  isWorkoutComplete,
  resolveBadgeUrl,
  tierExpectations,
};
