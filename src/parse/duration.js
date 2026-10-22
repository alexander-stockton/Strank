/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 *
 * Parses duration tokens like 20s, 1m, 1m5s, 15m, 1h40m6s into total seconds.
 * Seconds may be decimal; hours and minutes are whole numbers.
 */

const i18n = require('../i18n');

function isTimeDurationKey(key) {
  return (
    typeof key === 'string' &&
    key.startsWith('duration') &&
    key !== 'durationSteps'
  );
}

/**
 * Parses duration tokens to total seconds (may be fractional).
 * @returns {number|null}
 */
function parseDurationToSeconds(token) {
  if (token == null) return null;
  if (typeof token === 'number' && Number.isFinite(token)) return token;
  const raw = String(token).trim().toLowerCase();
  if (!raw) return null;

  // plain seconds (integer or decimal)
  if (/^\d+(\.\d+)?$/.test(raw)) {
    return parseFloat(raw);
  }

  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/);
  if (m && (m[1] || m[2] || m[3])) {
    const hours = m[1] ? parseInt(m[1], 10) : 0;
    const minutes = m[2] ? parseInt(m[2], 10) : 0;
    const seconds = m[3] ? parseFloat(m[3]) : 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

function roundSeconds(s) {
  return Math.round(Number(s) * 1000) / 1000;
}

function formatSecondsPart(s) {
  const n = roundSeconds(s);
  if (Number.isInteger(n)) return String(n);
  // Trim floating noise: 59.500 → 59.5
  return String(n).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

/**
 * Format total seconds as #h#m#s (omit zero units except 0m when hours+seconds).
 * Examples: 20s, 1m35s, 1h40m6s, 1m, 1h, 2m59.5s, 1h0m5s, 1h5m
 */
function formatDurationSeconds(totalSeconds) {
  if (totalSeconds == null || totalSeconds === '') return '';
  const n = Number(totalSeconds);
  if (!Number.isFinite(n) || n < 0) return '';

  const h = Math.floor(n / 3600);
  const afterH = n - h * 3600;
  const m = Math.floor(afterH / 60);
  const s = roundSeconds(afterH - m * 60);

  if (h > 0) {
    if (s > 0) return `${h}h${m}m${formatSecondsPart(s)}s`;
    if (m > 0) return `${h}h${m}m`;
    return `${h}h`;
  }
  if (m > 0) {
    if (s > 0) return `${m}m${formatSecondsPart(s)}s`;
    return `${m}m`;
  }
  return `${formatSecondsPart(s)}s`;
}

/**
 * Split total seconds into whole hours/minutes and (possibly decimal) seconds.
 */
function splitDurationSeconds(totalSeconds) {
  const n = Number(totalSeconds);
  if (!Number.isFinite(n) || n < 0) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }
  const hours = Math.floor(n / 3600);
  const afterH = n - hours * 3600;
  const minutes = Math.floor(afterH / 60);
  const seconds = roundSeconds(afterH - minutes * 60);
  return { hours, minutes, seconds };
}

/**
 * Carry overflow: seconds ≥ 60 → +1 minute; minutes ≥ 60 → +1 hour.
 * Example: 241 minutes → 4 hours + 1 minute; 241 seconds → +4 minutes + 1 second.
 * Hours remain capped at 200 after carry.
 * @returns {{ ok: true, hours: number, minutes: number, seconds: number } | { ok: false, message: string }}
 */
function normalizeDurationParts(parts) {
  const rawH = parts && parts.hours;
  const rawM = parts && parts.minutes;
  const rawS = parts && parts.seconds;

  const empty = (v) => v === '' || v == null;
  if (empty(rawH) && empty(rawM) && empty(rawS)) {
    return { ok: false, message: i18n.t('validation.durationRequired') };
  }

  let h = empty(rawH) ? 0 : Number(rawH);
  let m = empty(rawM) ? 0 : Number(rawM);
  let s = empty(rawS) ? 0 : Number(rawS);

  if (!Number.isFinite(h) || h < 0 || !Number.isInteger(h)) {
    return { ok: false, message: i18n.t('validation.hoursWhole') };
  }
  if (!Number.isFinite(m) || m < 0 || !Number.isInteger(m)) {
    return { ok: false, message: i18n.t('validation.minutesWhole') };
  }
  if (!Number.isFinite(s) || s < 0) {
    return { ok: false, message: i18n.t('validation.secondsInvalid') };
  }

  // Carry seconds → minutes (preserve fractional seconds remainder)
  while (s >= 60) {
    s = roundSeconds(s - 60);
    m += 1;
  }

  // Carry minutes → hours
  while (m >= 60) {
    m -= 60;
    h += 1;
  }

  if (h > 200) {
    return { ok: false, message: i18n.t('validation.hoursMax') };
  }

  return { ok: true, hours: h, minutes: m, seconds: roundSeconds(s) };
}

/**
 * Combine h/m/s parts into total seconds (with overflow carry into higher units).
 * @returns {{ ok: true, seconds: number, hours: number, minutes: number, secondsPart: number } | { ok: false, message: string }}
 */
function combineDurationParts(parts) {
  const normalized = normalizeDurationParts(parts);
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    seconds: roundSeconds(normalized.hours * 3600 + normalized.minutes * 60 + normalized.seconds),
    hours: normalized.hours,
    minutes: normalized.minutes,
    secondsPart: normalized.seconds,
  };
}

