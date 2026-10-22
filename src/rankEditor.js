/**
 * Feature 12 - Rank Editor
 * Spec: features/feature-12-Rank-Editor.md
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const ranks = require('./ranks');
const catalog = require('./catalog');
const ranksGallery = require('./ranksGallery');
const {
  formatDurationSeconds,
  parseDurationToSeconds,
} = require('./parse/duration');
const i18n = require('./i18n');
const { isUnrankedName, sectionHeaderDepth } = require('./rankTokens');

const { t, tn } = i18n;

const SEPARATOR = '--------------';
const IMAGE_EXTS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']);
const WEIGHT_UNIT_RE = 'stones?|kgs|kg|lbs|lb|st|g|oz|%';
const DISTANCE_UNIT_RE =
  'kilometers|miles|meters|meter|yards|yard|yrd|steps|km|mi|ft|in|yd|m';

function defaultWeightUnit() {
  try {
    return require('./unitConversion').weightFileToken(
      require('./config').getWeightUnits(),
    );
  } catch (_) {
    return 'lb';
  }
}

function defaultDistanceUnit() {
  try {
    return require('./unitConversion').distanceFileToken(
      require('./config').getDistanceUnits(),
    );
  } catch (_) {
    return 'mi';
  }
}
const FORM_LETTER_RE = /^[ILT](?:\s+or\s+[ILT])?$/i;

function loadDraft(options = {}) {
  try {
    const filePath = options.filePath || paths.ranksTxtPath();
    if (!fs.existsSync(filePath)) {
      return { ok: false, message: t('rankEditor.loadFailed'), text: '' };
    }
    const text = fs.readFileSync(filePath, 'utf8');
    return { ok: true, text };
  } catch (_) {
    return { ok: false, message: t('rankEditor.loadFailed'), text: '' };
  }
}

/**
 * Diagnose body indentation problems that break or distort the preview.
 */
function diagnoseBodyIndentation(bodyText, tierName) {
  const issues = [];
  const body = String(bodyText || '');
  if (!body.trim()) return issues;

  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    if (/^ +/.test(raw) && !raw.startsWith('\t')) {
      issues.push({
        message: t('rankEditor.indentSpaces', { tier: tierName, line: i + 1 }),
        tier: tierName,
        line: i + 1,
      });
      break;
    }
  }

  const { tokenizeLines, buildHeaderForest } = require('./parse/indent');
  const tokenized = tokenizeLines(body);
  if (tokenized.ok) {
    const forest = buildHeaderForest(tokenized.lines);
    if (!forest.ok) {
      issues.push({
        message: t('rankEditor.indentJump', {
          tier: tierName,
          detail: forest.message || t('rankEditor.indentJumpFallback'),
        }),
        tier: tierName,
        line: null,
      });
    } else {
      // Known section headers at the wrong tab depth (e.g. flat ARMS/STRENGTH/PUSH)
      for (const line of tokenized.lines) {
        if (line.blank || line.leaf || line.separator || line.badgePath)
          continue;
        if (!String(line.content || '').endsWith(':')) continue;
        const name = String(line.content).replace(/:$/, '').trim();
        const expected = sectionHeaderDepth(name);
        if (expected == null) continue;
        if (line.depth !== expected) {
          issues.push({
            message: tn('rankEditor.indentDepth', expected, {
              tier: tierName,
              name,
              tabs: expected,
              found: line.depth,
            }),
            tier: tierName,
            line: line.index + 1,
          });
          break;
        }
      }
    }
  }
  return issues;
}

/**
 * Tolerant draft parse: keep tiers that succeed; collect errors for the rest.
 */
