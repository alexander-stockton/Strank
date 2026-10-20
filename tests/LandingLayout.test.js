/**
 * @jest-environment jsdom
 *
 * Feature 14 — Landing Layout & Day Focus
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

describe('Feature 14 — Landing Layout', () => {
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
    landingLayout.setReorganizeMode(false);

    document.body.innerHTML =
      '<nav class="app-navbar app-navbar-left" data-navbar-alignment="left"><div class="app-navbar-links"></div><div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div></nav><div id="root"></div>';
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    landingLayout.setReorganizeMode(false);
    ranking.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-14.1 — Reorganize Landing Components', () => {
    it('Drag mode reorders component cards', () => {
      storage.writeStore({ schemaVersion: 1, entries: [] });
      mount = mountLandingView(root, { localDate: '2026-10-17' });

      const host = document.querySelector('[data-landing-menu-host="navbar"]');
      expect(host).toBeTruthy();
      expect(host.hidden).toBe(false);

      const layoutBtn = host.querySelector('[data-action="toggle-layout-menu"]');
      layoutBtn.click();
      const toggle = host.querySelector('[data-action="toggle-reorganize"]');
      expect(toggle).toBeTruthy();
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));

      expect(landingLayout.isReorganizeMode()).toBe(true);
      expect(root.querySelector('.landing-view.is-reorganize')).toBeTruthy();

      // Simulate drop: skill-progress onto today-expectations
      landingLayout.set(['skill-progress', 'today-expectations', 'next-rank']);
      mount.refresh();

      const cfg = fs.readFileSync(path.join(dataDir, 'landing-config.txt'), 'utf8');
      expect(cfg).toMatch(/landing component order:\s*skill-progress,today-expectations,next-rank/);
      expect(cfg).toMatch(/landing layout mode:\s*custom/);

      // Relaunch: remount reads persisted order
      mount.destroy();
      landingLayout.setReorganizeMode(false);
      landingConfig.clearLandingConfigCache();
      landingConfig.load();
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      expect(landingLayout.get().order[0]).toBe('skill-progress');
      const board = root.querySelector('[data-landing-board]');
      expect(board.getAttribute('data-layout-mode')).toBe('custom');
      const cards = [...root.querySelectorAll('[data-landing-card]')].map((el) =>
        el.getAttribute('data-landing-card')
      );
      expect(cards[0]).toBe('skill-progress');
    });

    it('Reset layout restores defaults', () => {
      landingLayout.set(['skill-progress', 'next-rank', 'today-expectations']);
      expect(landingLayout.get().mode).toBe('custom');

      storage.writeStore({ schemaVersion: 1, entries: [] });
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const host = document.querySelector('[data-landing-menu-host="navbar"]');
      host.querySelector('[data-action="toggle-layout-menu"]').click();
      host.querySelector('[data-action="reset-layout"]').click();

      expect(landingLayout.get().order).toEqual([
        'today-expectations',
        'next-rank',
        'skill-progress',
      ]);
      expect(landingLayout.get().mode).toBe('default');
      const cfg = fs.readFileSync(path.join(dataDir, 'landing-config.txt'), 'utf8');
      expect(cfg).toMatch(/landing component order:\s*today-expectations,next-rank,skill-progress/);
      expect(cfg).toMatch(/landing layout mode:\s*default/);
    });
  });
});
