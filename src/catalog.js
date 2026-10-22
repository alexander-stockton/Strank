/**
 * Feature 1 - App Foundation
 * Feature 5 - Dynamic Exercise Catalog
 * Spec: features/feature-5-Dynamic-Exercise-Catalog.md
 */

const fs = require('fs');
const { formatTxtPath, ranksTxtPath } = require('./paths');
const { tokenizeLines, buildHeaderForest, headerPathFor } = require('./parse/indent');
const { parseFormatLeaf } = require('./parse/metrics');
const ranks = require('./ranks');
const { t } = require('./i18n');

/**
 * Read format.txt as UTF-8 text.
 */
function readFormatText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/** Format-only cache (Feature 1). */
let cached = null;
/** Merged active catalog (Feature 5). */
let liveCached = null;
/** Last seen mtimes for focus-watch reload. */
let lastMtimes = { format: null, ranks: null };

function collectFormatEntries(text) {
  const tokenized = tokenizeLines(text);
  if (!tokenized.ok) {
    return { ok: false, message: t('error.loadExerciseData') };
  }

  const forest = buildHeaderForest(tokenized.lines);
  if (!forest.ok) {
    return { ok: false, message: t('error.loadExerciseData') };
  }

  const entries = [];
  const warnings = [];

  for (const node of forest.nodes) {
    if (!node.leaf) continue;
    const parsed = parseFormatLeaf(node.content);
    if (!parsed || !parsed.metrics.length) {
      warnings.push(`Skipped malformed leaf at line ${node.index + 1}`);
      console.warn(`[catalog] ${warnings[warnings.length - 1]}`);
      continue;
    }
    entries.push({
      exerciseId: parsed.exerciseId,
      name: parsed.name,
      headers: headerPathFor(node),
      metrics: parsed.metrics,
      notes: parsed.notes,
    });
  }

  return { ok: true, data: entries, warnings };
}

function parseCatalogText(text) {
  const collected = collectFormatEntries(text);
  if (!collected.ok) return collected;
  if (collected.data.length === 0) {
    return { ok: false, message: t('error.loadExerciseData') };
  }
  return collected;
}

function loadCatalog(options = {}) {
  try {
    const filePath = options.filePath || formatTxtPath();
    if (!fs.existsSync(filePath)) {
      cached = null;
      return { ok: false, message: t('error.loadExerciseData') };
    }
    const text = readFormatText(filePath);
    const result = parseCatalogText(text);
    cached = result.ok ? result.data : null;
    return result;
  } catch (_) {
    cached = null;
    return { ok: false, message: t('error.loadExerciseData') };
  }
}

function readFormatEntriesForMerge(options = {}) {
  try {
    if (options.formatText != null) {
      return collectFormatEntries(options.formatText);
    }
    const filePath = options.formatFilePath || formatTxtPath();
    if (!fs.existsSync(filePath)) {
      return { ok: true, data: [], warnings: [] };
    }
    const text = readFormatText(filePath);
    if (!String(text).trim()) {
      return { ok: true, data: [], warnings: [] };
    }
    return collectFormatEntries(text);
  } catch (_) {
    return { ok: false, message: t('error.loadExerciseData') };
  }
}

function readRankEntriesForMerge(options = {}) {
  try {
    if (options.ranksText != null) {
      return ranks.collectRankExercises({
        text: options.ranksText,
        filePath: options.ranksFilePath || ranksTxtPath(),
      });
    }
    const filePath = options.ranksFilePath || ranksTxtPath();
    if (!fs.existsSync(filePath)) {
      return { ok: true, data: [] };
    }
    return ranks.collectRankExercises({ filePath });
  } catch (_) {
    return { ok: false, message: t('error.loadExerciseData') };
  }
}

function mergeLiveCatalog(formatEntries, rankEntries) {
  const byId = new Map();

  for (const f of formatEntries) {
    byId.set(f.exerciseId, {
      exerciseId: f.exerciseId,
      name: f.name,
      headers: f.headers || [],
      metrics: [...(f.metrics || [])],
      notes: f.notes != null ? f.notes : null,
      source: 'format',
      prioritySource: 'format',
    });
  }

  for (const r of rankEntries) {
    const existing = byId.get(r.exerciseId);
    if (existing) {
      const ranksHeaders = r.headers && r.headers.length ? r.headers : null;
      byId.set(r.exerciseId, {
        exerciseId: r.exerciseId,
        name: r.name,
        headers: ranksHeaders || existing.headers || [],
        metrics: [...(r.metrics || [])],
        notes: r.notes != null ? r.notes : existing.notes,
        source: 'both',
        prioritySource: 'ranks',
      });
    } else {
      byId.set(r.exerciseId, {
        exerciseId: r.exerciseId,
        name: r.name,
        headers: r.headers || [],
        metrics: [...(r.metrics || [])],
        notes: r.notes != null ? r.notes : null,
        source: 'ranks',
        prioritySource: 'ranks',
      });
    }
  }

  return [...byId.values()];
}

