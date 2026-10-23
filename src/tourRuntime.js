/**
 * Feature 18 - Tour
 * Spec: features/feature-18-Tour.md
 */

const i18n = require('./i18n');
const tourCatalog = require('./tourCatalog');
const tourProgress = require('./tourProgress');

/** Extra px around the target so the hole isn’t flush with the control edge. */
const SPOTLIGHT_PAD = 8;
const SPOTLIGHT_FALLBACK = {
  left: 0,
  top: 0,
  width: 120,
  height: 120,
  cx: 60,
  cy: 60,
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Prefer an explicit mount root, then the active view pane, so parked/cached
 * panes are not matched (their rects sit off-screen and misplace the spotlight).
 */
function activeScope(doc, preferredRoot) {
  if (preferredRoot && typeof preferredRoot.querySelector === 'function') {
    return preferredRoot;
  }
  if (!doc || typeof doc.querySelector !== 'function') return doc;
  return (
    doc.querySelector('[data-view-pane][data-view-active="true"]') ||
    doc.querySelector('[data-view-active="true"]') ||
    doc
  );
}

function queryFirst(doc, selectorList, preferredRoot) {
  const root = activeScope(doc, preferredRoot) || doc;
  const parts = String(selectorList || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sel of parts) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (_) {
      /* ignore invalid selector */
    }
  }
  // Fallback: whole document (chrome targets like GitHub FAB live on body).
  if (root !== doc) {
    for (const sel of parts) {
      try {
        const el = doc.querySelector(sel);
        if (el) return el;
      } catch (_) {
        /* ignore */
      }
    }
  }
  return null;
}

function queryAll(doc, selectorList, preferredRoot) {
  const root = activeScope(doc, preferredRoot) || doc;
  const parts = String(selectorList || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  const collect = (scope) => {
    for (const sel of parts) {
      try {
        scope.querySelectorAll(sel).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          out.push(el);
        });
      } catch (_) {
        /* ignore invalid selector */
      }
    }
  };
  collect(root);
  if (!out.length && root !== doc) collect(doc);
  return out;
}

/** Union of getBoundingClientRect() for a list of elements. */
function unionRects(els) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let found = false;
  for (const el of els || []) {
    if (!el || typeof el.getBoundingClientRect !== 'function') continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) && !(r.height > 0)) continue;
    found = true;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!found) return null;
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Fit spotlight geometry to a target’s bounding box using the step’s stored shape.
 * @param {{ left: number, top: number, width: number, height: number } | null} rect
 * @param {'circle' | 'rect' | 'none' | string} shape
 * @param {number} [pad]
 * @returns {{ left: number, top: number, width: number, height: number, cx: number, cy: number, shape: 'circle' | 'rect' | 'none' }}
 */
function fitSpotlight(rect, shape, pad = SPOTLIGHT_PAD) {
  if (shape === 'none') {
    const cx = rect ? rect.left + rect.width / 2 : SPOTLIGHT_FALLBACK.cx;
    const cy = rect ? rect.top + rect.height / 2 : SPOTLIGHT_FALLBACK.cy;
    return {
      left: rect ? rect.left : 0,
      top: rect ? rect.top : 0,
      width: rect ? rect.width : 0,
      height: rect ? rect.height : 0,
      cx,
      cy,
      shape: 'none',
    };
  }
  const kind = shape === 'circle' ? 'circle' : 'rect';
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) {
    return { ...SPOTLIGHT_FALLBACK, shape: kind };
  }
  const p = Math.max(0, Number(pad) || 0);
  if (kind === 'circle') {
    const side = Math.max(rect.width, rect.height) + p * 2;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return {
      left: cx - side / 2,
      top: cy - side / 2,
      width: side,
      height: side,
      cx,
      cy,
      shape: 'circle',
    };
  }
  const left = rect.left - p;
  const top = rect.top - p;
  const width = rect.width + p * 2;
  const height = rect.height + p * 2;
  return {
    left,
    top,
    width,
    height,
    cx: left + width / 2,
    cy: top + height / 2,
    shape: 'rect',
  };
}

/**
 * @param {{
 *   doc: Document,
 *   win?: Window,
 *   getRoute?: () => string,
 *   navigate?: (hash: string) => void,
 *   prepareStep?: (step: object) => void,
 *   getActiveRoot?: () => Element | null,
 * }} options
 */
