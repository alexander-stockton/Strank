/**
 * @jest-environment jsdom
 *
 * Feature 14 — Day Focus (layout rearrange removed)
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
  'landing expectations visible: true',
  'landing next rank visible: true',
  'landing get started visible: true',
  'landing skill progress visible: true',
  'landing layout mode: default',
  'landing component order: today-expectations,next-rank,skill-progress',
  'focus arms days: mon,tue,wed,thu,fri,sat,sun',
  'focus core days: mon,tue,wed,thu,fri,sat,sun',
  'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
  'focus legs days: mon,tue,wed,thu,fri,sat,sun',
].join('\n');

describe('Feature 14 — Day Focus menus', () => {
  let tempRoot;
  let dataDir;
  let storage;
  let catalog;
  let ranks;
  let ranking;
  let config;
  let landingConfig;
  let landingLayout;
  let mountLandingView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f14-layout-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'format.dat'), Buffer.from(FIXTURE_FORMAT, 'utf8'));
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'navbar alignment: left\nlogging: false\n', 'utf8');
    fs.writeFileSync(path.join(dataDir, 'landing-config.txt'), ALL_FOCUS + '\n', 'utf8');

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

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranks = require('../src/ranks');
    ranking = require('../src/ranking');
    config = require('../src/config');
    landingConfig = require('../src/landingConfig');
    landingLayout = require('../src/landingLayout');
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

    expect(landingLayout.get().order).toEqual([
      'today-expectations',
      'next-rank',
      'skill-progress',
    ]);
  });

  it('keeps default board layout', () => {
    storage.writeStore({ schemaVersion: 1, entries: [] });
    mount = mountLandingView(root, { localDate: '2026-10-17' });
    const board = root.querySelector('[data-landing-board]');
    expect(board.getAttribute('data-layout-mode')).toBe('default');
    expect(root.querySelector('.landing-view.is-reorganize')).toBeNull();
    expect(root.querySelector('.landing-view.is-customize')).toBeNull();
  });
});
