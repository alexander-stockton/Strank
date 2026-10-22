/**
 * Feature 9 — Workout History Calendar
 * Spec: features/feature-9-Workout-History-Calendar.md
 */

const storage = require('./storage');
const history = require('./history');
const ranking = require('./ranking');
const { formatLocalDate } = require('./appDate');

function parseLocalDate(iso) {
  const [y, m, d] = String(iso).split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

function addDays(iso, delta) {
  const dt = parseLocalDate(iso);
  dt.setDate(dt.getDate() + delta);
  return formatLocalDate(dt);
}

/**
 * A day is recorded if any entries OR a Feature 8 workouts[] session exists (FR-002).
 */
function recordedDatesSet() {
  const read = storage.readStore();
  const set = new Set();
  if (!read.ok) return set;
  for (const e of read.data.entries || []) {
    if (e.localDate) set.add(e.localDate);
  }
  for (const w of read.data.workouts || []) {
    if (w.localDate) set.add(w.localDate);
  }
  return set;
}

function isRecorded(localDate) {
  return recordedDatesSet().has(localDate);
}

/**
 * Build month grid cells including muted leading/trailing days from adjacent months.
 */
function buildMonthCells(year, month) {
  const first = new Date(year, month - 1, 1);
  const firstDow = (() => {
    const day = first.getDay();
    return day === 0 ? 6 : day - 1; // Mon=0
  })();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  // Leading muted days
  if (firstDow > 0) {
    const prevMonthLast = new Date(year, month - 1, 0);
    const prevYear = prevMonthLast.getFullYear();
    const prevMonth = prevMonthLast.getMonth() + 1;
    const prevDays = prevMonthLast.getDate();
    for (let i = firstDow - 1; i >= 0; i -= 1) {
      const d = prevDays - i;
      cells.push({
        localDate: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNumber: d,
        inMonth: false,
      });
    }
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({
      localDate: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNumber: d,
      inMonth: true,
    });
  }

  // Trailing muted days to fill final week
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const next = addDays(last.localDate, 1);
    const dt = parseLocalDate(next);
    cells.push({
      localDate: next,
      dayNumber: dt.getDate(),
      inMonth: false,
    });
  }

  return cells;
}

/**
 * Month model: cells, week badges, month progression (FR-001–FR-004, FR-008a).
 */
function getMonth(year, month, options = {}) {
  const today = options.today || ranking.currentLocalDate();
  const recorded = recordedDatesSet();
  const cells = buildMonthCells(year, month).map((c) => ({
    ...c,
    recorded: recorded.has(c.localDate),
  }));

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    const slice = cells.slice(i, i + 7);
    const weekStart = ranking.mondayOf(slice[0].localDate);
    const compared = ranking.compareToRanks(weekStart, { today });
    const tierName = compared.ok ? compared.data.overallTierName : 'UNRANKED';
    weeks.push({
      weekStart,
      tierName,
      days: slice,
    });
  }

  const prog = ranking.getMonthProgression(year, month, { today });
  if (!prog.ok) return prog;

  return {
    ok: true,
    data: {
      year,
      month,
      cells,
      weeks,
      progression: {
        startTierName: prog.data.startTierName,
        endTierName: prog.data.endTierName,
        endKind: prog.data.endKind,
      },
    },
  };
}

/**
 * Day detail model: entries + day-rank (FR-005–FR-006).
 */
function getDay(localDate, options = {}) {
  const today = options.today || ranking.currentLocalDate();
  if (!history.isValidLocalDateString(localDate)) {
    return { ok: false, message: 'localDate is invalid.' };
  }

  const listed = history.list({ localDate });
  if (!listed.ok) return listed;

  const dayRank = ranking.compareDay(localDate, { today });
  const tierName = dayRank.ok ? dayRank.data.overallTierName : 'UNRANKED';

  let workoutDurationMs = null;
  const read = storage.readStore();
  if (read.ok) {
    const sessions = (read.data.workouts || []).filter((w) => w && w.localDate === localDate);
    if (sessions.length) {
      sessions.sort((a, b) =>
        String(a.completedAt || '').localeCompare(String(b.completedAt || ''))
      );
      const latest = sessions[sessions.length - 1];
      if (latest && Number.isFinite(latest.durationMs)) workoutDurationMs = latest.durationMs;
    }
  }

  return {
    ok: true,
    data: {
      localDate,
      tierName,
      entries: listed.data,
      recorded: listed.data.length > 0 || isRecorded(localDate),
      workoutDurationMs,
    },
  };
}

/**
 * Years overview with progressions (FR-008b).
 */
function getYearsOverview(options = {}) {
  const today = options.today || ranking.currentLocalDate();
  const yearsResult = ranking.listActiveYears({ today });
  if (!yearsResult.ok) return yearsResult;

  const years = yearsResult.data.map((year) => {
    const prog = ranking.getYearProgression(year, { today });
    const progression = prog.ok
      ? {
          startTierName: prog.data.startTierName,
          endTierName: prog.data.endTierName,
          endKind: prog.data.endKind,
        }
      : { startTierName: 'UNRANKED', endTierName: 'UNRANKED', endKind: 'latestFinishedWeek' };
    return { year, progression };
  });

  return { ok: true, data: years };
}

function adjacentDay(localDate, delta) {
  return addDays(localDate, delta);
}

module.exports = {
  getMonth,
  getDay,
  getYearsOverview,
  recordedDatesSet,
  isRecorded,
  adjacentDay,
  buildMonthCells,
  MONTH_NAMES: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};
