/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 1 — App Foundation', () => {
  describe('US-1.1 — Launch Offline App', () => {
    it('App opens without authentication', () => {
      const app = require('../src/app');
      app.networkGuard.install();
      app.networkGuard.resetCount();

      const state = app.bootstrap();
      expect(state.hasLoginForm).toBe(false);
      expect(state.view).toBe('shell');
      expect(state.ok).toBe(true);

      const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      expect(html.toLowerCase()).not.toMatch(/login|password|sign[\s-]?in/);
      expect(html).toContain('id="app"');

      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      expect(pkg.main).toBe('index.html');
      expect(pkg.window.title).toBe('Strank');

      app.networkGuard.assertOffline();
      expect(app.networkGuard.getOutboundAttempts()).toBe(0);
    });
  });

  describe('US-1.4 — Persist Locally With No Network', () => {
    it('Fatal catalog parse blocks app', () => {
      jest.resetModules();
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-shell-'));
      const dataDir = path.join(tempRoot, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(path.join(dataDir, 'format.txt'), '', 'utf8');
      fs.writeFileSync(
        path.join(dataDir, 'ranks.txt'),
        ['UNRANKED:', 'badges/unranked.svg', '--------------', ''].join('\n'),
        'utf8'
      );

      jest.doMock('../src/paths', () => ({
        getProjectRoot: () => tempRoot,
        getDataDir: () => dataDir,
        formatTxtPath: () => path.join(dataDir, 'format.txt'),
        ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
        storePath: () => path.join(dataDir, 'store.json'),
        windowStatePath: () => path.join(dataDir, 'window-state.json'),
        configTxtPath: () => path.join(dataDir, 'config.txt'),
      }));

      const app = require('../src/app');
      const state = app.bootstrap();
      expect(state.ok).toBe(false);
      expect(state.view).toBe('dataError');
      expect(state.message).toBe('Failed to load exercise data.');

      // Nav targets are not usable on data error (UI omits shell nav)
      expect(state.view).not.toBe('shell');

      fs.rmSync(tempRoot, { recursive: true, force: true });
      jest.resetModules();
      jest.dontMock('../src/paths');
    });
  });
});
