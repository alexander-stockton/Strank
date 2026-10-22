/**
 * @jest-environment jsdom
 *
 * Feature 9 - Workout History Calendar
 * Spec: features/feature-9-Workout-History-Calendar.md
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
  '\t\tPULL:',
  '\t\t\t- pull-ups x[reps] x[sets]',
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
  '\t\tPULL:',
  '\t\t\t- pull-ups x2 x3',
  '',
  'BRONZE II:',
  '{badges/bronze-ii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x4 x3',
  '',
  'SILVER I:',
  '{badges/silver-i.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x12 x3',
  '',
].join('\n');

function entry(overrides) {
  return {
    entryId: overrides.entryId || `e_${overrides.localDate}_${overrides.exerciseId}`,
    exerciseId: overrides.exerciseId,
    localDate: overrides.localDate,
    createdAt: `${overrides.localDate}T10:00:00.000-05:00`,
    updatedAt: `${overrides.localDate}T10:00:00.000-05:00`,
    metrics: overrides.metrics || { reps: 4, sets: 3 },
  };
}

describe('Feature 9 - Workout History Calendar', () => {
  let tempRoot;
  let dataDir;
  let ranking;
  let storage;
  let catalog;
  let ranksMod;
  let historyCalendar;
  let mountHistoryCalendarView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f9-cal-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
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
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranksMod = require('../src/ranks');
    ranking = require('../src/ranking');
    historyCalendar = require('../src/historyCalendar');
    ({ mountHistoryCalendarView } = require('../src/historyCalendarView'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranksMod.clearRanksCache();
    catalog.loadLiveCatalog();
    ranksMod.loadRanks();
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

  describe('US-9.1 - View Month Calendar', () => {
    it('Recorded days use blue cell white number', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-03' })],
        workouts: [],
      });

      mount = mountHistoryCalendarView(root, {
        ranking,
        historyCalendar,
        today: '2026-10-17',
        year: 2026,
        month: 10,
      });

      const day3 = root.querySelector('[data-date="2026-10-03"]');
      const day4 = root.querySelector('[data-date="2026-10-04"]');
      expect(day3.classList.contains('recorded')).toBe(true);
      expect(day3.classList.contains('unrecorded')).toBe(false);
      expect(day4.classList.contains('unrecorded')).toBe(true);
      expect(day4.classList.contains('recorded')).toBe(false);
    });

    it('Month heading shows progression badges', () => {
      const orig = ranking.getMonthProgression;
      ranking.getMonthProgression = () => ({
        ok: true,
        data: {
          startTierName: 'BRONZE I',
          endTierName: 'SILVER I',
          endKind: 'latestFinishedWeek',
          year: 2026,
          month: 10,
        },
      });

      mount = mountHistoryCalendarView(root, {
        ranking,
        historyCalendar,
        today: '2026-10-17',
        year: 2026,
        month: 10,
      });

      const prog = root.querySelector('[data-month-progression]');
      expect(prog).toBeTruthy();
      expect(prog.querySelector('[data-start-tier]').getAttribute('data-start-tier')).toBe('BRONZE I');
      expect(prog.querySelector('.progression-arrow')).toBeTruthy();
      expect(prog.querySelector('[data-end-tier]').getAttribute('data-end-tier')).toBe('SILVER I');

      ranking.getMonthProgression = orig;
    });
  });

  describe('US-9.2 - See Weekly Rank Badges', () => {
    it('Week shows rank badge', () => {
      // Spec scenario cites week starting 2026-10-13; that calendar week’s Monday is 2026-10-12
      // (Tue 13-Sun 18). today Sat 17 -> passed days through Fri 16 (>=3).
      const weekStart = ranking.mondayOf('2026-10-13');
      expect(weekStart).toBe('2026-10-12');

      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-12',
            metrics: { reps: 12, sets: 3 },
          }),
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-13',
            metrics: { reps: 12, sets: 3 },
          }),
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-14',
            metrics: { reps: 12, sets: 3 },
          }),
        ],
        workouts: [],
      });

      const compared = ranking.compareToRanks(weekStart, { today: '2026-10-17' });
      expect(compared.data.overallTierName).toBe('SILVER I');

      mount = mountHistoryCalendarView(root, {
        ranking,
        historyCalendar,
        today: '2026-10-17',
        year: 2026,
        month: 10,
      });

      const weekRow = root.querySelector(`[data-week-start="${weekStart}"]`);
      expect(weekRow).toBeTruthy();
      expect(weekRow.querySelector('[data-week-badge]').getAttribute('data-week-badge')).toBe('SILVER I');
    });
  });

  describe('US-9.4 - Navigate Time, Zoom Levels, And Back', () => {
    it('Jump month and year', () => {
      mount = mountHistoryCalendarView(root, {
        ranking,
        historyCalendar,
        today: '2026-10-17',
        year: 2026,
        month: 10,
      });

      expect(root.querySelector('[data-month-name]').textContent).toBe('October');
      expect(root.querySelector('[data-action="zoom-year"]').textContent).toBe('2026');

      root.querySelector('[data-action="next-month"]').click();
      expect(root.querySelector('[data-month-name]').textContent).toBe('November');
      expect(root.querySelector('[data-action="zoom-year"]').textContent).toBe('2026');

      root.querySelector('[data-action="prev-year"]').click();
      expect(root.querySelector('[data-month-name]').textContent).toBe('November');
      expect(root.querySelector('[data-action="zoom-year"]').textContent).toBe('2025');
    });

    it('Click year opens years overview', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2025-06-02' }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-03' }),
        ],
        workouts: [],
      });

      mount = mountHistoryCalendarView(root, {
        ranking,
        historyCalendar,
        today: '2026-10-17',
        year: 2026,
        month: 10,
      });

      root.querySelector('[data-action="zoom-year"]').click();
      expect(root.querySelector('[data-view="historyYears"]')).toBeTruthy();
      expect(root.querySelector('[data-year="2025"]')).toBeTruthy();
      expect(root.querySelector('[data-year="2026"]')).toBeTruthy();
      expect(root.querySelector('[data-year-progression="2026"] .progression-arrow')).toBeTruthy();
      expect(root.querySelector('[data-year-progression="2025"] [data-start-tier]')).toBeTruthy();

      // Whole year row is clickable -> same month number as today, in that year
      root.querySelector('.year-row-clickable[data-year="2025"]').click();
      expect(root.querySelector('[data-view="workoutHistory"]')).toBeTruthy();
      expect(root.querySelector('[data-month-name]').textContent).toBe('October');
      expect(root.querySelector('[data-action="zoom-year"]').textContent).toBe('2025');
    });

    it('Back stack returns through zoom levels', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-03' })],
        workouts: [],
      });

      let landed = false;
      mount = mountHistoryCalendarView(root, {
        ranking,
        historyCalendar,
        today: '2026-10-17',
        year: 2026,
        month: 10,
        onBack: () => {
          landed = true;
        },
      });

      root.querySelector('.cal-day-btn[data-date="2026-10-03"]').click();
      expect(root.querySelector('[data-view="historyDay"]')).toBeTruthy();

      root.querySelector('[data-action="back"]').click();
      expect(root.querySelector('[data-view="workoutHistory"]')).toBeTruthy();
      expect(root.querySelector('[data-month-name]').textContent).toBe('October');

      root.querySelector('[data-action="back-landing"]').click();
      expect(landed).toBe(true);
    });
  });
});
