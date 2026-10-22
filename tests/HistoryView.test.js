/**
 * @jest-environment jsdom
 *
 * Feature 3 — Exercise History
 * Feature 5 — Dynamic Exercise Catalog
 * Spec: features/feature-3-Exercise-History.md
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
  '\t\t\t- bed-lifts x[reps] x[sets]',
  '',
].join('\n');

const FIXTURE_RANKS = ['UNRANKED:', 'badges/unranked.svg', '--------------', ''].join('\n');

function makeEntry(overrides) {
  return {
    entryId: overrides.entryId,
    exerciseId: overrides.exerciseId,
    localDate: overrides.localDate,
    createdAt: overrides.createdAt || `${overrides.localDate}T10:00:00.000-05:00`,
    updatedAt: overrides.updatedAt || `${overrides.localDate}T10:00:00.000-05:00`,
    metrics: overrides.metrics || { reps: 1, sets: 1 },
  };
}

describe('Feature 3 — Exercise History (History UI)', () => {
  let tempRoot;
  let dataDir;
  let history;
  let storage;
  let catalog;
  let dailyLog;
  let mountHistoryView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f3-ui-'));
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
    history = require('../src/history');
    ({ mountHistoryView } = require('../src/historyView'));

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
    mount = mountHistoryView(root, {
      history,
      catalog,
      confirm: confirmImpl || (() => true),
    });
    return mount;
  }

  describe('US-3.1 — Browse History', () => {
    it('User sees entries across dates', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          makeEntry({ entryId: 'e_a', exerciseId: 'pull-ups', localDate: '2026-10-10' }),
          makeEntry({ entryId: 'e_b', exerciseId: 'pull-ups', localDate: '2026-10-12' }),
          makeEntry({ entryId: 'e_c', exerciseId: 'pull-ups', localDate: '2026-10-17' }),
        ],
      });

      mountView();
      expect(root.querySelector('[data-view="history"]')).toBeTruthy();
      const groups = [...root.querySelectorAll('[data-date-group]')].map((el) =>
        el.getAttribute('data-date-group')
      );
      expect(groups).toEqual(['2026-10-17', '2026-10-12', '2026-10-10']);
      expect(root.querySelectorAll('.entry-row')).toHaveLength(3);
    });

    it('User filters by date', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          makeEntry({ entryId: 'e_a', exerciseId: 'pull-ups', localDate: '2026-10-10' }),
          makeEntry({ entryId: 'e_b', exerciseId: 'pull-ups', localDate: '2026-10-12' }),
        ],
      });

      mountView();
      const dateInput = root.querySelector('[name="filterDate"]');
      dateInput.value = '2026-10-10';
      root.querySelector('#history-filters').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const rows = root.querySelectorAll('.entry-row');
      expect(rows).toHaveLength(1);
      expect(rows[0].getAttribute('data-entry-id')).toBe('e_a');
      expect(root.querySelector('[data-date-group="2026-10-12"]')).toBeNull();
    });
  });

  describe('US-3.4 — Delete Any History Entry', () => {
    it('User deletes a history entry', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          makeEntry({
            entryId: 'e_1',
            exerciseId: 'pull-ups',
            localDate: '2026-10-10',
            metrics: { reps: 2, sets: 3 },
          }),
        ],
      });

      let confirmMsg = '';
      mountView((msg) => {
        confirmMsg = msg;
        return true;
      });

      root.querySelector('[data-action="delete"][data-entry-id="e_1"]').click();
      expect(confirmMsg).toBe('Delete this exercise entry?');
      expect(history.list().data.find((e) => e.entryId === 'e_1')).toBeUndefined();
      expect(root.querySelector('[data-entry-id="e_1"]')).toBeNull();
      expect(root.querySelector('[data-empty="history"]')).toBeTruthy();
    });
  });

  describe('US-5.3 — Keep Historical Orphans', () => {
    it('Deleted exercise remains in history', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          makeEntry({
            entryId: 'e_bed',
            exerciseId: 'bed-lifts',
            localDate: '2026-10-10',
            metrics: { reps: 5, sets: 3 },
          }),
        ],
      });

      fs.writeFileSync(
        path.join(dataDir, 'format.txt'),
        [
          'ARMS:',
          '\tSTRENGTH:',
          '\t\tPUSH:',
          '\t\t\t- pike-push-ups x[reps] x[sets]',
          '\t\tPULL:',
          '\t\t\t- pull-ups x[reps] x[sets]',
          '',
        ].join('\n'),
        'utf8'
      );
      catalog.reloadFromDisk();

      mountView();

      const row = root.querySelector('[data-entry-id="e_bed"]');
      expect(row).toBeTruthy();
      expect(row.getAttribute('data-orphan')).toBe('true');
      expect(row.textContent).toMatch(/Removed from catalog/);
      expect(row.textContent).toMatch(/Reps 5/);
      expect(row.textContent).toMatch(/Sets 3/);

      root.querySelector('[data-action="add-exercise"]').click();
      const options = [...root.querySelectorAll('#history-entry-form [name="exerciseId"] option')].map(
        (o) => o.value
      );
      expect(options).not.toContain('bed-lifts');
      expect(options).toContain('pull-ups');
    });
  });
});
