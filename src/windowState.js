/**
 * Persist / restore NW.js window position and size across launches.
 */

const fs = require('fs');
const path = require('path');
const { getDataDir, windowStatePath } = require('./paths');

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function resolveStatePath() {
  // Prefer paths module; also try cwd (nw . usually sets cwd to the project).
  const candidates = [
    windowStatePath(),
    path.join(process.cwd(), 'data', 'window-state.json'),
  ];
  return candidates[0];
}

function readState() {
  try {
    const file = resolveStatePath();
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
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
    console.warn('[windowState] read failed:', err && err.message);
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
      console.warn('[windowState] refuse to write invalid state:', state);
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
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn('[windowState] write failed:', err && err.message);
    return false;
  }
}

function firstFinite(...values) {
  for (const v of values) {
    if (isFiniteNumber(v)) return v;
  }
  return NaN;
}

/**
 * Prefer Chromium DOM outer metrics (reliable in the page). Fall back to NW Window props.
 */
function captureFromWindow(win, domWindow) {
  const w = domWindow || (typeof window !== 'undefined' ? window : null);
  const x = firstFinite(w && w.screenX, w && w.screenLeft, win && win.x);
  const y = firstFinite(w && w.screenY, w && w.screenTop, win && win.y);
  const width = firstFinite(w && w.outerWidth, win && win.width);
  const height = firstFinite(w && w.outerHeight, win && win.height);
  if (![x, y, width, height].every(isFiniteNumber)) {
    return null;
  }
  if (width < 50 || height < 50) {
    return null;
  }
  return { x, y, width, height };
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
  const w = domWindow || (typeof window !== 'undefined' ? window : null);
  const screenW = (w && w.screen && w.screen.availWidth) || state.width;
  const screenH = (w && w.screen && w.screen.availHeight) || state.height;
  const next = clampToScreen(state, screenW, screenH);
  try {
    win.resizeTo(next.width, next.height);
    win.moveTo(next.x, next.y);
    return true;
  } catch (err) {
    console.warn('[windowState] apply via resizeTo/moveTo failed:', err && err.message);
    try {
      win.width = next.width;
      win.height = next.height;
      win.x = next.x;
      win.y = next.y;
      return true;
    } catch (err2) {
      console.warn('[windowState] apply via setters failed:', err2 && err2.message);
      return false;
    }
  }
}

function saveFromWindow(win, domWindow) {
  const captured = captureFromWindow(win, domWindow);
  if (!captured) {
    return false;
  }
  return writeState(captured);
}

module.exports = {
  readState,
  writeState,
  captureFromWindow,
  clampToScreen,
  applyToWindow,
  saveFromWindow,
  resolveStatePath,
  MIN_WIDTH,
  MIN_HEIGHT,
};
