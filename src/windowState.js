/**
 * Persist / restore NW.js window position and size across launches.
 *
 * Window managers / WindowBlinds often report a larger size than was passed to
 * resizeTo (frame chrome). We learn that delta after restore and subtract it
 * when saving so geometry does not ratchet upward every launch.
 */

const fs = require('fs');
const path = require('path');
const { getDataDir, windowStatePath } = require('./paths');

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

/** Last successfully captured (compensated) geometry. */
let lastGoodState = null;

/**
 * Extra pixels the WM adds on top of resizeTo() / moveTo() requests.
 * Learned after each apply by comparing requested vs measured size.
 */
let frameChrome = { w: 0, h: 0 };

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function resolveStatePath() {
  return windowStatePath();
}

function debugLog(message, extra) {
  try {
    let loggingOn = false;
    try {
      const config = require('./config');
      loggingOn = typeof config.isLoggingEnabled === 'function' && config.isLoggingEnabled();
    } catch (_) {
      loggingOn = false;
    }
    if (!loggingOn) return;
    const dir = getDataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = `[${new Date().toISOString()}] ${message}${
      extra !== undefined ? ` ${JSON.stringify(extra)}` : ''
    }\n`;
    fs.appendFileSync(path.join(dir, 'window-state.log'), line, 'utf8');
  } catch (_) {
    /* never throw from logging */
  }
}

function readState() {
  try {
    const file = resolveStatePath();
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    if (
      !isFiniteNumber(parsed.x) ||
      !isFiniteNumber(parsed.y) ||
      !isFiniteNumber(parsed.width) ||
      !isFiniteNumber(parsed.height)
    ) {
      return null;
    }
    return {
      x: Math.round(parsed.x),
      y: Math.round(parsed.y),
      width: Math.round(parsed.width),
      height: Math.round(parsed.height),
    };
  } catch (err) {
    debugLog('read failed', { message: err && err.message });
    return null;
  }
}

function writeState(state) {
  try {
    if (
      !state ||
      !isFiniteNumber(state.x) ||
      !isFiniteNumber(state.y) ||
      !isFiniteNumber(state.width) ||
      !isFiniteNumber(state.height)
    ) {
      debugLog('refuse invalid state', state);
      return false;
    }
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload = {
      x: Math.round(state.x),
      y: Math.round(state.y),
      width: Math.max(MIN_WIDTH, Math.round(state.width)),
      height: Math.max(MIN_HEIGHT, Math.round(state.height)),
    };
    const file = resolveStatePath();
    const json = JSON.stringify(payload, null, 2);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, json, 'utf8');
    try {
      fs.renameSync(tmp, file);
    } catch (_) {
      fs.writeFileSync(file, json, 'utf8');
      try {
        fs.unlinkSync(tmp);
      } catch (__) {
        /* ignore */
      }
    }
    lastGoodState = payload;
    debugLog('wrote state', { file, payload, frameChrome });
    return true;
  } catch (err) {
    debugLog('write failed', { message: err && err.message, stack: err && err.stack });
    return false;
  }
}

function coerceNumber(v) {
  try {
    if (typeof v === 'function') v = v.call(null);
  } catch (_) {
    return NaN;
  }
  return isFiniteNumber(v) ? v : NaN;
}

function firstFinite(...values) {
  for (const v of values) {
    const n = coerceNumber(v);
    if (isFiniteNumber(n)) return n;
  }
  return NaN;
}

function firstSize(...values) {
  for (const v of values) {
    const n = coerceNumber(v);
    if (isFiniteNumber(n) && n >= 50) return n;
  }
  return NaN;
}

function resolveDomWindow(win, domWindow) {
  if (domWindow) return domWindow;
  if (win && win.__strankDomWindow) return win.__strankDomWindow;
  if (win && win.window) return win.window;
  if (typeof window !== 'undefined') return window;
  return null;
}

/** Raw outer metrics from NW / DOM (includes frame chrome). */
function captureRaw(win, domWindow) {
  const w = resolveDomWindow(win, domWindow);
  const x = firstFinite(win && win.x, w && w.screenX, w && w.screenLeft);
  const y = firstFinite(win && win.y, w && w.screenY, w && w.screenTop);
  const width = firstSize(win && win.width, w && w.outerWidth);
  const height = firstSize(win && win.height, w && w.outerHeight);

  if (![x, y, width, height].every(isFiniteNumber)) {
    debugLog('capture miss', {
      hasDom: Boolean(w),
      winX: win && win.x,
      winY: win && win.y,
      winW: win && win.width,
      winH: win && win.height,
      outerWidth: w && w.outerWidth,
      outerHeight: w && w.outerHeight,
    });
    return null;
  }
  return { x, y, width, height };
}

