/**
 * Shared exercise description (notes) help control.
 * Notes come from `{...}` on format.txt / ranks.txt leaves (Feature 1 FR-005).
 *
 * Tooltip flip: when a tip would overflow its clip parent / viewport on the
 * right, it opens left-aligned (`is-flipped`) so text stays readable.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeDescription(notes) {
  if (notes == null) return null;
  const text = String(notes).trim();
  if (!text) return null;
  // Ignore format.txt placeholder tokens like {(description)} / {description}
  if (/^\(?description\)?$/i.test(text)) return null;
  try {
    const placeholder = require('./i18n').t('format.placeholder');
    if (
      placeholder &&
      new RegExp(
        `^\\(?${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)?$`,
        'i',
      ).test(text)
    ) {
      return null;
    }
  } catch (_) {
    /* i18n optional during early load */
  }
  return text;
}

function hasDescription(notes) {
  return normalizeDescription(notes) != null;
}

/**
 * Resolve description for an exercise id from the active catalog.
 */
function descriptionForExercise(exerciseId, catalogMod) {
  if (!exerciseId || !catalogMod) return null;
  const ex =
    typeof catalogMod.getActiveExercise === 'function'
      ? catalogMod.getActiveExercise(exerciseId)
      : typeof catalogMod.getExerciseById === 'function'
        ? catalogMod.getExerciseById(exerciseId)
        : null;
  return normalizeDescription(ex && ex.notes);
}

/**
 * Circled-? control; description appears on hover (and keyboard focus).
 * Returns empty string when there is no description.
 */
function renderExerciseHelp(notes, options = {}) {
  const text = normalizeDescription(notes);
  if (!text) return '';
  const tipId = options.id
    ? `exercise-help-${escapeHtml(String(options.id))}`
    : `exercise-help-${Math.random().toString(36).slice(2, 9)}`;
  const aria =
    options.ariaLabel != null && String(options.ariaLabel).trim()
      ? String(options.ariaLabel)
      : require('./i18n').t('exercise.helpAria');
  return `<span class="exercise-help" data-exercise-help>
    <button type="button" class="exercise-help-btn" aria-label="${escapeHtml(aria)}" aria-describedby="${tipId}">?</button>
    <span class="exercise-help-tip" role="tooltip" id="${tipId}" data-exercise-help-tip>${escapeHtml(text)}</span>
  </span>`;
}

function isScrollContainer(el) {
  if (!el || el.nodeType !== 1) return false;
  let style;
  try {
    style = el.ownerDocument.defaultView.getComputedStyle(el);
  } catch (_) {
    return false;
  }
  const ox = style.overflowX || style.overflow;
  const oy = style.overflowY || style.overflow;
  return /(auto|scroll|hidden)/.test(ox) || /(auto|scroll|hidden)/.test(oy);
}

/**
 * Nearest ancestor that clips overflow (panel scroller, card, etc.).
 */
function getClipParent(el) {
  let node = el && el.parentElement;
  const doc = el && el.ownerDocument;
  while (node && node !== doc.body && node !== doc.documentElement) {
    if (isScrollContainer(node)) return node;
    node = node.parentElement;
  }
  return doc.documentElement;
}

function clipBounds(clipEl, win) {
  if (!clipEl || clipEl === clipEl.ownerDocument.documentElement) {
    return {
      left: 0,
      right: win.innerWidth || clipEl.clientWidth,
      top: 0,
      bottom: win.innerHeight || clipEl.clientHeight,
    };
  }
  const r = clipEl.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}

/**
 * Position one tip: default below-right; flip to below-left if it would
 * overflow the clip parent or viewport on the right.
 */
