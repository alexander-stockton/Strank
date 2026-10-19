/**
 * @jest-environment jsdom
 *
 * Feature 9 — Workout History Calendar
 * Spec: features/feature-9-Workout-History-Calendar.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_FORMAT = [
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPULL:',
  '\t\t\t- pull-ups x[reps] x[sets]',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x[reps] x[sets]',
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
  '\t\tPULL:',
  '\t\t\t- pull-ups x2 x3',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x4 x3',
  '',
].join('\n');

function entry(overrides) {
  return {
    entryId: overrides.entryId || `e_${overrides.localDate}_${overrides.exerciseId}`,
    exerciseId: overrides.exerciseId,
    localDate: overrides.localDate,
    createdAt: `${overrides.localDate}T10:00:00.000-05:00`,
    updatedAt: `${overrides.localDate}T10:00:00.000-05:00`,
    metrics: overrides.metrics || { reps: 2, sets: 3 },
  };
}

describe('Feature 9 — History Day View', () => {
  let tempRoot;
  let dataDir;
  let ranking;
  let storage;
  let catalog;
  let ranksMod;
  let history;
  let historyCalendar;
  let mountHistoryDayView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f9-day-'));
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
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranksMod = require('../src/ranks');
    ranking = require('../src/ranking');
    history = require('../src/history');
    historyCalendar = require('../src/historyCalendar');
    ({ mountHistoryDayView } = require('../src/historyDayView'));

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

  describe('US-9.3 — Open Day Details And Edit', () => {
    it('Day detail shows exercises and day rank', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pull-ups',
            localDate: '2026-10-03',
            metrics: { reps: 2, sets: 3 },
          }),
        ],
        workouts: [],
      });

      const dayRank = ranking.compareDay('2026-10-03', { today: '2026-10-17' });
      expect(dayRank.data.overallTierName).toBe('BRONZE I');

      mount = mountHistoryDayView(root, {
        localDate: '2026-10-03',
        today: '2026-10-17',
        historyCalendar,
        history,
        ranking,
      });

      expect(root.querySelector('[data-view="historyDay"]')).toBeTruthy();
      expect(root.querySelector('[data-exercise-id="pull-ups"]')).toBeTruthy();
      expect(root.textContent).toMatch(/pull-ups/i);
      expect(root.querySelector('[data-day-rank]').getAttribute('data-day-rank')).toBe('BRONZE I');
      expect(root.querySelector('[data-day-heading]').textContent).toMatch(/October 3, 2026/);
    });

    it('User edits a mistaken entry', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            entryId: 'e_pull_edit',
            exerciseId: 'pull-ups',
            localDate: '2026-10-03',
            metrics: { reps: 2, sets: 3 },
          }),
        ],
        workouts: [],
      });

      mount = mountHistoryDayView(root, {
        localDate: '2026-10-03',
        today: '2026-10-17',
        historyCalendar,
        history,
        confirm: () => true,
      });

      root.querySelector('[data-action="edit"][data-entry-id="e_pull_edit"]').click();
      const form = root.querySelector('#history-day-entry-form');
      expect(form).toBeTruthy();
      const reps = form.querySelector('[name="metric-reps"]');
      reps.value = '3';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const row = root.querySelector('[data-entry-id="e_pull_edit"]');
      expect(row.querySelector('[data-metrics]').textContent).toMatch(/Reps 3/);

      const store = storage.readStore();
      const saved = store.data.entries.find((e) => e.entryId === 'e_pull_edit');
      expect(saved.metrics.reps).toBe(3);
    });
  });
});
