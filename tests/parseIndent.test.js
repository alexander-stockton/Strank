/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const { tokenizeLines, buildHeaderForest, headerPathFor } = require('../src/parse/indent');
const { parseCatalogText } = require('../src/catalog');
const { parseRanksText } = require('../src/ranks');

describe('Feature 1 — App Foundation', () => {
  describe('US-1.3 — Load Rank Thresholds', () => {
    it('Indentation makes a line the header of the next deeper line', () => {
      const fixture = ['ARMS:', '\tSTRENGTH:', '\t\tPUSH:', '\t\t\t- pike push-ups x[reps] x[sets]', 'CORE:', '\tSTRENGTH:', '\t\t- crunches x[reps] x[sets]'].join(
        '\n'
      );

      const tokenized = tokenizeLines(fixture);
      expect(tokenized.ok).toBe(true);
      const forest = buildHeaderForest(tokenized.lines);
      expect(forest.ok).toBe(true);

      const arms = forest.roots.find((n) => n.content === 'ARMS:');
      const core = forest.roots.find((n) => n.content === 'CORE:');
      expect(arms).toBeTruthy();
      expect(core).toBeTruthy();

      const strength = arms.children.find((c) => c.content === 'STRENGTH:');
      expect(strength).toBeTruthy();
      expect(strength.parent).toBe(arms);

      // CORE is a depth-0 sibling of ARMS, not a child
      expect(arms.children.some((c) => c.content === 'CORE:')).toBe(false);
      expect(core.parent).toBeNull();

      const leaf = forest.nodes.find((n) => n.leaf && n.content.includes('pike push-ups'));
      expect(headerPathFor(leaf)).toEqual(['ARMS', 'STRENGTH', 'PUSH']);
    });

    it('Variable children under the same header type', () => {
      const fixture = [
        'BRONZE I:',
        'badges/bronze-i.svg',
        '--------------',
        'ARMS:',
        '\tSTRENGTH:',
        '\t\tPULL:',
        '\t\t\t- heavy bookbag #10 x10',
        '\t\t\t- bed-lifts x5 x3',
        '\t\t\t- pull-ups x2 x3',
        'CORE:',
        '\tSTRENGTH:',
        '\t\tPULL:',
        '\t\t\t- alpha x1 x1',
        '\t\t\t- beta x1 x1',
      ].join('\n');

      const result = parseRanksText(fixture);
      expect(result.ok).toBe(true);
      const bronze = result.data.find((t) => t.name === 'BRONZE I');
      expect(bronze).toBeTruthy();

      // Count leaves under each PULL via re-parse of body sections — assert threshold counts
      // First PULL has 3 exercises, second has 2
      expect(Object.keys(bronze.thresholds).filter((k) => ['heavy-bookbag', 'bed-lifts', 'pull-ups'].includes(k))).toHaveLength(3);
      expect(Object.keys(bronze.thresholds).filter((k) => ['alpha', 'beta'].includes(k))).toHaveLength(2);

      // Also prove catalog-style forest accepts variable PULL children
      const catalogish = [
        'ARMS:',
        '\tSTRENGTH:',
        '\t\tPULL:',
        '\t\t\t- a x[reps] x[sets]',
        '\t\t\t- b x[reps] x[sets]',
        '\t\t\t- c x[reps] x[sets]',
        'LEGS:',
        '\tSTRENGTH:',
        '\t\tPULL:',
        '\t\t\t- d x[reps] x[sets]',
        '\t\t\t- e x[reps] x[sets]',
      ].join('\n');
      const cat = parseCatalogText(catalogish);
      expect(cat.ok).toBe(true);
      expect(cat.data).toHaveLength(5);
    });
  });
});
