/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const ranks = require('../src/ranks');
const { ranksTxtPath } = require('../src/paths');

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
      expect(bronze.thresholds['pike-push-ups']).toEqual({ weight: 0, reps: 4, sets: 3 });
    });
  });
});
