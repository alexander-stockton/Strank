/**
 * Feature 15 — App Animations (buttons, accordions, smooth scroll)
 * Spec: features/feature-15-App-Animations.md
 */

const animationFlags = require('./animationFlags');

function isElevatedButton(el) {
  if (!el || el.tagName !== 'BUTTON') return false;
  if (el.classList.contains('exercise-help-btn')) return false;
  if (el.classList.contains('outline')) return false;
  return el.classList.contains('primary') && !el.classList.contains('ghost');
}

function isOutlineButton(el) {
  if (!el || el.tagName !== 'BUTTON') return false;
  if (el.classList.contains('exercise-help-btn')) return false;
  return el.classList.contains('outline') || (el.classList.contains('secondary') && el.classList.contains('outline'));
}

function applyRootFlags(root, doc) {
  const elevated = animationFlags.isEnabled('elevated-buttons', { doc });
  const outline = animationFlags.isEnabled('outline-buttons', { doc });
  const accordions = animationFlags.isEnabled('accordions', { doc });
  const smooth = animationFlags.isEnabled('smooth-card-scroll', { doc });
  root.classList.toggle('motion-elevated-on', elevated);
  root.classList.toggle('motion-outline-on', outline);
  root.classList.toggle('motion-accordions-on', accordions);
  root.classList.toggle('motion-smooth-scroll-on', smooth);
}

function attach(root) {
  if (!root) return { destroy() {} };
  const doc = root.ownerDocument || document;
  applyRootFlags(root, doc);
  if (doc.documentElement) applyRootFlags(doc.documentElement, doc);

  const onPointerDown = (ev) => {
    const btn = ev.target && ev.target.closest && ev.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('exercise-help-btn')) return;
    if (isElevatedButton(btn) && animationFlags.isEnabled('elevated-buttons', { doc })) {
      btn.classList.add('is-pressed');
      btn.classList.remove('is-bounce');
    } else if (isOutlineButton(btn) && animationFlags.isEnabled('outline-buttons', { doc })) {
      btn.classList.add('is-pressed');
    }
  };

  const onPointerUp = (ev) => {
    const btn = ev.target && ev.target.closest && ev.target.closest('button');
    if (!btn) return;
    const stillOver = btn.matches(':hover') || (ev.target === btn);
    if (isElevatedButton(btn) && animationFlags.isEnabled('elevated-buttons', { doc })) {
      btn.classList.remove('is-pressed');
      if (stillOver) {
        btn.classList.add('is-bounce');
        const win = doc.defaultView || global;
        win.setTimeout(() => btn.classList.remove('is-bounce'), 580);
      }
    } else if (isOutlineButton(btn) && animationFlags.isEnabled('outline-buttons', { doc })) {
      btn.classList.remove('is-pressed');
    }
  };

  const onPointerLeave = (ev) => {
    const btn = ev.target;
    if (!btn || btn.tagName !== 'BUTTON') return;
    btn.classList.remove('is-pressed', 'is-bounce');
  };

  root.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('pointerup', onPointerUp, true);
  root.addEventListener('pointerleave', onPointerLeave, true);

  return {
    destroy() {
      root.removeEventListener('pointerdown', onPointerDown, true);
      root.removeEventListener('pointerup', onPointerUp, true);
      root.removeEventListener('pointerleave', onPointerLeave, true);
    },
    refresh() {
      applyRootFlags(root, doc);
      if (doc.documentElement) applyRootFlags(doc.documentElement, doc);
    },
  };
}

module.exports = {
  attach,
  isElevatedButton,
  isOutlineButton,
  applyRootFlags,
};