function parseDraft(text) {
  const raw = String(text == null ? '' : text);
  const blocks = ranks.splitTierBlocks(raw);
  const errors = [];
  if (!blocks.length) {
    return {
      ok: false,
      incomplete: true,
      tiers: [],
      errors: [{ message: t('rankEditor.noTiers'), line: null }],
      columns: [],
    };
  }

  const tiers = [];
  for (const block of blocks) {
    const badgeLine = block.badgePath
      ? `{${block.badgePath}}`
      : '{badges/unranked.svg}';
    const piece = [
      `${block.name}:`,
      badgeLine,
      SEPARATOR,
      block.body || '',
    ].join('\n');
    const result = ranks.parseRanksText(piece);
    if (result.ok && result.data && result.data.length) {
      for (const tier of result.data) tiers.push(tier);
      // Still surface indentation problems that “succeed” with a broken tree
      for (const issue of diagnoseBodyIndentation(
        block.body || '',
        block.name,
      )) {
        errors.push(issue);
      }
    } else {
      const indentIssues = diagnoseBodyIndentation(
        block.body || '',
        block.name,
      );
      if (indentIssues.length) {
        for (const issue of indentIssues) errors.push(issue);
      } else {
        errors.push({
          message:
            result.message || t('rankEditor.parseTier', { name: block.name }),
          tier: block.name,
          line: null,
        });
      }
    }
  }

  // Re-number order across collected tiers
  let next = 1;
  for (const tier of tiers) {
    if (isUnrankedName(tier.name)) {
      tier.order = 0;
    } else {
      tier.order = next;
      next += 1;
    }
  }

  const columns = ranksGallery.columnsFromTiers(tiers);
  const incomplete = errors.length > 0 || tiers.length === 0;
  return {
    ok: tiers.length > 0 && errors.length === 0,
    incomplete,
    tiers,
    errors,
    columns,
  };
}

function saveDraft(text, options = {}) {
  const raw = String(text == null ? '' : text);
  const parsed = parseDraft(raw);
  if (!parsed.ok) {
    const confirm =
      typeof options.confirm === 'function' ? options.confirm : () => false;
    if (!confirm(t('rankEditor.saveAnyway'))) {
      return {
        ok: false,
        cancelled: true,
        message: t('rankEditor.saveCancelled'),
      };
    }
  }

  try {
    const filePath = options.filePath || paths.ranksTxtPath();
    fs.writeFileSync(filePath, raw, 'utf8');
  } catch (_) {
    return { ok: false, message: t('rankEditor.saveFailed') };
  }

  try {
    ranks.clearRanksCache();
    catalog.reloadFromDisk(options);
  } catch (_) {
    /* reload best-effort */
  }

  return { ok: true, data: { text: raw } };
}

function trimTrailingSpaces(line) {
  return String(line).replace(/[ \t]+$/g, '');
}

function normalizeNewlines(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function lineDepth(line) {
  let d = 0;
  while (d < line.length && line[d] === '\t') d += 1;
  return d;
}

function looksLikeBadgeLine(raw) {
  const t = String(raw || '').trim();
  if (!t || t.startsWith('-') || t.endsWith(':') || /^-+$/.test(t))
    return false;
  return (
    t.includes('badges/') ||
    t.startsWith('{') ||
    /\.(svg|png|jpe?g|webp|gif)\s*\}?$/i.test(t)
  );
}

function wrapBadgePath(raw) {
  let badge = String(raw || '').trim();
  if (!badge) return badge;
  badge = badge.replace(/^\{|\}$/g, '');
  return `{${badge}}`;
}

/**
 * True when this depth-0 `Name:` starts a rank tier (badge and/or separator follows),
 * not a muscle-group header like ARMS:/CORE: inside a tier body.
 */
function isRankTierStart(lines, index) {
  if (ranks.isTierHeaderAt(lines, index)) return true;
  const line = lines[index];
  if (!line) return false;
  const depth = lineDepth(line);
  const content = line.slice(depth).trim();
  if (
    depth !== 0 ||
    !content.endsWith(':') ||
    content.startsWith('-') ||
    /^-+$/.test(content)
  ) {
    return false;
  }
  let j = index + 1;
  while (j < lines.length && lines[j].trim() === '') j += 1;
  if (j >= lines.length) return false;
  const peek = lines[j].trim();
  if (looksLikeBadgeLine(peek)) return true;
  if (/^-+$/.test(peek)) return true;
  return false;
}

function nextRankTierIndex(lines, fromIndex) {
  for (let i = fromIndex; i < lines.length; i += 1) {
    if (isRankTierStart(lines, i)) return i;
  }
  return lines.length;
}

