/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 *
 * NW.js shell UI — no login. Feature 7+ will replace the placeholder landing.
 */

(function bootUi() {
  const app = require('./app.js');
  const windowState = require('./windowState.js');
  const root = document.getElementById('app');

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
      console.warn('[ui] nw API unavailable — window state will not persist');
      return;
    }

    let win;
    try {
      win = nwApi.Window.get();
    } catch (err) {
      console.warn('[ui] nw.Window.get failed:', err && err.message);
      return;
    }

    const saveNow = () => {
      const ok = windowState.saveFromWindow(win, window);
      if (!ok) {
        // Retry once shortly — outer metrics can be 0 on the first tick
        setTimeout(() => windowState.saveFromWindow(win, window), 50);
      }
      return ok;
    };

    const restore = () => {
      const saved = windowState.readState();
      if (!saved) return;
      windowState.applyToWindow(win, saved, window);
    };

    // package.json size applies first; restore after show/load
    try {
      win.on('loaded', restore);
    } catch (_) {
      /* ignore */
    }
    setTimeout(restore, 0);
    setTimeout(restore, 150);
    setTimeout(restore, 400);

    // Persist while the app is open (does not rely on close events alone)
    setTimeout(saveNow, 300);
    setInterval(saveNow, 2000);

    try {
      win.on('move', saveNow);
      win.on('resize', saveNow);
    } catch (err) {
      console.warn('[ui] move/resize listeners failed:', err && err.message);
    }

    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);

    // X / Alt+F4: save then quit the whole NW process
    win.on('close', function onClose() {
      try {
        windowState.saveFromWindow(this, window);
      } catch (err) {
        console.warn('[ui] save on close failed:', err && err.message);
      }
      try {
        this.close(true);
      } catch (_) {
        /* ignore */
      }
      try {
        nwApi.App.quit();
      } catch (_) {
        /* ignore */
      }
    });
  }

  function render() {
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
        <span class="nav-stub" title="Feature 9">Workout History</span>
        <span class="nav-stub" title="Feature 10">Ranks</span>
        <span class="nav-stub" title="Feature 11">Config</span>
      </nav>
      <main class="shell-main">
        <section class="panel">
          <h1>Ready</h1>
          <p class="status-ok">Offline foundation loaded. No sign-in required.</p>
          <p>Landing, workouts, and history screens arrive in later features. Catalog and ranks are available to the app runtime.</p>
          <div class="stats">
            <div class="stat"><span class="label">Exercises</span><span class="value">${state.catalog.length}</span></div>
            <div class="stat"><span class="label">Rank tiers</span><span class="value">${state.ranks.length}</span></div>
            <div class="stat"><span class="label">Saved entries</span><span class="value">${state.store.entries.length}</span></div>
          </div>
        </section>
      </main>
    `;
    return wrap;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.__strank = { app, render, windowState };
})();
