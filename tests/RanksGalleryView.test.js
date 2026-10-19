/**
 * @jest-environment jsdom
 *
 * Feature 6 — Custom Ranks
 * Feature 10 — Ranks Gallery (consumers for Feature 6)
 * Spec: features/feature-6-Custom-Ranks.md
 * Spec: features/feature-10-Ranks-Gallery.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const FIXTURE_FORMAT = [
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x[reps] x[sets]',
  '\t\tPULL:',
  '\t\t\t- pull-ups x[reps] x[sets]',
  '',
].join('\n');

describe('Feature 6 — Ranks Gallery consumers', () => {
  let tempRoot;
  let dataDir;
  let ranks;
  let catalog;
  let mountRanksGalleryView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f6-gallery-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges', 'custom'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    ranks = require('../src/ranks');
    catalog = require('../src/catalog');
    ({ mountRanksGalleryView } = require('../src/ranksGalleryView'));

    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-6.3 — UI Accommodates Custom Ladder', () => {
    it('Only defined tiers appear', () => {
      fs.writeFileSync(
        path.join(dataDir, 'ranks.txt'),
        [
          'COPPER I:',
          '{badges/custom/copper-i.png}',
          '--------------',
          'ARMS:',
          '\tSTRENGTH:',
          '\t\t- pike-push-ups x3 x3',
          '',
          'COPPER II:',
          '{badges/custom/copper-ii.png}',
          '--------------',
          'ARMS:',
          '\tSTRENGTH:',
          '\t\t- pike-push-ups x6 x3',
          '',
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(path.join(dataDir, 'badges', 'custom', 'copper-i.png'), TINY_PNG);
      fs.writeFileSync(path.join(dataDir, 'badges', 'custom', 'copper-ii.png'), TINY_PNG);

      ranks.clearRanksCache();
      catalog.clearCatalogCache();
      catalog.loadLiveCatalog();
      ranks.loadRanks();

      const storage = require('../src/storage');
      storage.ensureInitialized();

      const names = ranks.listTierNames();
      expect(names).toEqual(['COPPER I', 'COPPER II']);
      expect(names).not.toContain('PRO X');
      expect(names).not.toContain('BRONZE I');

      const ranking = require('../src/ranking');
      ranking.__setLocalDate('2026-10-20');
      const target = ranking.getTargetTier({ today: '2026-10-20' });
      expect(target.ok).toBe(true);
      expect(target.data && target.data.name).toBe('COPPER I');
      expect(target.data.name).not.toBe('PRO X');

      mount = mountRanksGalleryView(root, { ranks, catalog });
      const tierNames = [...root.querySelectorAll('[data-tier-name]')].map((el) =>
        el.getAttribute('data-tier-name')
      );
      expect(tierNames).toEqual(['COPPER I', 'COPPER II']);
      expect(root.textContent).not.toMatch(/PRO X/);
    });
  });

  describe('US-6.5 — Custom Badge Image For A Custom Rank', () => {
    it('Custom rank uses a custom badge image', () => {
      fs.writeFileSync(
        path.join(dataDir, 'ranks.txt'),
        [
          'COPPER I:',
          'badges/custom/copper-i.png',
          '--------------',
          'ARMS:',
          '\tSTRENGTH:',
          '\t\t- pull-ups x5 x3',
          '',
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(path.join(dataDir, 'badges', 'custom', 'copper-i.png'), TINY_PNG);

      ranks.clearRanksCache();
      catalog.clearCatalogCache();
      catalog.loadLiveCatalog();
      ranks.loadRanks();

      mount = mountRanksGalleryView(root, { ranks, catalog });
      const col = root.querySelector('[data-tier-name="COPPER I"]');
      expect(col).toBeTruthy();
      const img = col.querySelector('[data-badge-img]');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toMatch(/^file:/);
      expect(img.getAttribute('src')).toMatch(/copper-i\.png/);
    });

    it('Missing badge file falls back', () => {
      fs.writeFileSync(
        path.join(dataDir, 'ranks.txt'),
        [
          'COPPER I:',
          'badges/custom/missing.png',
          '--------------',
          'ARMS:',
          '\tSTRENGTH:',
          '\t\t- pull-ups x5 x3',
          '',
        ].join('\n'),
        'utf8'
      );

      ranks.clearRanksCache();
      catalog.clearCatalogCache();
      catalog.loadLiveCatalog();
      ranks.loadRanks();

      const copper = ranks.getTierByName('COPPER I');
      expect(ranks.resolveBadgeUrl(copper)).toBeNull();

      mount = mountRanksGalleryView(root, { ranks, catalog });
      const col = root.querySelector('[data-tier-name="COPPER I"]');
      expect(col).toBeTruthy();
      expect(col.querySelector('[data-badge-img]')).toBeNull();
      expect(col.querySelector('[data-badge-fallback="COPPER I"]')).toBeTruthy();

      const ranking = require('../src/ranking');
      ranking.__setLocalDate('2026-10-20');
      require('../src/storage').ensureInitialized();
      require('../src/storage').writeStore({
        schemaVersion: 1,
        entries: [
          {
            entryId: 'e1',
            exerciseId: 'pull-ups',
            localDate: '2026-10-13',
            createdAt: '2026-10-13T10:00:00.000-05:00',
            updatedAt: '2026-10-13T10:00:00.000-05:00',
            metrics: { reps: 5, sets: 3 },
          },
          {
            entryId: 'e2',
            exerciseId: 'pull-ups',
            localDate: '2026-10-14',
            createdAt: '2026-10-14T10:00:00.000-05:00',
            updatedAt: '2026-10-14T10:00:00.000-05:00',
            metrics: { reps: 5, sets: 3 },
          },
          {
            entryId: 'e3',
            exerciseId: 'pull-ups',
            localDate: '2026-10-15',
            createdAt: '2026-10-15T10:00:00.000-05:00',
            updatedAt: '2026-10-15T10:00:00.000-05:00',
            metrics: { reps: 5, sets: 3 },
          },
        ],
      });
      const compared = ranking.compareToRanks('2026-10-13');
      expect(compared.ok).toBe(true);
      expect(compared.data.overallTierName).toBe('COPPER I');
    });
  });
});
