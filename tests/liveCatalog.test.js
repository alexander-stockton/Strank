/**
 * Feature 5 — Dynamic Exercise Catalog
 * Spec: features/feature-5-Dynamic-Exercise-Catalog.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 5 — Dynamic Exercise Catalog', () => {
  let tempRoot;
  let dataDir;
  let catalog;
  let storage;

  function writeFormat(text) {
    fs.writeFileSync(path.join(dataDir, 'format.txt'), text, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'format.dat'), Buffer.from(text, 'utf8'));
  }

  function writeRanks(text) {
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), text, 'utf8');
  }

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f5-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      formatDatPath: () => path.join(dataDir, 'format.dat'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    catalog = require('../src/catalog');
    storage = require('../src/storage');
    storage.ensureInitialized();
    catalog.clearCatalogCache();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-5.1 — Merge Catalog With Ranks Priority', () => {
    it('Ranks schema wins on conflict', () => {
      writeFormat(
        [
          'ARMS:',
          '\tSTRENGTH:',
          '\t\tPULL:',
          '\t\t\t- heavy bookbag #[weight] x[reps]',
          '',
        ].join('\n')
      );
      writeRanks(
        [
          'BRONZE:',
          '{badges/bronze.svg}',
          '--------------',
          'ARMS:',
          '\tSTRENGTH:',
          '\t\tPULL:',
          '\t\t\t- heavy bookbag 10lb x5 x3',
          '',
        ].join('\n')
      );

      const result = catalog.loadLiveCatalog();
      expect(result.ok).toBe(true);
      const entry = result.data.find((e) => e.exerciseId === 'heavy-bookbag');
      expect(entry).toBeTruthy();
      expect(entry.metrics).toEqual(expect.arrayContaining(['weight', 'reps', 'sets']));
      expect(entry.metrics).toHaveLength(3);
      expect(entry.prioritySource).toBe('ranks');
      expect(entry.source).toBe('both');
    });

    it('Format-only exercise remains active', () => {
      writeFormat(
        [
          'ARMS:',
          '\tSTRENGTH:',
          '\t\t- chest-raises x[reps] x[sets]',
          '\t\t- pull-ups x[reps] x[sets]',
          '',
        ].join('\n')
      );
      writeRanks(
        [
          'BRONZE:',
          '{badges/bronze.svg}',
          '--------------',
          'ARMS:',
          '\tSTRENGTH:',
          '\t\t- pull-ups x10 x3',
          '',
        ].join('\n')
      );

      const result = catalog.loadLiveCatalog();
      expect(result.ok).toBe(true);
      const chest = result.data.find((e) => e.exerciseId === 'chest-raises');
      expect(chest).toBeTruthy();
      expect(chest.source).toBe('format');
      expect(chest.prioritySource).toBe('format');
      expect(catalog.getActiveExercise('chest-raises')).toBeTruthy();
    });
  });

  describe('US-5.3 — Keep Historical Orphans', () => {
    it('Deleted exercise remains in history', () => {
      writeFormat(
        [
          'ARMS:',
          '\tSTRENGTH:',
          '\t\t- bed-lifts x[reps] x[sets]',
          '\t\t- pull-ups x[reps] x[sets]',
          '',
        ].join('\n')
      );
      writeRanks(['UNRANKED:', 'badges/unranked.svg', '--------------', ''].join('\n'));

      expect(catalog.loadLiveCatalog().ok).toBe(true);

      storage.writeStore({
        schemaVersion: 1,
        entries: [
          {
            entryId: 'e_orphan',
            exerciseId: 'bed-lifts',
            localDate: '2026-10-10',
            createdAt: '2026-10-10T10:00:00.000-05:00',
            updatedAt: '2026-10-10T10:00:00.000-05:00',
            metrics: { reps: 5, sets: 3 },
          },
        ],
      });

      writeFormat(['ARMS:', '\tSTRENGTH:', '\t\t- pull-ups x[reps] x[sets]', ''].join('\n'));
      catalog.reloadFromDisk();

      expect(catalog.getActiveExercise('bed-lifts')).toBeNull();
      expect(catalog.isOrphan({ exerciseId: 'bed-lifts' })).toBe(true);

      const listed = require('../src/history').list();
      expect(listed.ok).toBe(true);
      const entry = listed.data.find((e) => e.entryId === 'e_orphan');
      expect(entry).toBeTruthy();
      expect(entry.metrics).toEqual({ reps: 5, sets: 3 });

      const active = catalog.loadLiveCatalog();
      expect(active.data.find((e) => e.exerciseId === 'bed-lifts')).toBeUndefined();
    });
  });

  describe('US-5.4 — Customize Via File Changes', () => {
    it('New custom exercise appears after reload', () => {
      writeFormat(
        [
          'LEGS:',
          '\tSTRENGTH:',
          '\t\t- squats x[reps] x[sets]',
          '',
        ].join('\n')
      );
      writeRanks(['UNRANKED:', 'badges/unranked.svg', '--------------', ''].join('\n'));

      expect(catalog.loadLiveCatalog().ok).toBe(true);
      expect(catalog.getActiveExercise('wall-sits')).toBeNull();

      writeFormat(
        [
          'LEGS:',
          '\tSTRENGTH:',
          '\t\t- squats x[reps] x[sets]',
          '\t\t- wall-sits ([duration]) x[sets]',
          '',
        ].join('\n')
      );
      const reloaded = catalog.reloadFromDisk();
      expect(reloaded.ok).toBe(true);

      const wall = catalog.getActiveExercise('wall-sits');
      expect(wall).toBeTruthy();
      expect(wall.metrics).toEqual(expect.arrayContaining(['durationSeconds', 'sets']));
      expect(wall.metrics).toHaveLength(2);
    });
  });
});
