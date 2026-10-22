/**
 * Feature 16 - distance / weight conversion & convert-on-change
 * Spec: features/feature-16-Localization.md (FR-023 … FR-030)
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const storage = require('./storage');
const ranks = require('./ranks');
const catalog = require('./catalog');

/** Max abs value for weight/distance measures: 6 digits left, 2 right. */
const MEASURE_MAX = 999999.99;

/** Exact meters-per-unit (FR-024). */
const M_PER = {
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

const KG_PER_LB = 0.45359237;
const LB_PER_ST = 14;

const WEIGHT_CANON = new Set(['lbs', 'kg', 'st']);
const DISTANCE_CANON = new Set(['mi', 'km', 'm', 'yd', 'ft', 'in', 'steps']);

function normalizeWeightUnit(raw) {
  const u = String(raw == null ? '' : raw)
    .toLowerCase()
    .trim();
  if (u === 'kg' || u === 'kgs' || u === 'kilogram' || u === 'kilograms') return 'kg';
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return 'lbs';
  if (u === 'st' || u === 'stone' || u === 'stones') return 'st';
  return null;
}

function normalizeDistanceUnit(raw) {
  const u = String(raw == null ? '' : raw)
    .toLowerCase()
    .trim();
  if (!u) return null;
  if (u === 'mi' || u === 'mile' || u === 'miles') return 'mi';
  if (u === 'km' || u === 'kilometer' || u === 'kilometers') return 'km';
  if (u === 'm' || u === 'meter' || u === 'meters') return 'm';
  if (u === 'yd' || u === 'yrd' || u === 'yard' || u === 'yards') return 'yd';
  if (u === 'ft' || u === 'foot' || u === 'feet') return 'ft';
  if (u === 'in' || u === 'inch' || u === 'inches') return 'in';
  if (u === 'steps' || u === 'step') return 'steps';
  if (u === 'custom') return 'mi';
  return null;
}

/** Round / clamp a weight or distance measure to <=6 integer digits and 2 decimals. */
function roundMeasure(value) {
  if (!Number.isFinite(value)) return 0;
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.min(MEASURE_MAX, Math.abs(value));
  return sign * (Math.round(abs * 100) / 100);
}

/**
 * Weight storage / convert-on-change quantization by destination unit:
 * - lbs -> nearest integer
 * - kg  -> nearest 0.5
 * - st  -> nearest 0.01
 */
function roundWeightForUnit(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n === 0) return 0;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.min(MEASURE_MAX, Math.abs(n));
  const u = normalizeWeightUnit(unit) || 'lbs';
  let stepped;
  if (u === 'lbs') stepped = Math.round(abs);
  else if (u === 'kg') stepped = Math.round(abs * 2) / 2;
  else if (u === 'st') stepped = Math.round(abs * 100) / 100;
  else stepped = Math.round(abs * 100) / 100;
  return sign * Math.min(MEASURE_MAX, stepped);
}

/** Compact string for ranks.txt tokens (`10`, `1.5`, `0.25`). */
function formatMeasureToken(value) {
  const n = roundMeasure(value);
  if (Object.is(n, -0) || n === 0) return '0';
  const fixed = n.toFixed(2);
  return fixed.replace(/\.?0+$/, '');
}

function strideInches(sex, heightFt) {
  const h = Number(heightFt);
  if (!Number.isFinite(h) || h <= 0) return null;
  const s = String(sex || '')
    .toLowerCase()
    .trim();
  if (s === 'female') return 4.92 * h;
  if (s === 'male') return 4.98 * h;
  return null;
}

function toPounds(value, unit) {
  const u = normalizeWeightUnit(unit);
  if (u === 'lbs') return value;
  if (u === 'st') return value * LB_PER_ST;
  if (u === 'kg') return value / KG_PER_LB;
  throw new Error(`unknown weight unit ${unit}`);
}

function fromPounds(pounds, unit) {
  const u = normalizeWeightUnit(unit);
  if (u === 'lbs') return pounds;
  if (u === 'st') return pounds / LB_PER_ST;
  if (u === 'kg') return pounds * KG_PER_LB;
  throw new Error(`unknown weight unit ${unit}`);
}

function convertWeight(value, from, to) {
  const n = Number(value);
  if (!Number.isFinite(n)) return n;
  if (n === 0) return 0;
  const fromU = normalizeWeightUnit(from);
  const toU = normalizeWeightUnit(to);
  if (!fromU || !toU) throw new Error(`unknown weight unit ${from}->${to}`);
  if (fromU === toU) return n;
  return fromPounds(toPounds(n, fromU), toU);
}