function positionExerciseHelpTip(btn) {
  if (!btn) return;
  const wrap = btn.closest('[data-exercise-help]');
  const tip = wrap && wrap.querySelector('[data-exercise-help-tip]');
  if (!wrap || !tip) return;

  const win = btn.ownerDocument.defaultView || window;
  tip.classList.remove('is-flipped');
  tip.style.maxWidth = '';
  tip.style.minWidth = '';
  tip.style.width = '';

  // Tip must be measurable; CSS hover/focus already sets display, but force
  // open class for cases where we measure slightly before paint.
  tip.classList.add('is-measuring');

  /** Shrink tip so it fits between clip.left and tip’s right edge (flipped). */
  function thinToFitLeft(clip, pad) {
    void tip.offsetWidth; // reflow after flip / prior width change
    let rect = tip.getBoundingClientRect();
    if (rect.left >= clip.left + pad) return;
    // Available width from clip left edge to the tip’s right anchor
    const available = Math.max(72, Math.floor(rect.right - (clip.left + pad)));
    // Override stylesheet min-width: 10rem so the box can actually get thinner
    tip.style.minWidth = '0px';
    tip.style.maxWidth = `${available}px`;
    tip.style.width = `${available}px`;
    void tip.offsetWidth;
    rect = tip.getBoundingClientRect();
    // Still overflowing (padding/border) - tighten once more
    if (rect.left < clip.left + pad) {
      const tighter = Math.max(72, Math.floor(rect.right - (clip.left + pad)));
      tip.style.maxWidth = `${tighter}px`;
      tip.style.width = `${tighter}px`;
    }
  }

  const measure = () => {
    tip.classList.remove('is-measuring');
    const tipRect = tip.getBoundingClientRect();
    // Hidden / zero-size (not yet shown) - nothing to do
    if (!tipRect.width || !tipRect.height) return;

    const clip = clipBounds(getClipParent(wrap), win);
    const pad = 6;
    const overflowsRight = tipRect.right > clip.right - pad;
    if (overflowsRight) {
      tip.classList.add('is-flipped');
      // Flipped tip grows leftward; if it past the left clip edge, thin it.
      thinToFitLeft(clip, pad);
    }
  };

  if (typeof win.requestAnimationFrame === 'function') {
    win.requestAnimationFrame(() => win.requestAnimationFrame(measure));
  } else {
    measure();
  }
}

function clearExerciseHelpTip(btn) {
  const wrap = btn && btn.closest('[data-exercise-help]');
  const tip = wrap && wrap.querySelector('[data-exercise-help-tip]');
  if (!tip) return;
  tip.classList.remove('is-flipped', 'is-measuring');
  tip.style.maxWidth = '';
  tip.style.minWidth = '';
  tip.style.width = '';
}

/**
 * Install a document-level handler so every view’s exercise-help tips flip
 * when they would overflow. Safe to call more than once (idempotent per root).
 *
 * @param {Document|ParentNode} [root=document]
 * @returns {() => void} uninstall
 */
function installExerciseHelpTooltips(root) {
  const target = root || (typeof document !== 'undefined' ? document : null);
  if (!target || typeof target.addEventListener !== 'function') {
    return () => {};
  }
  if (target.__exerciseHelpTipsInstalled) {
    return target.__exerciseHelpTipsUninstall || (() => {});
  }

  const onPointerOver = (ev) => {
    const btn =
      ev.target && ev.target.closest && ev.target.closest('.exercise-help-btn');
    if (!btn) return;
    const related = ev.relatedTarget;
    if (related && btn.contains(related)) return;
    positionExerciseHelpTip(btn);
  };

  const onFocusIn = (ev) => {
    const btn =
      ev.target && ev.target.closest && ev.target.closest('.exercise-help-btn');
    if (!btn) return;
    positionExerciseHelpTip(btn);
  };

  const onPointerOut = (ev) => {
    const btn =
      ev.target && ev.target.closest && ev.target.closest('.exercise-help-btn');
    if (!btn) return;
    const related = ev.relatedTarget;
    if (related && btn.contains(related)) return;
    // Keep flip while tip is visible under hover CSS; clear after leave
    clearExerciseHelpTip(btn);
  };

  const onFocusOut = (ev) => {
    const btn =
      ev.target && ev.target.closest && ev.target.closest('.exercise-help-btn');
    if (!btn) return;
    clearExerciseHelpTip(btn);
  };

  const onResize = () => {
    const doc = target.ownerDocument || target;
    const active =
      doc.querySelector &&
      doc.querySelector(
        '.exercise-help-btn:hover, .exercise-help-btn:focus-visible',
      );
    if (active) positionExerciseHelpTip(active);
  };

  const win =
    target.defaultView ||
    (target.ownerDocument && target.ownerDocument.defaultView) ||
    (typeof window !== 'undefined' ? window : null);

  target.addEventListener('pointerover', onPointerOver, true);
  target.addEventListener('pointerout', onPointerOut, true);
  target.addEventListener('focusin', onFocusIn, true);
  target.addEventListener('focusout', onFocusOut, true);
  if (win) win.addEventListener('resize', onResize);

  const uninstall = () => {
    target.removeEventListener('pointerover', onPointerOver, true);
    target.removeEventListener('pointerout', onPointerOut, true);
    target.removeEventListener('focusin', onFocusIn, true);
    target.removeEventListener('focusout', onFocusOut, true);
    if (win) win.removeEventListener('resize', onResize);
    target.__exerciseHelpTipsInstalled = false;
    target.__exerciseHelpTipsUninstall = null;
  };

  target.__exerciseHelpTipsInstalled = true;
  target.__exerciseHelpTipsUninstall = uninstall;
  return uninstall;
}

module.exports = {
  escapeHtml,
  normalizeDescription,
  hasDescription,
  descriptionForExercise,
  renderExerciseHelp,
  positionExerciseHelpTip,
  clearExerciseHelpTip,
  installExerciseHelpTooltips,
  getClipParent,
};
