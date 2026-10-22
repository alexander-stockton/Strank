/**
 * Feature 1 - App Foundation
 * Feature 2 - Daily Exercise Log
 * Feature 3 - Exercise History
 * Feature 4 - Weekly Ranking
 * Feature 5 - Dynamic Exercise Catalog
 * Feature 7 - Landing Page
 *
 * NW.js shell UI - no login.
 *
 * IMPORTANT: Do not auto-boot on require(). NW.js loads required modules in the
 * Node context (no window #app). index.html must call boot(window) with the
 * real DOM window.
 *
 * Shell architecture: header + navbar are created once and reused across route
 * changes. Only #shell-main (and nav active state / header badges) update.
 */

const windowState = require('./windowState.js');

function boot(domWindow) {
  if (!domWindow || !domWindow.document) {
    windowState.debugLog('ui boot aborted: no domWindow');
    throw new Error('boot(window) requires the browser window');
  }

  const win = domWindow;
  const doc = win.document;

  windowState.debugLog('ui boot start', {
    hasNw: typeof nw !== 'undefined',
    screenX: win.screenX,
    outerWidth: win.outerWidth,
    readyState: doc.readyState,
    statePath: windowState.resolveStatePath(),
  });

  let app;
  let todayView;
  let historyCalendarView;
  let rankView;
  let ranksGalleryView;
  let landingView;
  let activeWorkoutView;
  let configView;
  let rankEditorView;
  let rankManagerView;
  let rankFormView;
  let workout;
  let config;
  let appShell;
  let rankBadge;
  let exerciseHelp;
  let onboarding;
  let onboardingView;
  let workoutStartTransition;
  let clickRipple;
  let controlMotion;
  let contentReveal;
  let viewTransitions;
  let navbarUtilities;
  let contributingView;
  let githubFab;
  let fontScaleHotkeys;
  let tourRuntime;
  let i18n;
  let paths;
  let setupInstall;
  let setupInstallView;
  try {
    i18n = require('./i18n.js');
    paths = require('./paths.js');
    setupInstall = require('./setupInstall.js');
    setupInstallView = require('./setupInstallView.js');
    app = require('./app.js');
    todayView = require('./todayView.js');
    historyCalendarView = require('./historyCalendarView.js');
    rankView = require('./rankView.js');
    ranksGalleryView = require('./ranksGalleryView.js');
    landingView = require('./landingView.js');
    activeWorkoutView = require('./activeWorkoutView.js');
    configView = require('./configView.js');
    rankEditorView = require('./rankEditorView.js');
    rankManagerView = require('./rankManagerView.js');
    rankFormView = require('./rankFormView.js');
    workout = require('./workout.js');
    config = require('./config.js');
    appShell = require('./appShell.js');
    rankBadge = require('./rankBadge.js');
    exerciseHelp = require('./exerciseHelp.js');
    onboarding = require('./onboarding.js');
    onboardingView = require('./onboardingView.js');
    contributingView = require('./contributingView.js');
    githubFab = require('./githubFab.js');
    fontScaleHotkeys = require('./fontScaleHotkeys.js');
    workoutStartTransition = require('./workoutStartTransition.js');
    clickRipple = require('./clickRipple.js');
    controlMotion = require('./controlMotion.js');
    contentReveal = require('./contentReveal.js');
    viewTransitions = require('./viewTransitions.js');
    navbarUtilities = require('./navbarUtilities.js');
    tourRuntime = require('./tourRuntime.js');
  } catch (err) {
    windowState.debugLog('ui app require failed', { message: err && err.message, stack: err && err.stack });
    throw err;
  }

  // Shared across all views: flip exercise-help tips that would overflow right
  if (exerciseHelp && typeof exerciseHelp.installExerciseHelpTooltips === 'function') {
    exerciseHelp.installExerciseHelpTooltips(doc);
  }

  const root = doc.getElementById('app');
  let activeMount = null;
  /** Session date when entering /workout from Get Started */
  let workoutLocalDate = null;
  /** Persistent shell root (header + nav + main); null when showing fatal/error views */
  let shellEl = null;
  let shellAlignment = null;
  /** Language the persistent header + navbar were last labeled in */
  let shellLanguage = null;
  /** Feature 15 - last ranked view id for slide direction */
  let lastViewId = null;
  let clickRippleHandle = null;
  let controlMotionHandle = null;
  let startTransitionHandle = null;
  let slideTransitionHandle = null;
  /** Timeout id for pre-slide lead-in (loading cursor → animation). */
  let slideLeadInTimer = null;
  /** Epoch ms when the next slide is allowed to start (set on nav / hashchange). */
  let slideLeadInDeadline = null;
  /** Outgoing mount/pane waiting for lead-in → slide (nav interrupt clears without destroy). */
  let pendingSlideOutgoing = null;
  /**
   * Most-recent previous view kept rendered off-screen.
   * Returning here skips the lead-in delay.
   * @type {null | { viewId: string, pane: Element, mount: object|null }}
   */
  let previousViewCache = null;
  /** Unbind Day Focus / Edit Ranks / Privacy / Contributing on the persistent navbar */
  let navbarUtilitiesUnbind = null;
  /** Hash to restore when leaving the standalone Privacy notice */
  let privacyReturnHash = '#/';
  /** Hash to restore when leaving the standalone Contributing notice */
  let contributingReturnHash = '#/';
  /** Feature 17 - persistent GitHub FAB handle */
  let githubFabHandle = null;
  /** Ctrl+/- font-size hotkeys */
  let fontScaleHotkeysHandle = null;
  /** Feature 18 - guided tour controller */
  let tourController = null;

  if (clickRipple && typeof clickRipple.attach === 'function') {
    clickRippleHandle = clickRipple.attach(doc);
  }
  if (controlMotion && typeof controlMotion.attach === 'function') {
    controlMotionHandle = controlMotion.attach(doc.documentElement);
  }

  if (!root) {
    windowState.debugLog('ui boot aborted: #app missing', {
      readyState: doc.readyState,
      bodyChildren: doc.body ? doc.body.children.length : -1,
    });
    throw new Error('Missing #app element in window document');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showFatal(err) {
    tearDownShell();
    root.innerHTML = `
      <section class="error-view" data-view="uiCrash">
        <h1>${escapeHtml(i18n.t('shell.uiFailed'))}</h1>
        <p class="message">${escapeHtml((err && err.message) || String(err))}</p>
        <pre style="white-space:pre-wrap;font-size:12px;opacity:0.85">${escapeHtml(
          (err && err.stack) || ''
        )}</pre>
      </section>`;
  }

  function getNwApi() {
    if (typeof nw !== 'undefined' && nw && nw.Window) return nw;
    if (typeof global !== 'undefined' && global.nw && global.nw.Window) return global.nw;
    if (win.nw && win.nw.Window) return win.nw;
    return null;
  }

  function setupWindowLifecycle() {
    const nwApi = getNwApi();
    if (!nwApi) {
      windowState.debugLog('ui: nw API unavailable');
      console.warn('[ui] nw API unavailable - window state will not persist');
      return;
    }

    let nwWin;
    try {
      nwWin = nwApi.Window.get();
    } catch (err) {
      windowState.debugLog('ui: Window.get failed', { message: err && err.message });
      console.warn('[ui] nw.Window.get failed:', err && err.message);
      return;
    }

    windowState.attachLifecycle(nwWin, { domWindow: win, quit: true });

    // Immediate attempt; attachLifecycle also re-applies after geometry restore.
    try {
      windowState.applyFullscreenPreference(nwWin, Boolean(config.get().fullscreen));
    } catch (_) {
      /* ignore */
    }

    const saveNow = () => {
      windowState.debugLog('ui page save');
      windowState.saveFromWindow(nwWin, win);
    };
    win.addEventListener('beforeunload', saveNow);
    win.addEventListener('pagehide', saveNow);
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'hidden') saveNow();
    });
  }

  function normalizeHash(hash) {
    let h = String(hash == null ? '' : hash).trim();
    if (!h) return '#/';
    if (h.charAt(0) !== '#') h = `#${h}`;
    if (h === '#') return '#/';
    return h;
  }

  function routeFromHash(hash) {
    const raw = normalizeHash(hash).replace(/^#/, '');
    if (raw === '/history' || raw === 'history') return 'history';
    if (raw === '/rank' || raw === 'rank' || raw === '/rankDebug' || raw === 'rankDebug') return 'rank';
    if (raw === '/ranks' || raw === 'ranks') return 'ranks';
    if (raw === '/config' || raw === 'config') return 'config';
    if (raw === '/rank-manager' || raw === 'rank-manager') return 'rank-manager';
    if (raw === '/rank-create' || raw === 'rank-create') return 'rank-create';
    if (raw.startsWith('/rank-edit/') || raw.startsWith('rank-edit/')) return 'rank-edit';
    if (raw === '/rank-editor' || raw === 'rank-editor') return 'rank-editor';
    if (raw === '/workout' || raw === 'workout') return 'workout';
    if (raw === '/today' || raw === 'today') return 'today';
    if (raw === '/setup' || raw === 'setup') return 'setup';
    if (raw === '/onboarding' || raw === 'onboarding') return 'onboarding';
    if (raw === '/privacy' || raw === 'privacy') return 'privacy';
    if (raw === '/contributing' || raw === 'contributing') return 'contributing';
    if (raw === '' || raw === '/' || raw === '/landing' || raw === 'landing') return 'landing';
    return 'landing';
  }

  function currentRoute() {
    return routeFromHash(win.location.hash);
  }

  /**
   * Show loading cursor immediately on nav intent. Arms lead-in delay unless
   * the destination is the one-deep previous-view cache.
   */
  function beginNavLoading(targetHash) {
    const next = normalizeHash(targetHash);
    const cur = normalizeHash(win.location.hash);
    if (next === cur) return false;
    const toView = viewIdForRoute(routeFromHash(next));
    const returning =
      previousViewCache && previousViewCache.viewId === toView && lastViewId && lastViewId !== toView;
    setSlideLoadingCursor(true);
    if (returning) {
      // Instant reverse: keep cursor, skip random lead-in.
      slideLeadInDeadline = null;
    } else if (slideLeadInDeadline == null) {
      armSlideLeadIn();
    }
    return true;
  }

  /** Capture hash-link presses before the route changes (feels instant). */
  function installNavLoadingPointerHook() {
    const onPointerDown = (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      const t = ev.target;
      if (!t || typeof t.closest !== 'function') return;
      const a = t.closest('a[href^="#"]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (href == null) return;
      beginNavLoading(href);
    };
    doc.addEventListener('pointerdown', onPointerDown, true);
    return () => doc.removeEventListener('pointerdown', onPointerDown, true);
  }

  /** Catch programmatic `location.hash = ...` the same tick as the click handler. */
  function installNavLoadingHashHook() {
    try {
      const proto = win.Location && win.Location.prototype;
      if (!proto) return () => {};
      const desc = Object.getOwnPropertyDescriptor(proto, 'hash');
      if (!desc || typeof desc.set !== 'function' || typeof desc.get !== 'function') {
        return () => {};
      }
      const origSet = desc.set;
      const origGet = desc.get;
      Object.defineProperty(proto, 'hash', {
        configurable: true,
        enumerable: desc.enumerable,
        get() {
          return origGet.call(this);
        },
        set(value) {
          beginNavLoading(value);
          return origSet.call(this, value);
        },
      });
      return () => {
        try {
          Object.defineProperty(proto, 'hash', desc);
        } catch (_) {
          /* ignore */
        }
      };
    } catch (_) {
      return () => {};
    }
  }

  /** Map router id -> Feature 15 view rank id (FR-024). */
  function viewIdForRoute(route) {
    if (route === 'history') return 'history-month';
    if (route === 'today') return 'landing';
    if (route === 'rank') return 'ranks';
    if (route === 'privacy') return 'privacy-notice';
    if (route === 'contributing') return 'contributing-notice';
    if (route === 'setup') return 'setup-install';
    return route;
  }

  function createViewPane(viewId) {
    const pane = doc.createElement('div');
    pane.className = 'view-slide-pane';
    pane.setAttribute('data-view-pane', '');
    if (viewId) pane.setAttribute('data-view-id', String(viewId));
    return pane;
  }

  function setSlideLoadingCursor(on) {
    if (!doc.documentElement) return;
    doc.documentElement.classList.toggle('is-view-slide-loading', !!on);
  }

  function clearSlideLeadIn() {
    if (slideLeadInTimer != null) {
      win.clearTimeout(slideLeadInTimer);
      slideLeadInTimer = null;
    }
    slideLeadInDeadline = null;
    setSlideLoadingCursor(false);
    // Do not destroy pending outgoing — it is still the live page until a slide finishes.
    pendingSlideOutgoing = null;
  }

  /** Mark nav start: wait cursor + random 0.05–0.5s before slide motion. */
  function armSlideLeadIn() {
    const leadMs =
      viewTransitions && typeof viewTransitions.randomLeadInMs === 'function'
        ? viewTransitions.randomLeadInMs()
        : 50 + Math.random() * 450;
    slideLeadInDeadline = Date.now() + leadMs;
    setSlideLoadingCursor(true);
  }

  function playIncomingReveal(pane) {
    if (contentReveal && typeof contentReveal.play === 'function') {
      contentReveal.play(pane);
    }
    if (controlMotionHandle && typeof controlMotionHandle.refresh === 'function') {
      controlMotionHandle.refresh();
    }
  }

  function suspendMount(mount) {
    if (mount && typeof mount.suspend === 'function') {
      try {
        mount.suspend();
      } catch (_) {
        /* ignore */
      }
    }
  }

  function resumeMount(mount) {
    if (mount && typeof mount.resume === 'function') {
      try {
        mount.resume();
      } catch (_) {
        /* ignore */
      }
    }
  }

  function destroyMountAndPane(mount, pane) {
    if (mount && typeof mount.destroy === 'function') {
      try {
        mount.destroy();
      } catch (_) {
        /* ignore */
      }
    }
    if (pane && pane.parentNode) {
      pane.parentNode.removeChild(pane);
    }
  }

  function destroyPreviousViewCache() {
    if (!previousViewCache) return;
    const cached = previousViewCache;
    previousViewCache = null;
    destroyMountAndPane(cached.mount, cached.pane);
  }

  /** Keep only the most-recent previous page rendered off-screen. */
  function cachePreviousView(viewId, pane, mount) {
    if (!viewId || !pane) {
      destroyPreviousViewCache();
      return;
    }
    if (previousViewCache && previousViewCache.pane === pane) {
      previousViewCache = { viewId, pane, mount };
      return;
    }
    destroyPreviousViewCache();
    suspendMount(mount);
    pane.setAttribute('data-view-cached', 'true');
    pane.removeAttribute('data-view-active');
    pane.style.pointerEvents = 'none';
    pane.setAttribute('aria-hidden', 'true');
    previousViewCache = { viewId, pane, mount };
  }

  function takePreviousViewCache(viewId) {
    if (!previousViewCache || previousViewCache.viewId !== viewId) return null;
    const cached = previousViewCache;
    previousViewCache = null;
    cached.pane.removeAttribute('data-view-cached');
    cached.pane.removeAttribute('aria-hidden');
    return cached;
  }

  function getActiveViewPane(main) {
    if (!main) return null;
    return (
      main.querySelector('[data-view-pane][data-view-active="true"]') ||
      main.querySelector('[data-view-pane]:not([data-view-cached])')
    );
  }

  function finishOutgoingMount(oldMount, fromPane) {
    destroyMountAndPane(oldMount, fromPane);
  }

  function navRouteFor(route) {
    if (route === 'rank') return 'ranks';
    if (
      route === 'rank-editor' ||
      route === 'rank-manager' ||
      route === 'rank-create' ||
      route === 'rank-edit'
    ) {
      return 'config';
    }
    // Privacy / Contributing / onboarding are not nav tabs - leave no tab highlighted.
    if (route === 'privacy' || route === 'contributing' || route === 'onboarding' || route === 'setup') {
      return '';
    }
    return route;
  }

  function openContributing() {
    if (currentRoute() !== 'contributing') {
      contributingReturnHash = win.location.hash || '#/';
    }
    win.location.hash = '#/contributing';
  }

  function rankEditNameFromHash() {
    const hash = (win.location.hash || '').replace(/^#/, '');
    const m = hash.match(/^\/?rank-edit\/(.+)$/);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch (_) {
      return m[1];
    }
  }

  function applyConfigChrome() {
    try {
      // Do not config.load() here - that re-reads disk and would wipe in-memory
      // updates (e.g. color-picker preview before the debounced write lands).
      config.applyToDocument(doc);
      i18n.init();
      i18n.applyToDocument(doc);
    } catch (_) {
      /* ignore */
    }
  }

  /** Re-label the persistent header + navbar after a language change (views re-render themselves). */
  function relocalizeShell() {
    if (!shellEl) return;
    shellLanguage = i18n.getLanguage();
    replaceNavbar(currentRoute(), shellAlignment || config.getNavbarAlignment());
    const reloadBtn = shellEl.querySelector('[data-action="reload-catalog"]');
    if (reloadBtn) reloadBtn.textContent = i18n.t('shell.reloadExerciseData');
    const dateEl = shellEl.querySelector('#local-date');
    if (dateEl) dateEl.textContent = app.formatDisplayDate(dateEl.getAttribute('data-local-date'));
    const tourBtn = shellEl.querySelector('[data-tour-guide-btn]');
    if (tourBtn) {
      const label = i18n.t('tour.guideAria');
      tourBtn.setAttribute('aria-label', label);
      tourBtn.setAttribute('title', label);
    }
    if (githubFabHandle && typeof githubFabHandle.relabel === 'function') {
      githubFabHandle.relabel();
    }
    if (tourController && typeof tourController.syncResumeArrow === 'function') {
      tourController.syncResumeArrow();
    }
  }

  function notifyTourRouteReady() {
    if (tourController && typeof tourController.onRouteReady === 'function') {
      tourController.onRouteReady();
    }
  }

  function resolveHeaderRankName(localDate) {
    try {
      if (app.landing && typeof app.landing.getLandingModel === 'function') {
        const model = app.landing.getLandingModel(localDate);
        if (model && model.ok && model.data && model.data.overallRankName) {
          return model.data.overallRankName;
        }
      }
    } catch (_) {
      /* fall through */
    }
    return 'UNRANKED';
  }

  function tearDownActiveMount() {
    if (activeMount) {
      activeMount.destroy();
      activeMount = null;
    }
    destroyPreviousViewCache();
  }

  function tearDownShell() {
    tearDownActiveMount();
    if (typeof navbarUtilitiesUnbind === 'function') {
      navbarUtilitiesUnbind();
      navbarUtilitiesUnbind = null;
    }
    shellEl = null;
    shellAlignment = null;
    shellLanguage = null;
  }

  function bindNavbarUtilities() {
    if (!shellEl || !navbarUtilities) return;
    if (typeof navbarUtilitiesUnbind === 'function') {
      navbarUtilitiesUnbind();
      navbarUtilitiesUnbind = null;
    }
    navbarUtilitiesUnbind = navbarUtilities.fillNavbarUtilities(shellEl, {
      onEditRanks: () => {
        win.location.hash = '#/rank-manager';
      },
      onPrivacy: () => {
        if (currentRoute() !== 'privacy') {
          privacyReturnHash = win.location.hash || '#/';
        }
        win.location.hash = '#/privacy';
      },
      onScheduleChange: () => {
        if (activeMount && typeof activeMount.refresh === 'function') activeMount.refresh();
      },
    });
  }

  function getShellMain() {
    return shellEl ? shellEl.querySelector('#shell-main') : null;
  }

  function updateNavbarActive(route) {
    if (!shellEl) return;
    const active = navRouteFor(route);
    shellEl.querySelectorAll('.app-navbar [data-route]').forEach((link) => {
      const isActive = link.getAttribute('data-route') === active;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function updateHeaderChrome(state) {
    if (!shellEl) return;
    const dateEl = shellEl.querySelector('#local-date');
    if (dateEl) {
      dateEl.setAttribute('data-local-date', state.localDate);
      dateEl.textContent = app.formatDisplayDate(state.localDate);
    }

    const brand = shellEl.querySelector('.shell-brand-block');
    if (!brand) return;
    const headerRankName = resolveHeaderRankName(state.localDate);
    const existing = brand.querySelector('[data-header-rank-badge]');
    const nextHtml = rankBadge.renderRankBadge(headerRankName, {
      dataAttr: 'data-header-rank-badge',
      className: 'shell-header-badge',
    });
    if (existing) {
      const wrap = doc.createElement('div');
      wrap.innerHTML = nextHtml;
      const next = wrap.firstElementChild;
      if (next) existing.replaceWith(next);
    } else {
      brand.insertAdjacentHTML('afterbegin', nextHtml);
    }
  }

  function replaceNavbar(route, alignment) {
    if (!shellEl) return;
    const existing = shellEl.querySelector('.app-navbar');
    const html = appShell.renderAppNavbar(navRouteFor(route), alignment);
    const wrap = doc.createElement('div');
    wrap.innerHTML = html;
    const next = wrap.firstElementChild;
    if (!next) return;
    if (existing) existing.replaceWith(next);
    else shellEl.insertBefore(next, getShellMain());
    bindNavbarUtilities();
  }

  function ensureShell(state) {
    applyConfigChrome();
    try {
      require('./landingConfig.js').load();
    } catch (_) {
      /* ignore */
    }
    const alignment = config.getNavbarAlignment();
    const route = currentRoute();

    if (shellEl && root.contains(shellEl)) {
      if (shellAlignment !== alignment) {
        shellEl.className = `app-shell app-shell-nav-${alignment}`;
        replaceNavbar(route, alignment);
        shellAlignment = alignment;
      } else {
        updateNavbarActive(route);
      }
      if (shellLanguage !== i18n.getLanguage()) relocalizeShell();
      updateHeaderChrome(state);
      return getShellMain();
    }

    tearDownShell();
    root.innerHTML = '';

    const headerRankName = resolveHeaderRankName(state.localDate);
    const headerBadge = rankBadge.renderRankBadge(headerRankName, {
      dataAttr: 'data-header-rank-badge',
      className: 'shell-header-badge',
    });

    const wrap = doc.createElement('div');
    wrap.dataset.view = 'shell';
    wrap.className = `app-shell app-shell-nav-${alignment}`;
    wrap.innerHTML = `
      <header class="shell-header">
        <div class="shell-brand-block">
          ${headerBadge}
          <div class="brand">Strank</div>
          <button type="button" class="shell-tour-guide-btn" data-tour-guide-btn
            aria-label="${escapeHtml(i18n.t('tour.guideAria'))}" title="${escapeHtml(i18n.t('tour.guideAria'))}">🧭</button>
        </div>
        <div class="local-date" id="local-date" data-local-date="${escapeHtml(state.localDate)}">${escapeHtml(
          app.formatDisplayDate(state.localDate)
        )}</div>
        <button type="button" class="ghost shell-reload" data-action="reload-catalog">${escapeHtml(
          i18n.t('shell.reloadExerciseData')
        )}</button>
      </header>
      ${appShell.renderAppNavbar(navRouteFor(route), alignment)}
      <main class="shell-main" id="shell-main"></main>
    `;

    const reloadBtn = wrap.querySelector('[data-action="reload-catalog"]');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        reloadExerciseData();
      });
    }

    const tourBtn = wrap.querySelector('[data-tour-guide-btn]');
    if (tourBtn) {
      tourBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (tourController) tourController.onHeaderTourClick();
      });
    }

    root.appendChild(wrap);
    shellEl = wrap;
    shellAlignment = alignment;
    shellLanguage = i18n.getLanguage();
    bindNavbarUtilities();
    return wrap.querySelector('#shell-main');
  }

  function mountRoute(main, state) {
    const route = currentRoute();
    if (route === 'history') {
      activeMount = historyCalendarView.mountHistoryCalendarView(main, {
        ranking: app.ranking,
        history: app.history,
        catalog: app.catalog,
        onBack: () => {
          win.location.hash = '#/';
        },
      });
    } else if (route === 'rank') {
      activeMount = rankView.mountRankView(main, {
        ranking: app.ranking,
      });
    } else if (route === 'ranks') {
      activeMount = ranksGalleryView.mountRanksGalleryView(main, {
        ranksGallery: app.ranksGallery,
        onBack: () => {
          win.location.hash = '#/';
        },
      });
    } else if (route === 'config') {
      activeMount = configView.mountConfigView(main, {
        onBack: () => {
          win.location.hash = '#/';
        },
        onNavigate: (path) => {
          const p = String(path || '/').replace(/^\//, '');
          win.location.hash = p ? `#/${p}` : '#/';
        },
        onSettingsChanged: () => {
          applyConfigChrome();
          // Catalog/ranks reload belongs to unit-conversion / import paths - not every
          // settings tick (color dragging used to hitch the whole app here).
          const alignment = config.getNavbarAlignment();
          if (shellEl && shellAlignment !== alignment) {
            shellEl.className = `app-shell app-shell-nav-${alignment}`;
            replaceNavbar(currentRoute(), alignment);
            shellAlignment = alignment;
          }
          if (shellEl && shellLanguage !== i18n.getLanguage()) relocalizeShell();
          if (shellEl) {
            try {
              const state = app.bootstrap();
              if (state.ok) updateHeaderChrome(state);
            } catch (_) {
              /* ignore */
            }
          }
        },
        confirm: (msg) => win.confirm(msg),
      });
    } else if (route === 'rank-manager') {
      activeMount = rankManagerView.mountRankManagerView(main, {
        onBack: () => {
          win.location.hash = '#/config';
        },
        onCreate: () => {
          win.location.hash = '#/rank-create';
        },
        onEdit: (name) => {
          win.location.hash = `#/rank-edit/${encodeURIComponent(name || '')}`;
        },
        onRawEditor: () => {
          win.location.hash = '#/rank-editor';
        },
        confirm: (msg) => win.confirm(msg),
      });
    } else if (route === 'rank-create' || route === 'rank-edit') {
      activeMount = rankFormView.mountRankFormView(main, {
        mode: route === 'rank-edit' ? 'edit' : 'create',
        rankName: route === 'rank-edit' ? rankEditNameFromHash() : null,
        onBack: () => {
          win.location.hash = '#/rank-manager';
        },
        onSaved: () => {
          try {
            if (app && app.catalog && typeof app.catalog.reloadFromDisk === 'function') {
              app.catalog.reloadFromDisk();
            }
          } catch (_) {
            /* ignore */
          }
          win.location.hash = '#/rank-manager';
        },
        confirm: (msg) => win.confirm(msg),
      });
    } else if (route === 'rank-editor') {
      activeMount = rankEditorView.mountRankEditorView(main, {
        onBack: () => {
          win.location.hash = '#/rank-manager';
        },
        confirm: (msg) => win.confirm(msg),
        onSaved: () => {
          try {
            if (app && app.catalog && typeof app.catalog.reloadFromDisk === 'function') {
              app.catalog.reloadFromDisk();
            }
          } catch (_) {
            /* ignore */
          }
        },
      });
    } else if (route === 'workout') {
      const localDate = workoutLocalDate || state.localDate;
      activeMount = activeWorkoutView.mountActiveWorkoutView(main, {
        workout,
        localDate,
        confirm: (msg) => win.confirm(msg),
        onComplete: () => {
          workoutLocalDate = null;
          // Landing must remount with fresh store data; a cached pane can stay
          // parked off-screen after the workout slide and look blank.
          destroyPreviousViewCache();
          if (slideTransitionHandle && typeof slideTransitionHandle.cancel === 'function') {
            slideTransitionHandle.cancel();
            slideTransitionHandle = null;
          }
          clearSlideLeadIn();
          setSlideLoadingCursor(false);
          win.location.hash = '#/';
        },
        onCancel: () => {
          workoutLocalDate = null;
          destroyPreviousViewCache();
          win.location.hash = '#/';
        },
      });
    } else if (route === 'today') {
      activeMount = todayView.mountTodayView(main, {
        dailyLog: app.dailyLog,
        catalog: app.catalog,
      });
    } else if (route === 'onboarding') {
      activeMount = onboardingView.mountOnboardingView(main, {
        onComplete: () => {
          win.location.hash = '#/';
        },
        onGiveTour: () => {
          win.location.hash = '#/';
          win.setTimeout(() => {
            if (tourController) tourController.startFromBeginning();
          }, 0);
        },
      });
    } else if (route === 'privacy') {
      activeMount = onboardingView.mountPrivacyNoticeView(main, {
        onBack: () => {
          const target = privacyReturnHash || '#/';
          win.location.hash = target;
        },
      });
    } else if (route === 'contributing') {
      activeMount = contributingView.mountContributingNoticeView(main, {
        onBack: () => {
          const target = contributingReturnHash || '#/';
          win.location.hash = target;
        },
      });
    } else {
      activeMount = landingView.mountLandingView(main, {
        onGetStarted: (model) => {
          workoutLocalDate = model.localDate || state.localDate;
          workout.start(workoutLocalDate);
          if (startTransitionHandle && startTransitionHandle.cancel) {
            startTransitionHandle.cancel();
          }
          const host = getShellMain() || root;
          startTransitionHandle = workoutStartTransition.run({
            doc,
            root: host,
            today: workoutLocalDate,
            onComplete: () => {
              startTransitionHandle = null;
              win.location.hash = '#/workout';
            },
          });
        },
      });
    }

  }

  function setSetupScreenMode(on) {
    try {
      doc.documentElement.classList.toggle('is-setup-screen', !!on);
      if (doc.body) doc.body.classList.toggle('is-setup-screen', !!on);
    } catch (_) {
      /* ignore */
    }
  }

  function destroyGithubFab() {
    if (githubFabHandle && typeof githubFabHandle.destroy === 'function') {
      githubFabHandle.destroy();
    }
    githubFabHandle = null;
  }

  function ensureGithubFab() {
    if (currentRoute() === 'setup') {
      destroyGithubFab();
      return;
    }
    if (githubFabHandle) return;
    if (githubFab && typeof githubFab.installGithubFab === 'function') {
      githubFabHandle = githubFab.installGithubFab(doc, {
        onOpen: () => openContributing(),
      });
    }
  }

  function renderSetupScreen() {
    if (slideTransitionHandle && typeof slideTransitionHandle.cancel === 'function') {
      slideTransitionHandle.cancel();
      slideTransitionHandle = null;
    }
    clearSlideLeadIn();
    tearDownActiveMount();
    tearDownShell();
    destroyGithubFab();
    destroyPreviousViewCache();
    lastViewId = null;
    previousViewCache = null;
    setSetupScreenMode(true);
    root.innerHTML = '';
    const host = doc.createElement('div');
    host.className = 'setup-install-host';
    root.appendChild(host);
    activeMount = setupInstallView.mountSetupInstallView(host, {
      document: doc,
      onFinished: (result) => {
        if (result && result.relaunchNeeded && result.launchExe) {
          setupInstall.relaunchFrom(result.launchExe, () => {
            try {
              if (typeof nw !== 'undefined' && nw.App) nw.App.quit();
            } catch (_) {
              /* ignore */
            }
          });
          return;
        }
        setSetupScreenMode(false);
        win.location.hash = '#/';
        win.setTimeout(() => render(), 0);
      },
    });
  }

  function render() {
    try {
      const state = app.bootstrap();

      if (currentRoute() === 'setup') {
        renderSetupScreen();
        return;
      }

      setSetupScreenMode(false);
      ensureGithubFab();

      if (state.view === 'dataError') {
        if (slideTransitionHandle && typeof slideTransitionHandle.cancel === 'function') {
          slideTransitionHandle.cancel();
          slideTransitionHandle = null;
        }
        clearSlideLeadIn();
        tearDownActiveMount();
        tearDownShell();
        root.innerHTML = '';
        root.appendChild(renderDataError(state.message));
        lastViewId = null;
        previousViewCache = null;
        return;
      }

      if (state.view === 'storeCorrupt') {
        if (slideTransitionHandle && typeof slideTransitionHandle.cancel === 'function') {
          slideTransitionHandle.cancel();
          slideTransitionHandle = null;
        }
        clearSlideLeadIn();
        tearDownActiveMount();
        tearDownShell();
        root.innerHTML = '';
        root.appendChild(renderStoreCorrupt());
        lastViewId = null;
        previousViewCache = null;
        return;
      }

      const main = ensureShell(state);
      if (!main) {
        throw new Error('Shell main missing');
      }

      const route = currentRoute();
      const toView = viewIdForRoute(route);
      const fromView = lastViewId;
      const oldMount = activeMount;
      const fromPane = getActiveViewPane(main);
      const returningToCache = !!(previousViewCache && previousViewCache.viewId === toView);

      // Same view re-render (config apply, etc.): refresh in place, keep cache.
      if (fromView && toView === fromView && fromPane && oldMount) {
        clearSlideLeadIn();
        activeMount = oldMount;
        if (typeof activeMount.refresh === 'function') activeMount.refresh();
        notifyTourRouteReady();
        return;
      }

      activeMount = null;

      if (slideTransitionHandle && typeof slideTransitionHandle.cancel === 'function') {
        slideTransitionHandle.cancel();
        slideTransitionHandle = null;
      }
      if (slideLeadInTimer != null) {
        win.clearTimeout(slideLeadInTimer);
        slideLeadInTimer = null;
      }
      pendingSlideOutgoing = null;

      // Drop orphan panes (keep active + the one previous cache).
      Array.from(main.querySelectorAll('[data-view-pane]')).forEach((pane) => {
        if (pane === fromPane) return;
        if (previousViewCache && pane === previousViewCache.pane) return;
        if (pane.parentNode) pane.parentNode.removeChild(pane);
      });

      // Lead-in / cursor usually armed in beginNavLoading (pointerdown / hash set).
      // Clear cursor when cards begin moving (onMotionStart), or if there is no slide.
      if (fromView && fromPane && fromView !== toView) {
        setSlideLoadingCursor(true);
        if (returningToCache) {
          slideLeadInDeadline = null;
        } else if (slideLeadInDeadline == null) {
          armSlideLeadIn();
        }
      } else {
        slideLeadInDeadline = null;
        setSlideLoadingCursor(false);
      }

      let toPane;
      let reusedCache = false;
      if (returningToCache) {
        const cached = takePreviousViewCache(toView);
        toPane = cached.pane;
        activeMount = cached.mount;
        reusedCache = true;
        // Do not refresh() here — that remounts the whole view and reintroduces
        // the delay the cache is meant to avoid. resume() is enough (e.g. workout timer).
        resumeMount(activeMount);
        // Ensure reused pane is stacked for the enter slide.
        if (toPane.parentNode) toPane.parentNode.appendChild(toPane);
      } else {
        toPane = createViewPane(toView);
        main.appendChild(toPane);
        mountRoute(toPane, state);
      }
      toPane.setAttribute('data-view-id', String(toView));
      toPane.setAttribute('data-view-active', 'true');
      if (fromPane) fromPane.removeAttribute('data-view-active');

      const shouldSlide =
        fromPane &&
        fromView &&
        fromPane !== toPane &&
        viewTransitions &&
        typeof viewTransitions.run === 'function';

      if (!shouldSlide) {
        clearSlideLeadIn();
        if (fromPane && fromPane !== toPane) {
          // No slide: drop outgoing; also clear previous cache (nav reset).
          destroyPreviousViewCache();
          finishOutgoingMount(oldMount, fromPane);
        }
        if (!reusedCache) playIncomingReveal(toPane);
        toPane.style.pointerEvents = '';
        lastViewId = toView;
        notifyTourRouteReady();
        return;
      }

      toPane.style.pointerEvents = 'none';
      fromPane.style.pointerEvents = 'none';

      // Park incoming off-screen during lead-in (cached panes are already parked).
      if (typeof viewTransitions.prepare === 'function') {
        viewTransitions.prepare({
          container: main,
          fromEl: fromPane,
          toEl: toPane,
          fromView,
          toView,
          doc,
        });
      }

      // Skip lead-in wait when returning to the most-recent previous page.
      let waitMs = 0;
      if (returningToCache) {
        slideLeadInDeadline = null;
      } else {
        waitMs = Math.max(0, (slideLeadInDeadline || Date.now()) - Date.now());
        slideLeadInDeadline = null;
        if (!reusedCache) playIncomingReveal(toPane);
      }

      pendingSlideOutgoing = { mount: oldMount, pane: fromPane, viewId: fromView };
      lastViewId = toView;
      setSlideLoadingCursor(true);

      const endSlideLoading = () => {
        setSlideLoadingCursor(false);
      };

      const beginSlide = () => {
        slideLeadInTimer = null;
        // Keep loading cursor until onComplete — not when motion merely starts.

        let completed = false;
        const result = viewTransitions.run({
          container: main,
          fromEl: fromPane,
          toEl: toPane,
          fromView,
          toView,
          doc,
          retainFromEl: true,
          // Cached returns are already parked; start motion without the double-rAF beat.
          immediate: reusedCache,
          onMotionStart: () => {
            endSlideLoading();
          },
          onComplete: () => {
            if (completed) return;
            completed = true;
            slideTransitionHandle = null;
            pendingSlideOutgoing = null;
            // Keep outgoing rendered as the new "previous" page.
            cachePreviousView(fromView, fromPane, oldMount);
            toPane.style.pointerEvents = '';
            toPane.removeAttribute('aria-hidden');
            endSlideLoading();
            notifyTourRouteReady();
          },
        });

        if (result && result.skipped) {
          if (!completed) {
            completed = true;
            pendingSlideOutgoing = null;
            cachePreviousView(fromView, fromPane, oldMount);
            toPane.style.pointerEvents = '';
            endSlideLoading();
            notifyTourRouteReady();
          }
        } else {
          slideTransitionHandle = result;
        }
      };

      if (waitMs <= 0) {
        beginSlide();
      } else {
        slideLeadInTimer = win.setTimeout(beginSlide, waitMs);
      }
    } catch (err) {
      clearSlideLeadIn();
      windowState.debugLog('ui render failed', { message: err && err.message, stack: err && err.stack });
      showFatal(err);
    }
  }

  function renderDataError(message) {
    const el = doc.createElement('section');
    el.className = 'error-view';
    el.dataset.view = 'dataError';
    el.innerHTML = `
      <h1>${escapeHtml(i18n.t('shell.dataError.title'))}</h1>
      <p class="message">${escapeHtml(message)}</p>
      <p>${escapeHtml(i18n.t('shell.dataError.unavailable'))}</p>
    `;
    return el;
  }

  function renderStoreCorrupt() {
    const el = doc.createElement('section');
    el.className = 'error-view';
    el.dataset.view = 'storeCorrupt';
    el.innerHTML = `
      <h1>${escapeHtml(i18n.t('shell.localData.title'))}</h1>
      <p class="message">${escapeHtml(i18n.t('error.localDataUnreadable'))}</p>
      <button type="button" class="primary" id="reset-local-data">${escapeHtml(i18n.t('shell.localData.reset'))}</button>
    `;
    el.querySelector('#reset-local-data').addEventListener('click', () => {
      const confirmed = win.confirm(i18n.t('shell.localData.resetConfirm'));
      if (!confirmed) return;
      app.resetLocalData();
      render();
    });
    return el;
  }

  function setupCatalogFocusWatch() {
    win.addEventListener('focus', () => {
      if (!app || !app.catalog || typeof app.catalog.diskCatalogChanged !== 'function') return;
      if (!app.catalog.diskCatalogChanged()) return;
      app.catalog.reloadFromDisk();
      if (shellEl) {
        try {
          const state = app.bootstrap();
          if (state.ok) updateHeaderChrome(state);
        } catch (_) {
          /* ignore */
        }
      }
      if (activeMount && typeof activeMount.refresh === 'function') {
        activeMount.refresh();
      }
    });
  }

  function reloadExerciseData() {
    if (app && app.catalog && typeof app.catalog.reloadFromDisk === 'function') {
      app.catalog.reloadFromDisk();
    }
    // Edited language files show up without a restart.
    i18n.reload();
    relocalizeShell();
    if (shellEl) {
      try {
        const state = app.bootstrap();
        if (state.ok) updateHeaderChrome(state);
      } catch (_) {
        /* ignore */
      }
    }
    if (activeMount && typeof activeMount.refresh === 'function') {
      activeMount.refresh();
    } else {
      render();
    }
  }

  try {
    setupWindowLifecycle();
    setupCatalogFocusWatch();
    try {
      if (paths && typeof paths.ensureUserDataSeeded === 'function') {
        paths.ensureUserDataSeeded();
      }
    } catch (_) {
      /* seed best-effort before config */
    }
    try {
      config.load();
    } catch (_) {
      /* defaults applied inside load */
    }
    i18n.init();
    i18n.applyToDocument(doc);

    const rawHash = (win.location.hash || '').replace(/^#/, '');
    if (setupInstall && typeof setupInstall.shouldShow === 'function' && setupInstall.shouldShow()) {
      if (win.location.hash !== '#/setup') {
        win.location.hash = '#/setup';
      }
    } else if (onboarding && typeof onboarding.shouldShow === 'function' && onboarding.shouldShow()) {
      if (win.location.hash !== '#/onboarding') {
        win.location.hash = '#/onboarding';
      }
    } else if (!rawHash || rawHash === '/') {
      if (win.location.hash !== '#/') {
        win.location.hash = '#/';
      }
    }

    win.addEventListener('hashchange', () => render());
    installNavLoadingPointerHook();
    installNavLoadingHashHook();

    ensureGithubFab();

    if (fontScaleHotkeys && typeof fontScaleHotkeys.installFontScaleHotkeys === 'function') {
      fontScaleHotkeysHandle = fontScaleHotkeys.installFontScaleHotkeys(doc, {
        isWindowActive: () => {
          if (doc.visibilityState === 'hidden') return false;
          if (typeof doc.hasFocus === 'function' && !doc.hasFocus()) return false;
          return true;
        },
        onNudge: (delta) => {
          if (!config || typeof config.nudgeFontSize !== 'function') return;
          const result = config.nudgeFontSize(delta);
          if (!result || !result.changed) return;
          applyConfigChrome();
          if (activeMount && typeof activeMount.refresh === 'function') {
            activeMount.refresh();
          }
        },
      });
    }

    if (tourRuntime && typeof tourRuntime.createTourController === 'function') {
      tourController = tourRuntime.createTourController({
        doc,
        win,
        getRoute: () => currentRoute(),
        navigate: (hash) => {
          win.location.hash = hash;
        },
        getActiveRoot: () => {
          if (activeMount && typeof activeMount.getRoot === 'function') {
            try {
              return activeMount.getRoot();
            } catch (_) {
              return null;
            }
          }
          return null;
        },
        prepareStep: (step) => {
          const prep = step && step.prepare;
          if (!prep || !activeMount) return;
          if (prep.historyZoom === 'day' && typeof activeMount.openDay === 'function') {
            let day = null;
            try {
              day =
                (app.ranking && typeof app.ranking.currentLocalDate === 'function' && app.ranking.currentLocalDate()) ||
                (app && typeof app.currentLocalDate === 'function' && app.currentLocalDate()) ||
                null;
            } catch (_) {
              day = null;
            }
            if (!day) {
              const d = new Date();
              day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            activeMount.openDay(day);
          } else if (prep.historyZoom === 'month' && typeof activeMount.openMonth === 'function') {
            const vm =
              typeof activeMount.getViewMonth === 'function' ? activeMount.getViewMonth() : null;
            if (vm && vm.year && vm.month) activeMount.openMonth(vm.year, vm.month);
          } else if (prep.historyZoom === 'years' && typeof activeMount.openYears === 'function') {
            activeMount.openYears();
          } else if (prep.configSection && typeof activeMount.revealSection === 'function') {
            // Pin near the top of the content-body (Accessibility pic 2).
            activeMount.revealSection(prep.configSection, { align: 'start' });
          }
        },
      });
    }

    render();
    if (githubFabHandle && typeof githubFabHandle.relayout === 'function') {
      githubFabHandle.relayout();
    }

    win.__strank = {
      app,
      render,
      windowState,
      todayView,
      historyCalendarView,
      rankView,
      ranksGalleryView,
      landingView,
      activeWorkoutView,
      workout,
      config,
    };

    windowState.debugLog('ui render complete', {
      route: currentRoute(),
      hash: win.location.hash,
      hasLanding: Boolean(root.querySelector('[data-view="landing"]')),
      mainHtmlLength: (root.querySelector('#shell-main') || root).innerHTML.length,
      shellPersisted: Boolean(shellEl),
    });
  } catch (err) {
    windowState.debugLog('ui boot failed', { message: err && err.message, stack: err && err.stack });
    showFatal(err);
    throw err;
  }

  return { render, app };
}

module.exports = { boot };
