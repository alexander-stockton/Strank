/**
 * Feature 12 - Rank difficulty scoring & auto-sort
 * Spec: features/feature-12-Rank-Editor.md (custom ranks list)
 */

const { isUnrankedName } = require('./rankTokens');
const travelPace = require('./travelPace');

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Perceived difficulty for one exercise from its threshold metrics.
 * Travel (distance + duration): scale × speed
 *   = (weight||1) × reps × sets × distance² / duration
 *   so pace and workout size both matter.
 * Otherwise: weight/volume plus duration and distance contributions.
 */
function exerciseDifficulty(thresholds) {
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

  let duration = 0;
  if (t.durationSeconds != null) duration = numberOrZero(t.durationSeconds);
  else if (t.durationGoSeconds != null || t.durationRestSeconds != null) {
    duration = numberOrZero(t.durationGoSeconds) + numberOrZero(t.durationRestSeconds);
  } else if (t.durationSteps != null) {
    duration = numberOrZero(t.durationSteps);
  }

  return loadFactor * volume + duration * setFactor + distance * 10;
}

/**
 * Average exercise difficulty for a tier (UNRANKED -> 0).
 */
function tierDifficulty(tier) {
  if (!tier) return 0;
  if (isUnrankedName(tier.name)) return 0;
  const exercises = Array.isArray(tier.exercises) ? tier.exercises : [];
  if (!exercises.length) return 0;
  let sum = 0;
  for (const ex of exercises) {
    sum += exerciseDifficulty(ex.thresholds || {});
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
  const unranked = [];
  const scored = [];
  list.forEach((tier, index) => {
    if (isUnrankedName(tier.name)) unranked.push(tier);
    else {
      const priorOrder = Number.isFinite(Number(tier.order)) ? Number(tier.order) : index + 1;
      scored.push({ tier, score: tierDifficulty(tier), priorOrder, index });
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
  exerciseDifficulty,
  tierDifficulty,
  sortTiersByDifficulty,
};
