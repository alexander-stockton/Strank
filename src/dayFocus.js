/**
 * Feature 14 — Landing Layout & Day Focus
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const landingConfig = require('./landingConfig');
const { formatLocalDate } = require('./appDate');
const { GROUP_ALIASES, muscleGroupFromHeader } = require('./rankTokens');

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // Date#getDay
const MUSCLE_GROUPS = ['arms', 'core', 'lungs', 'legs'];
const FOCUS_KEYS = {
  arms: 'focus arms days',
  core: 'focus core days',
  lungs: 'focus lungs days',
  legs: 'focus legs days',
};

function defaults() {
  return {
    arms: ['mon', 'thu'],
    core: ['tue', 'fri'],
    lungs: ['mon', 'wed', 'fri'],
    legs: ['wed', 'sat'],
  };
}

function parseDayTokens(raw) {
  const parts = String(raw == null ? '' : raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = [];
  const seen = new Set();
  for (const p of parts) {
    if (!WEEKDAYS.includes(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    valid.push(p);
  }
  return valid;
}

function coerceGroupDays(raw, fallback) {
  const parsed = parseDayTokens(raw);
  // Invalid / empty file value → defaults for that key (FR edge: coerce without full reset)
  if (!String(raw == null ? '' : raw).trim()) return [...fallback];
  const tokens = String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return [...fallback];
  if (tokens.some((t) => !WEEKDAYS.includes(t)) && parsed.length === 0) {
    return [...fallback];
  }
  return parsed;
}

function getSchedule() {
  landingConfig.load();
  const s = landingConfig.get();
  const d = defaults();
  return {
    arms: coerceGroupDays(s[FOCUS_KEYS.arms], d.arms),
    core: coerceGroupDays(s[FOCUS_KEYS.core], d.core),
    lungs: coerceGroupDays(s[FOCUS_KEYS.lungs], d.lungs),
    legs: coerceGroupDays(s[FOCUS_KEYS.legs], d.legs),
  };
}

function serializeDays(days) {
  return (days || []).filter((d) => WEEKDAYS.includes(d)).join(',');
}

function setSchedule(patch, options = {}) {
  const current = getSchedule();
  const next = { ...current };
  for (const group of MUSCLE_GROUPS) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, group)) {
      next[group] = parseDayTokens(
        Array.isArray(patch[group]) ? patch[group].join(',') : patch[group]
      );
    }
  }
  const update = {};
  for (const group of MUSCLE_GROUPS) {
    update[FOCUS_KEYS[group]] = serializeDays(next[group]);
  }
  landingConfig.update(update, options);
  return { ok: true, data: getSchedule() };
}

function weekdayKeyForDate(localDate) {
  const iso = localDate || formatLocalDate(new Date());
  const [y, m, d] = String(iso)
    .split('-')
    .map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return WEEKDAY_KEYS[dt.getDay()];
}

/**
 * Muscle groups scheduled for a local calendar date.
 * @returns {string[]} e.g. ['arms','lungs']
 */
function groupsForDate(localDate) {
  const day = weekdayKeyForDate(localDate);
  const schedule = getSchedule();
  return MUSCLE_GROUPS.filter((g) => (schedule[g] || []).includes(day));
}

function normalizeMuscleGroup(nameOrHeader) {
  return muscleGroupFromHeader(nameOrHeader);
}

function muscleGroupFromHeaders(headers) {
  for (const h of headers || []) {
    const g = normalizeMuscleGroup(h);
    if (g) return g;
  }
  return null;
}

module.exports = {
  defaults,
  getSchedule,
  setSchedule,
  groupsForDate,
  weekdayKeyForDate,
  parseDayTokens,
  coerceGroupDays,
  muscleGroupFromHeaders,
  normalizeMuscleGroup,
  WEEKDAYS,
  MUSCLE_GROUPS,
  FOCUS_KEYS,
  GROUP_ALIASES,
};
