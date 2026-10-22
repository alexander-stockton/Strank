/**
 * Feature 19 - Packaging & Distribution
 * Spec: features/feature-19-Packaging-Distribution.md
 *
 * Offline first-run setup (installer-like UI). All payload files come from the
 * bundled package - no network. Skipped in unpackaged `npm start` / Jest.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const paths = require('./paths');

const STATE_FILE = 'setup-state.json';

/** Names never copied into the install destination (runtime junk / self-locks). */
const SKIP_NAMES = new Set([
  'node_modules',
  '.git',
  '.strank-user-data',
  'dist',
  'tests',
  'features',
  '.gitignore',
]);

function statePath() {
  return path.join(paths.getCanonicalUserDataDir(), STATE_FILE);
}

function readState() {
  try {
    const p = statePath();
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return raw && typeof raw === 'object' ? raw : null;
  } catch (_) {
    return null;
  }
}

function writeState(state) {
  const dir = paths.getCanonicalUserDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function isSetupComplete() {
  const s = readState();
  return Boolean(s && s.completed);
}

/**
 * Show installer only for packaged builds that have not finished setup.
 * Dev (`nw .`) never shows it.
 */
function shouldShow() {
  if (typeof paths.isPackaged === 'function' && !paths.isPackaged())
    return false;
  if (isSetupComplete()) return false;
  return true;
}

function defaultInstallDir() {
  const local =
    process.env.LOCALAPPDATA ||
    process.env.STRANK_LOCALAPPDATA ||
    path.join(os.homedir(), 'AppData', 'Local');
  return path.join(local, 'Programs', 'Strank');
}

function packageSourceDir() {
  return paths.getInstallDir();
}

function samePath(a, b) {
  try {
    return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
  } catch (_) {
    return false;
  }
}

function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Recursively copy package files. Offline only - local filesystem.
 * @param {string} src
 * @param {string} dest
 * @param {(info: { copied: number, current: string }) => void} [onProgress]
 * @returns {{ copied: number }}
 */
function copyTree(src, dest, onProgress) {
  let copied = 0;
  const walk = (from, to) => {
    const st = fs.statSync(from);
    if (st.isDirectory()) {
      if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
      for (const name of fs.readdirSync(from)) {
        if (SKIP_NAMES.has(name)) continue;
        walk(path.join(from, name), path.join(to, name));
      }
      return;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied += 1;
    if (typeof onProgress === 'function') {
      onProgress({ copied, current: to });
    }
  };
  walk(src, dest);
  return { copied };
}

/**
 * Prefer assets/icon.ico (from icon.png), then PNG, then the exe itself.
 * @param {string} installOrWorkDir
 * @param {string} [targetExe]
 * @returns {string}
 */
function resolveShortcutIcon(installOrWorkDir, targetExe) {
  const ico = path.join(installOrWorkDir, 'assets', 'icon.ico');
  if (fs.existsSync(ico)) return ico;
  const png = path.join(installOrWorkDir, 'assets', 'icon.png');
  if (fs.existsSync(png)) return png;
  if (targetExe && fs.existsSync(targetExe)) return targetExe;
  return path.join(installOrWorkDir, 'Strank.exe');
}

/**
 * Create a Windows .lnk shortcut (offline COM via PowerShell).
 * Icon matches assets/icon.png via the packaged .ico (same badge as the exe).
 * @returns {{ ok: boolean, path?: string, icon?: string, message?: string }}
 */
function createDesktopShortcut(targetExe) {
  try {
    const desktop = process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, 'Desktop')
      : path.join(os.homedir(), 'Desktop');
    if (!fs.existsSync(desktop)) {
      return { ok: false, message: 'desktop-missing' };
    }
    const linkPath = path.join(desktop, 'Strank.lnk');
    const workDir = path.dirname(targetExe);
    const iconPath = resolveShortcutIcon(workDir, targetExe);
    const ps = [
      `$s = New-Object -ComObject WScript.Shell`,
      `$l = $s.CreateShortcut(${JSON.stringify(linkPath)})`,
      `$l.TargetPath = ${JSON.stringify(targetExe)}`,
      `$l.WorkingDirectory = ${JSON.stringify(workDir)}`,
      `$l.Description = 'Strank'`,
      `$l.IconLocation = ${JSON.stringify(`${iconPath},0`)}`,
      `$l.Save()`,
    ].join('; ');
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ps],
      { windowsHide: true, encoding: 'utf8' },
    );
    if (result.status !== 0) {
      return { ok: false, message: result.stderr || 'shortcut-failed' };
    }
    return { ok: true, path: linkPath, icon: iconPath };
  } catch (err) {
    return {
      ok: false,
      message: err && err.message ? err.message : String(err),
    };
  }
}

