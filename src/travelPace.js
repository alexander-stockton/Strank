/**
 * Travel / walking judgment when distance + duration are both present.
 *
 * Pace (time-per-unit): lower is better.
 * Scale: (weight||1) × (reps||1) × (sets||1) × distance — higher is better.
 * Score (difficulty / impressiveness): scale × speed = scale × distance / duration
 *   so short high-pace bursts don't outrank long loaded efforts.
 */

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Active travel duration in seconds (not rest). */
function primaryDurationSeconds(metrics) {
  const m = metrics || {};
  if (m.durationSeconds != null) {
    const n = numberOrNull(m.durationSeconds);
    if (n != null && n > 0) return n;
  }
  if (m.durationGoSeconds != null) {
    const n = numberOrNull(m.durationGoSeconds);
    if (n != null && n > 0) return n;
  }
  return null;
}

/** True when both distance and an active duration are positive. */
function hasTravelPair(metrics) {
  const d = numberOrNull(metrics && metrics.distance);
  const t = primaryDurationSeconds(metrics);
  return d != null && d > 0 && t != null && t > 0;
}

/**
 * Seconds per distance-unit (time-per-unit). Lower = faster = better.
 * @returns {number|null}
 */
function timePerUnit(metrics) {
  if (!hasTravelPair(metrics)) return null;
  return primaryDurationSeconds(metrics) / numberOrNull(metrics.distance);
}

/** Distance-units per second (speed). Higher = faster. */
function speedUnitsPerSecond(metrics) {
  const pace = timePerUnit(metrics);
  if (pace == null || !(pace > 0)) return null;
  return 1 / pace;
}

/**
 * Workout scale: load × volume × distance.
 * Missing weight/reps/sets count as 1 (bodyweight single effort).
 * @returns {number|null}
 */
function travelScale(metrics) {
  const d = numberOrNull(metrics && metrics.distance);
  if (d == null || !(d > 0)) return null;
  const w = numberOrNull(metrics.weight);
  const load = w != null && w > 0 ? w : 1;
  const reps = numberOrNull(metrics.reps);
  const sets = numberOrNull(metrics.sets);
  const r = reps != null && reps > 0 ? reps : 1;
  const s = sets != null && sets > 0 ? sets : 1;
  return load * r * s * d;
}

/**
 * Combined impressiveness: scale × speed (= load × vol × distance² / duration).
 * Higher = harder / more impressive.
 * @returns {number|null}
 */
function travelScore(metrics) {
  if (!hasTravelPair(metrics)) return null;
  const scale = travelScale(metrics);
  const speed = speedUnitsPerSecond(metrics);
  if (scale == null || speed == null) return null;
  return scale * speed;
}

/**
 * Keys folded into travel pace+scale (do not compare independently).
 */
function travelAbsorbedKeys(metrics) {
  const keys = new Set();
  if (!hasTravelPair(metrics)) return keys;
  keys.add('distance');
  keys.add('weight');
  keys.add('reps');
  keys.add('sets');
  const m = metrics || {};
  if (m.durationSeconds != null && numberOrNull(m.durationSeconds) > 0) {
    keys.add('durationSeconds');
  }
  if (m.durationGoSeconds != null && numberOrNull(m.durationGoSeconds) > 0) {
    keys.add('durationGoSeconds');
  }
  return keys;
}

/**
 * Progress 0..1 toward a faster (lower) pace. Same shape as lower-is-better rest.
 */
function paceProgress(actualPace, curPace, nextPace) {
  const A = Number(actualPace);
  const cur = Number(curPace);
  const next = Number(nextPace);
  if (!Number.isFinite(A) || !Number.isFinite(cur) || !Number.isFinite(next)) return 0;
  if (cur === next) return A <= next ? 1 : 0;
  if (next < cur) return Math.min(1, Math.max(0, (cur - A) / (cur - next)));
  return Math.min(1, Math.max(0, (A - cur) / (next - cur)));
}

/** How much faster (lower) pace must get to hit nextPace. */
function paceRemaining(actualPace, nextPace) {
  const A = Number(actualPace);
  const next = Number(nextPace);
  if (!Number.isFinite(next)) return null;
  if (!Number.isFinite(A)) return Math.abs(next);
  return Math.max(0, A - next);
}

/**
 * Progress 0..1 toward a larger scale (higher-is-better).
 */
function scaleProgress(actualScale, curScale, nextScale) {
  const A = Number(actualScale);
  const cur = Number(curScale);
  const next = Number(nextScale);
  if (!Number.isFinite(next)) return 0;
  if (!Number.isFinite(A)) return 0;
  if (cur === next) return A >= next ? 1 : 0;
  if (next > cur) return Math.min(1, Math.max(0, (A - cur) / (next - cur)));
  return A >= next ? 1 : 0;
}

function scaleRemaining(actualScale, nextScale) {
  const A = Number(actualScale);
  const next = Number(nextScale);
  if (!Number.isFinite(next)) return null;
  if (!Number.isFinite(A)) return Math.abs(next);
  return Math.max(0, next - A);
}

module.exports = {
  primaryDurationSeconds,
  hasTravelPair,
  timePerUnit,
  speedUnitsPerSecond,
  travelScale,
  travelScore,
  travelAbsorbedKeys,
  paceProgress,
  paceRemaining,
  scaleProgress,
  scaleRemaining,
};
