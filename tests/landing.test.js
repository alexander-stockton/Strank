/**
 * Feature 7 — Landing Page
 * Spec: features/feature-7-Landing-Page.md
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
      ['navbar alignment: left', 'landing expectations visible: true', 'logging: false'].join('\n'),
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
    ranks = require('../src/ranks');
    ranking = require('../src/ranking');
    config = require('../src/config');
    landing = require('../src/landing');

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();
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
  });
});
