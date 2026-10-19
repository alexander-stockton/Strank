/**
 * @jest-environment jsdom
 *
 * Feature 2 — Daily Exercise Log
 * Feature 5 — Dynamic Exercise Catalog
 * Spec: features/feature-2-Daily-Exercise-Log.md
 * Spec: features/feature-5-Dynamic-Exercise-Catalog.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_FORMAT = [
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x[reps] x[sets]',
  '\t\tPULL:',
  '\t\t\t- pull-ups x[reps] x[sets]',
  '',
].join('\n');

const FIXTURE_RANKS = ['UNRANKED:', 'badges/unranked.svg', '--------------', ''].join('\n');

describe('Feature 2 — Daily Exercise Log (Today UI)', () => {
  let tempRoot;
  let dataDir;
  let dailyLog;
  let storage;
  let catalog;
  let mountTodayView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f2-ui-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    dailyLog = require('../src/dailyLog');
    ({ mountTodayView } = require('../src/todayView'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    catalog.loadLiveCatalog();
    dailyLog.__resetTestHooks();
    dailyLog.__setLocalDate('2026-10-17');

    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    dailyLog.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  function mountView(confirmImpl) {
    mount = mountTodayView(root, {
      dailyLog,
      catalog,
      confirm: confirmImpl || (() => true),
      tickMs: 0,
    });
    return mount;
  }

  describe('US-2.1 — Log Today’s Exercise', () => {
    it('User logs a valid exercise for today', () => {
      mountView();
      expect(root.querySelector('[data-view="today"]')).toBeTruthy();

      root.querySelector('[data-action="add-exercise"]').click();
      const form = root.querySelector('#entry-form');
      expect(form).toBeTruthy();

      const select = form.querySelector('[name="exerciseId"]');
      select.value = 'pike-push-ups';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      const reps = root.querySelector('[name="metric-reps"]');
      const sets = root.querySelector('[name="metric-sets"]');
      expect(reps).toBeTruthy();
      expect(sets).toBeTruthy();
      reps.value = '4';
      sets.value = '3';

      root.querySelector('#entry-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const listed = dailyLog.listToday();
      expect(listed.ok).toBe(true);
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0].metrics).toEqual({ reps: 4, sets: 3 });
      expect(listed.data[0].localDate).toBe('2026-10-17');

      const row = root.querySelector('[data-entry-id]');
      expect(row).toBeTruthy();
      expect(row.textContent).toMatch(/pike-push-ups|Reps 4/i);
      expect(row.textContent).toMatch(/4/);
      expect(row.textContent).toMatch(/3/);
    });
  });

  describe('US-2.2 — View Today’s Exercises', () => {
    it('Today lists only today’s entries', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          {
            entryId: 'e_today',
            exerciseId: 'pull-ups',
            localDate: '2026-10-17',
            createdAt: '2026-10-17T10:00:00.000-05:00',
            updatedAt: '2026-10-17T10:00:00.000-05:00',
            metrics: { reps: 5, sets: 3 },
          },
          {
            entryId: 'e_yesterday',
            exerciseId: 'pull-ups',
            localDate: '2026-10-16',
            createdAt: '2026-10-16T10:00:00.000-05:00',
            updatedAt: '2026-10-16T10:00:00.000-05:00',
            metrics: { reps: 4, sets: 3 },
          },
        ],
      });

      mountView();
      const rows = root.querySelectorAll('.entry-row');
      expect(rows).toHaveLength(1);
      expect(rows[0].getAttribute('data-entry-id')).toBe('e_today');
      expect(root.querySelector('[data-entry-id="e_yesterday"]')).toBeNull();
    });
  });

  describe('US-2.3 — Edit Today’s Exercise', () => {
    it('User updates today’s entry', () => {
      const created = dailyLog.createToday({
        exerciseId: 'pike-push-ups',
        reps: 4,
        sets: 3,
      });
      mountView();

      root.querySelector(`[data-action="edit"][data-entry-id="${created.data.entryId}"]`).click();
      const reps = root.querySelector('[name="metric-reps"]');
      reps.value = '6';
      root.querySelector('#entry-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const listed = dailyLog.listToday();
      expect(listed.data[0].metrics.reps).toBe(6);
      expect(root.querySelector('.entry-metrics').textContent).toMatch(/6/);
    });
  });

  describe('US-2.4 — Delete Today’s Exercise', () => {
    it('User deletes today’s entry', () => {
      const created = dailyLog.createToday({
        exerciseId: 'pike-push-ups',
        reps: 4,
        sets: 3,
      });
      const entryId = created.data.entryId;
      let confirmMsg = '';
      mountView((msg) => {
        confirmMsg = msg;
        return true;
      });

      root.querySelector(`[data-action="delete"][data-entry-id="${entryId}"]`).click();
      expect(confirmMsg).toBe('Delete this exercise entry?');

      expect(dailyLog.listToday().data.find((e) => e.entryId === entryId)).toBeUndefined();
      expect(root.querySelector(`[data-entry-id="${entryId}"]`)).toBeNull();
      expect(root.querySelector('[data-empty="today"]')).toBeTruthy();
    });
  });

  describe('US-5.2 — Forms Follow Live Definitions', () => {
    it('Entry fields update after schema change', () => {
      fs.writeFileSync(
        path.join(dataDir, 'format.txt'),
        [
          'CORE:',
          '\tSTRENGTH:',
          '\t\t- plank-hold ([duration]) x[sets]',
          '',
        ].join('\n'),
        'utf8'
      );
      catalog.reloadFromDisk();
      mountView();

      root.querySelector('[data-action="add-exercise"]').click();
      const select = root.querySelector('[name="exerciseId"]');
      select.value = 'plank-hold';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      expect(root.querySelector('[name="metric-durationSeconds"]')).toBeTruthy();
      expect(root.querySelector('[name="metric-sets"]')).toBeTruthy();
      expect(root.querySelector('[name="metric-weight"]')).toBeNull();
      expect(root.querySelector('[name="metric-reps"]')).toBeNull();

      root.querySelector('[data-action="cancel-dialog"]').click();

      fs.writeFileSync(
        path.join(dataDir, 'format.txt'),
        [
          'CORE:',
          '\tSTRENGTH:',
          '\t\t- plank-hold #[weight] ([duration]) x[sets]',
          '',
        ].join('\n'),
        'utf8'
      );
      root.querySelector('[data-action="reload-catalog"]').click();

      root.querySelector('[data-action="add-exercise"]').click();
      const select2 = root.querySelector('[name="exerciseId"]');
      select2.value = 'plank-hold';
      select2.dispatchEvent(new Event('change', { bubbles: true }));

      expect(root.querySelector('[name="metric-durationSeconds"]')).toBeTruthy();
      expect(root.querySelector('[name="metric-sets"]')).toBeTruthy();
      expect(root.querySelector('[name="metric-weight"]')).toBeTruthy();
      expect(root.querySelector('[name="metric-reps"]')).toBeNull();
    });
  });
});
