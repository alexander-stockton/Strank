/**
 * Feature 12 - Rank list manager (CRUD + serialize + template)
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const ranks = require('./ranks');
const catalog = require('./catalog');
const rankDifficulty = require('./rankDifficulty');
const { formatDurationSeconds } = require('./parse/duration');
const { slugifyExerciseName } = require('./parse/metrics');
const i18n = require('./i18n');
const config = require('./config');
const unitConversion = require('./unitConversion');

const SEPARATOR = '--------------';

function loadTiers(options = {}) {
  ranks.clearRanksCache();
  const loaded = ranks.loadRanks(options);
  if (!loaded.ok) return loaded;
  return { ok: true, data: loaded.data || [] };
}

function listRankRows(options = {}) {
  const loaded = loadTiers(options);
  if (!loaded.ok) return loaded;
  const rows = (loaded.data || []).map((tier) => ({
    name: tier.name,
    badgePath: tier.badgePath || null,
    order: tier.order,
    difficulty: rankDifficulty.tierDifficulty(tier),
    isUnranked: ranks.isUnrankedName(tier.name),
  }));
  return { ok: true, data: rows };
}

function zeroThresholds(source) {
  const thresholds = {};
  const keys = Object.keys(source || {});
  for (const key of keys) {
    thresholds[key] = 0;
  }
  if (thresholds.weight == null) thresholds.weight = 0;
  if (thresholds.distance == null) thresholds.distance = 0;
  if (thresholds.reps == null) thresholds.reps = 0;
  if (thresholds.sets == null) thresholds.sets = 0;
  return thresholds;
}

/**
 * Blank exercise row for "Add exercise" under a section.
 */
