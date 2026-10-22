/**
 * Feature 15 - App Animations (incoming content reveal)
 * Spec: features/feature-15-App-Animations.md
 */

const animationFlags = require('./animationFlags');

const DURATION_MS = 750;
const STAGGER_AT = 0.25;
const RISE_PX = 6;

const AUTO_FRAME_SELECTOR = [
  '[data-content-reveal-frame]',
  '.landing-card',
  '[data-landing-card]',
  '.ranks-gallery-column',
  '.landing-panel',
  '.landing-skill-body',
  '.onboarding-view',
  '.onboarding-privacy',
].join(', ');

const AUTO_ITEM_SELECTOR = [
  '[data-content-reveal-item]',
  '.expectation-row',
  '.workout-check-row',
  '.skill-progress-row',
  '.history-day-row',
  '.ranks-gallery-item',
].join(', ');

function markUnit(el, delayMs) {
  el.classList.add('content-reveal-unit');
  el.style.setProperty('--reveal-rise', `${RISE_PX}px`);
  el.style.setProperty('--reveal-duration', `${DURATION_MS}ms`);
  el.style.animationDelay = `${delayMs}ms`;
}

function unitsForFrame(frame) {
  const explicitItems = frame.querySelectorAll('[data-content-reveal-item]');
  if (explicitItems.length) return Array.from(explicitItems);

  const autoItems = frame.querySelectorAll(AUTO_ITEM_SELECTOR);
  // Only count items that belong to this frame (not nested frames).
  const owned = Array.from(autoItems).filter((item) => {
    const owner = item.closest(AUTO_FRAME_SELECTOR);
    return owner === frame;
  });
  if (owned.length) return owned;

  const body = frame.querySelector('[data-content-reveal-body]');
  if (body) return [body];

  // Card/column chrome stays; reveal the expectations / panel body when present.
  const softBody =
    frame.querySelector('.panel-body, .ranks-gallery-expectations, .landing-skill-body') || frame;
  return [softBody];
}

/**
 * Mark list items / reveal units under root and start CSS animations.
 * Frames stay put; each frame/group starts its own stagger timer at 0.
 */
function play(root, options = {}) {
  if (!root) return { skipped: true };
  const doc = root.ownerDocument || document;
  if (!animationFlags.isEnabled('content-reveal', { doc })) {
    return { skipped: true };
  }

  const staggerDelay = DURATION_MS * STAGGER_AT;
  const frames = Array.from(root.querySelectorAll(AUTO_FRAME_SELECTOR));
  // Prefer outermost / unique frames (skip a node already covered by an ancestor frame).
  const topFrames = frames.filter((frame) => {
    let parent = frame.parentElement;
    while (parent && parent !== root) {
      if (parent.matches && parent.matches(AUTO_FRAME_SELECTOR)) return false;
      parent = parent.parentElement;
    }
    return true;
  });

  let count = 0;
  if (topFrames.length) {
    topFrames.forEach((frame) => {
      unitsForFrame(frame).forEach((el, i) => {
        markUnit(el, i * staggerDelay);
        count += 1;
      });
    });
  } else {
    // Fallback: treat the whole root as one group
    root.querySelectorAll(AUTO_ITEM_SELECTOR).forEach((el, i) => {
      markUnit(el, i * staggerDelay);
      count += 1;
    });
  }

  return { skipped: false, count, staggerDelayMs: staggerDelay, groups: topFrames.length || 1 };
}

module.exports = {
  play,
  DURATION_MS,
  STAGGER_AT,
  RISE_PX,
};
