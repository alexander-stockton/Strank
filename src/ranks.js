/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const fs = require('fs');
const { ranksTxtPath } = require('./paths');
const { tokenizeLines, buildHeaderForest, isBadgePathLine, isSeparatorLine, unwrapBadgePath } = require('./parse/indent');
const { parseRanksLeaf, slugifyExerciseName } = require('./parse/metrics');

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
    return { ok: false, message: 'Failed to load rank data.' };
  }
  const forest = buildHeaderForest(tokenized.lines);
  if (!forest.ok) {
    return { ok: false, message: 'Failed to load rank data.' };
  }

  const thresholds = {};
  for (const node of forest.nodes) {
    if (!node.leaf) continue;
    const parsed = parseRanksLeaf(node.content);
    if (!parsed) {
      console.warn(`[ranks] Skipped malformed leaf at line ${node.index + 1}`);
      continue;
    }
    thresholds[parsed.exerciseId] = parsed.thresholds;
  }
  return { ok: true, thresholds };
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
  try {
    const filePath = options.filePath || ranksTxtPath();
    if (!fs.existsSync(filePath)) {
      cachedTiers = null;
      return { ok: false, message: 'Failed to load rank data.' };
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const result = parseRanksText(text);
    cachedTiers = result.ok ? result.data : null;
    return result;
  } catch (_) {
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

function clearRanksCache() {
  cachedTiers = null;
}

module.exports = {
  splitTierBlocks,
  parseRanksText,
  loadRanks,
  listTierNames,
  clearRanksCache,
  slugifyExerciseName,
  isTierHeaderAt,
};