/**
 * Metrics suitable for resizeTo/moveTo: strip learned frame chrome from size.
 * Position is left as reported (chrome usually does not shift x/y the same way).
 */
function captureFromWindow(win, domWindow) {
  const raw = captureRaw(win, domWindow);
  if (!raw) return null;
  return {
    x: raw.x,
    y: raw.y,
    width: Math.max(MIN_WIDTH, raw.width - frameChrome.w),
    height: Math.max(MIN_HEIGHT, raw.height - frameChrome.h),
  };
}

function learnFrameChrome(win, requested, domWindow) {
  const raw = captureRaw(win, domWindow);
  if (!raw || !requested) return;
  const dw = raw.width - requested.width;
  const dh = raw.height - requested.height;
  // Only accept plausible positive chrome (WindowBlinds is typically ~8-50px).
  if (dw >= 0 && dw <= 80) frameChrome.w = Math.round(dw);
  if (dh >= 0 && dh <= 100) frameChrome.h = Math.round(dh);
  debugLog('learned frame chrome', { frameChrome, requested, measured: raw });
}

function clampToScreen(state, screenWidth, screenHeight) {
  const availW = screenWidth || state.width;
  const availH = screenHeight || state.height;
  const width = Math.max(MIN_WIDTH, Math.min(state.width, availW));
  const height = Math.max(MIN_HEIGHT, Math.min(state.height, availH));
  const maxX = Math.max(0, availW - 80);
  const maxY = Math.max(0, availH - 80);
  const x = Math.min(Math.max(state.x, -width + 80), maxX);
  const y = Math.min(Math.max(state.y, 0), maxY);
  return { x, y, width, height };
}

function applyToWindow(win, state, domWindow) {
  if (!win || !state) return false;
  const w = resolveDomWindow(win, domWindow);
  const screenW = (w && w.screen && w.screen.availWidth) || state.width;
  const screenH = (w && w.screen && w.screen.availHeight) || state.height;
  const next = clampToScreen(state, screenW, screenH);
  try {
    win.moveTo(next.x, next.y);
    win.resizeTo(next.width, next.height);
    debugLog('applied state', next);
    // Learn chrome after the WM has applied framing.
    setTimeout(() => learnFrameChrome(win, next, domWindow), 50);
    setTimeout(() => learnFrameChrome(win, next, domWindow), 200);
    return true;
  } catch (err) {
    debugLog('apply resizeTo/moveTo failed', { message: err && err.message });
    try {
      win.x = next.x;
      win.y = next.y;
      win.width = next.width;
      win.height = next.height;
      setTimeout(() => learnFrameChrome(win, next, domWindow), 50);
      return true;
    } catch (err2) {
      debugLog('apply setters failed', { message: err2 && err2.message });
      return false;
    }
  }
}

function saveFromWindow(win, domWindow) {
  const captured = captureFromWindow(win, domWindow);
  if (!captured) {
    if (lastGoodState) {
      debugLog('capture failed - flushing lastGoodState');
      return writeState(lastGoodState);
    }
    return false;
  }
  lastGoodState = captured;
  return writeState(captured);
}

function flushLastGood() {
  if (!lastGoodState) {
    const fromDisk = readState();
    if (fromDisk) lastGoodState = fromDisk;
  }
  if (!lastGoodState) {
    debugLog('flushLastGood: nothing to write');
    return false;
  }
  return writeState(lastGoodState);
}

/**
 * Single owner for move/resize/close persistence.
 * Restore before any save so defaults cannot clobber the file.
 */
