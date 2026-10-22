/**
 * Build scripts/uninstall/Uninstall.cs → uninstall.exe with the Unranked badge icon.
 * Used by npm run dist (Windows). Requires .NET Framework csc.exe.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pngBufferToIco } = require('./dist-win');

const ROOT = path.resolve(__dirname, '..');
const CS_SRC = path.join(__dirname, 'uninstall', 'Uninstall.cs');
const BADGE_SVG = path.join(ROOT, 'data', 'badges', 'unranked.svg');
const WORK_DIR = path.join(ROOT, 'dist', '_uninstall-build');
const PNG_PATH = path.join(WORK_DIR, 'unranked.png');
const ICO_PATH = path.join(WORK_DIR, 'unranked.ico');

function findCsc() {
  const candidates = [
    process.env.WINDIR &&
      path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    process.env.WINDIR &&
      path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Rasterize a 256×256 Unranked-style badge (matches data/badges/unranked.svg colors).
 * Uses System.Drawing via PowerShell so we do not add image deps.
 */
function renderUnrankedPng(outPng) {
  fs.mkdirSync(path.dirname(outPng), { recursive: true });
  const ps = `
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$rect = New-Object System.Drawing.Rectangle 32, 32, 192, 192
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect,
  [System.Drawing.Color]::FromArgb(255, 0x8A, 0x7F, 0x72),
  [System.Drawing.Color]::FromArgb(255, 0x2E, 0x29, 0x24),
  90
)
$g.FillEllipse($brush, $rect)
$penOuter = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0x1F, 0x1B, 0x17), 7)
$g.DrawEllipse($penOuter, $rect)
$inner = New-Object System.Drawing.Rectangle 49, 49, 158, 158
$penInner = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(217, 0x9A, 0x8F, 0x82), 3.5)
$g.DrawEllipse($penInner, $inner)
$bmp.Save(${JSON.stringify(outPng)}, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $brush.Dispose(); $penOuter.Dispose(); $penInner.Dispose(); $bmp.Dispose()
`;
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', ps],
    { encoding: 'utf8', windowsHide: true }
  );
  if (result.status !== 0 || !fs.existsSync(outPng)) {
    throw new Error(
      `build-uninstall: failed to render Unranked PNG: ${result.stderr || result.stdout || 'unknown'}`
    );
  }
  if (!fs.existsSync(BADGE_SVG)) {
    throw new Error(`build-uninstall: missing badge source ${BADGE_SVG}`);
  }
}

function ensureUnrankedIco() {
  renderUnrankedPng(PNG_PATH);
  const ico = pngBufferToIco(fs.readFileSync(PNG_PATH));
  fs.writeFileSync(ICO_PATH, ico);
  return ICO_PATH;
}

/**
 * Compile uninstall.exe into outPath (absolute).
 * @param {string} outPath
 * @returns {string} outPath
 */
function buildUninstallExe(outPath) {
  if (process.platform !== 'win32') {
    throw new Error('build-uninstall: Windows only');
  }
  const csc = findCsc();
  if (!csc) {
    throw new Error('build-uninstall: csc.exe not found (.NET Framework 4.x required)');
  }
  if (!fs.existsSync(CS_SRC)) {
    throw new Error(`build-uninstall: missing ${CS_SRC}`);
  }

  fs.mkdirSync(WORK_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const icoPath = ensureUnrankedIco();

  const result = spawnSync(
    csc,
    [
      '/nologo',
      '/target:exe',
      '/optimize+',
      `/win32icon:${icoPath}`,
      `/out:${outPath}`,
      CS_SRC,
    ],
    { encoding: 'utf8', windowsHide: true }
  );
  if (result.status !== 0 || !fs.existsSync(outPath)) {
    throw new Error(
      `build-uninstall: csc failed:\n${result.stdout || ''}\n${result.stderr || ''}`
    );
  }
  return outPath;
}

function defaultOutPath() {
  return path.join(ROOT, 'dist', 'Strank-win-x64', 'uninstall.exe');
}

module.exports = {
  ROOT,
  CS_SRC,
  BADGE_SVG,
  WORK_DIR,
  findCsc,
  ensureUnrankedIco,
  buildUninstallExe,
  defaultOutPath,
};

if (require.main === module) {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : defaultOutPath();
  console.log('Building uninstall.exe →', out);
  buildUninstallExe(out);
  console.log('OK');
}