function toMeters(value, unit, strideProfile) {
  const u = normalizeDistanceUnit(unit);
  if (!u) throw new Error(`unknown distance unit ${unit}`);
  if (u === 'steps') {
    const stride = strideInches(strideProfile && strideProfile.sex, strideProfile && strideProfile.heightFt);
    if (stride == null || stride <= 0) throw new Error('steps needs stride');
    return (value * stride) * M_PER.in;
  }
  return value * M_PER[u];
}

function fromMeters(meters, unit, strideProfile) {
  const u = normalizeDistanceUnit(unit);
  if (!u) throw new Error(`unknown distance unit ${unit}`);
  if (u === 'steps') {
    const stride = strideInches(strideProfile && strideProfile.sex, strideProfile && strideProfile.heightFt);
    if (stride == null || stride <= 0) throw new Error('steps needs stride');
    const inches = meters / M_PER.in;
    return inches / stride;
  }
  return meters / M_PER[u];
}

function convertDistance(value, from, to, strideProfile) {
  const n = Number(value);
  if (!Number.isFinite(n)) return n;
  if (n === 0) return 0;
  const fromU = normalizeDistanceUnit(from);
  const toU = normalizeDistanceUnit(to);
  if (!fromU || !toU) throw new Error(`unknown distance unit ${from}->${to}`);
  if (fromU === toU) return n;
  return fromMeters(toMeters(n, fromU, strideProfile), toU, strideProfile);
}

/**
 * Pick a 2-decimal destination value whose convert-back equals the rounded source.
 * Guarantees unit A->B->A parity for convert-on-change (ranks / store), instead of
 * drifting by float rounding (e.g. 0.25mi -> km -> 0.25mi).
 */
function quantizeConvertedMeasure(original, from, to, convertExact, strideProfile) {
  const originalR = roundMeasure(Number(original));
  if (!Number.isFinite(originalR)) return originalR;
  if (originalR === 0) return 0;
  const exact = convertExact(originalR, from, to, strideProfile);
  if (!Number.isFinite(exact)) return exact;
  const primary = roundMeasure(exact);

  // Scan a window of 2-decimal candidates around the exact conversion and pick
  // the value closest to `exact` that converts back to originalR (A->B->A parity).
  const window = 0.5;
  const start = Math.max(0, Math.floor((exact - window) * 100) / 100);
  const end = Math.min(MEASURE_MAX, Math.ceil((exact + window) * 100) / 100);

  let best = primary;
  let bestErr = Number.POSITIVE_INFINITY;
  for (let c = start; c <= end + 1e-9; c = roundMeasure(c + 0.01)) {
    if (!Number.isFinite(c) || c < 0 || Math.abs(c) > MEASURE_MAX) continue;
    try {
      const back = roundMeasure(convertExact(c, to, from, strideProfile));
      if (back !== originalR) continue;
      const err = Math.abs(c - exact);
      if (err < bestErr - 1e-12 || (Math.abs(err - bestErr) <= 1e-12 && Math.abs(c - primary) < Math.abs(best - primary))) {
        best = c;
        bestErr = err;
      }
    } catch (_) {
      /* skip */
    }
  }
  return bestErr < Number.POSITIVE_INFINITY ? best : primary;
}

/** Convert distance and quantize so a round-trip to the source unit restores the original. */
function convertDistanceForStorage(value, from, to, strideProfile) {
  const fromU = normalizeDistanceUnit(from);
  const toU = normalizeDistanceUnit(to);
  if (!fromU || !toU) throw new Error(`unknown distance unit ${from}->${to}`);
  if (fromU === toU) return roundMeasure(Number(value));
  return quantizeConvertedMeasure(value, fromU, toU, convertDistance, strideProfile);
}

/**
 * Convert weight for ranks/store persistence using unit-specific steps
 * (lbs int, kg 0.5, st 0.01) so convert-on-change does not leave float junk.
 */
function convertWeightForStorage(value, from, to) {
  const fromU = normalizeWeightUnit(from);
  const toU = normalizeWeightUnit(to);
  if (!fromU || !toU) throw new Error(`unknown weight unit ${from}->${to}`);
  if (fromU === toU) return roundWeightForUnit(value, toU);
  return roundWeightForUnit(convertWeight(value, fromU, toU), toU);
}

