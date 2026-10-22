/**
 * Feature 1 — App Foundation
 * Feature 6 — Custom Ranks
 * Spec: features/feature-1-App-Foundation.md
 * Spec: features/feature-6-Custom-Ranks.md
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { ranksTxtPath, getDataDir } = require('./paths');
const {
  tokenizeLines,
  buildHeaderForest,
  isBadgePathLine,
  isSeparatorLine,
  unwrapBadgePath,
  headerPathFor,
} = require('./parse/indent');
const { parseRanksLeaf, slugifyExerciseName } = require('./parse/metrics');

let cachedTiers = null;

const SUPPORTED_BADGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

function tierIdFromName(name) {
  return String(name)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

/**
 * Split ranks.txt into tier blocks: name, optional badgePath, body text after separator.
 */
function splitTierBlocks(text) {
  const rawLines = String(text).split(/\r?\n/);
  const blocks = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const depth = (() => {
      let d = 0;
      while (d < line.length && line[d] === '\t') d += 1;
      return d;
    })();
    const content = line.slice(depth).trim();

    // Tier headers are depth-0 Name: lines that are followed (skipping blanks) by badge and/or separator
    if (depth === 0 && content.endsWith(':') && !content.startsWith('-') && !isSeparatorLine(content)) {
      const name = content.replace(/:$/, '').trim();
      let j = i + 1;
      while (j < rawLines.length && rawLines[j].trim() === '') j += 1;

      let badgePath = null;
      if (j < rawLines.length) {
        const peek = rawLines[j].trim();
        if (isBadgePathLine(peek)) {
          badgePath = unwrapBadgePath(peek);
          j += 1;
          while (j < rawLines.length && rawLines[j].trim() === '') j += 1;
        }
      }

      if (j < rawLines.length && isSeparatorLine(rawLines[j].trim())) {
        j += 1; // consume separator
        const bodyLines = [];
        // Body continues until next tier header (depth-0 Name: followed by badge/separator pattern)
        while (j < rawLines.length) {
          if (isTierHeaderAt(rawLines, j)) break;
          bodyLines.push(rawLines[j]);
          j += 1;
        }
        blocks.push({ name, badgePath, body: bodyLines.join('\n') });
        i = j;
        continue;
      }
    }
    i += 1;
  }

  return blocks;
}

function isTierHeaderAt(rawLines, index) {
  const line = rawLines[index];
  if (!line) return false;
  let depth = 0;
  while (depth < line.length && line[depth] === '\t') depth += 1;
  if (depth !== 0) return false;
  const content = line.slice(depth).trim();
  if (!content.endsWith(':') || content.startsWith('-') || isSeparatorLine(content)) return false;

  let j = index + 1;
  while (j < rawLines.length && rawLines[j].trim() === '') j += 1;
  if (j >= rawLines.length) return false;

  const peek = rawLines[j].trim();
  if (isBadgePathLine(peek)) {
    j += 1;
    while (j < rawLines.length && rawLines[j].trim() === '') j += 1;
  }
  return j < rawLines.length && isSeparatorLine(rawLines[j].trim());
}

function parseTierBody(bodyText) {
  const tokenized = tokenizeLines(bodyText);
  if (!tokenized.ok) {
    return { ok: false, message: tokenized.message || 'Failed to load rank data.' };
  }
  const forest = buildHeaderForest(tokenized.lines);
  if (!forest.ok) {
    return { ok: false, message: forest.message || 'Failed to load rank data.' };
  }

  const thresholds = {};
  const exercises = [];
  for (const node of forest.nodes) {
    if (!node.leaf) continue;
    const parsed = parseRanksLeaf(node.content);
    if (!parsed) {
      console.warn(`[ranks] Skipped malformed leaf at line ${node.index + 1}`);
      continue;
    }
    thresholds[parsed.exerciseId] = parsed.thresholds;
    exercises.push({
      exerciseId: parsed.exerciseId,
      name: parsed.name,
      headers: headerPathFor(node),
      metrics: Object.keys(parsed.thresholds || {}),
      notes: parsed.notes,
      thresholds: parsed.thresholds,
    });
  }
  return { ok: true, thresholds, exercises };
}

function parseRanksText(text) {
  const blocks = splitTierBlocks(text);
  if (blocks.length === 0) {
    return { ok: false, message: 'Failed to load rank data.' };
  }

  const tiers = [];
  let order = 0;
  for (const block of blocks) {
    const bodyResult = parseTierBody(block.body || '');
    if (!bodyResult.ok) {
      return bodyResult;
    }
    const isUnranked = block.name.toUpperCase() === 'UNRANKED';
    tiers.push({
      tierId: tierIdFromName(block.name),
      name: block.name,
      order: isUnranked ? 0 : order === 0 && tiers.length === 0 ? 0 : order,
      badgePath: block.badgePath,
      thresholds: isUnranked ? {} : bodyResult.thresholds,
      // Leaf list with headers for Landing / gallery grouping (Feature 7+)
      exercises: isUnranked
        ? []
        : (bodyResult.exercises || []).map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            headers: ex.headers || [],
            thresholds: ex.thresholds || {},
            notes: ex.notes != null ? ex.notes : null,
          })),
    });
    // Fix order: UNRANKED forced 0; others increment in file order
    order += 1;
  }

  // Normalize order: UNRANKED=0, others 1..n in file sequence excluding unranked bump
  let next = 1;
  for (const tier of tiers) {
    if (tier.name.toUpperCase() === 'UNRANKED') {
      tier.order = 0;
    } else {
      tier.order = next;
      next += 1;
    }
  }

  return { ok: true, data: tiers };
}

