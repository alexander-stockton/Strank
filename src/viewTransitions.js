/**
 * Feature 15 - App Animations (ranked view slides)
 * Spec: features/feature-15-App-Animations.md
 */

const animationFlags = require('./animationFlags');

/** Lead-in before slide motion starts (seconds → ms). */
const LEAD_IN_MIN_MS = 50; // 0.05s
const LEAD_IN_MAX_MS = 500; // 0.5s

/** Random delay between button-press and slide start (inclusive range endpoints). */
function randomLeadInMs(randomFn = Math.random) {
  const span = LEAD_IN_MAX_MS - LEAD_IN_MIN_MS;
  return LEAD_IN_MIN_MS + randomFn() * span;
}

const VIEW_RANKS = {
  'setup-install': 0,
  onboarding: 1,
  'privacy-notice': 2,
  'contributing-notice': 2,
  landing: 3,
  workout: 4,
  history: 5,
  'history-month': 5,
  'history-day': 6,
  'history-year': 7,
  ranks: 8,
  config: 9,
  'rank-manager': 10,
  'rank-editor': 11,
  'rank-create': 12,
  'rank-edit': 13,
};

function rankFor(viewId) {
  if (viewId == null) return null;
  const id = String(viewId);
  if (Object.prototype.hasOwnProperty.call(VIEW_RANKS, id)) return VIEW_RANKS[id];
  return null;
}

function direction(fromRank, toRank) {
  if (fromRank == null || toRank == null) return 'none';
  if (fromRank < toRank) return 'ascend';
  if (fromRank > toRank) return 'descend';
  return 'none';
}

function enterFromClass(dir) {
  return dir === 'ascend' ? 'view-slide-enter-from-below' : 'view-slide-enter-from-right';
}

function exitToClass(dir) {
  return dir === 'ascend' ? 'view-slide-exit-to-right' : 'view-slide-exit-to-down';
}

/**
 * Park the incoming pane off-screen with no transition (call during lead-in).
 * Keeps the outgoing view visible until motion starts.
 */
function clearSlidePose(el) {
  if (!el || !el.classList) return;
  el.classList.remove(
    'view-slide-enter-from-below',
    'view-slide-enter-from-right',
    'view-slide-enter-active',
    'view-slide-exit-to-right',
    'view-slide-exit-to-down',
    'view-slide-exit-active',
    'view-slide-prepared'
  );
  try {
    el.style.transform = '';
    el.style.opacity = '';
    el.style.transition = '';
  } catch (_) {
    /* ignore */
  }
}

function prepare(opts) {
  const doc = opts.doc || (opts.container && opts.container.ownerDocument);
  const dir = direction(rankFor(opts.fromView), rankFor(opts.toView));
  const enabled = animationFlags.isEnabled('view-slides', { doc });
  if (!enabled || dir === 'none' || !opts.toEl) {
    return { direction: dir, skipped: true };
  }
  // Drop any prior park/enter classes (cached reverse nav) so only one pose applies.
  clearSlidePose(opts.toEl);
  opts.toEl.classList.add(enterFromClass(dir));
  opts.toEl.classList.add('view-slide-prepared');
  void opts.toEl.offsetWidth;
  return { direction: dir, skipped: false };
}

/**
 * After an exit slide, keep the pane off-screen on the side it left toward
 * so a reverse navigation can slide it back in without remounting.
 */
function parkExited(el, dir) {
  if (!el) return;
  clearSlidePose(el);
  if (dir === 'ascend') {
    el.classList.add('view-slide-enter-from-right', 'view-slide-prepared');
  } else if (dir === 'descend') {
    el.classList.add('view-slide-enter-from-below', 'view-slide-prepared');
  } else {
    el.classList.add('view-slide-prepared');
  }
}

