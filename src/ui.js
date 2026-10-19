/**
 * Feature 1 — App Foundation
 * Feature 2 — Daily Exercise Log
 * Feature 3 — Exercise History
 * Feature 4 — Weekly Ranking
 * Feature 5 — Dynamic Exercise Catalog
 * Feature 6 — Custom Ranks
 *
 * NW.js shell UI — no login.
 */

(function bootUi() {
  const windowState = require('./windowState.js');
  windowState.debugLog('ui boot start', {
    hasNw: typeof nw !== 'undefined',
    screenX: typeof window !== 'undefined' ? window.screenX : null,
    outerWidth: typeof window !== 'undefined' ? window.outerWidth : null,
    statePath: windowState.resolveStatePath(),
  });

  let app;
  let todayView;
  let historyCalendarView;
  let rankView;
  let ranksGalleryView;
  let configView;
  let rankEditorView;
  try {
    app = require('./app.js');
    todayView = require('./todayView.js');
    historyCalendarView = require('./historyCalendarView.js');
    rankView = require('./rankView.js');
    ranksGalleryView = require('./ranksGalleryView.js');
    configView = require('./configView.js');
    rankEditorView = require('./rankEditorView.js');
  } catch (err) {
    windowState.debugLog('ui app require failed', { message: err && err.message, stack: err && err.stack });
    throw err;
  }

  const root = document.getElementById('app');
  let activeMount = null;
  setupWindowLifecycle();
  setupCatalogFocusWatch();
  render();

  function getNwApi() {
    if (typeof nw !== 'undefined' && nw && nw.Window) return nw;
    if (typeof global !== 'undefined' && global.nw && global.nw.Window) return global.nw;
    if (typeof window !== 'undefined' && window.nw && window.nw.Window) return window.nw;
    return null;
  }

  function setupWindowLifecycle() {
    const nwApi = getNwApi();
    if (!nwApi) {
      windowState.debugLog('ui: nw API unavailable');
      console.warn('[ui] nw API unavailable — window state will not persist');
      return;
    }

    let win;
    try {
      win = nwApi.Window.get();
    } catch (err) {
      windowState.debugLog('ui: Window.get failed', { message: err && err.message });
      console.warn('[ui] nw.Window.get failed:', err && err.message);
      return;
    }

    windowState.attachLifecycle(win, { domWindow: window, quit: true });

    const saveNow = () => {
      windowState.debugLog('ui page save');
      windowState.saveFromWindow(win, window);
    };
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
  }

  function currentRoute() {
    const hash = (window.location.hash || '').replace(/^#/, '');
    if (hash === '/history' || hash === 'history') return 'history';
    if (hash === '/rank' || hash === 'rank' || hash === '/rankDebug' || hash === 'rankDebug') return 'rank';
    if (hash === '/ranks' || hash === 'ranks') return 'ranksGallery';
    if (hash === '/config' || hash === 'config') return 'config';
    if (hash === '/rank-editor' || hash === 'rank-editor') return 'rankEditor';
    if (hash === '/today' || hash === 'today' || hash === '' || hash === '/') return 'today';
    return 'today';
  }

  function render() {
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
  }

  function renderDataError(message) {
    const el = document.createElement('section');
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
    const el = document.createElement('section');
    el.className = 'error-view';
    el.dataset.view = 'storeCorrupt';
    el.innerHTML = `
      <h1>Local data</h1>
      <p class="message">Local data could not be read.</p>
      <button type="button" class="primary" id="reset-local-data">Reset local data</button>
    `;
    el.querySelector('#reset-local-data').addEventListener('click', () => {
      const confirmed = window.confirm('This deletes all saved exercises. Continue?');
      if (!confirmed) return;
      app.resetLocalData();
      render();
    });
    return el;
  }

  function setupCatalogFocusWatch() {
    window.addEventListener('focus', () => {
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
    } else if (app && app.ranks && typeof app.ranks.loadRanks === 'function') {
      app.ranks.loadRanks();
    }
    if (activeMount && typeof activeMount.refresh === 'function') {
      activeMount.refresh();
    } else {
      render();
    }
  }

  function renderShell(state) {
    const route = currentRoute();
    const wrap = document.createElement('div');
    wrap.dataset.view = 'shell';
    wrap.innerHTML = `
      <header class="shell-header">
        <div class="brand">Strank</div>
        <div class="local-date" id="local-date">${escapeHtml(state.localDate)}</div>
      </header>
      <nav class="shell-nav" aria-label="Main">
        <a class="nav-link ${route === 'today' ? 'active' : ''}" href="#/today" data-route="today">Today</a>
        <a class="nav-link ${route === 'history' ? 'active' : ''}" href="#/history" data-route="history">History</a>
        <a class="nav-link ${route === 'rank' ? 'active' : ''}" href="#/rank" data-route="rank">Rank</a>
        <a class="nav-link ${route === 'ranksGallery' ? 'active' : ''}" href="#/ranks" data-route="ranks">Ranks</a>
        <a class="nav-link ${route === 'config' || route === 'rankEditor' ? 'active' : ''}" href="#/config" data-route="config">Config</a>
        <button type="button" class="nav-link ghost" data-action="reload-catalog">Reload exercise data</button>
      </nav>
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
        ranks: app.ranks,
        onBack: () => {
          window.location.hash = '#/today';
        },
      });
    } else if (route === 'rank') {
      activeMount = rankView.mountRankView(main, {
        ranking: app.ranking,
      });
    } else if (route === 'ranksGallery') {
      activeMount = ranksGalleryView.mountRanksGalleryView(main, {
        ranks: app.ranks,
        catalog: app.catalog,
        onBack: () => {
          window.location.hash = '#/today';
        },
      });
    } else if (route === 'config') {
      activeMount = configView.mountConfigView(main, {
        onEditRanks: () => {
          window.location.hash = '#/rank-editor';
        },
        onBack: () => {
          window.location.hash = '#/today';
        },
      });
    } else if (route === 'rankEditor') {
      activeMount = rankEditorView.mountRankEditorView(main, {
        ranks: app.ranks,
        catalog: app.catalog,
        onBack: () => {
          window.location.hash = '#/config';
        },
      });
    } else {
      activeMount = todayView.mountTodayView(main, {
        dailyLog: app.dailyLog,
        catalog: app.catalog,
      });
    }

    return wrap;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.addEventListener('hashchange', () => render());

  window.__strank = {
    app,
    render,
    windowState,
    todayView,
    historyCalendarView,
    rankView,
    ranksGalleryView,
    configView,
    rankEditorView,
  };
})();
