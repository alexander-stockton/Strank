/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 *
 * Parses duration tokens like 20s, 1m, 1m5s, 15m into total seconds.
 */

function parseDurationToSeconds(token) {
  if (token == null) return null;
  const raw = String(token).trim().toLowerCase();
  if (!raw) return null;

  // plain integer seconds
  if (/^\d+$/.test(raw)) {
    return parseInt(raw, 10);
  }

  const m = raw.match(/^(?:(\d+)m)?(?:(\d+)s)?$/);
  if (m && (m[1] || m[2])) {
    const minutes = m[1] ? parseInt(m[1], 10) : 0;
    const seconds = m[2] ? parseInt(m[2], 10) : 0;
    return minutes * 60 + seconds;
  }

  return null;
}

module.exports = {
  parseDurationToSeconds,
};
