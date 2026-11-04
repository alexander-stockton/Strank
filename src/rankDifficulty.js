/**
 * Feature 12 - Rank difficulty scoring & auto-sort
 * Spec: features/feature-12-Rank-Editor.md (custom ranks list)
 */

const { isUnrankedName } = require('./rankTokens');
const travelPace = require('./travelPace');

/** Full duration contribution (timed holds that start with a real standard). */
const DURATION_WEIGHT_PRIMARY = 1;
/**
 * Duration contribution when Bronze I (first ladder tier) baseline is 0h0m0s —
 * time is optional / secondary for that exercise lineage.
 */
const DURATION_WEIGHT_SECONDARY = 0.05;

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function durationSecondsOf(thresholds) {
  const t = thresholds || {};
  if (t.durationSeconds != null) return numberOrZero(t.durationSeconds);
  if (t.durationGoSeconds != null || t.durationRestSeconds != null) {
    return numberOrZero(t.durationGoSeconds) + numberOrZero(t.durationRestSeconds);
  }
  if (t.durationSteps != null) return numberOrZero(t.durationSteps);
  return 0;
}

/**
 * Map exerciseId -> Bronze I (first ladder tier) duration seconds.
 * Missing ids are omitted (callers treat unknown as primary/full weight).
 */
function bronzeIDurationBaselines(tiers) {
  const list = Array.isArray(tiers) ? tiers : [];
  const ladder = list.filter((t) => t && !isUnrankedName(t.name));
  if (!ladder.length) return {};
  const base = ladder.reduce((best, tier) => {
    const bo = Number.isFinite(Number(best.order)) ? Number(best.order) : Infinity;
    const to = Number.isFinite(Number(tier.order)) ? Number(tier.order) : Infinity;
    return to < bo ? tier : best;
  });
  const map = Object.create(null);
  for (const ex of base.exercises || []) {
    const id = ex && ex.exerciseId;
    if (!id) continue;
    map[id] = durationSecondsOf(ex.thresholds || {});
  }
  return map;
}

/**
 * Perceived difficulty for one exercise from its threshold metrics.
 * Travel (distance + duration): scale × speed
 *   = (weight||1) × reps × sets × distance² / duration
 *   so pace and workout size both matter.
 * Otherwise: weight/volume plus duration and distance contributions.
 *
 * Duration weighing:
 * - 0h0m0s (duration <= 0): not weighed
 * - Bronze I baseline was 0h0m0s: weighed at DURATION_WEIGHT_SECONDARY
 * - otherwise: full DURATION_WEIGHT_PRIMARY
 *
 * @param {object} thresholds
 * @param {{ durationIsSecondary?: boolean }} [options]
 */
function exerciseDifficulty(thresholds, options = {}) {
  const t = thresholds || {};
  const weight = numberOrZero(t.weight);
  const distance = numberOrZero(t.distance);
  const reps = Math.max(numberOrZero(t.reps), 0);
  const sets = Math.max(numberOrZero(t.sets), 0);
  const repFactor = Math.max(reps, 1);
  const setFactor = Math.max(sets, 1);
  const volume = repFactor * setFactor;
  const loadFactor = weight > 0 ? weight : 1;

  if (travelPace.hasTravelPair(t)) {
    const score = travelPace.travelScore(t);
    return (score != null ? score : 0) * 1000;
  }

  const duration = durationSecondsOf(t);
  let durationTerm = 0;
  if (duration > 0) {
    const coeff =
      options.durationIsSecondary === true
        ? DURATION_WEIGHT_SECONDARY
        : DURATION_WEIGHT_PRIMARY;
    durationTerm = duration * setFactor * coeff;
  }

  return loadFactor * volume + durationTerm + distance * 10;
}

/**
 * Average exercise difficulty for a tier (UNRANKED -> 0).
 * @param {object} tier
 * @param {{ bronzeIDurations?: Record<string, number> }} [options]
 */
function tierDifficulty(tier, options = {}) {
  if (!tier) return 0;
  if (isUnrankedName(tier.name)) return 0;
  const exercises = Array.isArray(tier.exercises) ? tier.exercises : [];
  if (!exercises.length) return 0;
  const baselines = options.bronzeIDurations || null;
  let sum = 0;
  for (const ex of exercises) {
    const id = ex && ex.exerciseId;
    const durationIsSecondary =
      baselines != null &&
      id &&
      Object.prototype.hasOwnProperty.call(baselines, id) &&
      numberOrZero(baselines[id]) <= 0;
    sum += exerciseDifficulty(ex.thresholds || {}, { durationIsSecondary });
  }
  return sum / exercises.length;
}

/**
 * Sort tiers by ascending difficulty. UNRANKED always stays first.
 * Equal scores keep prior ladder order (`tier.order`) so editing/renaming an
 * exercise does not reshuffle peers that share the same difficulty.
 */
function sortTiersByDifficulty(tiers) {
  const list = Array.isArray(tiers) ? [...tiers] : [];
  const baselines = bronzeIDurationBaselines(list);
  const unranked = [];
  const scored = [];
  list.forEach((tier, index) => {
    if (isUnrankedName(tier.name)) unranked.push(tier);
    else {
      const priorOrder = Number.isFinite(Number(tier.order)) ? Number(tier.order) : index + 1;
      scored.push({
        tier,
        score: tierDifficulty(tier, { bronzeIDurations: baselines }),
        priorOrder,
        index,
      });
    }
  });
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.priorOrder !== b.priorOrder) return a.priorOrder - b.priorOrder;
    return a.index - b.index;
  });
  return [...unranked, ...scored.map((s) => s.tier)];
}

module.exports = {
  DURATION_WEIGHT_PRIMARY,
  DURATION_WEIGHT_SECONDARY,
  durationSecondsOf,
  bronzeIDurationBaselines,
  exerciseDifficulty,
  tierDifficulty,
  sortTiersByDifficulty,
};
