/**
 * @jest-environment jsdom
 *
 * Feature 11 — Config, Accessibility & Backup
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 11 — Config, Accessibility & Backup (UI)', () => {
  let tempRoot;
  let dataDir;
  let config;
  let mountConfigView;
  let root;
  let mount;
  let navigated;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f11-ui-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'format.txt'),
      ['CORE:', '\tSTRENGTH:', '\t\t- plank x[reps] x[sets]', ''].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'ranks.txt'),
      [
        'UNRANKED:',
        '{badges/unranked.svg}',
        '--------------',
        '',
        'BRONZE I:',
        '{badges/bronze-i.svg}',
        '--------------',
        'CORE:',
        '\tSTRENGTH:',
        '\t\t- plank x5 x3',
        '',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['navbar alignment: left', 'logging: false', 'font size: medium'].join('\n') + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'landing-config.txt'),
      [
      ].join('\n') + '\n',
      'utf8'
    );

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getBootstrapDataDir: () => dataDir,
      getDefaultStorePath: () => path.join(dataDir, 'store.json'),
      getDataDir: () => dataDir,
      getUserDataDir: () => dataDir,
      applyPathOverridesFromSettings: () => {},
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      localizationDir: () => path.join(dataDir, 'localization'),
      defaultsDir: () => path.join(dataDir, 'defaults'),
      validateDataDirectory: (raw) => ({
        ok: true,
        path: path.resolve(String(raw || dataDir).trim() || dataDir),
      }),
      validateStorePath: (raw) => ({
        ok: true,
        path: path.resolve(String(raw || path.join(dataDir, 'store.json')).trim()),
      }),
    }));

    config = require('../src/config');
    require('../src/landingConfig').load();
    config.load();
    ({ mountConfigView } = require('../src/configView'));

    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
    navigated = null;
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  function mountView(extra = {}) {
    mount = mountConfigView(root, {
      onNavigate: (p) => {
        navigated = p;
      },
      ...extra,
    });
  }

  describe('US-11.1 — Change Appearance', () => {
    it('Simple color pickers set accent on the Config card', () => {
      jest.useFakeTimers();
      mountView();
      const accent = root.querySelector('[data-simple-colors] [data-color-key="accent color"]');
      expect(accent).toBeTruthy();
      accent.value = '#ff0000';
      accent.dispatchEvent(new Event('input', { bubbles: true }));

      // Memory + theme update immediately; disk write is buffered.
      expect(config.get()['accent color'].toUpperCase()).toBe('#FF0000');
      expect(document.documentElement.style.getPropertyValue('--accent').toUpperCase()).toBe('#FF0000');
      expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).not.toMatch(/accent color: #FF0000/i);

      jest.advanceTimersByTime(300);
      expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/accent color: #FF0000/i);
      jest.useRealTimers();
    });

    it('Color picker change event flushes the write buffer immediately', () => {
      mountView();
      const accent = root.querySelector('[data-simple-colors] [data-color-key="accent color"]');
      accent.value = '#00ff00';
      accent.dispatchEvent(new Event('change', { bubbles: true }));
      expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/accent color: #00FF00/i);
    });

    it('More opens advanced Choose colors modal with all theme tokens', () => {
      mountView();
      root.querySelector('[data-action="more-colors"]').click();
      const form = root.querySelector('#color-picker-form');
      expect(form).toBeTruthy();
      expect(form.querySelector('[data-color-key="panel color"]')).toBeTruthy();
      expect(form.querySelector('[data-color-key="muted color"]')).toBeTruthy();
      expect(form.querySelector('[data-color-key="glow color"]')).toBeTruthy();
      expect(form.querySelector('[data-color-key="alert color"]')).toBeTruthy();

      form.querySelector('[data-color-key="background color"]').value = '#112233';
      form.querySelector('[data-color-key="text color"]').value = '#abcdef';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      expect(config.get()['background color'].toUpperCase()).toBe('#112233');
      expect(config.get()['text color'].toUpperCase()).toBe('#ABCDEF');
      expect(document.documentElement.style.getPropertyValue('--bg').toUpperCase()).toBe('#112233');
      expect(document.documentElement.style.getPropertyValue('--text').toUpperCase()).toBe('#ABCDEF');
    });

    it('Cancel in Choose colors restores the snapshot', () => {
      mountView();
      const before = config.get()['panel color'];
      root.querySelector('[data-action="more-colors"]').click();
      const panel = root.querySelector('#color-picker-form [data-color-key="panel color"]');
      panel.value = '#010203';
      panel.dispatchEvent(new Event('input', { bubbles: true }));
      root.querySelector('[data-action="cancel-colors"]').click();
      expect(config.get()['panel color']).toBe(before);
      expect(root.querySelector('#color-picker-form')).toBeNull();
    });

    it('Navbar alignment persists', () => {
      mountView();
      const top = root.querySelector('input[name="navbar-alignment"][value="top"]');
      top.checked = true;
      top.dispatchEvent(new Event('change', { bubbles: true }));

      const text = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
      expect(text).toMatch(/navbar alignment: top/);
      expect(config.getNavbarAlignment()).toBe('top');
    });
  });

  describe('US-11.2 — Accessibility Options', () => {
    it('Colorblind filter applies', () => {
      mountView({
        onSettingsChanged: (s) => {
          document.documentElement.setAttribute('data-colorblind', s['colorblind filter']);
          document.body.setAttribute('data-colorblind', s['colorblind filter']);
        },
      });
      const select = root.querySelector('[data-config-key="colorblind filter"]');
      select.value = 'deuteranopia';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      expect(config.get()['colorblind filter']).toBe('deuteranopia');
      expect(document.body.getAttribute('data-colorblind')).toBe('deuteranopia');

      // History recorded days remain distinguishable under the filter attribute
      document.body.innerHTML +=
        '<div class="history-calendar-view"><span class="day recorded" data-recorded="true">1</span><span class="day" data-recorded="false">2</span></div>';
      expect(document.body.querySelector('[data-recorded="true"]')).toBeTruthy();
      expect(document.body.querySelector('[data-recorded="false"]')).toBeTruthy();
      expect(document.body.getAttribute('data-colorblind')).toBe('deuteranopia');
    });

    it('Fullscreen toggle lives in Accessibility and persists', () => {
      mountView();
      const section = root.querySelector('[data-section="accessibility"]');
      const toggle = root.querySelector('[data-config-key="fullscreen"]');
      expect(section).toBeTruthy();
      expect(toggle).toBeTruthy();
      expect(section.contains(toggle)).toBe(true);
      expect(root.querySelector('[data-section="advanced"]').contains(toggle)).toBe(false);

      expect(toggle.checked).toBe(false);
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
      expect(config.get().fullscreen).toBe(true);
      expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/fullscreen:\s*true/);
    });
  });

  describe('US-11.4 — Advanced Settings', () => {
    it('Backup section exposes ranks import/export', () => {
      mountView();
      expect(root.querySelector('[data-action="export-ranks"]')).toBeTruthy();
      expect(root.querySelector('[data-action="import-ranks"]')).toBeTruthy();
    });

    it('Ranks list remains reachable (Edit Ranks lives on the navbar)', () => {
      mountView();
      expect(root.querySelector('[data-action="edit-ranks"]')).toBeNull();

      const { mountRankManagerView } = require('../src/rankManagerView');
      mount.destroy();
      mount = mountRankManagerView(root, {});
      expect(root.querySelector('[data-view="rank-manager"]')).toBeTruthy();
      expect(root.textContent).toMatch(/BRONZE I/);
      expect(root.querySelector('.rank-manager-footer [data-action="custom-rank"]')).toBeTruthy();
    });

    it('Logging toggle persists', () => {
      mountView();
      const logging = root.querySelector('[data-config-key="logging"]');
      expect(logging.checked).toBe(false);
      logging.checked = true;
      logging.dispatchEvent(new Event('change', { bubbles: true }));

      const text = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
      expect(text).toMatch(/logging: true/);
      expect(config.isLoggingEnabled()).toBe(true);
    });

    it('Reset User Data sits beside advanced toggles (outside Animations)', () => {
      mountView();
      root.querySelector('[data-action="toggle-advanced"]').click();
      const top = root.querySelector('.config-advanced-top');
      const reset = root.querySelector('[data-action="reset-user-data"]');
      expect(top).toBeTruthy();
      expect(reset).toBeTruthy();
      expect(top.contains(reset)).toBe(true);
      expect(root.querySelector('[data-section="animations"]').contains(reset)).toBe(false);
      expect(top.querySelector('[data-config-key="logging"]')).toBeTruthy();
    });

    it('Advanced exposes data directory and store path fields with browse', () => {
      mountView();
      root.querySelector('[data-action="toggle-advanced"]').click();
      const dataInput = root.querySelector('[data-config-path="data directory"]');
      const storeInput = root.querySelector('[data-config-path="store path"]');
      expect(dataInput).toBeTruthy();
      expect(storeInput).toBeTruthy();
      expect(dataInput.value).toBeTruthy();
      expect(storeInput.value).toMatch(/store\.json$/i);
      expect(root.querySelector('[data-action="browse-data-directory"]')).toBeTruthy();
      expect(root.querySelector('[data-action="browse-store-path"]')).toBeTruthy();
    });
  });

  describe('Feature 16 — units', () => {
    it('Distance list includes new units', () => {
      mountView();
      const select = root.querySelector('[data-config-key="distance units"]');
      expect([...select.options].map((o) => o.value)).toEqual(['mi', 'km', 'm', 'yd', 'ft', 'in']);
      select.value = 'yd';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(config.get()['distance units']).toBe('yd');
      expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/^distance units: yd$/m);
    });

    it('Weight list includes stones', () => {
      mountView();
      const select = root.querySelector('[data-config-key="weight units"]');
      expect([...select.options].map((o) => o.value)).toEqual(['lbs', 'kg', 'st']);
      select.value = 'st';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(config.get()['weight units']).toBe('st');
      expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/^weight units: st$/m);
    });

    it('Does not offer steps or stride profile fields', () => {
      mountView();
      const select = root.querySelector('[data-config-key="distance units"]');
      expect([...select.options].map((o) => o.value)).not.toContain('steps');
      expect(root.querySelector('[data-steps-profile]')).toBeNull();
      expect(root.querySelector('[data-config-key="stride sex"]')).toBeNull();
      expect(root.querySelector('[data-config-key="stride height ft"]')).toBeNull();
    });
  });

  describe('Feature 16 — language', () => {
    it('lists every shipped language and persists the selection', () => {
      const i18n = require('../src/i18n');
      i18n.init();
      mountView();
      const select = root.querySelector('[data-config-language]');
      expect(select).toBeTruthy();
      expect([...select.options].map((o) => o.value)).toEqual([
        'en',
        'zh-Hans',
        'hi',
        'es',
        'ar',
        'fr',
        'de',
        'pt',
        'ru',
        'ja',
      ]);

      select.value = 'fr';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(config.get().language).toBe('fr');
      expect(i18n.getLanguage()).toBe('fr');
      expect(root.querySelector('h1').textContent).toBe('Configuration');
      expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/^language: fr$/m);
    });
  });
});