/** Unit token written into ranks.txt leaves. */
function weightFileToken(unit) {
  const u = normalizeWeightUnit(unit) || 'lbs';
  if (u === 'kg') return 'kg';
  if (u === 'st') return 'st';
  return 'lb';
}

function distanceFileToken(unit) {
  const u = normalizeDistanceUnit(unit) || 'mi';
  if (u === 'm') return 'meters'; // avoid clashing with duration `15m`
  if (u === 'yd') return 'yd';
  return u;
}

/** Display label next to inputs / summaries. */
function weightDisplayLabel(unit) {
  const u = normalizeWeightUnit(unit) || 'lbs';
  if (u === 'kg') return 'kgs';
  if (u === 'st') return 'st';
  return 'lbs';
}

function distanceDisplayLabel(unit) {
  const u = normalizeDistanceUnit(unit) || 'mi';
  if (u === 'yd') return 'yd';
  return u;
}

const WEIGHT_TOKEN_RE =
  /(?<![\w.])(\d+(?:\.\d+)?)\s*(stones?|kgs|kg|lbs|lb|st)(?![a-z])/gi;
const DISTANCE_TOKEN_RE =
  /(?<![\w.])(\d+(?:\.\d+)?)\s*(kilometers|miles|meters|meter|yards|yard|yrd|steps|km|mi|ft|in|yd|m)(?![a-z])/gi;

function parseWeightTokenUnit(raw) {
  return normalizeWeightUnit(raw);
}

function parseDistanceTokenUnit(raw) {
  return normalizeDistanceUnit(raw);
}

/**
 * Rewrite weight/distance number+unit tokens inside ranks.txt text.
 * Duration tokens like `15m` / `1m5s` are left alone when the from-unit is not bare `m`,
 * and meters are stored as `meters` so they never collide with minute durations.
 */
function rewriteRanksText(text, options = {}) {
  let out = String(text == null ? '' : text);
  const {
    weightFrom,
    weightTo,
    distanceFrom,
    distanceTo,
    strideProfile,
  } = options;

  if (weightFrom && weightTo && normalizeWeightUnit(weightFrom) !== normalizeWeightUnit(weightTo)) {
    const fromU = normalizeWeightUnit(weightFrom);
    const toU = normalizeWeightUnit(weightTo);
    const toToken = weightFileToken(toU);
    out = out.replace(WEIGHT_TOKEN_RE, (full, num, unit) => {
      const parsed = parseWeightTokenUnit(unit);
      if (parsed !== fromU) return full;
      const converted = convertWeightForStorage(Number(num), fromU, toU);
      return `${formatMeasureToken(converted)}${toToken}`;
    });
  }

  if (distanceFrom && distanceTo && normalizeDistanceUnit(distanceFrom) !== normalizeDistanceUnit(distanceTo)) {
    const fromU = normalizeDistanceUnit(distanceFrom);
    const toU = normalizeDistanceUnit(distanceTo);
    const toToken = distanceFileToken(toU);
    out = out.replace(DISTANCE_TOKEN_RE, (full, num, unit) => {
      const parsed = parseDistanceTokenUnit(unit);
      if (parsed !== fromU) return full;
      // Bare `m` collides with duration minutes (`15m`). Only rewrite explicit
      // `meter`/`meters`, or the zero placeholder `0m`.
      if (fromU === 'm' && /^m$/i.test(unit) && Number(num) !== 0) return full;
      try {
        const converted = convertDistanceForStorage(Number(num), fromU, toU, strideProfile);
        return `${formatMeasureToken(converted)}${toToken}`;
      } catch (_) {
        return full;
      }
    });
  }

  return out;
}

function listRanksFilesToRewrite() {
  const files = new Set();
  const add = (p) => {
    if (p && fs.existsSync(p)) files.add(path.resolve(p));
  };
  add(path.join(paths.getDataDir(), 'ranks.txt'));
  add(path.join(paths.getDataDir(), 'defaults', 'ranks.txt'));
  const root = typeof paths.localizationDir === 'function' ? paths.localizationDir() : null;
  if (root && fs.existsSync(root)) {
    for (const tag of fs.readdirSync(root)) {
      const dir = path.join(root, tag);
      if (!fs.statSync(dir).isDirectory()) continue;
      add(path.join(dir, 'ranks.txt'));
      add(path.join(dir, 'ranks.default'));
    }
  }
  // Active language path (may equal one above)
  try {
    add(paths.ranksTxtPath());
    add(paths.defaultRanksTxtPath());
  } catch (_) {
    /* ignore */
  }
  return [...files];
}

