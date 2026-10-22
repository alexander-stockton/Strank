/**
 * Feature 12 — Rank difficulty scoring & auto-sort
 * Spec: features/feature-12-Rank-Editor.md (custom ranks list)
 */

const { isUnrankedName } = require('./rankTokens');

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Perceived difficulty for one exercise from its threshold metrics.
 * Combines weight, distance, duration, reps, and sets.
 */
function exerciseDifficulty(thresholds) {
  const t = thresholds || {};
  const weight = numberOrZero(t.weight);
  const distance = numberOrZero(t.distance);
  const reps = Math.max(numberOrZero(t.reps), 0);
  const sets = Math.max(numberOrZero(t.sets), 0);
  let duration = 0;
  if (t.durationSeconds != null) duration = numberOrZero(t.durationSeconds);
  else if (t.durationGoSeconds != null || t.durationRestSeconds != null) {
    duration = numberOrZero(t.durationGoSeconds) + numberOrZero(t.durationRestSeconds);
  } else if (t.durationSteps != null) {
    duration = numberOrZero(t.durationSteps);
  }

  const repFactor = Math.max(reps, 1);
  const setFactor = Math.max(sets, 1);
  // Weight × volume + duration × sets + light distance contribution
  return weight * repFactor * setFactor + duration * setFactor + distance * 10;
}

/**
 * Average exercise difficulty for a tier (UNRANKED → 0).
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
 * Stable for equal scores (preserves relative order).
 */
function sortTiersByDifficulty(tiers) {
  const list = Array.isArray(tiers) ? [...tiers] : [];
  const unranked = [];
  const scored = [];
  list.forEach((tier, index) => {
    if (isUnrankedName(tier.name)) unranked.push(tier);
    else scored.push({ tier, score: tierDifficulty(tier), index });
  });
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.index - b.index;
  });
  return [...unranked, ...scored.map((s) => s.tier)];
}

module.exports = {
  exerciseDifficulty,
  tierDifficulty,
  sortTiersByDifficulty,
};