function looksLikeExerciseLeaf(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.endsWith(':')) return false;
  if (looksLikeBadgeLine(trimmed) || /^-+$/.test(trimmed)) return false;
  const body = trimmed.replace(/^\-\s*/, '');
  return (
    trimmed.startsWith('-') ||
    /\d+\s*(?:stones?|kgs|kg|lbs|lb|st|g|oz|%)\b/i.test(body) ||
    /\d+\s*(?:kilometers|miles|meters|meter|yards|yard|yrd|steps|km|mi|ft|in|yd|m)\b/i.test(
      body,
    ) ||
    /\bx\d*\b/i.test(body) ||
    /\{+\s*x\d*\s*\}+/i.test(body) ||
    /\d+\s+x\d*/i.test(body) ||
    /\d+(?:h|m|s)\b/i.test(body)
  );
}

function pushXValue(xValues, raw) {
  const n = String(raw == null ? '' : raw).trim();
  if (n === '') xValues.push(1);
  else {
    const v = parseInt(n, 10);
    xValues.push(Number.isFinite(v) && v >= 0 ? v : 1);
  }
}

/** Strip every `{` / `}` from notes content and trim (`{tes{{t}` -> `test`). */
function normalizeNotesText(raw) {
  let s = String(raw == null ? '' : raw).trim();
  s = s.replace(/[{}]/g, '').trim();
  return s || null;
}

/**
 * After `{xN}` promotion: take the first `{` through end-of-line as notes
 * (supports unclosed `{test` and nested `{tes{{t}`).
 */
function extractInlineNotes(work) {
  const idx = String(work).indexOf('{');
  if (idx === -1) return { work, notes: null };
  const raw = work.slice(idx);
  const notes = normalizeNotesText(raw);
  return { work: work.slice(0, idx).trim(), notes };
}

/**
 * Repair a single exercise leaf toward ranks grammar.
 * Sets/reps are always emitted as `xN xM` (never as `{xN}` descriptions).
 */
