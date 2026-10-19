/**
 * @jest-environment jsdom
 *
 * Feature 7 — Landing Page
 * Spec: features/feature-7-Landing-Page.md
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
  'BRONZE II:',
  '{badges/bronze-ii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x6 x3',
  '',
  'BRONZE III:',
  '{badges/bronze-iii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x8 x3',
  '',
  'SILVER I:',
  '{badges/silver-i.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x12 x3',
  '\t\t\t- push-ups x20 x3',
  '',
].join('\n');

function entry(overrides) {
  return {
    entryId: overrides.entryId || `e_${overrides.localDate}_${overrides.exerciseId}`,
    exerciseId: overrides.exerciseId,
    localDate: overrides.localDate,
    createdAt: `${overrides.localDate}T10:00:00.000-05:00`,
    updatedAt: `${overrides.localDate}T10:00:00.000-05:00`,
    metrics: overrides.metrics,
  };
}

describe('Feature 7 — Landing Page (UI)', () => {
  let tempRoot;
  let dataDir;
  let landing;
  let ranking;
  let catalog;
  let ranks;
  let storage;
  let config;
  let mountLandingView;
  let renderAppNavbar;
  let root;
  let mount;

  function writeConfig(lines) {
    fs.writeFileSync(path.join(dataDir, 'config.txt'), lines.join('\n') + '\n', 'utf8');
    config.clearConfigCache();
    config.load();
  }

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f7-ui-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      [
        'navbar alignment: left',
        'landing expectations visible: true',
        'landing next rank visible: true',
        'landing get started visible: true',
        'logging: false',
      ].join('\n'),
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
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranks = require('../src/ranks');
    ranking = require('../src/ranking');
    config = require('../src/config');
    landing = require('../src/landing');
    ({ mountLandingView } = require('../src/landingView'));
    ({ renderAppNavbar } = require('../src/appShell'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();
    ranking.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');

    document.body.innerHTML = '<div id="root"></div>';
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

  describe('US-7.2 — See Next Rank Expectations', () => {
    it('Next tier listed center-right', () => {
      // Establish BRONZE III overall for the current week (Mon 2026-10-13 .. Sun 19)
      // BRONZE III only requires pike x8 — logging pike at 8 meets III; SILVER needs 12
      ranking.__setLocalDate('2026-10-17');
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 8, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 8, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-15', metrics: { reps: 8, sets: 3 } }),
        ],
      });

      const compared = ranking.compareToRanks('2026-10-13', { today: '2026-10-17' });
      expect(compared.data.overallTierName).toBe('BRONZE III');

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const nextPanel = root.querySelector('[data-panel="next-rank"]');
      expect(nextPanel).toBeTruthy();
      expect(nextPanel.querySelector('[data-next-tier-label]').textContent).toMatch(/SILVER I/);
      expect(nextPanel.querySelector('[data-exercise-id="pike-push-ups"]')).toBeTruthy();
      expect(nextPanel.textContent).toMatch(/Reps 12/);
    });
  });

  describe('US-7.3 — See Overall Rank Badge And Navbar', () => {
    it('Left navbar places badge top-left', () => {
      writeConfig([
        'navbar alignment: left',
        'landing expectations visible: true',
        'landing next rank visible: true',
        'logging: false',
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });

      const shell = document.createElement('div');
      shell.innerHTML = renderAppNavbar('landing', 'left');
      expect(shell.querySelector('[data-navbar-alignment="left"]')).toBeTruthy();
      expect(shell.querySelector('.app-navbar-left')).toBeTruthy();
      expect(shell.querySelector('[data-route="landing"]')).toBeTruthy();
      expect(shell.querySelector('[data-route="history"]')).toBeTruthy();
      expect(shell.querySelector('[data-route="ranks"]')).toBeTruthy();
      expect(shell.querySelector('[data-route="config"]')).toBeTruthy();

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      expect(root.querySelector('[data-navbar-alignment="left"]')).toBeTruthy();
      expect(root.querySelector('[data-badge-slot="top-left"]')).toBeTruthy();
      expect(root.querySelector('[data-overall-rank]')).toBeTruthy();
    });

    it('Top navbar places badge top-right', () => {
      writeConfig([
        'navbar alignment: top',
        'landing expectations visible: true',
        'landing next rank visible: true',
        'logging: false',
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });

      const shell = document.createElement('div');
      shell.innerHTML = renderAppNavbar('landing', 'top');
      expect(shell.querySelector('[data-navbar-alignment="top"]')).toBeTruthy();
      expect(shell.querySelector('.app-navbar-top')).toBeTruthy();

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      expect(root.querySelector('[data-navbar-alignment="top"]')).toBeTruthy();
      expect(root.querySelector('[data-badge-slot="top-right"]')).toBeTruthy();
      expect(root.querySelector('[data-overall-rank]')).toBeTruthy();
    });
  });

  describe('US-7.4 — See Completed State And Start Workout', () => {
    it('Get Started opens workout', () => {
      storage.writeStore({ schemaVersion: 1, entries: [] });
      let started = null;
      mount = mountLandingView(root, {
        localDate: '2026-10-17',
        onGetStarted: (model) => {
          started = model;
        },
      });

      const btn = root.querySelector('[data-action="get-started"]');
      expect(btn).toBeTruthy();
      btn.click();
      expect(started).toBeTruthy();
      expect(started.workoutComplete).toBe(false);

      // Simulate Feature 8 route mount
      const { mountActiveWorkoutView } = require('../src/activeWorkoutView');
      mount.destroy();
      mount = mountActiveWorkoutView(root, {
        localDate: started.localDate,
        expectations: started.todayExpectations,
      });
      expect(root.querySelector('[data-view="activeWorkout"]')).toBeTruthy();
      expect(root.textContent).toMatch(/Workout/);
      expect(root.querySelector('[data-workout-checklist]')).toBeTruthy();
    });

    it('Finished exercises show completed', () => {
      // Target when UNRANKED = BRONZE I (pike 4x3, push-ups 10x3)
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-17',
            metrics: { reps: 4, sets: 3 },
          }),
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-17',
            metrics: { reps: 10, sets: 3 },
          }),
        ],
      });

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const rows = root.querySelectorAll('[data-panel="today-expectations"] .expectation-row');
      expect(rows.length).toBeGreaterThanOrEqual(2);
      rows.forEach((row) => {
        expect(row.getAttribute('data-completed')).toBe('true');
        expect(row.classList.contains('is-completed')).toBe(true);
      });
      expect(root.querySelector('[data-workout-complete]')).toBeTruthy();
      expect(root.textContent).toMatch(/Today’s workout complete/);
      expect(root.querySelector('[data-action="get-started"]')).toBeNull();
    });
  });
});