function createTourController(options = {}) {
  const doc = options.doc;
  const win =
    options.win ||
    (doc && doc.defaultView) ||
    (typeof window !== 'undefined' ? window : null);

  function scopeRoot() {
    if (typeof options.getActiveRoot === 'function') {
      try {
        const r = options.getActiveRoot();
        if (r && typeof r.querySelector === 'function') return r;
      } catch (_) {
        /* ignore */
      }
    }
    return null;
  }
  if (!doc || !win) {
    return {
      startFromBeginning() {},
      startForRoute() {},
      resume() {},
      onHeaderTourClick() {},
      onRouteReady() {},
      syncResumeArrow() {},
      destroy() {},
      isVisible: () => false,
    };
  }

  let visible = false;
  let stepIndex = 0;
  let overlay = null;
  let resumeArrow = null;
  let pendingShow = null;
  let navTries = 0;
  /** Hash to restore on Quit/Finish — set when the tour-compass button is pressed. */
  let returnHash = '#/';

  function navigate(hash) {
    if (typeof options.navigate === 'function') options.navigate(hash);
    else win.location.hash = hash;
  }

  function normalizeReturnHash(raw) {
    const h = String(raw == null ? '' : raw).trim();
    if (!h || h === '#' || h === '#/') return '#/';
    return h.startsWith('#') ? h : `#${h}`;
  }

  /** Remember the page the user launched the tour from (compass button). */
  function rememberReturnHash() {
    try {
      returnHash = normalizeReturnHash(win.location && win.location.hash);
    } catch (_) {
      returnHash = '#/';
    }
  }

  function ensureOverlay() {
    if (overlay && overlay.isConnected) return overlay;
    overlay = doc.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.setAttribute('data-tour-overlay', '');
    overlay.innerHTML = `
      <div class="tour-scrim" data-tour-scrim aria-hidden="true"></div>
      <div class="tour-spotlight" data-tour-spotlight aria-hidden="true"></div>
      <div class="tour-card" data-tour-card role="dialog" aria-modal="true">
        <p class="tour-card-title" data-tour-title></p>
        <p class="tour-card-body" data-tour-body></p>
        <div class="tour-card-arrow" data-tour-card-arrow aria-hidden="true"></div>
        <div class="tour-card-actions">
          <button type="button" class="ghost tour-nav-btn" data-tour-prev aria-label="${escapeHtml(
            i18n.t('tour.prev'),
          )}">←</button>
          <button type="button" class="primary outline tour-quit-btn" data-tour-quit>${escapeHtml(
            i18n.t('tour.quit'),
          )}</button>
          <button type="button" class="ghost tour-nav-btn" data-tour-next aria-label="${escapeHtml(
            i18n.t('tour.next'),
          )}">-></button>
        </div>
      </div>
    `;
    overlay.hidden = true;
    doc.body.appendChild(overlay);

    overlay
      .querySelector('[data-tour-prev]')
      .addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        prev();
      });
    overlay
      .querySelector('[data-tour-next]')
      .addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        next();
      });
    overlay
      .querySelector('[data-tour-quit]')
      .addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        quit();
      });
    const scrim = overlay.querySelector('[data-tour-scrim]');
    scrim.addEventListener('click', (ev) => {
      ev.preventDefault();
      hideAndStore();
    });
    overlay
      .querySelector('[data-tour-card]')
      .addEventListener('click', (ev) => {
        ev.stopPropagation();
      });
    return overlay;
  }

  function ensureResumeArrow() {
    if (resumeArrow && resumeArrow.isConnected) return resumeArrow;
    resumeArrow = doc.createElement('div');
    resumeArrow.className = 'tour-resume-arrow';
    resumeArrow.setAttribute('data-tour-resume-arrow', '');
    resumeArrow.setAttribute('aria-hidden', 'true');
    resumeArrow.innerHTML = `<span class="tour-resume-arrow-glyph">↑</span>`;
    resumeArrow.hidden = true;
    doc.body.appendChild(resumeArrow);
    return resumeArrow;
  }

  function syncResumeArrow() {
    const show = tourProgress.hasStoredStep() && !visible;
    const arrow = ensureResumeArrow();
    arrow.hidden = !show;
    if (!show) return;
    const btn = doc.querySelector('[data-tour-guide-btn]');
    if (!btn) {
      arrow.hidden = true;
      return;
    }
    const r = btn.getBoundingClientRect();
    // Anchor at button center-x; CSS translateX(-50%) keeps the glyph centered.
    arrow.style.left = `${Math.round(r.left + r.width / 2)}px`;
    arrow.style.top = `${Math.round(r.bottom + 4)}px`;
  }

  function hideOverlayDom() {
    if (overlay) overlay.hidden = true;
    visible = false;
  }

  function showOverlayDom() {
    ensureOverlay().hidden = false;
    visible = true;
    if (resumeArrow) resumeArrow.hidden = true;
  }

  function positionForTarget(rawRect, step) {
    const ov = ensureOverlay();
    const scrim = ov.querySelector('[data-tour-scrim]');
    const spot = ov.querySelector('[data-tour-spotlight]');
    const card = ov.querySelector('[data-tour-card]');
    const tip = ov.querySelector('[data-tour-card-arrow]');

    const winW = win.innerWidth || doc.documentElement.clientWidth || 800;
    const winH = win.innerHeight || doc.documentElement.clientHeight || 600;

    const shape = (step && step.spotlight) || 'rect';
    const geom = fitSpotlight(rawRect, shape);

    spot.setAttribute('data-spotlight-shape', geom.shape);
    if (geom.shape === 'none') {
      scrim.classList.add('is-full-dim');
      spot.hidden = true;
    } else {
      scrim.classList.remove('is-full-dim');
      spot.hidden = false;
      spot.style.left = `${Math.round(geom.left)}px`;
      spot.style.top = `${Math.round(geom.top)}px`;
      spot.style.width = `${Math.round(geom.width)}px`;
      spot.style.height = `${Math.round(geom.height)}px`;
    }

    const cardW = Math.min(300, winW - 24);
    let cardLeft;
    let cardTop = geom.cy - 60;
    let arrowSide = 'left';
    if (shape === 'none') {
      // Place card beside the anchor region without claiming a hole.
      tip.hidden = true;
    } else {
      tip.hidden = false;
    }
    // Prefer docking beside the target (pic 2). Never fall back to below-target
    // placement for wide config sections - that left the card on Advanced.
    const rightOfTarget = geom.left + geom.width + 16;
    if (rightOfTarget + cardW <= winW - 12) {
      cardLeft = rightOfTarget;
      arrowSide = 'left';
    } else if (geom.left - cardW - 16 >= 12) {
      cardLeft = geom.left - cardW - 16;
      arrowSide = 'right';
    } else {
      cardLeft = winW - cardW - 12;
      arrowSide = 'left';
      if (cardLeft < geom.left + 8 && geom.left > cardW + 24) {
        cardLeft = 12;
        arrowSide = 'right';
      }
    }
    cardTop = Math.max(12, Math.min(cardTop, winH - 200));
    card.style.width = `${cardW}px`;
    card.style.left = `${Math.round(cardLeft)}px`;
    card.style.top = `${Math.round(cardTop)}px`;
    tip.setAttribute('data-arrow-side', arrowSide);
    // Aim the tip at the spotlight center (not a fixed offset on the card).
    tip.style.top = '';
    tip.style.left = '';
    tip.style.right = '';
    tip.style.bottom = '';
    tip.style.transform = '';
    if (!tip.hidden && (arrowSide === 'left' || arrowSide === 'right')) {
      const cardH = card.offsetHeight || 160;
      let tipY = geom.cy - cardTop;
      tipY = Math.max(18, Math.min(cardH - 18, tipY));
      tip.style.top = `${Math.round(tipY)}px`;
      tip.style.transform = 'translateY(-50%)';
    } else if (!tip.hidden && arrowSide === 'top') {
      let tipX = geom.cx - cardLeft;
      tipX = Math.max(18, Math.min(cardW - 18, tipX));
      tip.style.left = `${Math.round(tipX)}px`;
      tip.style.transform = 'translateX(-50%)';
    }
  }

  function fillCard(step) {
    const ov = ensureOverlay();
    const titleEl = ov.querySelector('[data-tour-title]');
    const bodyEl = ov.querySelector('[data-tour-body]');
    const prevBtn = ov.querySelector('[data-tour-prev]');
    const nextBtn = ov.querySelector('[data-tour-next]');
    const quitBtn = ov.querySelector('[data-tour-quit]');
    const steps = tourCatalog.listSteps();
    const isFirst = stepIndex <= 0;
    const isLast = stepIndex >= steps.length - 1;
    const title = step.titleKey ? i18n.t(step.titleKey) : '';
    titleEl.textContent = title;
    titleEl.hidden = !title;
    bodyEl.textContent = i18n.t(step.bodyKey);
    prevBtn.hidden = isFirst;
    prevBtn.disabled = isFirst;
    nextBtn.hidden = isLast;
    nextBtn.disabled = isLast;
    nextBtn.setAttribute('aria-label', i18n.t('tour.next'));
    prevBtn.setAttribute('aria-label', i18n.t('tour.prev'));
    quitBtn.textContent = isLast ? i18n.t('tour.finish') : i18n.t('tour.quit');
  }

  function resolveTarget(step) {
    if (!step || !step.target) return null;
    const preferred = scopeRoot();
    if (step.targetUnion) {
      const els = queryAll(doc, step.target, preferred);
      if (els.length) return els[0];
      if (step.fallbackTarget)
        return queryFirst(doc, step.fallbackTarget, preferred);
      return null;
    }
    let el = queryFirst(doc, step.target, preferred);
    if (!el && step.fallbackTarget)
      el = queryFirst(doc, step.fallbackTarget, preferred);
    return el;
  }

  function resolveTargetRect(step) {
    if (!step || !step.target) return null;
    const preferred = scopeRoot();
    if (step.targetUnion) {
      const els = queryAll(doc, step.target, preferred);
      const union = unionRects(els);
      if (union) return union;
      if (step.fallbackTarget) {
        const fb = queryFirst(doc, step.fallbackTarget, preferred);
        return fb ? fb.getBoundingClientRect() : null;
      }
      return null;
    }
    const el = resolveTarget(step);
    return el ? el.getBoundingClientRect() : null;
  }

  function runPrepare(step) {
    if (step && typeof options.prepareStep === 'function') {
      try {
        options.prepareStep(step);
      } catch (_) {
        /* ignore prepare failures */
      }
    }
  }

  /**
   * Scroll the nearest overflow scroller so the target sits near the top/middle.
   * Avoids window/document scrollIntoView, which mis-aims Config spotlights.
   */
  function scrollTargetsIntoView(step) {
    if (!step || !step.target || step.spotlight === 'none') return;
    // Config prepare already scrolled via revealSection - only fallback here.
    if (step.prepare && step.prepare.configSection) return;
    const el = resolveTarget(step);
    if (!el) return;
    let scroller = el.parentElement;
    while (scroller && scroller !== doc.body) {
      const style = win.getComputedStyle
        ? win.getComputedStyle(scroller)
        : null;
      const oy = style ? style.overflowY : '';
      if (
        (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
        scroller.scrollHeight > scroller.clientHeight + 1
      ) {
        break;
      }
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === doc.body) return;
    try {
      const sRect = scroller.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const delta = eRect.top - sRect.top + scroller.scrollTop;
      const maxScroll = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight,
      );
      const desired = delta - 12;
      // Instant - never measure mid smooth-scroll animation.
      const prevBehavior = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = 'auto';
      scroller.scrollTop = Math.max(0, Math.min(maxScroll, desired));
      scroller.style.scrollBehavior = prevBehavior;
    } catch (_) {
      /* ignore */
    }
  }

  let paintGen = 0;

  function clearPaintTimer() {
    if (pendingShow && pendingShow !== 'nav') {
      try {
        win.clearTimeout(pendingShow);
      } catch (_) {
        /* ignore */
      }
    }
    if (pendingShow !== 'nav') pendingShow = null;
  }

  /**
   * Scroll first (overlay hidden), wait for layout, re-scroll, then measure + draw.
   * Cancels any prior scheduled paint so a stale step cannot draw after Next.
   */
  function schedulePaintAfterScroll(step) {
    const gen = ++paintGen;
    clearPaintTimer();
    const finish = () => {
      if (gen !== paintGen || pendingShow === 'nav') return;
      pendingShow = null;
      // Re-assert scroll immediately before measuring (Config sections).
      if (step && step.prepare && step.prepare.configSection) {
        runPrepare(step);
      }
      paintCurrent();
    };
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(() => {
        win.requestAnimationFrame(() => {
          if (gen !== paintGen) return;
          pendingShow = win.setTimeout(finish, 32);
        });
      });
    } else {
      pendingShow = win.setTimeout(finish, 64);
    }
  }

  function paintCurrent() {
    const steps = tourCatalog.listSteps();
    const step = steps[stepIndex];
    if (!step) {
      quit();
      return;
    }
    fillCard(step);
    const rect = resolveTargetRect(step);
    showOverlayDom();
    positionForTarget(rect, step);
    syncResumeArrow();
  }

  function stepReady(step) {
    if (step.spotlight === 'none') {
      // Prefer an anchor for card placement; don't block the step forever.
      return Boolean(resolveTarget(step)) || navTries >= 4;
    }
    return Boolean(resolveTarget(step));
  }

  function prepareAndShow(step) {
    // 1) Hide previous spotlight/card  2) scroll  3) wait  4) draw
    hideOverlayDom();
    runPrepare(step);
    scrollTargetsIntoView(step);
    if (stepReady(step) || navTries >= 8) {
      schedulePaintAfterScroll(step);
      return true;
    }
    return false;
  }

  function goToIndex(index) {
    const steps = tourCatalog.listSteps();
    if (!steps.length) return;
    clearPaintTimer();
    paintGen += 1;
    stepIndex = Math.max(0, Math.min(index, steps.length - 1));
    const step = steps[stepIndex];
    navTries = 0;
    const desired = step.hash || '#/';
    const cur = win.location.hash || '#/';
    const same =
      String(desired).replace(/^#/, '') === String(cur).replace(/^#/, '') ||
      (desired === '#/' && (cur === '#' || cur === '' || cur === '#/'));

    const tryShow = () => {
      if (prepareAndShow(step)) return;
      navTries += 1;
      pendingShow = win.setTimeout(tryShow, 50);
    };

    if (!same) {
      pendingShow = 'nav';
      hideOverlayDom();
      navigate(desired);
      // onRouteReady will call tryShow; also schedule fallback
      win.setTimeout(() => {
        if (pendingShow === 'nav') tryShow();
      }, 80);
    } else {
      tryShow();
    }
  }

  function startAtStepId(stepId) {
    const idx = tourCatalog.indexOfStepId(stepId);
    goToIndex(idx >= 0 ? idx : 0);
  }

  function startFromBeginning() {
    tourProgress.clearStoredStep();
    goToIndex(0);
  }

  function startForRoute(route) {
    if (tourProgress.hasStoredStep()) {
      resume();
      return;
    }
    const step = tourCatalog.firstStepForRoute(route);
    startAtStepId(step ? step.id : tourCatalog.listSteps()[0].id);
  }

  function resume() {
    const { storedStepId } = tourProgress.read();
    if (storedStepId) startAtStepId(storedStepId);
    else startFromBeginning();
  }

  function onHeaderTourClick() {
    rememberReturnHash();
    if (tourProgress.hasStoredStep()) resume();
    else {
      const route =
        typeof options.getRoute === 'function' ? options.getRoute() : 'landing';
      startForRoute(route);
    }
  }

  function prev() {
    if (stepIndex <= 0) return;
    goToIndex(stepIndex - 1);
  }

  function next() {
    const steps = tourCatalog.listSteps();
    if (stepIndex >= steps.length - 1) {
      quit();
      return;
    }
    goToIndex(stepIndex + 1);
  }

  function quit() {
    if (pendingShow && pendingShow !== 'nav') win.clearTimeout(pendingShow);
    pendingShow = null;
    tourProgress.markCompleted();
    hideOverlayDom();
    syncResumeArrow();
    navigate(normalizeReturnHash(returnHash));
  }

  function hideAndStore() {
    const steps = tourCatalog.listSteps();
    const step = steps[stepIndex];
    if (step) tourProgress.storeStep(step.id);
    hideOverlayDom();
    syncResumeArrow();
  }

  function onRouteReady() {
    if (pendingShow === 'nav') {
      const steps = tourCatalog.listSteps();
      const step = steps[stepIndex];
      if (!step) return;
      navTries = 0;
      const tryShow = () => {
        if (prepareAndShow(step)) return;
        navTries += 1;
        pendingShow = win.setTimeout(tryShow, 50);
      };
      tryShow();
    } else if (visible) {
      // Resize/re-render: remeasure only (keep scroll).
      paintCurrent();
    } else {
      syncResumeArrow();
    }
  }

  function destroy() {
    if (pendingShow && pendingShow !== 'nav') win.clearTimeout(pendingShow);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (resumeArrow && resumeArrow.parentNode)
      resumeArrow.parentNode.removeChild(resumeArrow);
    overlay = null;
    resumeArrow = null;
    visible = false;
  }

  // Keep spotlight aligned on resize
  win.addEventListener('resize', () => {
    if (visible) paintCurrent();
    else syncResumeArrow();
  });

  syncResumeArrow();

  return {
    startFromBeginning,
    startForRoute,
    resume,
    onHeaderTourClick,
    onRouteReady,
    syncResumeArrow,
    destroy,
    isVisible: () => visible,
    /** test helpers */
    _goToIndex: goToIndex,
    _getStepIndex: () => stepIndex,
    _hideAndStore: hideAndStore,
    _quit: quit,
  };
}

module.exports = {
  createTourController,
  fitSpotlight,
  unionRects,
  SPOTLIGHT_PAD,
  queryFirst,
  queryAll,
};
