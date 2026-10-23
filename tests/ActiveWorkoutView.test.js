/**
 * @jest-environment jsdom
 *
 * Feature 8 - Active Workout
 * Spec: features/feature-8-Active-Workout.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_FORMAT = [
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x[reps] x[sets]',
  '\t\t\t- push-ups x[reps] x[sets]',
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
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x4 x3',
  '\t\t\t- push-ups x10 x3',
  '',
].join('\n');

describe('Feature 8 - Active Workout (UI)', () => {
  let tempRoot;
  let dataDir;
  let storage;
  let catalog;
  let ranks;
  let ranking;
  let config;
  let workout;
  let landing;
  let dailyLog;
  let mountActiveWorkoutView;
  let mountLandingView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f8-ui-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['navbar alignment: left', 'logging: false'].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'landing-config.txt'),
      [
        'focus arms days: mon,tue,wed,thu,fri,sat,sun',
        'focus core days: mon,tue,wed,thu,fri,sat,sun',
        'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
        'focus legs days: mon,tue,wed,thu,fri,sat,sun',
      ].join('\n') + '\n',
      'utf8'
    );

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
    landing = require('../src/landing');
    dailyLog = require('../src/dailyLog');
    workout = require('../src/workout');
    ({ mountActiveWorkoutView } = require('../src/activeWorkoutView'));
    ({ mountLandingView } = require('../src/landingView'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    const landingConfig = require('../src/landingConfig');
    landingConfig.clearLandingConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();
    landingConfig.load();
    ranking.__resetTestHooks();
    dailyLog.__resetTestHooks();
    workout.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');
    dailyLog.__setLocalDate('2026-10-17');

    document.body.innerHTML = `
      <nav class="app-navbar app-navbar-left"><div class="app-navbar-links"></div>
      <div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div></nav>
      <div id="root"></div>`;
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    ranking.__resetTestHooks();
    dailyLog.__resetTestHooks();
    workout.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-8.1 - Work Through Checklist', () => {
    it('Checklist shows expected exercises by header', () => {
      mount = mountActiveWorkoutView(root, {
        workout,
        localDate: '2026-10-17',
        confirm: () => true,
      });

      expect(root.querySelector('[data-view="activeWorkout"]')).toBeTruthy();
      expect(root.querySelector('[data-header-path="ARMS>STRENGTH>PUSH"]')).toBeTruthy();
      const pike = root.querySelector('[data-exercise-id="pike-push-ups"]');
      expect(pike).toBeTruthy();
      expect(pike.textContent).toMatch(/pike-push-ups/i);
      expect(pike.querySelector('[name="metric-reps"]')).toBeTruthy();
      expect(pike.querySelector('[name="metric-sets"]')).toBeTruthy();
      expect(root.querySelector('[data-workout-checklist]')).toBeTruthy();
      const stayHelp = root.querySelector('#exercise-help-workout-stay');
      expect(stayHelp).toBeTruthy();
      expect(stayHelp.textContent).toMatch(/Stay on this page/i);
      expect(root.querySelector('.workout-footer-start .workout-timer')).toBeTruthy();
    });
  });

  describe('Duration inputs', () => {
    it('shows hour minute second fields for duration metrics', () => {
      fs.writeFileSync(
        path.join(dataDir, 'format.txt'),
        [
          'CORE:',
          '\tHOLD:',
          '\t\t- plank-hold ([duration]) x[sets]',
          '',
        ].join('\n'),
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
          '\tHOLD:',
          '\t\t- plank-hold (1m5s) x3',
          '',
        ].join('\n'),
        'utf8'
      );
      catalog.clearCatalogCache();
      ranks.clearRanksCache();
      catalog.loadLiveCatalog();
      ranks.loadRanks();

      mount = mountActiveWorkoutView(root, {
        workout,
        localDate: '2026-10-17',
        confirm: () => true,
      });

      const row = root.querySelector('[data-exercise-id="plank-hold"]');
      expect(row).toBeTruthy();
      expect(row.querySelector('[data-duration-metric="durationSeconds"]')).toBeTruthy();
      expect(row.querySelector('[name="metric-durationSeconds-h"]')).toBeTruthy();
      expect(row.querySelector('[name="metric-durationSeconds-m"]')).toBeTruthy();
      expect(row.querySelector('[name="metric-durationSeconds-s"]')).toBeTruthy();
      // Prefill from target 65s -> 0h 1m 5s
      expect(row.querySelector('[name="metric-durationSeconds-h"]').value).toBe('0');
      expect(row.querySelector('[name="metric-durationSeconds-m"]').value).toBe('1');
      expect(row.querySelector('[name="metric-durationSeconds-s"]').value).toBe('5');
    });
  });

  describe('day-local Custom section', () => {
    function writeArmsOnlySaturdayPlusCoreCatalog() {
      fs.writeFileSync(
        path.join(dataDir, 'format.txt'),
        [
          'ARMS:',
          '\tSTRENGTH:',
          '\t\tPUSH:',
          '\t\t\t- pike-push-ups x[reps] x[sets]',
          '\t\t\t- push-ups x[reps] x[sets]',
          '',
          'CORE:',
          '\tSTRENGTH:',
          '\t\t- dragon-flag-negatives x[reps] x[sets]',
          '',
        ].join('\n'),
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
          'ARMS:',
          '\tSTRENGTH:',
          '\t\tPUSH:',
          '\t\t\t- pike-push-ups x4 x3',
          '\t\t\t- push-ups x10 x3',
          '',
          'CORE:',
          '\tSTRENGTH:',
          '\t\t- dragon-flag-negatives x3 x3',
          '',
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(dataDir, 'landing-config.txt'),
        [
          'focus arms days: sat',
          'focus core days: mon',
          'focus lungs days:',
          'focus legs days:',
        ].join('\n') + '\n',
        'utf8'
      );
      catalog.clearCatalogCache();
      ranks.clearRanksCache();
      const landingConfig = require('../src/landingConfig');
      landingConfig.clearLandingConfigCache();
      catalog.loadLiveCatalog();
      ranks.loadRanks();
      landingConfig.load();
    }

    it('Add exercise opens picker and inserts into Custom column', () => {
      writeArmsOnlySaturdayPlusCoreCatalog();
      mount = mountActiveWorkoutView(root, {
        workout,
        localDate: '2026-10-17',
        confirm: () => true,
      });

      expect(root.querySelector('[data-workout-col="custom"]')).toBeFalsy();
      const addBtn = root.querySelector('[data-action="add-exercise"]');
      expect(addBtn).toBeTruthy();
      expect(addBtn.textContent).toMatch(/Add exercise/i);
      addBtn.click();

      const overlay = root.querySelector('[data-history-add-overlay]');
      expect(overlay).toBeTruthy();

      const focus = root.querySelector('[data-add-focus]');
      focus.value = 'core';
      focus.dispatchEvent(new Event('change', { bubbles: true }));

      const skill = root.querySelector('[data-add-skill]');
      expect(skill).toBeTruthy();
      skill.value = 'dragon-flag-negatives';
      skill.dispatchEvent(new Event('change', { bubbles: true }));

      root.querySelector('[data-action="confirm-add"]').click();

      expect(root.querySelector('[data-history-add-overlay]')).toBeFalsy();
      const customCol = root.querySelector('[data-workout-col="custom"]');
      expect(customCol).toBeTruthy();
      expect(customCol.textContent).toMatch(/Custom/i);
      expect(customCol.querySelector('[data-exercise-id="dragon-flag-negatives"]')).toBeTruthy();
      expect(root.querySelector('[data-workout-col="strength"] [data-exercise-id="dragon-flag-negatives"]')).toBeFalsy();

      const draft = workout.getDraft();
      const custom = draft.items.find((i) => i.exerciseId === 'dragon-flag-negatives');
      expect(custom.custom).toBe(true);
      expect(custom.headers).toEqual(['Custom']);
    });
  });

  describe('US-8.2 - Complete And Save', () => {
    it('Complete saves and returns to landing', () => {
      let completed = false;
      mount = mountActiveWorkoutView(root, {
        workout,
        localDate: '2026-10-17',
        confirm: () => true,
        onComplete: () => {
          completed = true;
        },
      });

      const row = root.querySelector('[data-exercise-id="pike-push-ups"]');
      const check = row.querySelector('[data-check]');
      check.checked = true;
      check.dispatchEvent(new Event('change', { bubbles: true }));

      const reps = root.querySelector('[data-exercise-id="pike-push-ups"] [name="metric-reps"]');
      const sets = root.querySelector('[data-exercise-id="pike-push-ups"] [name="metric-sets"]');
      reps.value = '4';
      sets.value = '3';
      reps.dispatchEvent(new Event('input', { bubbles: true }));
      sets.dispatchEvent(new Event('input', { bubbles: true }));

      root.querySelector('[data-action="complete"]').click();
      expect(completed).toBe(true);

      const store = storage.readStore();
      expect(
        store.data.entries.find((e) => e.exerciseId === 'pike-push-ups' && e.localDate === '2026-10-17')
      ).toBeTruthy();
      expect(store.data.workouts).toHaveLength(1);

      mount.destroy();
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const landRow = root.querySelector(
        '[data-panel="today-expectations"] [data-exercise-id="pike-push-ups"]'
      );
      expect(landRow).toBeTruthy();
      expect(landRow.getAttribute('data-completed')).toBe('true');
    });
  });
});