function rewriteAllRanksFiles(options = {}) {
  const files = listRanksFilesToRewrite();
  let changed = 0;
  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = rewriteRanksText(before, options);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      changed += 1;
    }
  }
  ranks.clearRanksCache();
  catalog.clearCatalogCache();
  try {
    catalog.reloadFromDisk();
  } catch (_) {
    /* ignore */
  }
  return { ok: true, files: files.length, changed };
}

function convertMetricsObject(metrics, options = {}) {
  if (!metrics || typeof metrics !== 'object') return metrics;
  const next = { ...metrics };
  if (options.weightFrom && options.weightTo && next.weight != null && next.weight !== '') {
    try {
      next.weight = convertWeightForStorage(Number(next.weight), options.weightFrom, options.weightTo);
    } catch (_) {
      /* leave */
    }
  }
  if (options.distanceFrom && options.distanceTo && next.distance != null && next.distance !== '') {
    try {
      next.distance = convertDistanceForStorage(
        Number(next.distance),
        options.distanceFrom,
        options.distanceTo,
        options.strideProfile
      );
    } catch (_) {
      /* leave */
    }
  }
  return next;
}

function rewriteStoreMetricsOnUnitChange(options = {}) {
  const read = storage.readStore();
  if (!read.ok) return read;
  const data = read.data;
  const entries = (data.entries || []).map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    return { ...entry, metrics: convertMetricsObject(entry.metrics, options) };
  });
  const workouts = (data.workouts || []).map((session) => {
    if (!session || typeof session !== 'object') return session;
    const items = Array.isArray(session.items)
      ? session.items.map((item) => {
          if (!item || typeof item !== 'object') return item;
          return { ...item, metrics: convertMetricsObject(item.metrics, options) };
        })
      : session.items;
    return { ...session, items };
  });
  const written = storage.writeStore({
    schemaVersion: data.schemaVersion,
    entries,
    workouts,
  });
  if (!written.ok) return written;
  return { ok: true, data: written.data || { entries, workouts } };
}

function rewriteActiveWorkoutDraft(options = {}) {
  try {
    const workout = require('./workout');
    const draft = workout.getDraft && workout.getDraft();
    if (!draft || !Array.isArray(draft.items)) return { ok: true, changed: false };
    for (const item of draft.items) {
      if (!item) continue;
      item.metrics = convertMetricsObject(item.metrics, options);
      item.baselineMetrics = convertMetricsObject(item.baselineMetrics, options);
      if (item.targets) item.targets = convertMetricsObject(item.targets, options);
    }
    return { ok: true, changed: true };
  } catch (_) {
    return { ok: true, changed: false };
  }
}

/**
 * Run convert-on-change for a Config unit switch (FR-026-FR-028 + ranks rewrite).
 */
function applyUnitChange(options = {}) {
  const result = {
    ok: true,
    store: rewriteStoreMetricsOnUnitChange(options),
    ranks: rewriteAllRanksFiles(options),
    draft: rewriteActiveWorkoutDraft(options),
  };
  if (result.store && result.store.ok === false) result.ok = false;
  return result;
}

function canConvertSteps(strideProfile) {
  return strideInches(strideProfile && strideProfile.sex, strideProfile && strideProfile.heightFt) != null;
}

module.exports = {
  MEASURE_MAX,
  M_PER,
  KG_PER_LB,
  LB_PER_ST,
  WEIGHT_CANON,
  DISTANCE_CANON,
  normalizeWeightUnit,
  normalizeDistanceUnit,
  roundMeasure,
  roundWeightForUnit,
  formatMeasureToken,
  strideInches,
  convertWeight,
  convertDistance,
  convertWeightForStorage,
  convertDistanceForStorage,
  quantizeConvertedMeasure,
  toPounds,
  fromPounds,
  toMeters,
  fromMeters,
  weightFileToken,
  distanceFileToken,
  weightDisplayLabel,
  distanceDisplayLabel,
  rewriteRanksText,
  rewriteAllRanksFiles,
  rewriteStoreMetricsOnUnitChange,
  rewriteActiveWorkoutDraft,
  applyUnitChange,
  convertMetricsObject,
  canConvertSteps,
  listRanksFilesToRewrite,
};
