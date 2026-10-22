/**
 * NW.js node-main - runs in Node before/alongside the window.
 * Polls for the window because it often does not exist yet at boot,
 * and Window.on('new') can miss the already-creating main window.
 */

const windowState = require('./windowState');

windowState.debugLog('node-main boot', {
  cwd: process.cwd(),
  statePath: windowState.resolveStatePath(),
});

function bind(win, source) {
  if (!win) return false;
  windowState.debugLog(`node-main bind via ${source}`);
  windowState.attachLifecycle(win, { quit: true });
  return true;
}

function tryBindExisting() {
  try {
    const win = nw.Window.get();
    if (win) return bind(win, 'Window.get');
  } catch (err) {
    windowState.debugLog('node-main Window.get failed', { message: err && err.message });
  }
  return false;
}

function boot() {
  if (!tryBindExisting()) {
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (tryBindExisting() || tries > 200) {
        clearInterval(id);
        if (tries > 200) windowState.debugLog('node-main gave up polling for window');
      }
    }, 50);
  }

  try {
    nw.Window.on('new', (win) => {
      bind(win, 'Window.on(new)');
    });
  } catch (err) {
    windowState.debugLog('node-main Window.on(new) failed', { message: err && err.message });
  }
}

boot();
