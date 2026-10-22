/**
 * Feature 1 - App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const fs = require('fs');
const { ranksTxtPath } = require('./paths');
const {
  tokenizeLines,
  buildHeaderForest,
  isBadgePathLine,
  isSeparatorLine,
  unwrapBadgePath,
  headerPathFor,
} = require('./parse/indent');
const { parseRanksLeaf, slugifyExerciseName } = require('./parse/metrics');
const { isUnrankedName, unrankedDisplayName } = require('./rankTokens');
const { t } = require('./i18n');

let cachedTiers = null;

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
    return { ok: false, message: tokenized.message || t('error.loadRankData') };
  }
  const forest = buildHeaderForest(tokenized.lines);
  if (!forest.ok) {
    return { ok: false, message: forest.message || t('error.loadRankData') };
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
    return { ok: false, message: t('error.loadRankData') };
  }

  const tiers = [];
  let order = 0;
  for (const block of blocks) {
    const bodyResult = parseTierBody(block.body || '');
    if (!bodyResult.ok) {
      return bodyResult;
    }
    const isUnranked = isUnrankedName(block.name);
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
    if (isUnrankedName(tier.name)) {
      tier.order = 0;
    } else {
      tier.order = next;
      next += 1;
    }
  }

  return { ok: true, data: tiers };
}

function loadRanks(options = {}) {
  try {
    const filePath = options.filePath || ranksTxtPath();
    if (!fs.existsSync(filePath)) {
      cachedTiers = null;
      return { ok: false, message: t('error.loadRankData') };
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const result = parseRanksText(text);
    cachedTiers = result.ok ? result.data : null;
    return result;
  } catch (_) {
    cachedTiers = null;
    return { ok: false, message: t('error.loadRankData') };
  }
}

function listTierNames() {
  if (!cachedTiers) {
    const loaded = loadRanks();
    if (!loaded.ok) return [];
  }
  return cachedTiers.map((t) => t.name);
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
        return { ok: false, message: t('error.loadRankData') };
      }
      text = fs.readFileSync(filePath, 'utf8');
    }
    const blocks = splitTierBlocks(text);
    if (blocks.length === 0) {
      return { ok: false, message: t('error.loadRankData') };
    }

    const byId = new Map();
    for (const block of blocks) {
      if (isUnrankedName(block.name)) continue;
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
    return { ok: false, message: t('error.loadRankData') };
  }
}

function unrankedLabel(tiers) {
  if (!tiers) {
    if (!cachedTiers) loadRanks();
    tiers = cachedTiers;
  }
  return unrankedDisplayName(tiers);
}

module.exports = {
  splitTierBlocks,
  parseRanksText,
  loadRanks,
  listTierNames,
  clearRanksCache,
  collectRankExercises,
  slugifyExerciseName,
  isTierHeaderAt,
  isUnrankedName,
  unrankedLabel,
};
