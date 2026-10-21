/**
 * Feature 1 — App Foundation
 * Feature 2 — Daily Exercise Log
 * Feature 3 — Exercise History
 * Feature 4 — Weekly Ranking
 * Feature 5 — Dynamic Exercise Catalog
 * Feature 7 — Landing Page
 *
 * NW.js shell UI — no login.
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
  let i18n;
  try {
    i18n = require('./i18n.js');
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
    workoutStartTransition = require('./workoutStartTransition.js');
    clickRipple = require('./clickRipple.js');
    controlMotion = require('./controlMotion.js');
    contentReveal = require('./contentReveal.js');
    viewTransitions = require('./viewTransitions.js');
    navbarUtilities = require('./navbarUtilities.js');
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
  /** Feature 15 — last ranked view id for slide direction */
  let lastViewId = null;
  let clickRippleHandle = null;
  let controlMotionHandle = null;
  let startTransitionHandle = null;
  let slideTransitionHandle = null;
  /** Unbind Day Focus / Edit Ranks / Privacy on the persistent navbar */
  let navbarUtilitiesUnbind = null;
  /** Hash to restore when leaving the standalone Privacy notice */
  let privacyReturnHash = '#/';

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
      console.warn('[ui] nw API unavailable — window state will not persist');
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

  function currentRoute() {
    const hash = (win.location.hash || '').replace(/^#/, '');
    if (hash === '/history' || hash === 'history') return 'history';
    if (hash === '/rank' || hash === 'rank' || hash === '/rankDebug' || hash === 'rankDebug') return 'rank';
    if (hash === '/ranks' || hash === 'ranks') return 'ranks';
    if (hash === '/config' || hash === 'config') return 'config';
    if (hash === '/rank-manager' || hash === 'rank-manager') return 'rank-manager';
    if (hash === '/rank-create' || hash === 'rank-create') return 'rank-create';
    if (hash.startsWith('/rank-edit/') || hash.startsWith('rank-edit/')) return 'rank-edit';
    if (hash === '/rank-editor' || hash === 'rank-editor') return 'rank-editor';
    if (hash === '/workout' || hash === 'workout') return 'workout';
    if (hash === '/today' || hash === 'today') return 'today';
    if (hash === '/onboarding' || hash === 'onboarding') return 'onboarding';
    if (hash === '/privacy' || hash === 'privacy') return 'privacy';
    if (hash === '' || hash === '/' || hash === '/landing' || hash === 'landing') return 'landing';
    return 'landing';
  }

  /** Map router id → Feature 15 view rank id (FR-024). */
  function viewIdForRoute(route) {
    if (route === 'history') return 'history-month';
    if (route === 'today') return 'landing';
    if (route === 'rank') return 'ranks';
    return route;
  }

  function createViewPane() {
    const pane = doc.createElement('div');
    pane.className = 'view-slide-pane';
    pane.setAttribute('data-view-pane', '');
    return pane;
  }

  function playIncomingReveal(pane) {
    if (contentReveal && typeof contentReveal.play === 'function') {
      contentReveal.play(pane);
    }
    if (controlMotionHandle && typeof controlMotionHandle.refresh === 'function') {
      controlMotionHandle.refresh();
    }
  }

  function finishOutgoingMount(oldMount, fromPane) {
    if (oldMount && typeof oldMount.destroy === 'function') {
      try {
        oldMount.destroy();
      } catch (_) {
        /* ignore */
      }
    } else if (fromPane && fromPane.parentNode) {
      fromPane.parentNode.removeChild(fromPane);
    }
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
    // Privacy / onboarding are not nav tabs — leave no tab highlighted.
    if (route === 'privacy' || route === 'onboarding') return '';
    return route;
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
      // Do not config.load() here — that re-reads disk and would wipe in-memory
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
          // Catalog/ranks reload belongs to unit-conversion / import paths — not every
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
          win.location.hash = '#/';
        },
        onCancel: () => {
          workoutLocalDate = null;
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
      });
    } else if (route === 'privacy') {
      activeMount = onboardingView.mountPrivacyNoticeView(main, {
        onBack: () => {
          const target = privacyReturnHash || '#/';
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

  function render() {
    try {
      const state = app.bootstrap();

      if (state.view === 'dataError') {
        if (slideTransitionHandle && typeof slideTransitionHandle.cancel === 'function') {
          slideTransitionHandle.cancel();
          slideTransitionHandle = null;
        }
        tearDownActiveMount();
        tearDownShell();
        root.innerHTML = '';
        root.appendChild(renderDataError(state.message));
        lastViewId = null;
        return;
      }

      if (state.view === 'storeCorrupt') {
        if (slideTransitionHandle && typeof slideTransitionHandle.cancel === 'function') {
          slideTransitionHandle.cancel();
          slideTransitionHandle = null;
        }
        tearDownActiveMount();
        tearDownShell();
        root.innerHTML = '';
        root.appendChild(renderStoreCorrupt());
        lastViewId = null;
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
      activeMount = null;

      if (slideTransitionHandle && typeof slideTransitionHandle.cancel === 'function') {
        slideTransitionHandle.cancel();
        slideTransitionHandle = null;
      }

      const existingPanes = Array.from(main.querySelectorAll('[data-view-pane]'));
      const fromPane = existingPanes.length ? existingPanes[existingPanes.length - 1] : null;
      existingPanes.slice(0, -1).forEach((pane) => {
        if (pane.parentNode) pane.parentNode.removeChild(pane);
      });

      const toPane = createViewPane();
      main.appendChild(toPane);
      mountRoute(toPane, state);

      const shouldSlide =
        fromPane &&
        fromView &&
        viewTransitions &&
        typeof viewTransitions.run === 'function';

      if (!shouldSlide) {
        if (fromPane && fromPane !== toPane) {
          finishOutgoingMount(oldMount, fromPane);
        }
        playIncomingReveal(toPane);
        lastViewId = toView;
        return;
      }

      toPane.style.pointerEvents = 'none';
      fromPane.style.pointerEvents = 'none';

      let completed = false;
      const result = viewTransitions.run({
        container: main,
        fromEl: fromPane,
        toEl: toPane,
        fromView,
        toView,
        doc,
        onComplete: () => {
          if (completed) return;
          completed = true;
          slideTransitionHandle = null;
          finishOutgoingMount(oldMount, fromPane);
          toPane.style.pointerEvents = '';
        },
      });

      // Content reveal runs on the incoming pane while it slides (FR-035).
      playIncomingReveal(toPane);
      lastViewId = toView;

      if (result && result.skipped) {
        if (!completed) {
          completed = true;
          finishOutgoingMount(oldMount, fromPane);
          toPane.style.pointerEvents = '';
        }
      } else {
        slideTransitionHandle = result;
      }
    } catch (err) {
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
      config.load();
    } catch (_) {
      /* defaults applied inside load */
    }
    i18n.init();
    i18n.applyToDocument(doc);

    const rawHash = (win.location.hash || '').replace(/^#/, '');
    if (onboarding && typeof onboarding.shouldShow === 'function' && onboarding.shouldShow()) {
      if (win.location.hash !== '#/onboarding') {
        win.location.hash = '#/onboarding';
      }
    } else if (!rawHash || rawHash === '/') {
      if (win.location.hash !== '#/') {
        win.location.hash = '#/';
      }
    }

    win.addEventListener('hashchange', () => render());
    render();

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
