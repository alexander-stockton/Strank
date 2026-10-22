/**
 * Feature 11 — Config, Accessibility & Backup
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 11 — Config, Accessibility & Backup', () => {
  let tempRoot;
  let dataDir;
  let config;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f11-cfg-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      formatDatPath: () => path.join(dataDir, 'format.dat'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    config = require('../src/config');
    config.clearConfigCache();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-11.1 — Change Appearance', () => {
    it('Font size persists', () => {
      config.load();
      config.set('font size', 'large');
      const text = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
      expect(text).toMatch(/font size: 24/);

      config.clearConfigCache();
      const reloaded = config.load();
      expect(reloaded.data['font size']).toBe('24');
      expect(config.fontSizeToPx(reloaded.data['font size'])).toBe(24);
    });

    it('Corrupt config resets to defaults', () => {
      fs.writeFileSync(path.join(dataDir, 'config.txt'), 'not a valid config line\n', 'utf8');
      const result = config.load();
      expect(result.resetToDefaults).toBe(true);
      expect(result.data['navbar alignment']).toBe('left');
      expect(result.data.logging).toBe(false);

      const text = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
      expect(text).toMatch(/navbar alignment: left/);
      expect(text).toMatch(/logging: false/);
    });

    it('applyToDocument sets all theme CSS variables', () => {
      config.load();
      config.update({
        'accent color': '#111111',
        'background color': '#222222',
        'panel color': '#333333',
        'text color': '#444444',
        'muted color': '#555555',
        'danger color': '#666666',
        'ok color': '#777777',
        'glow color': '#888888',
      });
      const props = {};
      const el = {
        style: {
          fontSize: '',
          setProperty(k, v) {
            props[k] = v;
          },
          getPropertyValue(k) {
            return props[k] || '';
          },
          removeProperty(k) {
            delete props[k];
          },
        },
        setAttribute() {},
      };
      config.applyToDocument({ documentElement: el, body: el });
      expect(props['--accent'].toUpperCase()).toBe('#111111');
      expect(props['--bg'].toUpperCase()).toBe('#222222');
      expect(props['--panel'].toUpperCase()).toBe('#333333');
      expect(props['--text'].toUpperCase()).toBe('#444444');
      expect(props['--muted'].toUpperCase()).toBe('#555555');
      expect(props['--danger'].toUpperCase()).toBe('#666666');
      expect(props['--ok'].toUpperCase()).toBe('#777777');
      expect(props['--bg-glow'].toUpperCase()).toBe('#888888');
    });
  });

  describe('US-11.4 — Advanced Settings', () => {
    it('Logging defaults to off', () => {
      const result = config.load();
      expect(result.data.logging).toBe(false);
      expect(config.isLoggingEnabled()).toBe(false);

      fs.writeFileSync(
        path.join(dataDir, 'config.txt'),
        ['font size: medium', 'navbar alignment: left'].join('\n') + '\n',
        'utf8'
      );
      config.clearConfigCache();
      const again = config.load();
      expect(again.data.logging).toBe(false);
    });
  });
});
