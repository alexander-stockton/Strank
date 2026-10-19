/**
 * Feature 2 — Daily Exercise Log
 * Spec: features/feature-2-Daily-Exercise-Log.md
 *
 * Shared local-date helpers (kept separate from app.js to avoid circular requires).
 */

const MONTH_NAMES = [
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
];

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Human display: "October 17, 2026" from `YYYY-MM-DD` or a Date.
 */
function formatDisplayDate(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return '';
  let y;
  let m;
  let d;
  if (typeof isoOrDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(isoOrDate)) {
    y = parseInt(isoOrDate.slice(0, 4), 10);
    m = parseInt(isoOrDate.slice(5, 7), 10);
    d = parseInt(isoOrDate.slice(8, 10), 10);
  } else {
    const dt = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(dt.getTime())) return String(isoOrDate);
    y = dt.getFullYear();
    m = dt.getMonth() + 1;
    d = dt.getDate();
  }
  if (!y || !m || !d || m < 1 || m > 12) return String(isoOrDate);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

module.exports = {
  formatLocalDate,
  formatDisplayDate,
  MONTH_NAMES,
};
