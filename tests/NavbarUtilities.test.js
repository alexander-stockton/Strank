/**
 * @jest-environment jsdom
 *
 * Persistent navbar utilities: Day Focus, Edit Ranks, Privacy, Contributing.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

describe('navbarUtilities', () => {
  let tempRoot;
  let dataDir;
  let fillNavbarUtilities;
  let mountPrivacyNoticeView;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-nav-util-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'navbar alignment: left\nlanguage: en\n');
    fs.writeFileSync(
      path.join(dataDir, 'landing-config.txt'),
      [
        'focus arms days: mon,tue,wed,thu,fri,sat,sun',
        'focus core days: mon,tue,wed,thu,fri,sat,sun',
        'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
        'focus legs days: mon,tue,wed,thu,fri,sat,sun',
      ].join('\n') + '\n'
    );
    fs.writeFileSync(path.join(dataDir, 'store.json'), '{"schemaVersion":1,"entries":[]}');

    const projectData = path.resolve(__dirname, '..', 'data');
    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      getUserDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      localizationDir: () => path.join(projectData, 'localization'),
      localizedDataFile: (_f, fallback) => fallback,
    }));

    document.body.innerHTML = `
      <nav class="app-navbar app-navbar-left" data-navbar-alignment="left">
        <div class="app-navbar-links"></div>
        <div class="app-navbar-end" data-landing-menu-host="navbar"></div>
      </nav>
      <div id="root"></div>
    `;

    const config = require('../src/config');
    config.clearConfigCache();
    config.load();
    const landingConfig = require('../src/landingConfig');
    landingConfig.clearLandingConfigCache();
    landingConfig.load();

    ({ fillNavbarUtilities } = require('../src/navbarUtilities'));
    ({ mountPrivacyNoticeView } = require('../src/onboardingView'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('renders Day Focus, Edit Ranks, and Privacy opposite the tabs (no Contributing)', () => {
    fillNavbarUtilities(document);
    const host = document.querySelector('[data-landing-menu-host="navbar"]');
    expect(host.querySelector('[data-action="toggle-day-focus-menu"]')).toBeTruthy();
    expect(host.querySelector('[data-action="edit-ranks"]')).toBeTruthy();
    expect(host.querySelector('[data-action="open-privacy"]')).toBeTruthy();
    expect(host.querySelector('[data-action="open-contributing"]')).toBeFalsy();
    expect(host.textContent).toMatch(/Edit Ranks/);
    expect(host.textContent).toMatch(/Privacy/);
  });

  it('Edit Ranks and Privacy invoke handlers', () => {
    const onEditRanks = jest.fn();
    const onPrivacy = jest.fn();
    fillNavbarUtilities(document, { onEditRanks, onPrivacy });
    document.querySelector('[data-action="edit-ranks"]').click();
    document.querySelector('[data-action="open-privacy"]').click();
    expect(onEditRanks).toHaveBeenCalledTimes(1);
    expect(onPrivacy).toHaveBeenCalledTimes(1);
  });

  it('standalone Privacy Back calls onBack (prior page)', () => {
    const root = document.getElementById('root');
    const onBack = jest.fn();
    mountPrivacyNoticeView(root, { onBack });
    expect(root.querySelector('[data-view="privacy-notice"]')).toBeTruthy();
    root.querySelector('[data-action="privacy-back"]').click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