function loadRanks(options = {}) {
  const previous = cachedTiers;
  const keepLastGood = options.keepLastGood === true;
  try {
    const filePath = options.filePath || ranksTxtPath();
    if (!fs.existsSync(filePath)) {
      if (keepLastGood && previous) {
        return { ok: false, message: 'Failed to load rank data.', keptLastGood: true, data: previous };
      }
      cachedTiers = null;
      return { ok: false, message: 'Failed to load rank data.' };
    }
    const text = options.text != null ? options.text : fs.readFileSync(filePath, 'utf8');
    const result = parseRanksText(text);
    if (!result.ok) {
      if (keepLastGood && previous) {
        cachedTiers = previous;
        return { ok: false, message: result.message, keptLastGood: true, data: previous };
      }
      cachedTiers = null;
      return result;
    }
    cachedTiers = result.data;
    return result;
  } catch (_) {
    if (keepLastGood && previous) {
      cachedTiers = previous;
      return { ok: false, message: 'Failed to load rank data.', keptLastGood: true, data: previous };
    }
    cachedTiers = null;
    return { ok: false, message: 'Failed to load rank data.' };
  }
}

function listTierNames() {
  if (!cachedTiers) {
    const loaded = loadRanks();
    if (!loaded.ok) return [];
  }
  return cachedTiers.map((t) => t.name);
}

function getTierByName(name) {
  if (!cachedTiers) {
    const loaded = loadRanks();
    if (!loaded.ok) return null;
  }
  const target = String(name || '').trim().toLowerCase();
  return cachedTiers.find((t) => t.name.toLowerCase() === target) || null;
}

/**
 * Resolve badgePath to an absolute filesystem path under the data dir, or null.
 */
function resolveBadgeFsPath(tier) {
  if (!tier || !tier.badgePath) return null;
  const raw = unwrapBadgePath(String(tier.badgePath).trim());
  if (!raw) return null;
  if (!SUPPORTED_BADGE_EXT.test(raw)) return null;

  const normalized = path.normalize(raw);
  if (normalized.startsWith('..') || normalized.includes(`..${path.sep}`)) return null;

  const dataRoot = path.resolve(getDataDir());
  const abs = path.resolve(dataRoot, normalized);
  if (!(abs === dataRoot || abs.startsWith(dataRoot + path.sep))) return null;
  if (!fs.existsSync(abs)) return null;
  try {
    fs.accessSync(abs, fs.constants.R_OK);
  } catch (_) {
    return null;
  }
  return abs;
}

/**
 * Absolute/file URL for UI img src, or null if missing/unusable (FR-009–FR-011).
 */
function resolveBadgeUrl(tier) {
  const abs = resolveBadgeFsPath(tier);
  if (!abs) return null;
  return pathToFileURL(abs).href;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * HTML for a tier badge image or text-chip fallback (gallery / calendar).
 */
function renderBadgeHtml(tierOrName, className = 'tier-badge-img') {
  const tier =
    typeof tierOrName === 'string' || tierOrName == null
      ? getTierByName(tierOrName)
      : tierOrName;
  const name = tier ? tier.name : String(tierOrName || 'UNRANKED');
  const url = tier ? resolveBadgeUrl(tier) : null;
  if (url) {
    return `<img class="${escapeAttr(className)}" src="${escapeAttr(url)}" alt="${escapeAttr(
      name
    )}" data-tier-badge="${escapeAttr(name)}" />`;
  }
  return `<span class="tier-badge-fallback" data-tier-badge="${escapeAttr(name)}" data-badge-fallback="${escapeAttr(
    name
  )}">${escapeAttr(name)}</span>`;
}

function clearRanksCache() {
  cachedTiers = null;
}

/**
 * Collect unique exercises from all non-UNRANKED tiers (schema = union of threshold keys).
 * Used by Feature 5 live catalog merge.
 */
function collectRankExercises(options = {}) {
  try {
    const filePath = options.filePath || ranksTxtPath();
    let text;
    if (options.text != null) {
      text = options.text;
    } else {
      if (!fs.existsSync(filePath)) {
        return { ok: false, message: 'Failed to load rank data.' };
      }
      text = fs.readFileSync(filePath, 'utf8');
    }
    const blocks = splitTierBlocks(text);
    if (blocks.length === 0) {
      return { ok: false, message: 'Failed to load rank data.' };
    }

    const byId = new Map();
    for (const block of blocks) {
      if (block.name.toUpperCase() === 'UNRANKED') continue;
      const bodyResult = parseTierBody(block.body || '');
      if (!bodyResult.ok) return bodyResult;
      for (const ex of bodyResult.exercises || []) {
        const prev = byId.get(ex.exerciseId);
        if (!prev) {
          byId.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            name: ex.name,
            headers: ex.headers || [],
            metrics: [...ex.metrics],
            notes: ex.notes,
          });
        } else {
          const metricSet = new Set([...prev.metrics, ...ex.metrics]);
          prev.metrics = [...metricSet];
          if ((!prev.headers || !prev.headers.length) && ex.headers && ex.headers.length) {
            prev.headers = ex.headers;
          }
          if (!prev.notes && ex.notes) prev.notes = ex.notes;
          // Prefer a more specific name if previous was empty
          if (ex.name && ex.name.length >= prev.name.length) prev.name = ex.name;
        }
      }
    }

    return { ok: true, data: [...byId.values()] };
  } catch (_) {
    return { ok: false, message: 'Failed to load rank data.' };
  }
}

module.exports = {
  splitTierBlocks,
  parseRanksText,
  loadRanks,
  listTierNames,
  getTierByName,
  resolveBadgeFsPath,
  resolveBadgeUrl,
  renderBadgeHtml,
  clearRanksCache,
  collectRankExercises,
  slugifyExerciseName,
  isTierHeaderAt,
  SUPPORTED_BADGE_EXT,
};