function repairExerciseLeafLine(line) {
  if (!looksLikeExerciseLeaf(line)) return line;

  const indentMatch = String(line).match(/^(\t*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  let work = String(line)
    .trim()
    .replace(/^\-\s*/, '')
    .trim();
  if (!work) return line;

  const xValues = [];
  let notes = null;
  let durationToken = null;
  let weightNum = null;
  let weightUnit = null;
  let distanceNum = null;
  let distanceUnit = null;

  // Unwrap grouping around unit tokens: (10lb) -> 10lb, (lb) -> lb
  work = work.replace(
    new RegExp(
      `\\(\\s*(\\d+(?:\\.\\d+)?)\\s*(${WEIGHT_UNIT_RE}|${DISTANCE_UNIT_RE})\\s*\\)`,
      'gi',
    ),
    '$1$2',
  );
  work = work.replace(
    new RegExp(`\\(\\s*(${WEIGHT_UNIT_RE}|${DISTANCE_UNIT_RE})\\s*\\)`, 'gi'),
    '$1',
  );

  // Promote complete `{x3}` / `{x6 x3}` groups to plain x-tokens (never descriptions)
  work = work.replace(/\{+\s*(x\d*(?:\s+x\d*)*)\s*\}+/gi, ' $1 ');

  // Description: from first remaining `{` to EOL (unclosed `{test`, nested `{tes{{t}`, etc.)
  ({ work, notes } = extractInlineNotes(work));

  // Trailing prose notes after the final x-group (no leading `{`)
  if (!notes) {
    const prose = work.match(/^(.*\bx\d*(?:\s+x\d*)?)\s+([A-Za-z(].*)$/i);
    if (prose) {
      const maybe = normalizeNotesText(prose[2]);
      // Do not steal following `x3` / `x3 ...` / unit tokens as descriptions
      if (
        maybe &&
        !/^x\d*/i.test(maybe) &&
        !/^(stones?|kgs|kg|lbs|lb|st|kilometers|miles|meters|meter|yards|yard|yrd|steps|km|mi|ft|in|yd|m)\b/i.test(
          maybe,
        )
      ) {
        work = prose[1].trim();
        notes = maybe;
      }
    }
  }

  // Unitless duration (seconds) before two x-counts: `120 x1 x3`
  work = work.replace(/\b(\d+)\s+x(\d*)\s+x(\d*)\b/gi, (_, secs, a, b) => {
    const formatted = formatDurationSeconds(Number(secs));
    if (formatted && Number(secs) > 0) durationToken = formatted;
    pushXValue(xValues, a);
    pushXValue(xValues, b);
    return ' ';
  });

  // Bare reps then sets with x only on second: `4 x3`
  work = work.replace(/\b(\d+)\s+x(\d*)\b/gi, (_, a, b) => {
    pushXValue(xValues, a);
    pushXValue(xValues, b);
    return ' ';
  });

  // Remaining x-tokens left-to-right (including bare `x` -> 1)
  work = work.replace(/\bx(\d*)\b/gi, (_, n) => {
    pushXValue(xValues, n);
    return ' ';
  });

  // Duration tokens with units (skip zero-length durations)
  work = work.replace(
    /\b(\d+h\d+m\d+(?:\.\d+)?s|\d+h\d+m|\d+h\d+(?:\.\d+)?s|\d+h|\d+m\d+(?:\.\d+)?s|\d+m|\d+(?:\.\d+)?s)\b/gi,
    (tok) => {
      const secs = parseDurationToSeconds(tok);
      if (secs != null && secs > 0) {
        durationToken = formatDurationSeconds(secs);
      }
      // zero-duration tokens (e.g. 0m) are dropped
      return ' ';
    },
  );

  const unitConversion = require('./unitConversion');

  // Weight: number+unit, bare unit -> 0, (#n)
  let m = work.match(
    new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${WEIGHT_UNIT_RE})\\b`, 'i'),
  );
  if (m) {
    weightNum = Number(m[1]);
    weightUnit = unitConversion.weightFileToken(
      unitConversion.normalizeWeightUnit(m[2]) || 'lbs',
    );
    work = work.replace(m[0], ' ');
  } else {
    m = work.match(new RegExp(`\\b(${WEIGHT_UNIT_RE})\\b`, 'i'));
    if (m) {
      weightNum = 0;
      weightUnit = unitConversion.weightFileToken(
        unitConversion.normalizeWeightUnit(m[1]) || 'lbs',
      );
      work = work.replace(m[0], ' ');
    }
  }

  // Distance
  m = work.match(
    new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${DISTANCE_UNIT_RE})\\b`, 'i'),
  );
  if (m) {
    distanceNum = Number(m[1]);
    distanceUnit = unitConversion.distanceFileToken(
      unitConversion.normalizeDistanceUnit(m[2]) || 'mi',
    );
    work = work.replace(m[0], ' ');
  } else {
    m = work.match(new RegExp(`\\b(${DISTANCE_UNIT_RE})\\b`, 'i'));
    if (m) {
      distanceNum = 0;
      distanceUnit = unitConversion.distanceFileToken(
        unitConversion.normalizeDistanceUnit(m[1]) || 'mi',
      );
      work = work.replace(m[0], ' ');
    }
  }

  // Bare number between title and reps -> default weight unit (if weight still missing)
  if (weightNum == null) {
    m = work.match(/\b(\d+(?:\.\d+)?)\b/);
    if (m) {
      weightNum = Number(m[1]);
      weightUnit = defaultWeightUnit();
      work = work.replace(m[0], ' ');
    }
  }

  // Defaults: missing weight/distance -> 0 + default unit (duration is NOT defaulted)
  if (weightNum == null) {
    weightNum = 0;
    weightUnit = defaultWeightUnit();
  }
  if (distanceNum == null) {
    distanceNum = 0;
    distanceUnit = defaultDistanceUnit();
  }

  // Name = leftover; keep form-letter parens, drop other grouping
  let name = work.replace(/\s+/g, ' ').trim();
  const formTokens = [];
  name = name.replace(/\(([^)]*)\)/g, (full, inner) => {
    if (FORM_LETTER_RE.test(String(inner).trim())) {
      formTokens.push(full);
      return ` «FORM${formTokens.length - 1}» `;
    }
    return String(inner).trim();
  });
  name = name
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  name = name.replace(
    /«FORM(\d+)»/g,
    (_, idx) => formTokens[Number(idx)] || '',
  );
  name = name.replace(/\s+/g, ' ').trim();
  if (!name) name = 'exercise';

  // Reps + sets both required
  let reps = 1;
  let sets = 1;
  if (xValues.length === 1) {
    reps = xValues[0];
    sets = 1;
  } else if (xValues.length >= 2) {
    reps = xValues[0];
    sets = xValues[1];
  }

  const parts = [
    name,
    `${unitConversion.formatMeasureToken(weightNum)}${weightUnit}`,
    `${unitConversion.formatMeasureToken(distanceNum)}${distanceUnit}`,
  ];
  if (durationToken) parts.push(durationToken);
  parts.push(`x${reps}`, `x${sets}`);
  if (notes) parts.push(`{${notes}}`);

  return `${indent}- ${parts.join(' ')}`;
}

