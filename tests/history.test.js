/**
 * Feature 3 — Exercise History
 * Spec: features/feature-3-Exercise-History.md
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

describe('Feature 3 — Exercise History', () => {
  let tempRoot;
  let dataDir;
  let history;
  let storage;
  let catalog;
  let dailyLog;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f3-'));
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

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    catalog.loadLiveCatalog();
    dailyLog.__resetTestHooks();
    dailyLog.__setLocalDate('2026-10-17');
  });

  afterEach(() => {
    dailyLog.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-3.1 — Browse History', () => {
    it('User sees entries across dates', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          makeEntry({ entryId: 'e_a', exerciseId: 'pull-ups', localDate: '2026-10-10', metrics: { reps: 2, sets: 3 } }),
          makeEntry({ entryId: 'e_b', exerciseId: 'pull-ups', localDate: '2026-10-12', metrics: { reps: 3, sets: 3 } }),
          makeEntry({ entryId: 'e_c', exerciseId: 'pull-ups', localDate: '2026-10-17', metrics: { reps: 4, sets: 3 } }),
        ],
      });

      const listed = history.list();
      expect(listed.ok).toBe(true);
      expect(listed.data).toHaveLength(3);
      expect(listed.data.map((e) => e.localDate)).toEqual(['2026-10-17', '2026-10-12', '2026-10-10']);
    });

    it('User filters by date', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          makeEntry({ entryId: 'e_a', exerciseId: 'pull-ups', localDate: '2026-10-10' }),
          makeEntry({ entryId: 'e_b', exerciseId: 'pull-ups', localDate: '2026-10-12' }),
        ],
      });

      const listed = history.list({ localDate: '2026-10-10' });
      expect(listed.ok).toBe(true);
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0].localDate).toBe('2026-10-10');
      expect(listed.data[0].entryId).toBe('e_a');
    });
  });

  describe('US-3.2 — Add Entry on Any Date', () => {
    it('User backfills a past exercise', () => {
      const created = history.create({
        exerciseId: 'bed-lifts',
        localDate: '2026-10-10',
        reps: 5,
        sets: 3,
      });
      expect(created.ok).toBe(true);
      expect(created.data.localDate).toBe('2026-10-10');
      expect(created.data.metrics).toEqual({ reps: 5, sets: 3 });

      const listed = history.list({ localDate: '2026-10-10' });
      expect(listed.data.some((e) => e.entryId === created.data.entryId)).toBe(true);
    });

    it('Future date is rejected', () => {
      const created = history.create({
        exerciseId: 'pull-ups',
        localDate: '2026-10-18',
        reps: 2,
        sets: 3,
      });
      expect(created.ok).toBe(false);
      expect(created.message).toBe('Date cannot be in the future.');
      expect(storage.readStore().data.entries).toHaveLength(0);
    });
  });

  describe('US-3.3 — Edit Any History Entry', () => {
    it('User updates a past entry', () => {
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

      const updated = history.update('e_1', { sets: 4 });
      expect(updated.ok).toBe(true);
      expect(updated.data.metrics.sets).toBe(4);
      expect(updated.data.metrics.reps).toBe(2);

      const listed = history.list();
      expect(listed.data.find((e) => e.entryId === 'e_1').metrics.sets).toBe(4);
    });

    it('User moves an entry to another past date', () => {
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

      const updated = history.update('e_1', { localDate: '2026-10-11' });
      expect(updated.ok).toBe(true);
      expect(updated.data.localDate).toBe('2026-10-11');

      const onNew = history.list({ localDate: '2026-10-11' });
      expect(onNew.data.some((e) => e.entryId === 'e_1')).toBe(true);
      const onOld = history.list({ localDate: '2026-10-10' });
      expect(onOld.data.some((e) => e.entryId === 'e_1')).toBe(false);
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

      const deleted = history.delete('e_1');
      expect(deleted.ok).toBe(true);
      expect(history.list().data.find((e) => e.entryId === 'e_1')).toBeUndefined();
      expect(storage.readStore().data.entries.find((e) => e.entryId === 'e_1')).toBeUndefined();
    });
  });
});
