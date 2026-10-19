/**
 * Feature 8 — Active Workout
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

describe('Feature 8 — Active Workout (service)', () => {
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

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f8-workout-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'format.dat'), Buffer.from(FIXTURE_FORMAT, 'utf8'));
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['navbar alignment: left', 'logging: false'].join('\n'),
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

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranks = require('../src/ranks');
    ranking = require('../src/ranking');
    config = require('../src/config');
    landing = require('../src/landing');
    dailyLog = require('../src/dailyLog');
    workout = require('../src/workout');

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();
    ranking.__resetTestHooks();
    dailyLog.__resetTestHooks();
    workout.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');
    dailyLog.__setLocalDate('2026-10-17');
  });

  afterEach(() => {
    ranking.__resetTestHooks();
    dailyLog.__resetTestHooks();
    workout.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-8.2 — Complete And Save', () => {
    it('Complete saves and returns to landing', () => {
      const started = workout.start('2026-10-17');
      expect(started.ok).toBe(true);
      const pike = started.data.items.find((i) => i.exerciseId === 'pike-push-ups');
      expect(pike).toBeTruthy();
      pike.checked = true;
      pike.metrics = { reps: 4, sets: 3 };

      const completed = workout.complete(started.data);
      expect(completed.ok).toBe(true);
      expect(completed.data.localDate).toBe('2026-10-17');
      expect(completed.data.exerciseIds).toContain('pike-push-ups');

      const store = storage.readStore();
      expect(store.ok).toBe(true);
      const entry = store.data.entries.find(
        (e) => e.localDate === '2026-10-17' && e.exerciseId === 'pike-push-ups'
      );
      expect(entry).toBeTruthy();
      expect(entry.metrics).toEqual({ reps: 4, sets: 3 });
      expect(store.data.workouts.length).toBe(1);
      expect(store.data.workouts[0].exerciseIds).toContain('pike-push-ups');

      const model = landing.getLandingModel('2026-10-17');
      expect(model.ok).toBe(true);
      const landPike = model.data.todayExpectations.find((e) => e.exerciseId === 'pike-push-ups');
      expect(landPike.completed).toBe(true);
    });
  });

  describe('US-8.3 — Cancel Without Saving', () => {
    it('Cancel discards draft', () => {
      const before = storage.readStore();
      const entryCount = before.data.entries.length;
      const workoutCount = (before.data.workouts || []).length;

      const started = workout.start('2026-10-17');
      const pike = started.data.items.find((i) => i.exerciseId === 'pike-push-ups');
      pike.checked = true;
      pike.metrics = { reps: 4, sets: 3 };

      const cancelled = workout.cancel();
      expect(cancelled.ok).toBe(true);
      expect(workout.getDraft()).toBeNull();

      const after = storage.readStore();
      expect(after.data.entries).toHaveLength(entryCount);
      expect(after.data.workouts || []).toHaveLength(workoutCount);
      expect(
        after.data.entries.find((e) => e.exerciseId === 'pike-push-ups' && e.localDate === '2026-10-17')
      ).toBeUndefined();
    });
  });
});