/**
 * Run offline install: copy bundled package -> dest, seed user data, mark done.
 * @param {{
 *   destDir?: string,
 *   createShortcut?: boolean,
 *   onProgress?: (info: { phase: string, copied?: number, current?: string }) => void,
 * }} [options]
 */
function runInstall(options = {}) {
  const source = packageSourceDir();
  const dest = path.resolve(options.destDir || defaultInstallDir());
  const onProgress =
    typeof options.onProgress === 'function' ? options.onProgress : () => {};

  if (isInside(dest, source) && !samePath(dest, source)) {
    return { ok: false, message: 'dest-inside-source' };
  }

  onProgress({ phase: 'prepare' });

  let copied = 0;
  if (samePath(dest, source)) {
    // Install in place (already running from the chosen folder).
    onProgress({ phase: 'copy', copied: 0, current: dest });
  } else {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const result = copyTree(source, dest, (info) => {
      copied = info.copied;
      onProgress({ phase: 'copy', copied: info.copied, current: info.current });
    });
    copied = result.copied;
  }

  onProgress({ phase: 'seed' });
  if (typeof paths.ensureUserDataSeeded === 'function') {
    paths.ensureUserDataSeeded();
  }

  const exeName = process.platform === 'win32' ? 'Strank.exe' : 'Strank';
  const installedExe = path.join(dest, exeName);
  const launchExe = fs.existsSync(installedExe)
    ? installedExe
    : process.execPath;

  let shortcut = null;
  if (options.createShortcut !== false && process.platform === 'win32') {
    onProgress({ phase: 'shortcut' });
    shortcut = createDesktopShortcut(launchExe);
  }

  writeState({
    completed: true,
    completedAt: new Date().toISOString(),
    installDir: dest,
    offline: true,
  });

  onProgress({ phase: 'done', copied });
  return {
    ok: true,
    offline: true,
    destDir: dest,
    launchExe,
    copied,
    shortcut,
    relaunchNeeded: !samePath(dest, source) && fs.existsSync(installedExe),
  };
}

function markComplete(extra = {}) {
  writeState({
    completed: true,
    completedAt: new Date().toISOString(),
    offline: true,
    ...extra,
  });
}

/**
 * Launch installed exe and quit this process (packaged only).
 */
function relaunchFrom(exePath, quitFn) {
  try {
    const child = spawn(exePath, [], {
      detached: true,
      stdio: 'ignore',
      cwd: path.dirname(exePath),
    });
    child.unref();
  } catch (_) {
    /* fall through to quit */
  }
  if (typeof quitFn === 'function') quitFn();
  else if (
    typeof nw !== 'undefined' &&
    nw.App &&
    typeof nw.App.quit === 'function'
  ) {
    nw.App.quit();
  }
}

module.exports = {
  STATE_FILE,
  shouldShow,
  isSetupComplete,
  readState,
  writeState,
  markComplete,
  defaultInstallDir,
  packageSourceDir,
  runInstall,
  copyTree,
  resolveShortcutIcon,
  createDesktopShortcut,
  relaunchFrom,
  samePath,
};
