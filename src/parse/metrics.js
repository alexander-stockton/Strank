/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const { parseDurationToSeconds } = require('./duration');

function slugifyExerciseName(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractNotes(line) {
  const m = line.match(/\{([^}]*)\}\s*$/);
  if (!m) return { line, notes: null };
  return {
    line: line.slice(0, m.index).trim(),
    notes: m[1].trim() || null,
  };
}

/**
 * Infer metric schema keys from a format.txt placeholder leaf line (without leading -).
 */
function inferMetricKeysFromPlaceholders(body) {
  const metrics = [];
  const seen = new Set();

  const add = (key) => {
    if (!seen.has(key)) {
      seen.add(key);
      metrics.push(key);
    }
  };

  // Order matters for detection; emit in stable product order
  if (/#\[weight\]|#\s*\[weight\]/i.test(body) || /#(?!\[)/.test(body) && /#\[/.test(body) === false && /#\d/.test(body) === false) {
    // #[weight] placeholder
  }
  if (/#\[weight\]/i.test(body)) add('weight');

  if (/\(\[duration\s+go\]\)|\[duration\s+go\]/i.test(body)) add('durationGoSeconds');
  if (/\(\[duration\s+rest\]\)|\[duration\s+rest\]/i.test(body)) add('durationRestSeconds');
  if (/\[duration\s+in\s+steps\]/i.test(body)) add('durationSteps');
  // generic duration after specific forms
  if (
    !/duration\s+go|duration\s+rest|duration\s+in\s+steps/i.test(body) &&
    /(\(\[duration\]\)|\[duration\])/i.test(body)
  ) {
    add('durationSeconds');
  } else if (/(\(\[duration\]\)|\[duration\])/i.test(body) && !seen.has('durationGoSeconds')) {
    // burpee has go/rest already; bare [duration] alone
    if (!seen.has('durationGoSeconds') && !seen.has('durationRestSeconds') && !seen.has('durationSteps')) {
      add('durationSeconds');
    }
  }

  // Also handle: [duration] without brackets variant already covered
  if (/\[duration\]/i.test(body) && !seen.has('durationSeconds') && !seen.has('durationGoSeconds') && !seen.has('durationSteps')) {
    add('durationSeconds');
  }

  if (/x\[reps\]/i.test(body)) add('reps');
  if (/x\[sets\]/i.test(body)) add('sets');

  return metrics;
}

/**
 * Parse a format leaf into name + metrics schema + notes.
 * Input like: "- pike push-ups x[reps] x[sets]"
 */
function parseFormatLeaf(content) {
  let body = content.replace(/^\-\s*/, '').trim();
  const { line, notes } = extractNotes(body);
  body = line;

  const metrics = [];
  const seen = new Set();
  const add = (k) => {
    if (!seen.has(k)) {
      seen.add(k);
      metrics.push(k);
    }
  };

  // Strip known placeholder tokens to leave the name
  let namePart = body;

  // weight placeholder
  if (/#\[weight\]/i.test(namePart)) {
    add('weight');
    namePart = namePart.replace(/#\[weight\]/gi, ' ');
  }

  // go / rest / steps / duration placeholders (with optional parens)
  if (/\(\s*\[duration\s+go\]\s*\)|\[duration\s+go\]/i.test(namePart)) {
    add('durationGoSeconds');
    namePart = namePart.replace(/\(\s*\[duration\s+go\]\s*\)/gi, ' ').replace(/\[duration\s+go\]/gi, ' ');
  }
  if (/\(\s*\[duration\s+rest\]\s*\)|\[duration\s+rest\]/i.test(namePart)) {
    add('durationRestSeconds');
    namePart = namePart.replace(/\(\s*\[duration\s+rest\]\s*\)/gi, ' ').replace(/\[duration\s+rest\]/gi, ' ');
  }
  if (/\(\s*\[duration\s+in\s+steps\]\s*\)|\[duration\s+in\s+steps\]/i.test(namePart)) {
    add('durationSteps');
    namePart = namePart.replace(/\(\s*\[duration\s+in\s+steps\]\s*\)/gi, ' ').replace(/\[duration\s+in\s+steps\]/gi, ' ');
  }
  if (/\(\s*\[duration\]\s*\)|\[duration\]/i.test(namePart)) {
    add('durationSeconds');
    namePart = namePart.replace(/\(\s*\[duration\]\s*\)/gi, ' ').replace(/\[duration\]/gi, ' ');
  }

  if (/x\[reps\]/i.test(namePart)) {
    add('reps');
    namePart = namePart.replace(/x\[reps\]/gi, ' ');
  }
  if (/x\[sets\]/i.test(namePart)) {
    add('sets');
    namePart = namePart.replace(/x\[sets\]/gi, ' ');
  }

  const name = namePart.replace(/\s+/g, ' ').trim();
  if (!name) {
    return null;
  }

  return {
    name,
    exerciseId: slugifyExerciseName(name),
    metrics,
    notes,
  };
}

/**
 * Parse a ranks leaf with concrete values into name + threshold metrics.
 */
function parseRanksLeaf(content) {
  let body = content.replace(/^\-\s*/, '').trim();
  const { line, notes } = extractNotes(body);
  body = line;

  const thresholds = {};

  // Extract trailing metric tokens from the end repeatedly
  // Patterns: #N, xN, (NmNs|Ns|Nm), N steps, (N steps), bare durations in parens

  // Remove notes already done. Work left-to-right after name is hard; use regex globals.

  // weight: #10 or #0
  const weightMatch = body.match(/#(\d+(?:\.\d+)?)/);
  if (weightMatch) {
    thresholds.weight = Number(weightMatch[1]);
    body = body.replace(weightMatch[0], ' ');
  }

  // steps: (20 steps) or 20 steps
  const stepsMatch = body.match(/\(?\s*(\d+)\s*steps\s*\)?/i);
  if (stepsMatch) {
    thresholds.durationSteps = parseInt(stepsMatch[1], 10);
    body = body.replace(stepsMatch[0], ' ');
  }

  // Parenthetical durations — may be go/rest pair or single
  const parenDurations = [];
  body = body.replace(/\(([^)]+)\)/g, (full, inner) => {
    const innerTrim = inner.trim();
    // skip if looks like exercise variant letters only: I or L, I
    if (/^[IL](?:\s+or\s+[IL])?$/i.test(innerTrim)) {
      return full; // keep in name
    }
    if (/steps/i.test(innerTrim)) {
      return full; // already handled
    }
    const secs = parseDurationToSeconds(innerTrim);
    if (secs != null) {
      parenDurations.push(secs);
      return ' ';
    }
    return full;
  });

  // Bare duration tokens like 20s, 1m5s, 15m not in parens (plank-hold 20s x3)
  const bareDur = body.match(/\b(\d+m\d+s|\d+m|\d+s)\b/i);
  if (bareDur && parenDurations.length === 0) {
    const secs = parseDurationToSeconds(bareDur[1]);
    if (secs != null) {
      thresholds.durationSeconds = secs;
      body = body.replace(bareDur[0], ' ');
    }
  }

  if (parenDurations.length === 1) {
    thresholds.durationSeconds = parenDurations[0];
  } else if (parenDurations.length >= 2) {
    thresholds.durationGoSeconds = parenDurations[0];
    thresholds.durationRestSeconds = parenDurations[1];
  }

  // xN tokens — typically reps then sets; if only one xN and weight present, it's reps;
  // if duration + one xN, it's sets; if two xN, reps then sets
  const xMatches = [...body.matchAll(/\bx(\d+)\b/gi)];
  if (xMatches.length >= 2) {
    thresholds.reps = parseInt(xMatches[0][1], 10);
    thresholds.sets = parseInt(xMatches[1][1], 10);
    for (const m of xMatches) body = body.replace(m[0], ' ');
  } else if (xMatches.length === 1) {
    const n = parseInt(xMatches[0][1], 10);
    // Heuristic matching format schemas:
    // weight without sets placeholder on heavy bookbag → reps
    // duration exercises → sets
    if (thresholds.weight != null && thresholds.durationSeconds == null && thresholds.durationGoSeconds == null) {
      thresholds.reps = n;
    } else if (
      thresholds.durationSeconds != null ||
      thresholds.durationGoSeconds != null ||
      thresholds.durationSteps != null
    ) {
      thresholds.sets = n;
    } else {
      thresholds.reps = n;
    }
    body = body.replace(xMatches[0][0], ' ');
  }

  const name = body.replace(/\s+/g, ' ').trim();
  if (!name) return null;

  return {
    name,
    exerciseId: slugifyExerciseName(name),
    thresholds,
    notes,
  };
}

module.exports = {
  slugifyExerciseName,
  extractNotes,
  inferMetricKeysFromPlaceholders,
  parseFormatLeaf,
  parseRanksLeaf,
};
