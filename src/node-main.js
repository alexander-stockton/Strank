/**
 * NW.js node-main entry — runs in Node context before/alongside the window.
 * Ensures window geometry is saved even if the page script misses the close event.
 */

const windowState = require('./windowState');

function attach(win) {
  if (!win || win.__strankStateBound) return;
  win.__strankStateBound = true;

  const save = () => {
    try {
      // DOM window may not exist here; use NW props when available
      const state = {
        x: win.x,
        y: win.y,
        width: win.width,
        height: win.height,
      };
      if (
        typeof state.x === 'number' &&
        typeof state.y === 'number' &&
        typeof state.width === 'number' &&
        typeof state.height === 'number' &&
        Number.isFinite(state.x) &&
        Number.isFinite(state.y) &&
        Number.isFinite(state.width) &&
        Number.isFinite(state.height) &&
        state.width >= 50 &&
        state.height >= 50
      ) {
        windowState.writeState(state);
      }
    } catch (err) {
      console.warn('[node-main] save failed:', err && err.message);
    }
  };

  win.on('move', save);
  win.on('resize', save);
  win.on('close', () => {
    save();
    try {
      win.close(true);
    } catch (_) {
      /* ignore */
    }
    try {
      nw.App.quit();
    } catch (_) {
      /* ignore */
    }
  });
}

function boot() {
  try {
    const win = nw.Window.get();
    if (win) attach(win);
  } catch (_) {
    /* window may not exist yet */
  }

  // When any window opens, bind it
  try {
    nw.Window.on('new', (win) => {
      attach(win);
      win.on('loaded', () => {
        const saved = windowState.readState();
        if (saved) windowState.applyToWindow(win, saved);
      });
    });
  } catch (_) {
    /* older NW may not support Window.on('new') */
  }
}

boot();
