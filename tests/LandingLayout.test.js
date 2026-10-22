/**
 * @jest-environment jsdom
 *
 * Feature 14 - Day Focus
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_FORMAT = [
  'ARMS:',
  '\t- push-ups x[reps]',
  'CORE:',
  '\t- sit-ups x[reps]',
  '',
].join('\n');

const FIXTURE_RANKS = [
  'UNRANKED:',
  '{badges/unranked.svg}',
  '--------------',
  '',
  'BRONZE I:',
  '{badges/bronze-i.svg}',
  '--------------',
  'ARMS:',
  '\t- push-ups x10',
  'CORE:',
  '\t- sit-ups x10',
  '',
].join('\n');

const ALL_FOCUS = [
  'focus arms days: mon,tue,wed,thu,fri,sat,sun',
  'focus core days: mon,tue,wed,thu,fri,sat,sun',
  'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
  'focus legs days: mon,tue,wed,thu,fri,sat,sun',
].join('\n');

describe('Feature 14 - Day Focus menus', () => {
  let tempRoot;
  let dataDir;
  let storage;
  let catalog;
  let ranks;
  let ranking;
  let config;
  let landingConfig;
  let mountLandingView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f14-layout-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'navbar alignment: left\nlogging: false\n', 'utf8');
    fs.writeFileSync(path.join(dataDir, 'landing-config.txt'), ALL_FOCUS + '\n', 'utf8');

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

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranks = require('../src/ranks');
    ranking = require('../src/ranking');
    config = require('../src/config');
    landingConfig = require('../src/landingConfig');
    ({ mountLandingView } = require('../src/landingView'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    landingConfig.clearLandingConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();
    landingConfig.load();
    ranking.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');

    document.body.innerHTML =
      '<nav class="app-navbar app-navbar-left" data-navbar-alignment="left"><div class="app-navbar-links"></div><div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div></nav><div id="root"></div>';
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    ranking.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('exposes Day focus only (no Layout rearrange menu)', () => {
    storage.writeStore({ schemaVersion: 1, entries: [] });
    mount = mountLandingView(root, { localDate: '2026-10-17' });

    const host = document.querySelector('[data-landing-menu-host="navbar"]');
    expect(host).toBeTruthy();
    expect(host.hidden).toBe(false);
    expect(host.querySelector('[data-action="toggle-day-focus-menu"]')).toBeTruthy();
    expect(host.querySelector('[data-action="toggle-layout-menu"]')).toBeNull();
    expect(host.querySelector('[data-action="toggle-reorganize"]')).toBeNull();
    expect(host.querySelector('[data-action="toggle-customize"]')).toBeNull();
  });

  it('keeps default board layout', () => {
    storage.writeStore({ schemaVersion: 1, entries: [] });
    mount = mountLandingView(root, { localDate: '2026-10-17' });
    const board = root.querySelector('[data-landing-board]');
    expect(board.getAttribute('data-layout-mode')).toBe('default');
    expect(root.querySelector('[data-panel="today-expectations"]')).toBeTruthy();
    expect(root.querySelector('[data-panel="next-rank"]')).toBeTruthy();
    expect(root.querySelector('[data-panel="skill-progress"], [data-landing-card="skill-progress"]')).toBeTruthy();
  });
});
