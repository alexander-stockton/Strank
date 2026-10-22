/**
 * Feature 19 -- Packaging & Distribution
 * Spec: features/feature-19-Packaging-Distribution.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 19 - packaging', () => {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  it('Dist script produces Strank.exe', () => {
    expect(pkg.scripts && pkg.scripts.dist).toMatch(/dist-win/);
    const distWin = require('../scripts/dist-win.js');
    expect(distWin.getDistExePath()).toBe(
      path.join(root, 'dist', 'Strank-win-x64', 'Strank.exe')
    );

    const fakeOut = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-dist-'));
    try {
      const exe = distWin.simulateNwBuildOutput(fakeOut);
      expect(path.basename(exe)).toBe('Strank.exe');
      expect(fs.existsSync(exe)).toBe(true);
    } finally {
      fs.rmSync(fakeOut, { recursive: true, force: true });
    }

    // Optional full build smoke (downloads NW runtime): STRANK_DIST_SMOKE=1 npm test
    if (process.env.STRANK_DIST_SMOKE === '1') {
      const { spawnSync } = require('child_process');
      const result = spawnSync('npm', ['run', 'dist'], {
        cwd: root,
        encoding: 'utf8',
        shell: true,
        timeout: 10 * 60 * 1000,
      });
      expect(result.status).toBe(0);
      expect(fs.existsSync(distWin.getDistExePath())).toBe(true);
    }
  });

  it('Dev start still works', () => {
    expect(pkg.scripts && pkg.scripts.start).toMatch(/\bnw\b/);
    expect(fs.existsSync(path.join(root, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'package.json'))).toBe(true);
    const docs = fs.readFileSync(path.join(root, 'docs', 'packaging.md'), 'utf8');
    expect(docs).toMatch(/npm start/);
    expect(docs).toMatch(/npm run dist/);
    expect(docs).toMatch(/Strank\.exe/);
    expect(docs).toMatch(/APPDATA|AppData/i);
  });

  it('packages chromium offline flags and early network guard', () => {
    const { CHROMIUM_OFFLINE_ARGS } = require('../src/chromiumOfflineArgs');
    expect(String(pkg['chromium-args'] || '')).toBe(CHROMIUM_OFFLINE_ARGS);
    expect(CHROMIUM_OFFLINE_ARGS).toMatch(/disable-background-networking/);
    expect(CHROMIUM_OFFLINE_ARGS).toMatch(/disable-component-update/);
    expect(CHROMIUM_OFFLINE_ARGS).toMatch(/host-resolver-rules=MAP \* ~NOTFOUND/);
    expect(CHROMIUM_OFFLINE_ARGS).toMatch(/dns-over-https-mode=off/);
    expect(CHROMIUM_OFFLINE_ARGS).toMatch(/disable-quic/);
    expect(CHROMIUM_OFFLINE_ARGS).toMatch(/disable-webrtc/);
    const nodeMain = fs.readFileSync(path.join(root, 'src', 'node-main.js'), 'utf8');
    expect(nodeMain).toMatch(/networkGuard/);
    const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(indexHtml).toMatch(/connect-src 'none'/);
    const distWin = require('../scripts/dist-win.js');
    distWin.prepareStage();
    const stagedPkg = JSON.parse(
      fs.readFileSync(path.join(distWin.STAGE_DIR, 'package.json'), 'utf8')
    );
    expect(stagedPkg['chromium-args']).toBe(CHROMIUM_OFFLINE_ARGS);
  });

  it('dist stage includes AI use file for Contributing', () => {
    const distWin = require('../scripts/dist-win.js');
    expect(distWin.INCLUDE_PATHS).toContain('AI use');
    expect(fs.existsSync(path.join(root, 'AI use'))).toBe(true);
    distWin.prepareStage();
    expect(fs.existsSync(path.join(distWin.STAGE_DIR, 'AI use'))).toBe(true);
    const staged = fs.readFileSync(path.join(distWin.STAGE_DIR, 'AI use'), 'utf8');
    expect(staged).toMatch(/discord\.gg/);
    expect(staged).toMatch(/Tooltip text/);
    expect(staged).toMatch(/offline emphasis and installer/);
    const enBody = fs.readFileSync(
      path.join(root, 'data', 'localization', 'en', 'ui-contributing.txt'),
      'utf8'
    );
    expect(enBody).toMatch(/contributing\.aiUseBody:/);
    expect(enBody).toMatch(/offline emphasis and installer/);
  });

  it('exe/shortcut icon is generated from assets/icon.png', () => {
    const distWin = require('../scripts/dist-win.js');
    expect(fs.existsSync(distWin.ICON_PNG)).toBe(true);
    const icoPath = distWin.ensureAppIconIco();
    expect(icoPath).toBe(distWin.ICON_ICO);
    expect(fs.existsSync(icoPath)).toBe(true);
    const ico = fs.readFileSync(icoPath);
    expect(ico.readUInt16LE(2)).toBe(1); // icon type
    expect(ico.readUInt16LE(4)).toBe(1); // one image
    distWin.prepareStage();
    expect(fs.existsSync(path.join(distWin.STAGE_DIR, 'assets', 'icon.ico'))).toBe(true);
    expect(fs.existsSync(path.join(distWin.STAGE_DIR, 'assets', 'icon.png'))).toBe(true);
    const stagedPkg = JSON.parse(
      fs.readFileSync(path.join(distWin.STAGE_DIR, 'package.json'), 'utf8')
    );
    expect(stagedPkg.window && stagedPkg.window.icon).toBe('assets/icon.png');
  });
});

