/**
 * Feature 15 — App Animations (ranked view slides)
 * Spec: features/feature-15-App-Animations.md
 */

const animationFlags = require('./animationFlags');

const VIEW_RANKS = {
  onboarding: 1,
  'privacy-notice': 2,
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

/**
 * Apply enter/leave classes on shell-main children (view panes).
 * @param {{
 *   container: Element,
 *   fromEl?: Element|null,
 *   toEl: Element,
 *   fromView: string,
 *   toView: string,
 *   doc?: Document,
 *   onComplete?: () => void,
 *   durationMs?: number,
 * }} opts
 */
function run(opts) {
  const doc = opts.doc || (opts.container && opts.container.ownerDocument);
  const fromRank = rankFor(opts.fromView);
  const toRank = rankFor(opts.toView);
  const dir = direction(fromRank, toRank);
  const enabled = animationFlags.isEnabled('view-slides', { doc });
  const durationMs = opts.durationMs != null ? opts.durationMs : 420;
  const win = (doc && doc.defaultView) || global;

  let finished = false;
  let timerId = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (timerId != null) {
      win.clearTimeout(timerId);
      timerId = null;
    }
    if (opts.fromEl && opts.fromEl.parentNode) {
      opts.fromEl.parentNode.removeChild(opts.fromEl);
    }
    if (opts.toEl) {
      opts.toEl.classList.remove(
        'view-slide-enter-from-below',
        'view-slide-enter-from-right',
        'view-slide-enter-active',
        'view-slide-exit-to-right',
        'view-slide-exit-to-down',
        'view-slide-exit-active'
      );
    }
    if (typeof opts.onComplete === 'function') opts.onComplete();
  };

  const cancel = () => {
    finish();
  };

  if (!enabled || dir === 'none' || !opts.toEl) {
    if (opts.fromEl && opts.fromEl.parentNode) opts.fromEl.parentNode.removeChild(opts.fromEl);
    if (typeof opts.onComplete === 'function') opts.onComplete();
    return { direction: dir, skipped: true, cancel() {} };
  }

  if (opts.fromEl) {
    opts.fromEl.classList.add(
      dir === 'ascend' ? 'view-slide-exit-to-right' : 'view-slide-exit-to-down'
    );
    opts.fromEl.classList.add('view-slide-exit-active');
  }
  opts.toEl.classList.add(
    dir === 'ascend' ? 'view-slide-enter-from-below' : 'view-slide-enter-from-right'
  );
  void opts.toEl.offsetWidth;
  opts.toEl.classList.add('view-slide-enter-active');

  timerId = win.setTimeout(finish, durationMs);
  return { direction: dir, skipped: false, cancel };
}

module.exports = {
  VIEW_RANKS,
  rankFor,
  direction,
  run,
};
