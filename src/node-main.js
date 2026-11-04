/**
 * NW.js node-main - runs in Node before/alongside the window.
 * Polls for the window because it often does not exist yet at boot,
 * and Window.on('new') can miss the already-creating main window.
 */

const networkGuard = require('./networkGuard');
const windowState = require('./windowState');

// Block Node outbound APIs as early as possible (before UI bootstrap).
// Chromium C++ networking is killed separately via package.json chromium-args
// (see src/chromiumOfflineArgs.js). Under no circumstances may Strank use the net.
try {
  networkGuard.install();
} catch (_) {
  /* ignore */
}

// Refuse common proxy env vars that could route traffic off-box.
try {
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.ALL_PROXY;
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  delete process.env.all_proxy;
  process.env.NO_PROXY = '*';
  process.env.no_proxy = '*';
} catch (_) {
  /* ignore */
}

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
