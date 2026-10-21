/**
 * @jest-environment jsdom
 *
 * Feature 16 — Localization & Language Support
 * Spec: features/feature-16-Localization.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 16 — localization UI', () => {
  let tempRoot;
  let dataDir;
  let config;
  let i18n;
  let mountConfigView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f16-ui-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), 'CORE:\n\tSTRENGTH:\n\t\t- plank x[reps] x[sets]\n', 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'ranks.txt'),
      ['UNRANKED:', '{badges/unranked.svg}', '--------------', '', 'BRONZE I:', '{badges/bronze-i.svg}', '--------------', ''].join(
        '\n'
      ),
      'utf8'
    );
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'navbar alignment: left\nfont size: medium\n', 'utf8');
    fs.writeFileSync(path.join(dataDir, 'landing-config.txt'), '\n', 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    config = require('../src/config');
    i18n = require('../src/i18n');
    require('../src/landingConfig').load();
    config.load();
    i18n.init();
    ({ mountConfigView } = require('../src/configView'));

    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  function changeLanguage(tag) {
    const select = root.querySelector('[data-config-language]');
    select.value = tag;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  test('Arabic sets RTL direction', () => {
    mount = mountConfigView(root, {});
    expect(root.querySelector('[data-config-language]')).toBeTruthy();

    changeLanguage('ar');
    expect(config.get().language).toBe('ar');
    expect(i18n.getLanguage()).toBe('ar');
    expect(i18n.getDir()).toBe('rtl');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(root.querySelector('h1').textContent).toBe('الإعدادات');
    expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/^language: ar$/m);

    changeLanguage('en');
    expect(config.get().language).toBe('en');
    expect(i18n.getDir()).toBe('ltr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(root.querySelector('h1').textContent).toBe('Config');
  });

  test('Config language change re-renders chrome in the selected language', () => {
    mount = mountConfigView(root, {});
    const options = [...root.querySelectorAll('[data-config-language] option')].map((el) => el.value);
    expect(options).toEqual(['en', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'de', 'pt', 'ru', 'ja']);

    changeLanguage('es');
    expect(config.get().language).toBe('es');
    expect(root.querySelector('h1').textContent).toBe('Configuración');
    expect(root.querySelector('[data-section="language"] h2').textContent).toBe('Idioma');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/^language: es$/m);
  });
});
