/**
 * Feature 15 — App Animations (flyout / tooltip opacity fade)
 * Spec: features/feature-15-App-Animations.md
 */

const animationFlags = require('./animationFlags');

const DURATION_MS = 250;

function show(el, options = {}) {
  if (!el) return;
  const doc = el.ownerDocument || document;
  if (!animationFlags.isEnabled('flyout-fade', { doc })) {
    el.hidden = false;
    el.classList.add('flyout-fade-visible');
    el.style.opacity = '1';
    return;
  }
  el.hidden = false;
  el.classList.remove('flyout-fade-leaving');
  el.classList.add('flyout-fade-enter');
  void el.offsetWidth;
  el.classList.add('flyout-fade-visible');
  if (typeof options.onDone === 'function') {
    const win = doc.defaultView || global;
    win.setTimeout(options.onDone, DURATION_MS);
  }
}

function hide(el, options = {}) {
  if (!el) return;
  const doc = el.ownerDocument || document;
  if (!animationFlags.isEnabled('flyout-fade', { doc })) {
    el.hidden = true;
    el.classList.remove('flyout-fade-visible');
    if (typeof options.onDone === 'function') options.onDone();
    return;
  }
  el.classList.add('flyout-fade-leaving');
  el.classList.remove('flyout-fade-visible');
  const win = doc.defaultView || global;
  win.setTimeout(() => {
    el.hidden = true;
    el.classList.remove('flyout-fade-leaving', 'flyout-fade-enter');
    if (typeof options.onDone === 'function') options.onDone();
  }, DURATION_MS);
}

module.exports = {
  show,
  hide,
  DURATION_MS,
};
