/**
 * @jest-environment jsdom
 *
 * Feature 4 — Weekly Ranking
 * Spec: features/feature-4-Weekly-Ranking.md
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
  'badges/unranked.svg',
  '--------------',
  '',
  'BRONZE I:',
  'badges/bronze-i.svg',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x4 x3',
  '\t\t\t- push-ups x10 x3',
  '',
  'SILVER I:',
  'badges/silver-i.svg',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x12 x3',
  '\t\t\t- push-ups x20 x3',
  '',
].join('\n');

function entry(overrides) {
  return {
    entryId: overrides.entryId || `e_${overrides.localDate}_${overrides.exerciseId}`,
    exerciseId: overrides.exerciseId,
    localDate: overrides.localDate,
    createdAt: `${overrides.localDate}T10:00:00.000-05:00`,
    updatedAt: `${overrides.localDate}T10:00:00.000-05:00`,
    metrics: overrides.metrics,
  };
}

describe('Feature 4 — Rank View', () => {
  let tempRoot;
  let dataDir;
  let ranking;
  let storage;
  let catalog;
  let ranksMod;
  let mountRankView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f4-rank-'));
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
    ranksMod = require('../src/ranks');
    ranking = require('../src/ranking');
    ({ mountRankView } = require('../src/rankView'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranksMod.clearRanksCache();
    catalog.loadLiveCatalog();
    ranksMod.loadRanks();
    ranking.__resetTestHooks();
    ranking.__setLocalDate('2026-10-20');

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

  it('Rank view shows visual standing', () => {
    storage.writeStore({
      schemaVersion: 1,
      entries: [
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 12, sets: 3 } }),
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 12, sets: 3 } }),
        entry({ exerciseId: 'push-ups', localDate: '2026-10-15', metrics: { reps: 20, sets: 3 } }),
      ],
    });

    mount = mountRankView(root, { ranking, initialWeek: '2026-10-13' });
    expect(root.querySelector('[data-view="rankDebug"]')).toBeTruthy();
    expect(root.querySelector('[data-hero-tier]').getAttribute('data-hero-tier')).toBe('SILVER I');
    expect(root.querySelector('[data-next-tier]')).toBeTruthy();
    expect(root.querySelector('[data-breakdown]')).toBeTruthy();
    expect(root.querySelector('.rank-exercise-card')).toBeTruthy();
    expect(root.textContent).not.toMatch(/BRONZE I:\s*\n\s*badges\//);
  });

  it('User selects a past week', () => {
    storage.writeStore({
      schemaVersion: 1,
      entries: [
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-06', metrics: { reps: 4, sets: 3 } }),
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-07', metrics: { reps: 4, sets: 3 } }),
        entry({ exerciseId: 'push-ups', localDate: '2026-10-08', metrics: { reps: 10, sets: 3 } }),
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 12, sets: 3 } }),
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 12, sets: 3 } }),
        entry({ exerciseId: 'push-ups', localDate: '2026-10-15', metrics: { reps: 20, sets: 3 } }),
      ],
    });

    mount = mountRankView(root, { ranking, initialWeek: '2026-10-13' });
    expect(root.querySelector('[data-hero-tier]').getAttribute('data-hero-tier')).toBe('SILVER I');

    mount.setSelectedWeek('2026-10-06');
    expect(mount.getSelectedWeek()).toBe('2026-10-06');
    expect(root.querySelector('[data-week-range]').textContent).toMatch(/2026-10-06/);
    expect(root.querySelector('[data-hero-tier]').getAttribute('data-hero-tier')).toBe('BRONZE I');
  });
});