/**
 * Beautify: rebuild from known tier blocks only (never treat ARMS:/CORE: as tiers).
 * Buffer only - does not write disk.
 */
function beautify(text) {
  const normalized = normalizeNewlines(text);
  const blocks = ranks.splitTierBlocks(normalized);
  if (!blocks.length) {
    // Nothing parsed as tiers - only trim trailing spaces; do not invent structure
    const trimmed = normalized
      .split('\n')
      .map(trimTrailingSpaces)
      .join('\n')
      .replace(/\s+$/, '');
    return trimmed ? `${trimmed}\n` : '';
  }

  const out = [];
  for (let b = 0; b < blocks.length; b += 1) {
    if (b > 0) out.push('');
    const block = blocks[b];
    out.push(`${block.name}:`);
    if (block.badgePath) out.push(wrapBadgePath(block.badgePath));
    out.push(SEPARATOR);
    const bodyLines = String(block.body || '')
      .split('\n')
      .map(trimTrailingSpaces);
    while (bodyLines.length && bodyLines[0].trim() === '') bodyLines.shift();
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '')
      bodyLines.pop();
    for (const bodyLine of bodyLines) {
      if (bodyLine.trim() === '') continue;
      out.push(bodyLine);
    }
  }
  return `${out.join('\n')}\n`;
}

/**
 * Rebuild tab indentation for a tier body from section headers + leaves.
 * Uses known Strank header depths (ARMS/STRENGTH/PUSH/...) and stack nesting
 * for unknown headers so depth jumps and space-indents are corrected.
 */
function repairBodyIndentation(bodyText) {
  const lines = normalizeNewlines(bodyText).split('\n');
  const out = [];
  /** @type {{ name: string, depth: number }[]} */
  const stack = [];

  for (const rawLine of lines) {
    const trimmed = String(rawLine || '').trim();
    if (!trimmed) {
      out.push('');
      continue;
    }

    if (looksLikeBadgeLine(trimmed) || /^-+$/.test(trimmed)) {
      out.push(trimmed);
      continue;
    }

    const isLeaf = looksLikeExerciseLeaf(trimmed) || trimmed.startsWith('-');
    if (isLeaf) {
      const depth = stack.length;
      const repaired = repairExerciseLeafLine(trimmed);
      const leaf = repaired.trim().replace(/^\t+/, '');
      const content = leaf.startsWith('-') ? leaf : `- ${leaf}`;
      out.push(`${'\t'.repeat(depth)}${content}`);
      continue;
    }

    if (trimmed.endsWith(':')) {
      const name = trimmed.replace(/:$/, '').trim();
      const knownDepth = sectionHeaderDepth(name);
      let depth;
      if (knownDepth != null) {
        depth = knownDepth;
      } else {
        // Unknown header: nest under the current deepest header
        depth = stack.length;
      }
      while (stack.length && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }
      // If known depth skips a level relative to remaining parent, clamp to parent+1
      if (stack.length && depth > stack[stack.length - 1].depth + 1) {
        depth = stack[stack.length - 1].depth + 1;
      }
      if (!stack.length && depth !== 0) depth = 0;
      stack.push({ name, depth });
      out.push(`${'\t'.repeat(depth)}${name}:`);
      continue;
    }

    out.push(trimmed);
  }

  return out.join('\n');
}

