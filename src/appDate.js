/**
 * Feature 2 — Daily Exercise Log
 * Spec: features/feature-2-Daily-Exercise-Log.md
 *
 * Shared local-date helpers (kept separate from app.js to avoid circular requires).
 */

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  formatLocalDate,
};
