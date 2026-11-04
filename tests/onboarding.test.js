/**
 * @jest-environment jsdom
 *
 * Feature 15 � App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 15 - onboarding', () => {
  let tempRoot;
  let dataDir;
  let onboarding;
  let mountOnboardingView;
  let config;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f15-onboard-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      [
        'font size: 16',
        'navbar alignment: left',
        'logging: false',
        'onboarding completed: false',
        '',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(path.join(dataDir, 'landing-config.txt'), '', 'utf8');
    fs.writeFileSync(path.join(dataDir, 'store.json'), '{"schemaVersion":1,"entries":[]}', 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getInstallDir: () => tempRoot,
      getDataDir: () => dataDir,
      getUserDataDir: () => dataDir,
      getCanonicalUserDataDir: () => dataDir,
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    config = require('../src/config');
    onboarding = require('../src/onboarding');
    ({ mountOnboardingView } = require('../src/onboardingView'));
    config.clearConfigCache();
    config.load();
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('First launch shows onboarding controls', () => {
    expect(onboarding.shouldShow()).toBe(true);
    expect(onboarding.entryHash()).toBe('#/onboarding');
    const root = document.getElementById('root');
    const mount = mountOnboardingView(root, { confirm: () => true });
    expect(root.querySelector('[data-view="onboarding"]')).toBeTruthy();
    expect(root.querySelector('[data-onboarding-language]')).toBeTruthy();
    expect(root.querySelector('[data-onboarding-day-focus]')).toBeTruthy();
    expect(root.querySelector('[data-action="privacy-notice"]')).toBeTruthy();
    expect(root.querySelector('[data-action="give-tour"]')).toBeTruthy();
    expect(root.querySelector('[data-action="skip-onboarding"]')).toBeTruthy();
    mount.destroy();
  });

  it('Skip dismisses onboarding', () => {
    const root = document.getElementById('root');
    let done = false;
    const mount = mountOnboardingView(root, {
      onComplete: () => {
        done = true;
      },
    });
    root.querySelector('[data-action="skip-onboarding"]').click();
    expect(done).toBe(true);
    config.clearConfigCache();
    config.load();
    expect(config.get()['onboarding completed']).toBe(true);
    expect(onboarding.shouldShow()).toBe(false);
    expect(onboarding.entryHash()).toBe('#/');
    mount.destroy();
  });

  it('Day focus selection persists when progressing to Landing', () => {
    const root = document.getElementById('root');
    const dayFocus = require('../src/dayFocus');
    const landingConfig = require('../src/landingConfig');
    const { syncDayFocusInputs, fillNavbarUtilities } = require('../src/navbarUtilities');

    // Simulate shell Day Focus painted before onboarding edits (defaults).
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<nav class="app-navbar app-navbar-left">
        <div class="app-navbar-end" data-landing-menu-host="navbar"></div>
      </nav>`
    );
    fillNavbarUtilities(document);
    const armsMon = document.querySelector(
      '[data-landing-menu-host="navbar"] [data-focus-group="arms"][data-focus-day="mon"]'
    );
    expect(armsMon.checked).toBe(true);

    const mount = mountOnboardingView(root, { onComplete: () => {} });
    // Clear every Arms day, then select only Sunday — distinct from defaults.
    root.querySelectorAll('[data-focus-group="arms"][data-focus-day]').forEach((input) => {
      if (input.checked) {
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const sun = root.querySelector('[data-focus-group="arms"][data-focus-day="sun"]');
    sun.checked = true;
    sun.dispatchEvent(new Event('change', { bubbles: true }));

    root.querySelector('[data-action="skip-onboarding"]').click();

    landingConfig.clearLandingConfigCache();
    expect(dayFocus.getSchedule().arms).toEqual(['sun']);

    // Landing reuses the shell menu — sync must pick up onboarding edits.
    syncDayFocusInputs(document.querySelector('[data-landing-menu-host="navbar"]'));
    expect(
      document.querySelector(
        '[data-landing-menu-host="navbar"] [data-focus-group="arms"][data-focus-day="mon"]'
      ).checked
    ).toBe(false);
    expect(
      document.querySelector(
        '[data-landing-menu-host="navbar"] [data-focus-group="arms"][data-focus-day="sun"]'
      ).checked
    ).toBe(true);

    mount.destroy();
  });

  it('Privacy Notice shows dynamic paths', () => {
    const root = document.getElementById('root');
    const mount = mountOnboardingView(root);
    root.querySelector('[data-action="privacy-notice"]').click();
    expect(root.querySelector('[data-view="privacy-notice"]')).toBeTruthy();
    const userPath = root.querySelector('[data-privacy-user-path]');
    const appPath = root.querySelector('[data-privacy-app-path]');
    // User data (writable) vs install/package root (other app files).
    expect(userPath.textContent).toBe(dataDir);
    expect(appPath.textContent).toBe(tempRoot);
    expect(userPath.textContent).not.toBe(appPath.textContent);
    const copy = root.querySelector('[data-privacy-copy]').textContent;
    expect(copy).toMatch(/entirely offline/i);
    expect(copy).toMatch(/zero access/i);
    mount.destroy();
  });
});
