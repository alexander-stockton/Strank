/**
 * Feature 1 — App Foundation
 * Feature 2 — Daily Exercise Log
 * Spec: features/feature-2-Daily-Exercise-Log.md
 *
 * NW.js shell UI — no login. Today is the Feature 2 route; later features add more screens.
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
  try {
    app = require('./app.js');
    todayView = require('./todayView.js');
  } catch (err) {
    windowState.debugLog('ui app require failed', { message: err && err.message, stack: err && err.stack });
    throw err;
  }

  const root = document.getElementById('app');
  let todayMount = null;
  setupWindowLifecycle();
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
    if (hash === '/today' || hash === 'today' || hash === '' || hash === '/') return 'today';
    return 'today';
  }

  function render() {
    if (todayMount) {
      todayMount.destroy();
      todayMount = null;
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

  function renderShell(state) {
    const wrap = document.createElement('div');
    wrap.dataset.view = 'shell';
    wrap.innerHTML = `
      <header class="shell-header">
        <div class="brand">Strank</div>
        <div class="local-date" id="local-date">${escapeHtml(state.localDate)}</div>
      </header>
      <nav class="shell-nav" aria-label="Main">
        <a class="nav-link active" href="#/today" data-route="today">Today</a>
        <span class="nav-stub" title="Feature 9">Workout History</span>
        <span class="nav-stub" title="Feature 10">Ranks</span>
        <span class="nav-stub" title="Feature 11">Config</span>
      </nav>
      <main class="shell-main" id="shell-main"></main>
    `;

    const main = wrap.querySelector('#shell-main');
    const route = currentRoute();
    if (route === 'today') {
      todayMount = todayView.mountTodayView(main, {
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

  window.__strank = { app, render, windowState, todayView };
})();
