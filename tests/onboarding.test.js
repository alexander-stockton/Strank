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
