/**
 * Feature 19 - Packaging & Distribution
 * Spec: features/feature-19-Packaging-Distribution.md
 *
 * Windows x64 NW.js package -> dist/Strank-win-x64/Strank.exe
 *
 * Usage: npm run dist
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGE_DIR = path.join(ROOT, 'dist', '_stage');
const OUT_DIR = path.join(ROOT, 'dist', 'Strank-win-x64');
const ICON_PNG = path.join(ROOT, 'assets', 'icon.png');
const ICON_ICO = path.join(ROOT, 'assets', 'icon.ico');

/** Relative paths copied into the package (install defaults + runtime). */
const INCLUDE_PATHS = [
  'index.html',
  'package.json',
  'src',
  'assets',
  'AI use',
  'data/format.txt',
  'data/ranks.txt',
  'data/defaults',
  'data/badges',
  'data/localization',
  'node_modules/jszip',
];

/** End-user readme (repo file -> packaged as README.md). Not the developer README.md. */
const USER_README_SRC = 'README.user.md';
const USER_README_DEST = 'README.md';

/**
 * Wrap a PNG buffer as a Windows .ico (PNG-compressed, Vista+).
 * Source of truth remains assets/icon.png; the .ico is for exe + shortcut.
 * @param {Buffer} pngBuffer
 * @returns {Buffer}
 */
function pngBufferToIco(pngBuffer) {
  if (!Buffer.isBuffer(pngBuffer) || pngBuffer.length < 24) {
    throw new Error('dist: icon.png is missing or invalid');
  }
  if (pngBuffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('dist: icon.png is not a PNG');
  }
  const width = pngBuffer.readUInt32BE(16);
  const height = pngBuffer.readUInt32BE(20);
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type = icon
  dir.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12); // offset = 6 + 16
  return Buffer.concat([dir, entry, pngBuffer]);
}

/**
 * Ensure assets/icon.ico matches assets/icon.png (exe + shortcut icon).
 * @param {{ outPath?: string, pngPath?: string }} [options]
 * @returns {string} absolute path to the .ico
 */
function ensureAppIconIco(options = {}) {
  const pngPath = options.pngPath || ICON_PNG;
  const outPath = options.outPath || ICON_ICO;
  if (!fs.existsSync(pngPath)) {
    throw new Error(`dist: missing app icon ${pngPath}`);
  }
  const ico = pngBufferToIco(fs.readFileSync(pngPath));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, ico);
  return outPath;
}

function getDistDir() {
  return OUT_DIR;
}

function getDistExePath() {
  return path.join(OUT_DIR, 'Strank.exe');
}

function rmrf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === 'node_modules' && path.basename(src) !== 'jszip') continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * Build a slim stage tree (no tests, no SDK, no user store).
 * @returns {string} stage directory
 */
function prepareStage() {
  rmrf(STAGE_DIR);
  fs.mkdirSync(STAGE_DIR, { recursive: true });

  // Keep exe/shortcut icon in sync with the PNG badge before staging assets.
  ensureAppIconIco();

  for (const rel of INCLUDE_PATHS) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) {
      throw new Error(`dist: missing required path ${rel}`);
    }
    copyRecursive(src, path.join(STAGE_DIR, rel));
  }

  const userReadmeSrc = path.join(ROOT, USER_README_SRC);
  if (!fs.existsSync(userReadmeSrc)) {
    throw new Error(`dist: missing required path ${USER_README_SRC}`);
  }
  fs.copyFileSync(userReadmeSrc, path.join(STAGE_DIR, USER_README_DEST));

  // Production-lean package.json (keep NW window entry; drop dev tooling).
  const pkgPath = path.join(STAGE_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const { CHROMIUM_OFFLINE_ARGS } = require(
    path.join(ROOT, 'src', 'chromiumOfflineArgs'),
  );
  pkg.name = 'strank';
  pkg.product_string = 'Strank';
  if (!pkg.window || typeof pkg.window !== 'object') pkg.window = {};
  pkg.window.icon = 'assets/icon.png';
  // Always stamp offline Chromium switches into the packaged manifest.
  pkg['chromium-args'] = CHROMIUM_OFFLINE_ARGS;
  delete pkg.devDependencies;
  delete pkg.jest;
  pkg.scripts = { start: 'nw .' };
  if (!pkg.dependencies) pkg.dependencies = {};
  pkg.dependencies.jszip =
    pkg.dependencies.jszip ||
    require(path.join(ROOT, 'package.json')).dependencies.jszip;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  return STAGE_DIR;
}

