/**
 * Feature 15 - App Animations (Get Started -> workout handoff)
 * Spec: features/feature-15-App-Animations.md
 */

const animationFlags = require('./animationFlags');
const workoutStartTips = require('./workoutStartTips');
const storage = require('./storage');
const dailyLog = require('./dailyLog');

const NOTICE_HOLD_MS = 5000;
const NOTICE_HOLD_REDUCED_MS = 1000;
const WARBLE_MS = 300;
const FADE_MS = 350;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Split trailing `(attribution)` from tip copy for layout. */
function splitQuote(text) {
  const raw = String(text || '');
  const m = raw.match(/^(.*)\s*\(([^)]+)\)\s*$/);
  if (m) {
    return { quote: m[1].trim(), attribution: m[2].trim() };
  }
  return { quote: raw, attribution: null };
}

/**
 * @param {{
 *   doc: Document,
 *   root?: Element,
 *   today?: string,
 *   onComplete: () => void,
 *   timers?: { setTimeout: Function, clearTimeout: Function },
 * }} opts
 */
function run(opts) {
  const doc = opts.doc;
  // Prefer injected timers (tests); else global setTimeout so Jest fake timers apply.
  const setTimeoutFn =
    (opts.timers && opts.timers.setTimeout) || ((fn, ms) => setTimeout(fn, ms));
  const clearTimeoutFn =
    (opts.timers && opts.timers.clearTimeout) || ((id) => clearTimeout(id));
  const reduced = animationFlags.prefersReducedMotion(doc);
  const enabled = animationFlags.isEnabled('workout-start', { doc });
  const holdMs =
    opts.noticeHoldMs != null
      ? opts.noticeHoldMs
      : reduced
        ? NOTICE_HOLD_REDUCED_MS
        : NOTICE_HOLD_MS;

  const today = opts.today || dailyLog.currentLocalDate();
  let lastDate = null;
  try {
    const read = storage.readStore();
    if (read.ok) lastDate = workoutStartTips.lastEntryLocalDateFromStore(read.data);
  } catch (_) {
    /* ignore */
  }
  const tip = workoutStartTips.selectTip({ today, lastEntryLocalDate: lastDate });
  const parts = splitQuote(tip.text);
  const attrHtml = parts.attribution
    ? `<p class="workout-start-attr" data-workout-start-attr>(${escapeHtml(parts.attribution)})</p>`
    : '';

  const overlay = doc.createElement('div');
  overlay.className = 'workout-start-overlay';
  overlay.setAttribute('data-workout-start-overlay', '');
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  const rotateClass = enabled && !reduced ? ' is-rotating' : '';
  overlay.innerHTML = `
    <div class="workout-start-band" data-workout-start-band>
      <div class="workout-start-dash workout-start-dash-top" aria-hidden="true"></div>
      <div class="workout-start-notice" data-workout-start-notice>
        <div class="workout-start-bang${rotateClass}" data-workout-start-bang aria-hidden="true">
          <span class="workout-start-bang-circle">!</span>
        </div>
        <div class="workout-start-copy">
          <p class="workout-start-tip" data-workout-start-tip>${escapeHtml(parts.quote)}</p>
          ${attrHtml}
        </div>
      </div>
      <div class="workout-start-dash workout-start-dash-bottom" aria-hidden="true"></div>
    </div>
  `;

  const parent = opts.root || doc.body;
  const landing = parent.querySelector('[data-view="landing"]') || parent.querySelector('.landing-view');

  let cancelled = false;
  const timers = [];
  function later(fn, ms) {
    const id = setTimeoutFn(() => {
      if (!cancelled) fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function finish() {
    if (cancelled) return;
    cancelled = true;
    timers.forEach((id) => clearTimeoutFn(id));
    overlay.classList.add('is-leaving');
    const remove = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof opts.onComplete === 'function') opts.onComplete();
    };
    if (enabled && !reduced) {
      // Do not use later() here - it skips when cancelled, and finish() just
      // set that flag. Schedule the fade-out removal directly so onComplete
      // still navigates to Active Workout.
      const id = setTimeoutFn(remove, FADE_MS);
      timers.push(id);
    } else {
      remove();
    }
  }

  function showNotice() {
    if (cancelled) return;
    if (landing) landing.classList.add('is-faded-out');
    parent.appendChild(overlay);
    // force reflow then fade in
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');
    later(finish, holdMs);
  }

  if (!enabled || reduced) {
    showNotice();
    return {
      cancel() {
        cancelled = true;
        timers.forEach((id) => clearTimeoutFn(id));
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      },
      tip,
    };
  }

  if (landing) {
    landing.classList.add('is-warbling');
    later(() => {
      if (landing) {
        landing.classList.remove('is-warbling');
        landing.classList.add('is-fading-out');
      }
      later(showNotice, FADE_MS);
    }, WARBLE_MS);
  } else {
    showNotice();
  }

  return {
    cancel() {
      cancelled = true;
      timers.forEach((id) => clearTimeoutFn(id));
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },
    tip,
  };
}

module.exports = {
  run,
  splitQuote,
  NOTICE_HOLD_MS,
  NOTICE_HOLD_REDUCED_MS,
};
