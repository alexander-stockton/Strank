/**
 * Feature 15 — App Animations (config + reduced-motion gates)
 * Spec: features/feature-15-App-Animations.md
 */

const config = require('./config');

const FAMILY_KEYS = {
  'workout-start': 'animation workout start',
  'click-ripple': 'animation click ripple',
  'view-slides': 'animation view slides',
  'content-reveal': 'animation content reveal',
  'flyout-fade': 'animation flyout fade',
  'elevated-buttons': 'animation elevated buttons',
  'outline-buttons': 'animation outline buttons',
  accordions: 'animation accordions',
  'smooth-card-scroll': 'animation smooth card scroll',
};

function prefersReducedMotion(doc) {
  try {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    const win = (d && d.defaultView) || (typeof window !== 'undefined' ? window : null);
    if (!win || !win.matchMedia) return false;
    return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

function isEnabled(familyId, options = {}) {
  if (prefersReducedMotion(options.doc)) return false;
  const key = FAMILY_KEYS[familyId];
  if (!key) return true;
  try {
    config.load();
    const s = config.get();
    const v = s[key];
    if (v === false || v === 'false') return false;
    return true;
  } catch (_) {
    return true;
  }
}

module.exports = {
  FAMILY_KEYS,
  prefersReducedMotion,
  isEnabled,
};
