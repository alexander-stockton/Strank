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
      expect(result.data.length).toBeGreaterThan(0);

      const armsPush = result.data.find(
        (e) => e.headers.join('>') === 'ARMS>STRENGTH>PUSH' && e.name === 'exercise1'
      );
      expect(armsPush).toBeTruthy();
      expect(armsPush.metrics).toEqual(expect.arrayContaining(['weight', 'reps', 'sets']));
      expect(armsPush.metrics).toHaveLength(3);

      const lungsEndurance = result.data.find(
        (e) => e.headers.join('>') === 'LUNGS>ENDURANCE' && e.name === 'exercise1'
      );
      expect(lungsEndurance).toBeTruthy();
      expect(lungsEndurance.metrics).toEqual(
        expect.arrayContaining(['weight', 'durationSeconds', 'reps', 'sets'])
      );
    });

    it('Unknown exercise id is not in catalog', () => {
      const loaded = catalog.loadCatalog({ filePath: formatTxtPath() });
      expect(loaded.ok).toBe(true);
      expect(catalog.getExerciseById('bench-press')).toBeNull();
    });
  });
});
