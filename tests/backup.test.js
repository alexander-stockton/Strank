/**
 * Feature 11 - Config, Accessibility & Backup
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 11 - Config, Accessibility & Backup', () => {
  let tempRoot;
  let dataDir;
  let backup;
  let catalog;
  let storage;
  let config;

  const FORMAT = ['CORE:', '\tSTRENGTH:', '\t\t- plank x[reps] x[sets]', ''].join('\n');
  const RANKS = [
    'UNRANKED:',
    '{badges/unranked.svg}',
    '--------------',
    '',
    'BRONZE I:',
    '{badges/bronze-i.svg}',
    '--------------',
    'CORE:',
    '\tSTRENGTH:',
    '\t\t- plank x5 x3',
    '',
  ].join('\n');

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f11-bak-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['navbar alignment: left', 'logging: false', 'font size: 16'].join('\n') + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'badges', 'unranked.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'utf8'
    );

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      defaultRanksTxtPath: () => path.join(dataDir, 'defaults', 'ranks.txt'),
      badgesDir: () => path.join(dataDir, 'badges'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    backup = require('../src/backup');
    config = require('../src/config');
    storage.ensureInitialized();
    storage.writeStore({
      schemaVersion: 1,
      entries: [
        {
          entryId: 'e1',
          exerciseId: 'plank',
          localDate: '2026-10-17',
          createdAt: '2026-10-17T10:00:00.000Z',
          updatedAt: '2026-10-17T10:00:00.000Z',
          metrics: { reps: 5, sets: 3 },
        },
      ],
    });
    catalog.loadLiveCatalog();
    config.load();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-11.3 - Export And Import Backup', () => {
    it('Export creates ZIP with required files', async () => {
      // Coverage-map name retained; payload is binary history .dat
      const out = path.join(tempRoot, 'backup.dat');
      const result = backup.exportHistoryDat(out);
      expect(result.ok).toBe(true);
      expect(fs.existsSync(out)).toBe(true);

      const parsed = backup.parseHistoryDatBuffer(fs.readFileSync(out));
      expect(parsed.ok).toBe(true);
      expect(parsed.store.entries).toHaveLength(1);
      expect(parsed.store.entries[0].exerciseId).toBe('plank');
      expect(parsed.skillsBuf.length).toBe(0);
    });

    it('Import restores backup', async () => {
      const out = path.join(tempRoot, 'backup.dat');
      backup.exportHistoryDat(out);

      storage.writeStore({ schemaVersion: 1, entries: [] });

      const result = backup.importHistoryDat(out, { confirm: () => true });
      expect(result.ok).toBe(true);

      const store = JSON.parse(fs.readFileSync(path.join(dataDir, 'store.json'), 'utf8'));
      expect(store.entries).toHaveLength(1);
      expect(store.entries[0].exerciseId).toBe('plank');
    });

    it('Export and import config', () => {
      config.set('font size', 20);
      const out = path.join(tempRoot, 'config-copy.txt');
      expect(backup.exportConfig(out).ok).toBe(true);
      expect(fs.readFileSync(out, 'utf8')).toMatch(/font size: 20/);

      config.set('font size', 12);
      const result = backup.importConfig(out, { confirm: () => true });
      expect(result.ok).toBe(true);
      expect(config.get()['font size']).toBe('20');
    });

    it('Export and import ranks', () => {
      const out = path.join(tempRoot, 'ranks-copy.txt');
      expect(backup.exportRanks(out).ok).toBe(true);
      expect(fs.readFileSync(out, 'utf8')).toContain('BRONZE I:');

      const replacement = [
        'UNRANKED:',
        '{badges/unranked.svg}',
        '--------------',
        '',
        'SILVER I:',
        '{badges/silver-i.svg}',
        '--------------',
        'CORE:',
        '\tSTRENGTH:',
        '\t\t- plank x12 x3',
        '',
      ].join('\n');
      fs.writeFileSync(out, replacement, 'utf8');

      const result = backup.importRanks(out, { confirm: () => true });
      expect(result.ok).toBe(true);

      const text = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
      expect(text).toContain('SILVER I:');
      expect(text).not.toContain('BRONZE I:');

      const ranks = require('../src/ranks');
      ranks.clearRanksCache();
      expect(ranks.listTierNames()).toEqual(['UNRANKED', 'SILVER I']);
    });

    it('Import ranks cancels without writing', () => {
      const out = path.join(tempRoot, 'ranks-cancel.txt');
      fs.writeFileSync(out, RANKS, 'utf8');
      const before = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
      const result = backup.importRanks(out, { confirm: () => false });
      expect(result.cancelled).toBe(true);
      expect(fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8')).toBe(before);
    });
  });

  describe('US-11.4 - Logging', () => {
    it('window-state.log writes only when logging is on', () => {
      const windowState = require('../src/windowState');
      const logFile = path.join(dataDir, 'window-state.log');

      config.set('logging', false);
      if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
      windowState.debugLog('should-not-write');
      expect(fs.existsSync(logFile)).toBe(false);

      config.set('logging', true);
      windowState.debugLog('should-write', { ok: true });
      expect(fs.existsSync(logFile)).toBe(true);
      expect(fs.readFileSync(logFile, 'utf8')).toMatch(/should-write/);
    });
  });
});
