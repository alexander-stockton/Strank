/**
 * Feature 1 — App Foundation
 * Feature 6 — Custom Ranks
 * Spec: features/feature-1-App-Foundation.md
 * Spec: features/feature-6-Custom-Ranks.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ranks = require('../src/ranks');
const { ranksTxtPath, getDataDir } = require('../src/paths');

/** 1×1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('Feature 1 — App Foundation', () => {
  describe('US-1.3 — Load Rank Thresholds', () => {
    beforeEach(() => {
      ranks.clearRanksCache();
    });

    it('Ranks parse in order', () => {
      const result = ranks.loadRanks({ filePath: ranksTxtPath() });
      expect(result.ok).toBe(true);

      const names = ranks.listTierNames();
      expect(names[0]).toBe('UNRANKED');
      expect(names[1]).toBe('BRONZE I');
      expect(names).toContain('PRO X');
      expect(names[names.length - 1]).toBe('PRO X');

      const bronze = result.data.find((t) => t.name === 'BRONZE I');
      expect(bronze).toBeTruthy();
      expect(bronze.badgePath).toBe('badges/bronze-i.svg');
      expect(bronze.thresholds['pike-push-ups']).toEqual({
        weight: 0,
        distance: 0,
        reps: 4,
        sets: 3,
      });
    });
  });
});

describe('Feature 6 — Custom Ranks', () => {
  let tempRoot;
  let dataDir;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f6-ranks-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges', 'custom'), { recursive: true });

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-6.1 — Define A Custom Ladder In ranks.txt', () => {
    it('Custom tier loads after reload', () => {
      fs.writeFileSync(
        path.join(dataDir, 'ranks.txt'),
        [
          'UNRANKED:',
          '{badges/unranked.svg}',
          '--------------',
          '',
          'COPPER I:',
          '{badges/custom/copper-i.png}',
          '--------------',
          'ARMS:',
          '\tSTRENGTH:',
          '\t\tPUSH:',
          '\t\t\t- pike-push-ups x3 x3',
          '',
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(path.join(dataDir, 'badges', 'custom', 'copper-i.png'), TINY_PNG);

      const ranksMod = require('../src/ranks');
      ranksMod.clearRanksCache();
      const loaded = ranksMod.loadRanks();
      expect(loaded.ok).toBe(true);
      expect(ranksMod.listTierNames()).toContain('COPPER I');

      const copper = ranksMod.getTierByName('COPPER I');
      expect(copper).toBeTruthy();
      expect(copper.thresholds['pike-push-ups']).toEqual({ reps: 3, sets: 3 });

      const gallery = require('../src/ranksGallery');
      const columns = gallery.getColumns({ ranks: ranksMod });
      expect(columns.ok).toBe(true);
      expect(columns.data.map((c) => c.tierName)).toContain('COPPER I');
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
      const badgeFile = path.join(dataDir, 'badges', 'custom', 'copper-i.png');
      fs.writeFileSync(badgeFile, TINY_PNG);

      const ranksMod = require('../src/ranks');
      ranksMod.clearRanksCache();
      const loaded = ranksMod.loadRanks();
      expect(loaded.ok).toBe(true);
      const copper = loaded.data.find((t) => t.name === 'COPPER I');
      expect(copper.badgePath).toBe('badges/custom/copper-i.png');
      const url = ranksMod.resolveBadgeUrl(copper);
      expect(url).toBeTruthy();
      expect(url.startsWith('file:')).toBe(true);
      expect(ranksMod.resolveBadgeFsPath(copper)).toBe(path.resolve(badgeFile));
    });
  });
});

describe('Feature 6 — Default shipped badges', () => {
  beforeEach(() => {
    ranks.clearRanksCache();
  });

  it('Default ranks reference shipped badges', () => {
    const result = ranks.loadRanks({ filePath: ranksTxtPath() });
    expect(result.ok).toBe(true);
    const bronze = result.data.find((t) => t.name === 'BRONZE I');
    expect(bronze).toBeTruthy();
    expect(bronze.badgePath).toBe('badges/bronze-i.svg');
    const abs = path.join(getDataDir(), bronze.badgePath);
    expect(fs.existsSync(abs)).toBe(true);
  });
});
