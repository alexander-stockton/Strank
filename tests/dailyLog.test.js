/**
 * Feature 2 - Daily Exercise Log
 * Spec: features/feature-2-Daily-Exercise-Log.md
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

describe('Feature 2 - Daily Exercise Log', () => {
  let tempRoot;
  let dataDir;
  let dailyLog;
  let storage;
  let catalog;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f2-'));
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

  describe('US-2.1 - Log Today’s Exercise', () => {
    it('User logs a valid exercise for today', () => {
      const created = dailyLog.createToday({
        exerciseId: 'pike-push-ups',
        reps: 4,
        sets: 3,
      });
      expect(created.ok).toBe(true);
      expect(created.data.exerciseId).toBe('pike-push-ups');
      expect(created.data.localDate).toBe('2026-10-17');
      expect(created.data.metrics).toEqual({ reps: 4, sets: 3 });
      expect(created.data.entryId).toMatch(/^e_/);

      const listed = dailyLog.listToday();
      expect(listed.ok).toBe(true);
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0].metrics.reps).toBe(4);
      expect(listed.data[0].metrics.sets).toBe(3);
      expect(listed.data[0].localDate).toBe('2026-10-17');
    });

    it('Non-catalog exercise is rejected', () => {
      const created = dailyLog.createToday({
        exerciseId: 'bench-press',
        reps: 5,
        sets: 3,
      });
      expect(created.ok).toBe(false);
      expect(created.message).toBe('Exercise is not allowed.');

      const store = storage.readStore();
      expect(store.data.entries).toHaveLength(0);
    });

    it('Missing required metric', () => {
      const created = dailyLog.createToday({
        exerciseId: 'pike-push-ups',
        sets: 3,
      });
      expect(created.ok).toBe(false);
      expect(created.message).toBe('reps is required.');
    });
  });

  describe('US-2.2 - View Today’s Exercises', () => {
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

      const listed = dailyLog.listToday();
      expect(listed.ok).toBe(true);
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0].entryId).toBe('e_today');
      expect(listed.data[0].exerciseId).toBe('pull-ups');
    });
  });

  describe('US-2.3 - Edit Today’s Exercise', () => {
    it('User updates today’s entry', () => {
      const created = dailyLog.createToday({
        exerciseId: 'pike-push-ups',
        reps: 4,
        sets: 3,
      });
      expect(created.ok).toBe(true);

      const updated = dailyLog.updateToday(created.data.entryId, { reps: 6 });
      expect(updated.ok).toBe(true);
      expect(updated.data.metrics.reps).toBe(6);
      expect(updated.data.metrics.sets).toBe(3);

      const listed = dailyLog.listToday();
      expect(listed.data[0].metrics.reps).toBe(6);
    });
  });

  describe('US-2.4 - Delete Today’s Exercise', () => {
    it('User deletes today’s entry', () => {
      const created = dailyLog.createToday({
        exerciseId: 'pike-push-ups',
        reps: 4,
        sets: 3,
      });
      const entryId = created.data.entryId;

      const deleted = dailyLog.deleteToday(entryId);
      expect(deleted.ok).toBe(true);

      const listed = dailyLog.listToday();
      expect(listed.data.find((e) => e.entryId === entryId)).toBeUndefined();
      expect(storage.readStore().data.entries.find((e) => e.entryId === entryId)).toBeUndefined();
    });
  });

  describe('US-2.5 - Day Rolls at Midnight', () => {
    it('After midnight Today is a new day', () => {
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          {
            entryId: 'e_old',
            exerciseId: 'pull-ups',
            localDate: '2026-10-16',
            createdAt: '2026-10-16T22:00:00.000-05:00',
            updatedAt: '2026-10-16T22:00:00.000-05:00',
            metrics: { reps: 2, sets: 3 },
          },
        ],
      });

      dailyLog.__setLocalDate('2026-10-17');
      const listed = dailyLog.listToday();
      expect(listed.ok).toBe(true);
      expect(listed.data).toHaveLength(0);
      expect(listed.data.every((e) => e.localDate === '2026-10-17')).toBe(true);
    });
  });
});
