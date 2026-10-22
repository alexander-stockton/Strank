/**
 * Feature 2 — Daily Exercise Log
 * Spec: features/feature-2-Daily-Exercise-Log.md
 *
 * Shared local-date helpers (kept separate from app.js to avoid circular requires).
 */

const i18n = require('./i18n');

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Human display in the active language: "October 17, 2026" from `YYYY-MM-DD` or a Date.
 */
function formatDisplayDate(isoOrDate) {
  return i18n.formatDate(isoOrDate);
}

module.exports = {
  formatLocalDate,
  formatDisplayDate,
};