function attachLifecycle(win, options = {}) {
  if (!win) {
    debugLog('attachLifecycle: no win');
    return false;
  }

  if (options.domWindow) {
    win.__strankDomWindow = options.domWindow;
  }

  debugLog('attachLifecycle', {
    alreadyBound: Boolean(win.__strankStateBound),
    hasDom: Boolean(win.__strankDomWindow || (win && win.window)),
    statePath: resolveStatePath(),
    cwd: process.cwd(),
  });

  if (win.__strankStateBound) {
    return false;
  }

  win.__strankStateBound = true;
  const shouldQuit = options.quit !== false;
  let saveTimer = null;
  let suppressSaves = true;
  let restoredOnce = false;

  const saveNow = (reason, { force = false } = {}) => {
    if (suppressSaves && !force) {
      debugLog(`saveNow:${reason || 'unknown'} suppressed`);
      return false;
    }
    try {
      const ok = saveFromWindow(win, resolveDomWindow(win, win.__strankDomWindow));
      debugLog(`saveNow:${reason || 'unknown'}`, { ok, frameChrome });
      return ok;
    } catch (err) {
      debugLog(`saveNow:${reason || 'unknown'} threw`, { message: err && err.message });
      return false;
    }
  };

  const saveDebounced = () => {
    if (suppressSaves) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveNow('debounced');
    }, 150);
  };

  const enableSaves = () => {
    suppressSaves = false;
    debugLog('saves enabled', { frameChrome });
  };

  const restoreOnce = (reason) => {
    if (restoredOnce) return;
    const file = resolveStatePath();
    const fileExists = fs.existsSync(file);
    const saved = readState();
    if (!saved) {
      if (fileExists) {
        debugLog(`restore:${reason} - file present but unreadable, will retry`);
        return;
      }
      debugLog(`restore:${reason} - no saved state, enabling saves`);
      restoredOnce = true;
      enableSaves();
      return;
    }
    restoredOnce = true;
    suppressSaves = true;
    debugLog(`restore:${reason}`, { saved });
    applyToWindow(win, saved, resolveDomWindow(win, win.__strankDomWindow));
    lastGoodState = { ...saved };
    // Wait for chrome learning + WM settle before allowing saves.
    setTimeout(enableSaves, 500);
  };

  try {
    win.on('move', saveDebounced);
    win.on('resize', saveDebounced);
  } catch (err) {
    debugLog('move/resize bind failed', { message: err && err.message });
  }

  try {
    win.on('loaded', () => restoreOnce('loaded'));
  } catch (_) {
    /* ignore */
  }

  win.on('close', () => {
    debugLog('close event', { frameChrome });
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const ok = saveNow('close', { force: true });
    if (!ok) flushLastGood();

    try {
      win.close(true);
    } catch (_) {
      /* ignore */
    }
    if (shouldQuit) {
      try {
        const nwApi =
          (typeof nw !== 'undefined' && nw) ||
          (typeof global !== 'undefined' && global.nw) ||
          null;
        if (nwApi && nwApi.App) nwApi.App.quit();
      } catch (_) {
        /* ignore */
      }
    }
  });

  restoreOnce('attach');
  setTimeout(() => restoreOnce('t200'), 200);
  setTimeout(() => restoreOnce('t600'), 600);
  // Re-assert position/size once after WM may have adjusted the first apply.
  setTimeout(() => {
    if (!lastGoodState) return;
    suppressSaves = true;
    debugLog('re-assert restore', lastGoodState);
    applyToWindow(win, lastGoodState, resolveDomWindow(win, win.__strankDomWindow));
    setTimeout(enableSaves, 400);
  }, 800);

  // After geometry restore settles, honor Config fullscreen -> maximize.
  const applyFullscreenFromConfig = () => {
    try {
      const config = require('./config');
      if (!config.get) return;
      applyFullscreenPreference(win, Boolean(config.get().fullscreen));
    } catch (_) {
      /* ignore */
    }
  };
  setTimeout(applyFullscreenFromConfig, 1000);

  setInterval(() => saveNow('interval'), 2000);

  return true;
}

/**
 * Apply Config `fullscreen` preference: maximize when true, restore when false.
 * (Config key is "fullscreen"; behavior is window maximize, not OS exclusive fullscreen.)
 */
function applyFullscreenPreference(win, enabled) {
  if (!win) return false;
  try {
    if (enabled) {
      if (typeof win.maximize === 'function') {
        win.maximize();
        debugLog('fullscreen preference: maximize');
        return true;
      }
    } else if (typeof win.unmaximize === 'function') {
      win.unmaximize();
      debugLog('fullscreen preference: unmaximize');
      return true;
    } else if (typeof win.restore === 'function') {
      win.restore();
      debugLog('fullscreen preference: restore');
      return true;
    }
  } catch (err) {
    debugLog('fullscreen preference failed', { message: err && err.message });
  }
  return false;
}

module.exports = {
  readState,
  writeState,
  captureFromWindow,
  captureRaw,
  clampToScreen,
  applyToWindow,
  saveFromWindow,
  flushLastGood,
  attachLifecycle,
  applyFullscreenPreference,
  resolveStatePath,
  debugLog,
  MIN_WIDTH,
  MIN_HEIGHT,
};
