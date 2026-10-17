/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const catalog = require('../src/catalog');
const { formatTxtPath } = require('../src/paths');

describe('Feature 1 — App Foundation', () => {
  describe('US-1.2 — Load Exercise Catalog', () => {
    beforeEach(() => {
      catalog.clearCatalogCache();
    });

    it('Catalog includes format.txt exercises', () => {
      const result = catalog.loadCatalog({ filePath: formatTxtPath() });
      expect(result.ok).toBe(true);

      const pike = result.data.find((e) => e.name === 'pike push-ups');
      expect(pike).toBeTruthy();
      expect(pike.metrics).toEqual(expect.arrayContaining(['reps', 'sets']));
      expect(pike.metrics).toHaveLength(2);
      expect(pike.headers).toEqual(['ARMS', 'STRENGTH', 'PUSH']);

      const burpee = result.data.find((e) => e.name === 'burpee intervals');
      expect(burpee).toBeTruthy();
      expect(burpee.metrics).toEqual(
        expect.arrayContaining(['durationGoSeconds', 'durationRestSeconds', 'sets'])
      );
      expect(burpee.metrics).toHaveLength(3);
    });

    it('Unknown exercise id is not in catalog', () => {
      const loaded = catalog.loadCatalog({ filePath: formatTxtPath() });
      expect(loaded.ok).toBe(true);
      expect(catalog.getExerciseById('bench-press')).toBeNull();
    });
  });
});
