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
  '\t\tPULL:',
  '\t\t\t- pull-ups x[reps] x[sets]',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x[reps] x[sets]',
  'CORE:',
  '\tSTRENGTH:',
  '\t\t- chest-raises x[reps] x[sets]',
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
  'CORE:',
  '\tSTRENGTH:',
  '\t\t- chest-raises x8 x3',
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

describe('Feature 9 - History Day View', () => {
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
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
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

  describe('US-9.3 - Open Day Details And Edit', () => {
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

    it('retroactive add shows the logged-on day with the clock', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            entryId: 'e_same_day',
            exerciseId: 'pull-ups',
            localDate: '2026-10-03',
            metrics: { reps: 2, sets: 3 },
          }),
          {
            entryId: 'e_retro',
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-03',
            createdAt: '2026-10-17T15:45:12.000-05:00',
            updatedAt: '2026-10-17T15:45:12.000-05:00',
            completedAt: '2026-10-17T15:45:12.000-05:00',
            metrics: { reps: 4, sets: 3 },
          },
        ],
        workouts: [],
      });

      mount = mountHistoryDayView(root, {
        localDate: '2026-10-03',
        today: '2026-10-17',
        historyCalendar,
        history,
        catalog,
      });

      const same = root.querySelector('[data-entry-id="e_same_day"] [data-completed-at]');
      expect(same).toBeTruthy();
      expect(same.textContent).not.toMatch(/October/);

      const retro = root.querySelector('[data-entry-id="e_retro"] [data-completed-at]');
      expect(retro).toBeTruthy();
      expect(retro.getAttribute('data-entry-local-date')).toBe('2026-10-03');
      expect(retro.textContent).toMatch(/October 17, 2026/);
    });

    it('hides Add exercise on future days', () => {
      storage.writeStore({ schemaVersion: 1, entries: [], workouts: [] });

      mount = mountHistoryDayView(root, {
        localDate: '2026-10-20',
        today: '2026-10-17',
        historyCalendar,
        history,
        catalog,
      });

      expect(root.querySelector('[data-action="add-exercise"]')).toBeFalsy();
      expect(root.querySelector('[data-history-add-overlay]')).toBeFalsy();
    });

    it('Add exercise opens tour-style picker, creates entry, and opens Edit', () => {
      storage.writeStore({ schemaVersion: 1, entries: [], workouts: [] });

      mount = mountHistoryDayView(root, {
        localDate: '2026-10-03',
        today: '2026-10-17',
        historyCalendar,
        history,
        catalog,
      });

      const footerAdd = root.querySelector('.history-day-footer [data-action="add-exercise"]');
      expect(footerAdd).toBeTruthy();
      expect(footerAdd.textContent).toMatch(/Add exercise/i);
      footerAdd.click();

      const overlay = root.querySelector('[data-history-add-overlay]');
      expect(overlay).toBeTruthy();
      expect(overlay.querySelector('.history-add-card')).toBeTruthy();
      expect(overlay.querySelector('[data-action="cancel-add"]')).toBeTruthy();
      expect(overlay.querySelector('[data-action="confirm-add"]')).toBeFalsy();

      // ARMS STRENGTH shows Push/Pull; skill options include push/pull leaves.
      expect(overlay.querySelector('[data-action="add-subtype"]')).toBeTruthy();
      const skill = overlay.querySelector('[data-add-skill]');
      skill.value = 'pike-push-ups';
      skill.dispatchEvent(new Event('change', { bubbles: true }));
      expect(root.querySelector('[data-action="confirm-add"]')).toBeTruthy();

      root.querySelector('[data-action="confirm-add"]').click();

      const editForm = root.querySelector('#history-day-entry-form');
      expect(editForm).toBeTruthy();
      expect(root.querySelector('[data-dialog="day-entry"]')).toBeTruthy();
      expect(root.textContent).toMatch(/pike-push-ups/i);

      const store = storage.readStore();
      expect(store.data.entries.some((e) => e.exerciseId === 'pike-push-ups' && e.localDate === '2026-10-03')).toBe(
        true
      );
    });

    it('Add picker hides Push/Pull for CORE and still adds a skill', () => {
      storage.writeStore({ schemaVersion: 1, entries: [], workouts: [] });

      mount = mountHistoryDayView(root, {
        localDate: '2026-10-03',
        today: '2026-10-17',
        historyCalendar,
        history,
        catalog,
      });

      root.querySelector('[data-action="add-exercise"]').click();
      const focus = root.querySelector('[data-add-focus]');
      focus.value = 'core';
      focus.dispatchEvent(new Event('change', { bubbles: true }));

      expect(root.querySelector('[data-action="add-subtype"]')).toBeFalsy();
      const skill = root.querySelector('[data-add-skill]');
      expect([...skill.options].some((o) => o.value === 'chest-raises')).toBe(true);
      skill.value = 'chest-raises';
      skill.dispatchEvent(new Event('change', { bubbles: true }));
      root.querySelector('[data-action="confirm-add"]').click();

      expect(root.querySelector('#history-day-entry-form')).toBeTruthy();
      const store = storage.readStore();
      expect(store.data.entries.some((e) => e.exerciseId === 'chest-raises')).toBe(true);
    });
  });
});