/**
 * Fix syntax: repair tier headers (badge/separator) and body tab indentation.
 */
function fixSyntax(text) {
  const lines = normalizeNewlines(text).split('\n');
  const unresolved = [];
  const out = [];
  let i = 0;

  while (i < lines.length) {
    if (!isRankTierStart(lines, i)) {
      out.push(trimTrailingSpaces(lines[i]));
      i += 1;
      continue;
    }

    const name = lines[i].slice(lineDepth(lines[i])).trim();
    out.push(name);
    i += 1;
    while (i < lines.length && lines[i].trim() === '') i += 1;

    let badge = null;
    if (i < lines.length && looksLikeBadgeLine(lines[i])) {
      badge = wrapBadgePath(lines[i]);
      i += 1;
      while (i < lines.length && lines[i].trim() === '') i += 1;
    }

    if (badge) out.push(badge);
    else unresolved.push(`Tier “${name}” has no badge path (left unchanged).`);

    if (i < lines.length && /^-+$/.test(lines[i].trim())) {
      out.push(SEPARATOR);
      i += 1;
    } else if (badge) {
      out.push(SEPARATOR);
      unresolved.push(`Inserted separator after ${name}`);
    } else {
      unresolved.push(
        `Tier “${name}” is missing a separator (left unchanged).`,
      );
    }

    while (i < lines.length && lines[i].trim() === '') i += 1;

    const bodyEnd = nextRankTierIndex(lines, i);
    const bodyLines = [];
    while (i < bodyEnd) {
      bodyLines.push(trimTrailingSpaces(lines[i]));
      i += 1;
    }
    const repairedBody = repairBodyIndentation(bodyLines.join('\n'));
    if (repairedBody.trim()) {
      for (const bl of repairedBody.split('\n')) {
        out.push(bl);
      }
    }
  }

  // Normalize only real tier blocks; safe on already-valid files
  const result = beautify(out.join('\n'));
  return { text: result, unresolved };
}

