/**
 * Feature 7 — Landing Page
 * Spec: features/feature-7-Landing-Page.md
 * Feature 14 — Landing Day Focus
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
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
  'CORE:',
  '\t- sit-ups x[reps] x[sets]',
  'LUNGS:',
  '\t- running x[distance]',
  'LEGS:',
  '\t- squats x[reps] x[sets]',
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
  'CORE:',
  '\t- sit-ups x10 x3',
  'LUNGS:',
  '\t- running x1',
  'LEGS:',
  '\t- squats x10 x3',
  '',
  'BRONZE II:',
  '{badges/bronze-ii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x8 x3',
  '',
].join('\n');

const ALL_FOCUS_DAYS = [
  'focus arms days: mon,tue,wed,thu,fri,sat,sun',
  'focus core days: mon,tue,wed,thu,fri,sat,sun',
  'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
  'focus legs days: mon,tue,wed,thu,fri,sat,sun',
].join('\n');

describe('Feature 7 — Landing Page (services)', () => {
  let tempRoot;
  let dataDir;
  let landing;
  let ranking;
  let catalog;
  let ranks;
  let storage;
  let config;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f7-landing-'));
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
      ALL_FOCUS_DAYS + '\n',
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
    ranking.__setLocalDate('2026-10-17');
  });

  afterEach(() => {
    ranking.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-7.1 — See Today’s Expected Exercises', () => {
    it('Landing lists today’s increments center-left', () => {
      // UNRANKED → target = first tier BRONZE I
      storage.writeStore({ schemaVersion: 1, entries: [] });

      const today = landing.getTodayExpectations('2026-10-17');
      expect(today.ok).toBe(true);
      expect(today.targetTierName).toBe('BRONZE I');

      const pike = today.data.find((e) => e.exerciseId === 'pike-push-ups');
      expect(pike).toBeTruthy();
      expect(pike.targets.reps).toBe(4);
      expect(pike.targets.sets).toBe(3);
      expect(pike.headers.join('>')).toBe('ARMS>STRENGTH>PUSH');

      const model = landing.getLandingModel('2026-10-17');
      expect(model.ok).toBe(true);
      expect(model.data.todayExpectations.find((e) => e.exerciseId === 'pike-push-ups')).toBeTruthy();
      expect(model.data.targetTierName).toBe('BRONZE I');
    });

    it('keeps day-start expectations after mid-day rank-up', () => {
      // Prior days put overall at BRONZE I → day-start target = BRONZE II (next higher).
      // Completing BRONZE II work today would raise overall further; today’s list must stay BRONZE II.
      function entry(exerciseId, localDate, metrics) {
        return {
          entryId: `e_${localDate}_${exerciseId}`,
          exerciseId,
          localDate,
          createdAt: `${localDate}T10:00:00.000Z`,
          updatedAt: `${localDate}T10:00:00.000Z`,
          metrics,
        };
      }

      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry('pike-push-ups', '2026-10-13', { reps: 4, sets: 3 }),
          entry('pike-push-ups', '2026-10-14', { reps: 4, sets: 3 }),
          entry('pike-push-ups', '2026-10-15', { reps: 4, sets: 3 }),
          entry('push-ups', '2026-10-13', { reps: 10, sets: 3 }),
          entry('push-ups', '2026-10-14', { reps: 10, sets: 3 }),
          entry('push-ups', '2026-10-15', { reps: 10, sets: 3 }),
        ],
      });

      const before = landing.getTodayExpectations('2026-10-17');
      expect(before.ok).toBe(true);
      expect(before.targetTierName).toBe('BRONZE II');
      expect(before.data.find((e) => e.exerciseId === 'pike-push-ups').targets.reps).toBe(8);

      // Today’s logs meet BRONZE II thresholds (would advance live overall).
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry('pike-push-ups', '2026-10-13', { reps: 4, sets: 3 }),
          entry('pike-push-ups', '2026-10-14', { reps: 4, sets: 3 }),
          entry('pike-push-ups', '2026-10-15', { reps: 4, sets: 3 }),
          entry('push-ups', '2026-10-13', { reps: 10, sets: 3 }),
          entry('push-ups', '2026-10-14', { reps: 10, sets: 3 }),
          entry('push-ups', '2026-10-15', { reps: 10, sets: 3 }),
          entry('pike-push-ups', '2026-10-17', { reps: 8, sets: 3 }),
        ],
      });

      const live = ranking.compareToRanks('2026-10-13', { today: '2026-10-17' });
      expect(live.ok).toBe(true);
      expect(live.data.overallTierName).not.toBe('UNRANKED');

      const after = landing.getTodayExpectations('2026-10-17');
      expect(after.ok).toBe(true);
      expect(after.targetTierName).toBe('BRONZE II');
      expect(after.data.find((e) => e.exerciseId === 'pike-push-ups').targets.reps).toBe(8);
    });
  });

  describe('US-14.2 — Customize Weekday Muscle Focus', () => {
    it('Today’s expectations follow day focus', () => {
      // Monday 2026-10-12: Arms + Lungs by default; Core + Legs not scheduled
      const landingConfig = require('../src/landingConfig');
      landingConfig.update({
        'focus arms days': 'mon,thu',
        'focus core days': 'tue,fri',
        'focus lungs days': 'mon,wed,fri',
        'focus legs days': 'wed,sat',
      });
      ranking.__setLocalDate('2026-10-12');
      storage.writeStore({ schemaVersion: 1, entries: [] });

      const today = landing.getTodayExpectations('2026-10-12');
      expect(today.ok).toBe(true);
      expect(today.emptyFocus).toBe(false);
      expect(today.focusGroups.sort()).toEqual(['arms', 'lungs']);
      expect(today.data.find((e) => e.exerciseId === 'pike-push-ups')).toBeTruthy();
      expect(today.data.find((e) => e.exerciseId === 'push-ups')).toBeTruthy();
      expect(today.data.find((e) => e.exerciseId === 'running')).toBeTruthy();
      expect(today.data.find((e) => e.exerciseId === 'sit-ups')).toBeFalsy();
      expect(today.data.find((e) => e.exerciseId === 'squats')).toBeFalsy();
    });
  });
});
