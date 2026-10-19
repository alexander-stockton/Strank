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
  let landingView;
  let activeWorkoutView;
  let workout;
  let config;
  let appShell;
  try {
    app = require('./app.js');
    todayView = require('./todayView.js');
    historyCalendarView = require('./historyCalendarView.js');
    rankView = require('./rankView.js');
    landingView = require('./landingView.js');
    activeWorkoutView = require('./activeWorkoutView.js');
    workout = require('./workout.js');
    config = require('./config.js');
    appShell = require('./appShell.js');
  } catch (err) {
    windowState.debugLog('ui app require failed', { message: err && err.message, stack: err && err.stack });
    throw err;
  }

  const root = doc.getElementById('app');
  let activeMount = null;
  /** Session date when entering /workout from Get Started */
  let workoutLocalDate = null;

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
    root.innerHTML = `
      <section class="error-view" data-view="uiCrash">
        <h1>UI failed to start</h1>
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
    if (hash === '/workout' || hash === 'workout') return 'workout';
    if (hash === '/today' || hash === 'today') return 'today';
    if (hash === '' || hash === '/' || hash === '/landing' || hash === 'landing') return 'landing';
    return 'landing';
  }

  function render() {
    try {
      if (activeMount) {
        activeMount.destroy();
        activeMount = null;
      }

      const state = app.bootstrap();
      root.innerHTML = '';

      if (state.view === 'dataError') {
        root.appendChild(renderDataError(state.message));
        return;
      }

      if (state.view === 'storeCorrupt') {
        root.appendChild(renderStoreCorrupt());
        return;
      }

      root.appendChild(renderShell(state));
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
      <h1>Data error</h1>
      <p class="message">${escapeHtml(message)}</p>
      <p>Workout History, Ranks, and Config are unavailable until exercise data loads.</p>
    `;
    return el;
  }

  function renderStoreCorrupt() {
    const el = doc.createElement('section');
    el.className = 'error-view';
    el.dataset.view = 'storeCorrupt';
    el.innerHTML = `
      <h1>Local data</h1>
      <p class="message">Local data could not be read.</p>
      <button type="button" class="primary" id="reset-local-data">Reset local data</button>
    `;
    el.querySelector('#reset-local-data').addEventListener('click', () => {
      const confirmed = win.confirm('This deletes all saved exercises. Continue?');
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
      if (activeMount && typeof activeMount.refresh === 'function') {
        activeMount.refresh();
      }
    });
  }

  function reloadExerciseData() {
    if (app && app.catalog && typeof app.catalog.reloadFromDisk === 'function') {
      app.catalog.reloadFromDisk();
    }
    if (activeMount && typeof activeMount.refresh === 'function') {
      activeMount.refresh();
    } else {
      render();
    }
  }

  function renderShell(state) {
    const route = currentRoute();
    config.load();
    const alignment = config.getNavbarAlignment();

    const wrap = doc.createElement('div');
    wrap.dataset.view = 'shell';
    wrap.className = `app-shell app-shell-nav-${alignment}`;
    wrap.innerHTML = `
      <header class="shell-header">
        <div class="brand">Strank</div>
        <div class="local-date" id="local-date" data-local-date="${escapeHtml(state.localDate)}">${escapeHtml(
          app.formatDisplayDate(state.localDate)
        )}</div>
        <button type="button" class="ghost shell-reload" data-action="reload-catalog">Reload exercise data</button>
      </header>
      ${appShell.renderAppNavbar(route === 'rank' ? 'ranks' : route, alignment)}
      <main class="shell-main" id="shell-main"></main>
    `;

    const reloadBtn = wrap.querySelector('[data-action="reload-catalog"]');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        reloadExerciseData();
      });
    }

    const main = wrap.querySelector('#shell-main');
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
      main.innerHTML = `
        <section class="panel ranks-placeholder" data-view="ranksGallery">
          <h1>Ranks</h1>
          <p class="hint">Ranks gallery (Feature 10) will appear here.</p>
          <p><a href="#/rank">Open weekly rank debug</a></p>
        </section>`;
      activeMount = {
        destroy() {
          main.innerHTML = '';
        },
        refresh() {},
      };
    } else if (route === 'config') {
      main.innerHTML = `
        <section class="panel config-placeholder" data-view="config">
          <h1>Config</h1>
          <p class="hint">Config settings (Feature 11) will appear here.</p>
          <p class="hint">Navbar alignment is read from <code>config.txt</code>.</p>
        </section>`;
      activeMount = {
        destroy() {
          main.innerHTML = '';
        },
        refresh() {},
      };
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
    } else {
      activeMount = landingView.mountLandingView(main, {
        onGetStarted: (model) => {
          workoutLocalDate = model.localDate || state.localDate;
          workout.start(workoutLocalDate);
          win.location.hash = '#/workout';
        },
      });
    }

    return wrap;
  }

  try {
    setupWindowLifecycle();
    setupCatalogFocusWatch();
    try {
      config.load();
    } catch (_) {
      /* defaults applied inside load */
    }

    const rawHash = (win.location.hash || '').replace(/^#/, '');
    if (!rawHash || rawHash === '/') {
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
    });
  } catch (err) {
    windowState.debugLog('ui boot failed', { message: err && err.message, stack: err && err.stack });
    showFatal(err);
    throw err;
  }

  return { render, app };
}

module.exports = { boot };
