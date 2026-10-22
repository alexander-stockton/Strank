/**
 * Feature 15 - App Animations (click ripple)
 * Spec: features/feature-15-App-Animations.md
 */

const animationFlags = require('./animationFlags');

const MAX_RADIUS_PX = 15;
const STROKE_PX = 3;
const DURATION_MS = 450;

function ensureLayer(doc) {
  let layer = doc.querySelector('[data-click-ripple-layer]');
  if (layer) return layer;
  layer = doc.createElement('div');
  layer.className = 'click-ripple-layer';
  layer.setAttribute('data-click-ripple-layer', '');
  layer.setAttribute('aria-hidden', 'true');
  (doc.body || doc.documentElement).appendChild(layer);
  return layer;
}

function spawn(doc, x, y) {
  if (!animationFlags.isEnabled('click-ripple', { doc })) return null;
  const layer = ensureLayer(doc);
  const ring = doc.createElement('div');
  ring.className = 'click-ripple-ring';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.setProperty('--ripple-max', `${MAX_RADIUS_PX * 2}px`);
  ring.style.setProperty('--ripple-stroke', `${STROKE_PX}px`);
  layer.appendChild(ring);
  void ring.offsetWidth;
  ring.classList.add('is-expanding');
  const done = () => {
    if (ring.parentNode) ring.parentNode.removeChild(ring);
  };
  ring.addEventListener('animationend', done, { once: true });
  // Fallback cleanup if animationend never fires (jsdom)
  const win = doc.defaultView || global;
  win.setTimeout(done, DURATION_MS + 50);
  return ring;
}

function attach(doc) {
  if (!doc || typeof doc.addEventListener !== 'function') {
    return { destroy() {} };
  }
  ensureLayer(doc);
  const onClick = (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    spawn(doc, ev.clientX, ev.clientY);
  };
  doc.addEventListener('click', onClick, true);
  return {
    destroy() {
      doc.removeEventListener('click', onClick, true);
      const layer = doc.querySelector('[data-click-ripple-layer]');
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    },
    spawn: (x, y) => spawn(doc, x, y),
  };
}

module.exports = {
  attach,
  spawn,
  MAX_RADIUS_PX,
  STROKE_PX,
  DURATION_MS,
};