/**
 * Apply enter/leave classes on shell-main children (view panes).
 * Prefer calling prepare() first so the enter-from pose is already painted.
 * @param {{
 *   container: Element,
 *   fromEl?: Element|null,
 *   toEl: Element,
 *   fromView: string,
 *   toView: string,
 *   doc?: Document,
 *   onComplete?: () => void,
 *   durationMs?: number,
 *   retainFromEl?: boolean,
 *   immediate?: boolean,
 *   onMotionStart?: () => void,
 * }} opts
 */
function run(opts) {
  const doc = opts.doc || (opts.container && opts.container.ownerDocument);
  const fromRank = rankFor(opts.fromView);
  const toRank = rankFor(opts.toView);
  const dir = direction(fromRank, toRank);
  const enabled = animationFlags.isEnabled('view-slides', { doc });
  const durationMs = opts.durationMs != null ? opts.durationMs : 420;
  const retainFromEl = !!opts.retainFromEl;
  const immediate = !!opts.immediate;
  const win = (doc && doc.defaultView) || global;

  let finished = false;
  let timerId = null;
  let raf1 = null;
  let raf2 = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (timerId != null) {
      win.clearTimeout(timerId);
      timerId = null;
    }
    if (raf1 != null && typeof win.cancelAnimationFrame === 'function') {
      win.cancelAnimationFrame(raf1);
      raf1 = null;
    }
    if (raf2 != null && typeof win.cancelAnimationFrame === 'function') {
      win.cancelAnimationFrame(raf2);
      raf2 = null;
    }
    if (opts.fromEl && opts.fromEl.parentNode) {
      if (retainFromEl) {
        parkExited(opts.fromEl, dir);
      } else {
        opts.fromEl.parentNode.removeChild(opts.fromEl);
      }
    }
    // Always clear enter/exit poses so a stalled slide cannot leave the page blank.
    clearSlidePose(opts.toEl);
    if (typeof opts.onComplete === 'function') opts.onComplete();
  };

  const cancel = () => {
    finish();
  };

  if (!enabled || dir === 'none' || !opts.toEl) {
    if (opts.fromEl && opts.fromEl.parentNode && !retainFromEl) {
      opts.fromEl.parentNode.removeChild(opts.fromEl);
    }
    if (typeof opts.onComplete === 'function') opts.onComplete();
    return { direction: dir, skipped: true, cancel() {} };
  }

  // Ensure parked off-screen without transitioning into that pose.
  const fromCls = enterFromClass(dir);
  if (!opts.toEl.classList.contains(fromCls)) {
    opts.toEl.classList.add(fromCls);
  }
  opts.toEl.classList.add('view-slide-prepared');
  opts.toEl.classList.remove('view-slide-enter-active');
  void opts.toEl.offsetWidth;

  if (opts.fromEl) {
    opts.fromEl.classList.add(exitToClass(dir));
    // Exit motion arms with enter on the next frame so both share one paint.
  }

  const startMotion = () => {
    if (finished) return;
    opts.toEl.classList.remove('view-slide-prepared');
    if (opts.fromEl) {
      opts.fromEl.classList.add('view-slide-exit-active');
    }
    void opts.toEl.offsetWidth;
    opts.toEl.classList.add('view-slide-enter-active');
    if (typeof opts.onMotionStart === 'function') {
      try {
        opts.onMotionStart();
      } catch (_) {
        /* ignore */
      }
    }
    timerId = win.setTimeout(finish, durationMs);
  };

  // Two frames: paint the parked pose, then enable transition + target transform.
  // Skip when immediate (cached reverse nav) — pane is already painted off-screen.
  if (immediate) {
    startMotion();
  } else if (typeof win.requestAnimationFrame === 'function') {
    raf1 = win.requestAnimationFrame(() => {
      raf1 = null;
      raf2 = win.requestAnimationFrame(() => {
        raf2 = null;
        startMotion();
      });
    });
  } else {
    startMotion();
  }

  return { direction: dir, skipped: false, cancel };
}

module.exports = {
  VIEW_RANKS,
  rankFor,
  direction,
  prepare,
  parkExited,
  clearSlidePose,
  run,
  randomLeadInMs,
  LEAD_IN_MIN_MS,
  LEAD_IN_MAX_MS,
};