function defaultRanksText(options = {}) {
  try {
    const filePath = options.defaultPath || paths.defaultRanksTxtPath();
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (_) {
    /* fall through */
  }
  // Minimal valid ladder if defaults file is missing
  return [
    'UNRANKED:',
    '{badges/unranked.svg}',
    SEPARATOR,
    '',
    'BRONZE I:',
    '{badges/bronze-i.svg}',
    SEPARATOR,
    'ARMS:',
    '\tSTRENGTH:',
    '\t\tPUSH:',
    '\t\t\t- push-ups x10 x3',
    '',
  ].join('\n');
}

function sanitizeBadgeFileName(name) {
  const base = path.basename(String(name || 'badge'));
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'badge';
}

function uniqueBadgePath(dir, fileName) {
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  let candidate = fileName;
  let n = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${stem}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

/**
 * If `absPath` already lives under data/badges/, return its data-relative path.
 */
function existingBadgeRelativePath(absPath) {
  if (!absPath || typeof absPath !== 'string') return null;
  try {
    const resolved = path.resolve(absPath);
    const badgesRoot = path.resolve(paths.badgesDir());
    if (
      !(resolved === badgesRoot || resolved.startsWith(badgesRoot + path.sep))
    )
      return null;
    if (!fs.existsSync(resolved)) return null;
    return path.relative(paths.getDataDir(), resolved).replace(/\\/g, '/');
  } catch (_) {
    return null;
  }
}

/**
 * Copy a dropped image into badges/ (or badges/custom/ when `options.custom`).
 * If `source` is already under data/badges/, reuse that path without copying.
 * `source` is an absolute path or { buffer, name }.
 */
function importDroppedBadge(source, options = {}) {
  if (typeof source === 'string') {
    const existing = existingBadgeRelativePath(source);
    if (existing) {
      return {
        ok: true,
        data: {
          relativePath: existing,
          absolutePath: path.resolve(source),
          fileName: path.basename(source),
          reused: true,
        },
      };
    }
  }

  const useCustom = options.custom === true;
  const dir =
    options.badgesDir ||
    (useCustom
      ? typeof paths.badgesCustomDir === 'function'
        ? paths.badgesCustomDir()
        : path.join(paths.badgesDir(), 'custom')
      : paths.badgesDir());
  const relBase = useCustom ? 'badges/custom' : 'badges';
  fs.mkdirSync(dir, { recursive: true });

  let buffer;
  let originalName;
  if (
    source &&
    typeof source === 'object' &&
    !Buffer.isBuffer(source) &&
    source.buffer
  ) {
    buffer = Buffer.isBuffer(source.buffer)
      ? source.buffer
      : Buffer.from(source.buffer);
    originalName = source.name || 'badge.png';
  } else if (typeof source === 'string') {
    originalName = path.basename(source);
    buffer = fs.readFileSync(source);
  } else if (Buffer.isBuffer(source)) {
    buffer = source;
    originalName = options.name || 'badge.png';
  } else {
    return { ok: false, message: t('rankEditor.unsupportedImage') };
  }

  const ext = path.extname(originalName).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) {
    return { ok: false, message: t('rankEditor.unsupportedImage') };
  }

  const safeName = uniqueBadgePath(dir, sanitizeBadgeFileName(originalName));
  const absolutePath = path.join(dir, safeName);
  fs.writeFileSync(absolutePath, buffer);
  const relativePath = `${relBase}/${safeName}`.replace(/\\/g, '/');
  return {
    ok: true,
    data: {
      relativePath,
      absolutePath,
      fileName: safeName,
    },
  };
}

function readFormatHelpText(options = {}) {
  if (options.text != null) return String(options.text);
  if (options.filePath) {
    if (!fs.existsSync(options.filePath)) return null;
    return fs.readFileSync(options.filePath, 'utf8');
  }
  // Rules are help text: show the active language's translated format.txt when it ships one (FR-013).
  const localized =
    i18n.getLanguage() !== i18n.DEFAULT_LANGUAGE
      ? i18n.languageFilePath('format.txt')
      : null;
  const txtPath = localized || paths.formatTxtPath();
  if (fs.existsSync(txtPath)) return fs.readFileSync(txtPath, 'utf8');
  return null;
}

/**
 * Split format.txt into numbered rules + example rank template.
 */
function loadFormatHelp(options = {}) {
  try {
    const text = readFormatHelpText(options);
    if (text == null || !String(text).trim()) {
      return { ok: false, message: t('rankEditor.help.loadFailed') };
    }
    const lines = String(text).split(/\r?\n/);

    const rules = [];
    for (const line of lines) {
      const m = line.match(/^\s*#\s+(\d+)\.\s+(.*)$/);
      if (m) rules.push(`${m[1]}. ${m[2].trim()}`);
    }

    let exampleStart = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      // Example template header ("RANK NAME #:" in any language) - skip comment lines that mention it
      if (trimmed.startsWith('#')) continue;
      if (/#\s*:$/.test(trimmed)) {
        exampleStart = i;
        break;
      }
    }
    if (exampleStart < 0) {
      return { ok: false, message: t('rankEditor.help.loadFailed') };
    }
    const exampleRankText =
      lines
        .slice(exampleStart)
        .join('\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\s+$/, '') + '\n';

    if (!rules.length || !exampleRankText.trim()) {
      return { ok: false, message: t('rankEditor.help.loadFailed') };
    }

    return { ok: true, data: { rules, exampleRankText } };
  } catch (_) {
    return { ok: false, message: t('rankEditor.help.loadFailed') };
  }
}

module.exports = {
  loadDraft,
  parseDraft,
  saveDraft,
  beautify,
  fixSyntax,
  repairBodyIndentation,
  repairExerciseLeafLine,
  diagnoseBodyIndentation,
  defaultRanksText,
  importDroppedBadge,
  existingBadgeRelativePath,
  loadFormatHelp,
  SEPARATOR,
  IMAGE_EXTS,
};