function createEmptyExercise(headers = []) {
  const thresholds = {
    weight: 0,
    distance: 0,
    durationSeconds: 0,
    reps: 0,
    sets: 0,
  };
  return {
    exerciseId: '',
    name: '',
    headers: Array.isArray(headers) ? [...headers] : [],
    notes: null,
    thresholds,
    metrics: Object.keys(thresholds),
    _uid: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

/**
 * Template exercises from the first non-UNRANKED tier (or empty), values zeroed.
 */
function getTemplateExercises(options = {}) {
  const loaded = loadTiers(options);
  if (!loaded.ok) return { ok: true, data: [] };
  const source =
    (loaded.data || []).find((t) => !ranks.isUnrankedName(t.name)) || null;
  if (!source || !Array.isArray(source.exercises)) return { ok: true, data: [] };

  const data = source.exercises.map((ex, index) => {
    const thresholds = zeroThresholds(ex.thresholds);
    return {
      exerciseId: ex.exerciseId || slugifyExerciseName(ex.name),
      name: ex.name,
      headers: Array.isArray(ex.headers) ? [...ex.headers] : [],
      notes: ex.notes != null ? ex.notes : null,
      thresholds,
      metrics: Object.keys(thresholds),
      _uid: `tpl-${index}-${ex.exerciseId || index}`,
    };
  });
  return { ok: true, data };
}

function formatLeafLine(ex) {
  const t = ex.thresholds || {};
  const parts = [String(ex.name || 'exercise').trim()];
  const weight = t.weight != null && t.weight !== '' ? Number(t.weight) : 0;
  const distance = t.distance != null && t.distance !== '' ? Number(t.distance) : 0;
  const wUnit = unitConversion.weightFileToken(config.getWeightUnits());
  const dUnit = unitConversion.distanceFileToken(config.getDistanceUnits());
  parts.push(
    `${unitConversion.formatMeasureToken(Number.isFinite(weight) ? weight : 0)}${wUnit}`
  );
  parts.push(
    `${unitConversion.formatMeasureToken(Number.isFinite(distance) ? distance : 0)}${dUnit}`
  );

  let durationSecs = null;
  if (t.durationSeconds != null && Number(t.durationSeconds) > 0) {
    durationSecs = Number(t.durationSeconds);
  } else if (t.durationGoSeconds != null && Number(t.durationGoSeconds) > 0) {
    durationSecs = Number(t.durationGoSeconds);
  }
  if (durationSecs != null && durationSecs > 0) {
    parts.push(formatDurationSeconds(durationSecs));
  } else if (t.durationSteps != null && Number(t.durationSteps) > 0) {
    parts.push(`${Number(t.durationSteps)}steps`);
  }

  const reps = t.reps != null && t.reps !== '' ? Math.max(0, Math.trunc(Number(t.reps)) || 0) : 0;
  const sets = t.sets != null && t.sets !== '' ? Math.max(0, Math.trunc(Number(t.sets)) || 0) : 0;
  parts.push(`x${reps}`, `x${sets}`);
  if (ex.notes) parts.push(`{${String(ex.notes).trim()}}`);
  return `- ${parts.join(' ')}`;
}

/**
 * Keep exercises that share a header path contiguous (first-seen section order)
 * so serialize never re-opens ARMS › STRENGTH › PULL as a second block at the bottom.
 */
function groupExercisesByHeaders(exercises) {
  const groups = new Map();
  const order = [];
  for (const ex of exercises || []) {
    const key = (Array.isArray(ex.headers) ? ex.headers : []).join('\u0001');
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(ex);
  }
  return order.flatMap((key) => groups.get(key));
}

/**
 * Serialize exercises into indented ranks body (header tree + leaves).
 */
function serializeExercisesBody(exercises) {
  const lines = [];
  // Track emitted header prefixes: Map depth -> header name at that depth
  const stack = [];
  const ordered = groupExercisesByHeaders(exercises);

  for (const ex of ordered) {
    const headers = Array.isArray(ex.headers) ? ex.headers : [];
    // Align stack with this exercise's headers
    let depth = 0;
    while (depth < headers.length && depth < stack.length && stack[depth] === headers[depth]) {
      depth += 1;
    }
    stack.length = depth;
    while (depth < headers.length) {
      const name = headers[depth];
      stack.push(name);
      lines.push(`${'\t'.repeat(depth)}${name}:`);
      depth += 1;
    }
    const leafDepth = headers.length;
    lines.push(`${'\t'.repeat(leafDepth)}${formatLeafLine(ex)}`);
  }
  return lines.join('\n');
}

function serializeTierBlock(tier) {
  const name = String(tier.name || '').trim() || 'CUSTOM';
  const badge = tier.badgePath
    ? `{${String(tier.badgePath).replace(/^\{|\}$/g, '')}}`
    : '{badges/unranked.svg}';
  const body = serializeExercisesBody(tier.exercises || []);
  const parts = [`${name}:`, badge, SEPARATOR];
  if (body) parts.push(body);
  return parts.join('\n');
}

function serializeAllTiers(tiers) {
  const blocks = (tiers || []).map((t) => serializeTierBlock(t));
  return `${blocks.join('\n\n')}\n`;
}

function writeTiers(tiers, options = {}) {
  const sorted = rankDifficulty.sortTiersByDifficulty(tiers);
  // Re-number order
  let next = 1;
  for (const tier of sorted) {
    if (ranks.isUnrankedName(tier.name)) tier.order = 0;
    else {
      tier.order = next;
      next += 1;
    }
  }
  const text = serializeAllTiers(sorted);
  const filePath = options.filePath || paths.ranksTxtPath();
  try {
    fs.writeFileSync(filePath, text, 'utf8');
  } catch (_) {
    return { ok: false, message: i18n.t('ranks.saveFailed') };
  }
  ranks.clearRanksCache();
  try {
    catalog.reloadFromDisk(options);
  } catch (_) {
    /* best-effort */
  }
  return { ok: true, data: sorted, text };
}

function findTier(tiers, name) {
  const key = String(name || '')
    .trim()
    .toUpperCase();
  return (tiers || []).find((t) => String(t.name || '').toUpperCase() === key) || null;
}

function deleteRank(name, options = {}) {
  const loaded = loadTiers(options);
  if (!loaded.ok) return loaded;
  const key = String(name || '')
    .trim()
    .toUpperCase();
  if (ranks.isUnrankedName(name)) {
    return { ok: false, message: i18n.t('ranks.cannotDeleteUnranked') };
  }
  const next = (loaded.data || []).filter((t) => String(t.name || '').toUpperCase() !== key);
  if (next.length === (loaded.data || []).length) {
    return { ok: false, message: i18n.t('ranks.notFound') };
  }
  return writeTiers(next, options);
}

/**
 * Insert or replace a tier, then auto-sort by difficulty and save.
 */
function saveRank(tierInput, options = {}) {
  const loaded = loadTiers(options);
  if (!loaded.ok) return loaded;
  const name = String(tierInput.name || '').trim();
  if (!name) return { ok: false, message: i18n.t('ranks.nameRequired') };
  if (ranks.isUnrankedName(name)) {
    return { ok: false, message: i18n.t('ranks.nameReserved') };
  }

  const isEdit = options.replaceName != null && String(options.replaceName).trim() !== '';
  const replaceKey = isEdit
    ? String(options.replaceName)
        .trim()
        .toUpperCase()
    : null;

  const conflict = findTier(loaded.data, name);
  if (conflict) {
    const conflictKey = String(conflict.name).toUpperCase();
    if (!isEdit || conflictKey !== replaceKey) {
      return { ok: false, message: i18n.t('ranks.nameTaken') };
    }
  }

  const exercises = (Array.isArray(tierInput.exercises) ? tierInput.exercises : [])
    .map((ex) => {
      const exName = String(ex.name || '').trim();
      if (!exName) return null;
      const exerciseId = slugifyExerciseName(exName);
      const thresholds = { ...(ex.thresholds || {}) };
      return {
        exerciseId,
        name: exName,
        headers: Array.isArray(ex.headers) ? [...ex.headers] : [],
        notes: ex.notes != null && String(ex.notes).trim() !== '' ? String(ex.notes).trim() : null,
        thresholds,
        metrics: Object.keys(thresholds),
      };
    })
    .filter(Boolean);

  let preservedOrder = 0;
  if (isEdit) {
    const previous = findTier(loaded.data, options.replaceName);
    if (previous && Number.isFinite(Number(previous.order))) {
      preservedOrder = Number(previous.order);
    }
  } else {
    // New ranks append after current ladder so equal-score ties land at the end.
    const maxOrder = (loaded.data || []).reduce((m, t) => {
      const o = Number(t.order);
      return Number.isFinite(o) && o > m ? o : m;
    }, 0);
    preservedOrder = maxOrder + 1;
  }

  const tier = {
    tierId: String(name)
      .toUpperCase()
      .replace(/\s+/g, '_'),
    name,
    badgePath: tierInput.badgePath
      ? String(tierInput.badgePath).replace(/^\{|\}$/g, '')
      : 'badges/unranked.svg',
    order: preservedOrder,
    thresholds: {},
    exercises,
  };
  for (const ex of exercises) {
    tier.thresholds[ex.exerciseId] = ex.thresholds;
  }

  const next = (loaded.data || []).filter((t) => {
    const n = String(t.name || '').toUpperCase();
    if (isEdit && n === replaceKey) return false;
    if (!isEdit && n === name.toUpperCase()) return false;
    return true;
  });
  next.push(tier);
  return writeTiers(next, options);
}

function resolveBadgeUrl(badgePath) {
  if (!badgePath) return null;
  const rel = String(badgePath).replace(/^\{|\}$/g, '').trim();
  if (!rel) return null;
  const abs = path.resolve(paths.getDataDir(), rel);
  const root = path.resolve(paths.getDataDir());
  if (!(abs === root || abs.startsWith(root + path.sep))) return null;
  if (!fs.existsSync(abs)) return null;
  try {
    const { pathToFileURL } = require('url');
    return pathToFileURL(abs).href;
  } catch (_) {
    return null;
  }
}

function getTierByName(name, options = {}) {
  const loaded = loadTiers(options);
  if (!loaded.ok) return loaded;
  const tier = findTier(loaded.data, name);
  if (!tier) return { ok: false, message: i18n.t('ranks.notFound') };
  return { ok: true, data: tier };
}

module.exports = {
  loadTiers,
  listRankRows,
  getTemplateExercises,
  createEmptyExercise,
  getTierByName,
  deleteRank,
  saveRank,
  writeTiers,
  serializeAllTiers,
  serializeExercisesBody,
  groupExercisesByHeaders,
  formatLeafLine,
  resolveBadgeUrl,
  SEPARATOR,
};