/**
 * Ensure the built folder exposes Strank.exe (nw-builder may emit package name).
 * @param {string} outDir
 * @returns {string} absolute path to Strank.exe
 */
function ensureStrankExe(outDir) {
  const wanted = path.join(outDir, 'Strank.exe');
  if (fs.existsSync(wanted)) return wanted;

  const candidates = ['nw.exe', 'strank.exe', 'Strank.exe'];
  for (const name of fs.readdirSync(outDir)) {
    if (!/\.exe$/i.test(name)) continue;
    const lower = name.toLowerCase();
    if (candidates.includes(lower) || lower === 'strank.exe') {
      const from = path.join(outDir, name);
      if (path.resolve(from) !== path.resolve(wanted)) {
        fs.copyFileSync(from, wanted);
        try {
          fs.unlinkSync(from);
        } catch (_) {
          /* keep original if locked */
        }
      }
      return wanted;
    }
  }
  throw new Error(`dist: Strank.exe not found under ${outDir}`);
}

/**
 * @param {{ skipNwBuild?: boolean, stageOnly?: boolean }} [options]
 * @returns {Promise<{ outDir: string, exePath: string }>}
 */
async function buildWindowsDist(options = {}) {
  prepareStage();
  if (options.stageOnly) {
    return { outDir: STAGE_DIR, exePath: '' };
  }

  rmrf(OUT_DIR);
  fs.mkdirSync(path.dirname(OUT_DIR), { recursive: true });

  if (!options.skipNwBuild) {
    const nwbuild = (await import('nw-builder')).default;
    const rootPkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
    );
    const nwVersion =
      (rootPkg.devDependencies &&
        String(rootPkg.devDependencies.nw || '').replace(/^\^/, '')) ||
      '0.92.0';

    const iconIco = ensureAppIconIco({
      outPath: path.join(STAGE_DIR, 'assets', 'icon.ico'),
    });

    await nwbuild({
      mode: 'build',
      flavor: 'normal',
      platform: 'win',
      arch: 'x64',
      version: nwVersion,
      srcDir: STAGE_DIR,
      outDir: OUT_DIR,
      glob: false,
      cacheDir: path.join(ROOT, 'node_modules', 'nw'),
      app: {
        name: 'Strank',
        productName: 'Strank',
        company: 'Strank',
        fileDescription: 'Strank',
        fileVersion: String(rootPkg.version || '0.1.0'),
        productVersion: String(rootPkg.version || '0.1.0'),
        internalName: 'Strank',
        originalFilename: 'Strank.exe',
        // Windows Explorer / taskbar / shortcut: embedded .ico from assets/icon.png
        icon: iconIco,
      },
    });
  }

  const exePath = ensureStrankExe(OUT_DIR);

  // Console uninstaller with Unranked badge icon (always beside Strank.exe).
  const { buildUninstallExe } = require('./build-uninstall');
  const uninstallPath = path.join(OUT_DIR, 'uninstall.exe');
  buildUninstallExe(uninstallPath);

  return { outDir: OUT_DIR, exePath, uninstallPath };
}

/**
 * Test helper: write a fake nw.exe layout then rename to Strank.exe.
 * @param {string} outDir
 */
function simulateNwBuildOutput(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'nw.exe'), 'fake-nw-runtime');
  fs.writeFileSync(path.join(outDir, 'package.json'), '{"name":"strank"}\n');
  return ensureStrankExe(outDir);
}

async function main() {
  console.log('Feature 19: building Windows x64 package...');
  console.log(`  stage: ${STAGE_DIR}`);
  console.log(`  out:   ${OUT_DIR}`);
  const result = await buildWindowsDist();
  console.log(`OK: ${result.exePath}`);
}

module.exports = {
  ROOT,
  STAGE_DIR,
  OUT_DIR,
  INCLUDE_PATHS,
  USER_README_SRC,
  USER_README_DEST,
  ICON_PNG,
  ICON_ICO,
  getDistDir,
  getDistExePath,
  pngBufferToIco,
  ensureAppIconIco,
  prepareStage,
  ensureStrankExe,
  buildWindowsDist,
  simulateNwBuildOutput,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
}
