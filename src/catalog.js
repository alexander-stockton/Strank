/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const fs = require('fs');
const { formatTxtPath } = require('./paths');
const { tokenizeLines, buildHeaderForest, headerPathFor } = require('./parse/indent');
const { parseFormatLeaf } = require('./parse/metrics');

let cached = null;

function parseCatalogText(text) {
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

  if (entries.length === 0) {
    return { ok: false, message: 'Failed to load exercise data.' };
  }

  return { ok: true, data: entries, warnings };
}

function loadCatalog(options = {}) {
  try {
    const filePath = options.filePath || formatTxtPath();
    if (!fs.existsSync(filePath)) {
      cached = null;
      return { ok: false, message: 'Failed to load exercise data.' };
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const result = parseCatalogText(text);
    cached = result.ok ? result.data : null;
    return result;
  } catch (_) {
    cached = null;
    return { ok: false, message: 'Failed to load exercise data.' };
  }
}

function getExerciseById(id) {
  if (!cached) {
    const loaded = loadCatalog();
    if (!loaded.ok) return null;
  }
  return cached.find((e) => e.exerciseId === id) || null;
}

function clearCatalogCache() {
  cached = null;
}

module.exports = {
  parseCatalogText,
  loadCatalog,
  getExerciseById,
  clearCatalogCache,
};