function snapshotMtimes(options = {}) {
  const formatPath = options.formatFilePath || formatTxtPath();
  const ranksPath = options.ranksFilePath || ranksTxtPath();
  const mtime = (p) => {
    try {
      return fs.existsSync(p) ? fs.statSync(p).mtimeMs : null;
    } catch (_) {
      return null;
    }
  };
  return { format: mtime(formatPath), ranks: mtime(ranksPath) };
}

/**
 * Merge format.txt + ranks.txt into the active catalog. ranks.txt wins on conflict.
 */
function loadLiveCatalog(options = {}) {
  const previous = liveCached;
  const keepLastGood = options.keepLastGood === true;

  const formatResult = readFormatEntriesForMerge(options);
  if (!formatResult.ok) {
    if (keepLastGood && previous) {
      return { ok: false, message: formatResult.message, keptLastGood: true, data: previous };
    }
    liveCached = null;
    return formatResult;
  }

  const ranksResult = readRankEntriesForMerge(options);
  if (!ranksResult.ok) {
    if (keepLastGood && previous) {
      return { ok: false, message: 'Failed to load exercise data.', keptLastGood: true, data: previous };
    }
    liveCached = null;
    return { ok: false, message: t('error.loadExerciseData') };
  }

  const merged = mergeLiveCatalog(formatResult.data || [], ranksResult.data || []);
  if (merged.length === 0) {
    if (keepLastGood && previous) {
      return { ok: false, message: 'Failed to load exercise data.', keptLastGood: true, data: previous };
    }
    liveCached = null;
    return { ok: false, message: t('error.loadExerciseData') };
  }

  liveCached = merged;
  if (options.formatText == null && options.ranksText == null) {
    lastMtimes = snapshotMtimes(options);
  }
  return { ok: true, data: merged };
}

function getActiveExercise(id) {
  if (!liveCached) {
    const loaded = loadLiveCatalog();
    if (!loaded.ok) return null;
  }
  return liveCached.find((e) => e.exerciseId === id) || null;
}

function isOrphan(entry) {
  if (!entry || !entry.exerciseId) return true;
  return getActiveExercise(entry.exerciseId) == null;
}

/**
 * Re-read format.txt + ranks.txt. Refreshes merged catalog and ranks cache (Feature 6 FR-004).
 * Prefer keep-last-good ranks/catalog when a parse fails after a prior successful load.
 */
function reloadFromDisk(options = {}) {
  const ranksMod = require('./ranks');
  const ranksOpts = {
    keepLastGood: true,
  };
  if (options.ranksFilePath) ranksOpts.filePath = options.ranksFilePath;
  if (options.ranksText != null) ranksOpts.text = options.ranksText;

  const ranksResult = ranksMod.loadRanks(ranksOpts);
  const catalogResult = loadLiveCatalog({ ...options, keepLastGood: true });

  if (!catalogResult.ok && catalogResult.keptLastGood) {
    return {
      ok: false,
      message: catalogResult.message,
      keptLastGood: true,
      data: catalogResult.data,
      ranks: ranksResult,
    };
  }
  if (!catalogResult.ok) {
    return catalogResult;
  }
  if (!ranksResult.ok && !ranksResult.keptLastGood) {
    return { ok: false, message: ranksResult.message || 'Failed to load rank data.' };
  }
  return { ok: true, data: catalogResult.data, ranks: ranksResult };
}

/**
 * Returns true if format.txt or ranks.txt mtime changed since last live load.
 */
function diskCatalogChanged(options = {}) {
  const now = snapshotMtimes(options);
  if (lastMtimes.format == null && lastMtimes.ranks == null && !liveCached) {
    return true;
  }
  return now.format !== lastMtimes.format || now.ranks !== lastMtimes.ranks;
}

function getExerciseById(id) {
  if (liveCached) {
    return liveCached.find((e) => e.exerciseId === id) || null;
  }
  if (!cached) {
    const loaded = loadCatalog();
    if (!loaded.ok) return null;
  }
  return cached.find((e) => e.exerciseId === id) || null;
}

function clearCatalogCache() {
  cached = null;
  liveCached = null;
  lastMtimes = { format: null, ranks: null };
}

module.exports = {
  parseCatalogText,
  loadCatalog,
  loadLiveCatalog,
  readFormatText,
  getActiveExercise,
  isOrphan,
  reloadFromDisk,
  diskCatalogChanged,
  getExerciseById,
  clearCatalogCache,
};
