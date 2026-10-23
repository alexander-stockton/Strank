/**
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

describe('Feature 8 - Active Workout (service)', () => {
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
  });

  afterEach(() => {
    ranking.__resetTestHooks();
    dailyLog.__resetTestHooks();
    workout.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-8.2 - Complete And Save', () => {
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

    it('timer pauses off-session and durationMs is stored on Complete', () => {
      const started = workout.start('2026-10-17');
      expect(started.ok).toBe(true);
      workout.resumeSessionTimer(1_000);
      expect(workout.getSessionElapsedMs(1_500)).toBe(500);
      workout.pauseSessionTimer(2_000);
      expect(workout.getSessionElapsedMs(9_000)).toBe(1_000);
      workout.resumeSessionTimer(9_000);
      expect(workout.getSessionElapsedMs(9_250)).toBe(1_250);

      const pike = started.data.items.find((i) => i.exerciseId === 'pike-push-ups');
      pike.checked = true;
      pike.completedAt = '2026-10-17T12:00:00.000-05:00';
      pike.metrics = { reps: 4, sets: 3 };

      const completed = workout.complete(started.data);
      expect(completed.ok).toBe(true);
      expect(completed.data.durationMs).toBeGreaterThanOrEqual(1_250);

      const store = storage.readStore();
      expect(store.data.workouts[0].durationMs).toBe(completed.data.durationMs);
      const entry = store.data.entries.find((e) => e.exerciseId === 'pike-push-ups');
      expect(entry.completedAt).toBe('2026-10-17T12:00:00.000-05:00');

      const model = landing.getLandingModel('2026-10-17');
      expect(model.data.workoutDurationMs).toBe(completed.data.durationMs);
      expect(model.data.todayExpectations.find((e) => e.exerciseId === 'pike-push-ups').completedAt).toBe(
        '2026-10-17T12:00:00.000-05:00'
      );
    });

    it('returning via Get Started continues prior duration and can count up again', () => {
      const first = workout.start('2026-10-17');
      workout.resumeSessionTimer(0);
      workout.pauseSessionTimer(2_000);
      const pike = first.data.items.find((i) => i.exerciseId === 'pike-push-ups');
      pike.checked = true;
      pike.metrics = { reps: 4, sets: 3 };
      const saved = workout.complete(first.data);
      expect(saved.ok).toBe(true);
      expect(saved.data.durationMs).toBe(2_000);

      const second = workout.start('2026-10-17');
      expect(second.ok).toBe(true);
      expect(second.data.timer.elapsedMs).toBe(2_000);
      expect(second.data.timer.runningSince).toBeNull();
      workout.resumeSessionTimer(10_000);
      expect(workout.getSessionElapsedMs(10_500)).toBe(2_500);
    });
  });

  describe('resume / mistaken complete', () => {
    it('unchecking a previously saved exercise on Complete removes its entry', () => {
      // First session: complete pike + push-ups
      const first = workout.start('2026-10-17');
      expect(first.ok).toBe(true);
      for (const id of ['pike-push-ups', 'push-ups']) {
        const item = first.data.items.find((i) => i.exerciseId === id);
        expect(item).toBeTruthy();
        item.checked = true;
        item.metrics = { reps: id === 'pike-push-ups' ? 4 : 10, sets: 3 };
      }
      expect(workout.complete(first.data).ok).toBe(true);
      expect(
        storage.readStore().data.entries.filter((e) => e.localDate === '2026-10-17')
      ).toHaveLength(2);

      // Resume: uncheck push-ups (mistaken), keep pike, Complete again
      const resumed = workout.start('2026-10-17');
      expect(resumed.ok).toBe(true);
      const pike = resumed.data.items.find((i) => i.exerciseId === 'pike-push-ups');
      const push = resumed.data.items.find((i) => i.exerciseId === 'push-ups');
      expect(pike.checked).toBe(true);
      expect(push.checked).toBe(true);
      push.checked = false;

      const saved = workout.complete(resumed.data);
      expect(saved.ok).toBe(true);

      const store = storage.readStore();
      expect(
        store.data.entries.find((e) => e.exerciseId === 'pike-push-ups' && e.localDate === '2026-10-17')
      ).toBeTruthy();
      expect(
        store.data.entries.find((e) => e.exerciseId === 'push-ups' && e.localDate === '2026-10-17')
      ).toBeUndefined();

      const model = landing.getLandingModel('2026-10-17');
      expect(model.ok).toBe(true);
      expect(model.data.todayExpectations.find((e) => e.exerciseId === 'pike-push-ups').completed).toBe(
        true
      );
      expect(model.data.todayExpectations.find((e) => e.exerciseId === 'push-ups').completed).toBe(
        false
      );
    });
  });

  describe('day-local Custom exercises', () => {
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

    it('addCustomExercise puts unplanned skill under Custom without changing other days', () => {
      writeArmsOnlySaturdayPlusCoreCatalog();
      // 2026-10-17 is Saturday → Arms plan only
      const started = workout.start('2026-10-17');
      expect(started.ok).toBe(true);
      expect(started.data.items.every((i) => i.exerciseId !== 'dragon-flag-negatives')).toBe(true);

      const added = workout.addCustomExercise('dragon-flag-negatives');
      expect(added.ok).toBe(true);
      expect(added.item.custom).toBe(true);
      expect(added.item.headers).toEqual(['Custom']);
      expect(workout.isCustomItem(added.item)).toBe(true);

      const draftIds = started.data.items.map((i) => i.exerciseId);
      expect(draftIds).toContain('dragon-flag-negatives');
      expect(draftIds).toContain('pike-push-ups');

      const custom = started.data.items.find((i) => i.exerciseId === 'dragon-flag-negatives');
      custom.checked = true;
      custom.metrics = { reps: 3, sets: 2 };
      expect(workout.complete(started.data).ok).toBe(true);

      const store = storage.readStore();
      expect(
        store.data.entries.find(
          (e) => e.localDate === '2026-10-17' && e.exerciseId === 'dragon-flag-negatives'
        )
      ).toBeTruthy();

      // Next day (Sunday): no Arms/Core focus → empty plan; custom from Saturday must not appear
      ranking.__setLocalDate('2026-10-18');
      dailyLog.__setLocalDate('2026-10-18');
      const next = workout.start('2026-10-18');
      expect(next.ok).toBe(true);
      expect(next.data.items.find((i) => i.exerciseId === 'dragon-flag-negatives')).toBeUndefined();

      // Monday Core plan still lists dragon-flag under Core headers, not as leftover Custom
      ranking.__setLocalDate('2026-10-19');
      dailyLog.__setLocalDate('2026-10-19');
      const monday = workout.start('2026-10-19');
      expect(monday.ok).toBe(true);
      const planned = monday.data.items.find((i) => i.exerciseId === 'dragon-flag-negatives');
      expect(planned).toBeTruthy();
      expect(planned.custom).toBe(false);
      expect(planned.headers.join('>')).toMatch(/CORE/i);
    });

    it('re-adding a planned exercise does not move it into Custom', () => {
      writeArmsOnlySaturdayPlusCoreCatalog();
      const started = workout.start('2026-10-17');
      const before = started.data.items.find((i) => i.exerciseId === 'pike-push-ups');
      expect(before.custom).toBe(false);

      const again = workout.addCustomExercise('pike-push-ups');
      expect(again.ok).toBe(true);
      expect(again.alreadyPresent).toBe(true);
      const after = started.data.items.find((i) => i.exerciseId === 'pike-push-ups');
      expect(after.custom).toBe(false);
      expect(after.headers.join('>')).toMatch(/ARMS/i);
    });

    it('same-day logged orphan reloads into Custom', () => {
      writeArmsOnlySaturdayPlusCoreCatalog();
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          {
            entryId: 'e_orphan',
            exerciseId: 'dragon-flag-negatives',
            localDate: '2026-10-17',
            createdAt: '2026-10-17T12:00:00.000-05:00',
            updatedAt: '2026-10-17T12:00:00.000-05:00',
            completedAt: '2026-10-17T12:00:00.000-05:00',
            metrics: { reps: 2, sets: 1 },
          },
        ],
        workouts: [],
      });

      const started = workout.start('2026-10-17');
      expect(started.ok).toBe(true);
      const orphan = started.data.items.find((i) => i.exerciseId === 'dragon-flag-negatives');
      expect(orphan).toBeTruthy();
      expect(orphan.custom).toBe(true);
      expect(orphan.checked).toBe(true);
      expect(orphan.metrics).toEqual({ reps: 2, sets: 1 });
    });
  });

  describe('US-8.3 - Cancel Without Saving', () => {
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
