/**
 * Feature 8 / 15 — per-workout elapsed timer (hours, minutes, seconds, ms).
 * Timer state lives on the Active Workout draft; completed totals persist on workouts[].
 * Wall-clock stamps respect Config `24hr: t|f`.
 */

const config = require('./config');

function createTimerState() {
  return { elapsedMs: 0, runningSince: null };
}

function pauseTimer(timer, now = Date.now()) {
  if (!timer) return createTimerState();
  if (timer.runningSince == null) return timer;
  const n = typeof now === 'number' ? now : now.getTime();
  timer.elapsedMs += Math.max(0, n - timer.runningSince);
  timer.runningSince = null;
  return timer;
}

function resumeTimer(timer, now = Date.now()) {
  const t = timer || createTimerState();
  if (t.runningSince != null) return t;
  t.runningSince = typeof now === 'number' ? now : now.getTime();
  return t;
}

function readElapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  const n = typeof now === 'number' ? now : now.getTime();
  let ms = Number(timer.elapsedMs) || 0;
  if (timer.runningSince != null) {
    ms += Math.max(0, n - timer.runningSince);
  }
  return Math.max(0, Math.floor(ms));
}

function resolveUse24Hour(options = {}) {
  if (options.use24Hour != null) return Boolean(options.use24Hour);
  try {
    if (typeof config.getUse24HourClock === 'function') return config.getUse24HourClock();
  } catch (_) {
    /* defaults below */
  }
  return true;
}

/**
 * Format a wall-clock time from 24h components.
 * 24hr: HH:MM:SS.mmm  |  12hr: h:MM:SS.mmm AM|PM
 */
function formatWallClock(hours24, minutes, seconds, millis, use24Hour) {
  const pad = (n, w = 2) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(w, '0');
  const h24 = ((Math.floor(Number(hours24) || 0) % 24) + 24) % 24;
  const mm = pad(minutes);
  const ss = pad(seconds);
  const mmm = pad(millis, 3);
  if (use24Hour) {
    return `${pad(h24)}:${mm}:${ss}.${mmm}`;
  }
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${mm}:${ss}.${mmm} ${period}`;
}

/**
 * Convert a displayed clock string between 12hr and 24hr forms.
 * Accepts "23:50:10.001", "11:50:10.001 PM", "12:01:01.001 AM", etc.
 */
function convertClockDisplay(text, to24Hour) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const m = raw.match(
    /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\s*(AM|PM)?$/i
  );
  if (!m) return raw;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const seconds = parseInt(m[3], 10);
  let millis = m[4] != null ? parseInt(m[4].padEnd(3, '0').slice(0, 3), 10) : 0;
  const period = m[5] ? m[5].toUpperCase() : null;

  if (period) {
    // 12-hour input → normalize to 24h components
    if (period === 'AM') {
      if (hours === 12) hours = 0;
    } else if (period === 'PM') {
      if (hours !== 12) hours += 12;
    }
  }

  return formatWallClock(hours, minutes, seconds, millis, Boolean(to24Hour));
}

/** Elapsed workout duration as H:MM:SS.mmm (hours unpadded; not AM/PM). */
function formatDuration(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/** Clock time from an ISO-with-offset (or Date-parseable) stamp. */
function formatCompletionClock(iso, options = {}) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const use24 = resolveUse24Hour(options);
  return formatWallClock(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds(), use24);
}

module.exports = {
  createTimerState,
  pauseTimer,
  resumeTimer,
  readElapsedMs,
  formatDuration,
  formatCompletionClock,
  formatWallClock,
  convertClockDisplay,
};