function readPartNumber(value, integer) {
  if (value === '' || value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return integer ? Math.trunc(n) : n;
}

/**
 * Borrow when stepping down past 0 on minutes or seconds.
 * - minutes at 0, hours > 0 → hours-1, minutes 59
 * - seconds at 0, minutes > 0 → minutes-1, seconds 59
 * - seconds at 0, minutes at 0, hours > 0 → hours-1, minutes 59, seconds 59
 * - all zero → unchanged (changed: false)
 *
 * Spinner underflow (value -1) is treated as stepping down from 0.
 *
 * @param {'minutes'|'seconds'} field
 * @returns {{ ok: true, hours: number, minutes: number, seconds: number, changed: boolean } | { ok: false, message: string }}
 */
function borrowDurationOnStepDown(parts, field) {
  let h = readPartNumber(parts && parts.hours, true);
  let m = readPartNumber(parts && parts.minutes, true);
  let s = readPartNumber(parts && parts.seconds, false);
  if (h == null) return { ok: false, message: i18n.t('validation.hoursWhole') };
  if (m == null) return { ok: false, message: i18n.t('validation.minutesWhole') };
  if (s == null) return { ok: false, message: i18n.t('validation.secondsInvalid') };

  // Spinner may set -1; treat as 0 before borrow
  if (h < 0) h = 0;
  if (m < 0) m = 0;
  if (s < 0) s = 0;

  if (field === 'minutes') {
    if (m > 0) {
      return { ok: true, hours: h, minutes: m - 1, seconds: roundSeconds(s), changed: true };
    }
    // m === 0
    if (h <= 0) {
      return { ok: true, hours: 0, minutes: 0, seconds: roundSeconds(s), changed: false };
    }
    return { ok: true, hours: h - 1, minutes: 59, seconds: roundSeconds(s), changed: true };
  }

  if (field === 'seconds') {
    if (s > 0) {
      return { ok: true, hours: h, minutes: m, seconds: roundSeconds(s - 1), changed: true };
    }
    // s === 0
    if (h <= 0 && m <= 0) {
      return { ok: true, hours: 0, minutes: 0, seconds: 0, changed: false };
    }
    if (m > 0) {
      return { ok: true, hours: h, minutes: m - 1, seconds: 59, changed: true };
    }
    // m === 0, h > 0
    return { ok: true, hours: h - 1, minutes: 59, seconds: 59, changed: true };
  }

  return { ok: false, message: i18n.t('validation.unknownDurationField') };
}

module.exports = {
  parseDurationToSeconds,
  formatDurationSeconds,
  splitDurationSeconds,
  combineDurationParts,
  normalizeDurationParts,
  borrowDurationOnStepDown,
  isTimeDurationKey,
};
