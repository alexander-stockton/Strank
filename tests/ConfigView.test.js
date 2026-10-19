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
      path.join(dataDir, 'format.dat'),
      Buffer.from(['CORE:', '\tSTRENGTH:', '\t\t- plank x[reps] x[sets]', ''].join('\n'), 'utf8')
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
        'landing expectations visible: true',
        'landing next rank visible: true',
        'landing get started visible: true',
      ].join('\n') + '\n',
      'utf8'
    );

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
      mountView();
      const accent = root.querySelector('[data-simple-colors] [data-color-key="accent color"]');
      expect(accent).toBeTruthy();
      accent.value = '#ff0000';
      accent.dispatchEvent(new Event('input', { bubbles: true }));

      const text = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
      expect(text).toMatch(/accent color: #FF0000/i);
      expect(config.get()['accent color'].toUpperCase()).toBe('#FF0000');
    });

    it('More opens advanced Choose colors modal with all theme tokens', () => {
      mountView();
      root.querySelector('[data-action="more-colors"]').click();
      const form = root.querySelector('#color-picker-form');
      expect(form).toBeTruthy();
      expect(form.querySelector('[data-color-key="panel color"]')).toBeTruthy();
      expect(form.querySelector('[data-color-key="muted color"]')).toBeTruthy();
      expect(form.querySelector('[data-color-key="glow color"]')).toBeTruthy();

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
  });

  describe('US-11.4 — Advanced Settings', () => {
    it('Edit ranks.txt opens Rank Editor', () => {
      mountView();
      root.querySelector('[data-action="edit-ranks"]').click();
      expect(navigated).toBe('/rank-editor');

      const { mountRankEditorView } = require('../src/rankEditorView');
      mount.destroy();
      mount = mountRankEditorView(root, {});
      expect(root.querySelector('[data-view="rank-editor"]')).toBeTruthy();
      const editor = root.querySelector('[data-ranks-editor]');
      expect(editor).toBeTruthy();
      expect(editor.value).toMatch(/BRONZE I/);
      expect(editor.value).toMatch(/plank/);
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
  });
});
