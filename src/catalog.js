/**
 * Feature 1 — App Foundation
 * Feature 5 — Dynamic Exercise Catalog
 * Spec: features/feature-5-Dynamic-Exercise-Catalog.md
 */

const fs = require('fs');
const { formatDatPath, ranksTxtPath } = require('./paths');
const { tokenizeLines, buildHeaderForest, headerPathFor } = require('./parse/indent');
const { parseFormatLeaf } = require('./parse/metrics');
const ranks = require('./ranks');

/**
 * Read format.dat as binary and decode UTF-8 text (same content as format.txt).
 */
function readFormatBinaryText(filePath) {
  const buf = fs.readFileSync(filePath);
  return Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf);
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
    return { ok: false, message: 'Failed to load exercise data.' };
  }

  const forest = buildHeaderForest(tokenized.lines);
  if (!forest.ok) {
    return { ok: false, message: 'Failed to load exercise data.' };
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
    return { ok: false, message: 'Failed to load exercise data.' };
  }
  return collected;
}

function loadCatalog(options = {}) {
  try {
    const filePath = options.filePath || formatDatPath();
    if (!fs.existsSync(filePath)) {
      cached = null;
      return { ok: false, message: 'Failed to load exercise data.' };
    }
    const text = readFormatBinaryText(filePath);
    const result = parseCatalogText(text);
    cached = result.ok ? result.data : null;
    return result;
  } catch (_) {
    cached = null;
    return { ok: false, message: 'Failed to load exercise data.' };
  }
}

function readFormatEntriesForMerge(options = {}) {
  try {
    if (options.formatText != null) {
      return collectFormatEntries(options.formatText);
    }
    const filePath = options.formatFilePath || formatDatPath();
    if (!fs.existsSync(filePath)) {
      return { ok: true, data: [], warnings: [] };
    }
    const text = readFormatBinaryText(filePath);
    if (!String(text).trim()) {
      return { ok: true, data: [], warnings: [] };
    }
    return collectFormatEntries(text);
  } catch (_) {
    return { ok: false, message: 'Failed to load exercise data.' };
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
    return { ok: false, message: 'Failed to load exercise data.' };
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
  const formatPath = options.formatFilePath || formatDatPath();
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
 * Merge format.dat (binary) + ranks.txt into the active catalog. ranks.txt wins on conflict.
 */
function loadLiveCatalog(options = {}) {
  const formatResult = readFormatEntriesForMerge(options);
  if (!formatResult.ok) {
    liveCached = null;
    return formatResult;
  }

  const ranksResult = readRankEntriesForMerge(options);
  if (!ranksResult.ok) {
    liveCached = null;
    return { ok: false, message: 'Failed to load exercise data.' };
  }

  const merged = mergeLiveCatalog(formatResult.data || [], ranksResult.data || []);
  if (merged.length === 0) {
    liveCached = null;
    return { ok: false, message: 'Failed to load exercise data.' };
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

function reloadFromDisk(options = {}) {
  return loadLiveCatalog(options);
}

/**
 * Returns true if format.dat or ranks.txt mtime changed since last live load.
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
  readFormatBinaryText,
  getActiveExercise,
  isOrphan,
  reloadFromDisk,
  diskCatalogChanged,
  getExerciseById,
  clearCatalogCache,
};
