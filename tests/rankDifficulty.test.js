/**
 * Feature 12 - Rank difficulty scoring & auto-sort
 */

const path = require('path');
const ranks = require('../src/ranks');
const {
  exerciseDifficulty,
  tierDifficulty,
  sortTiersByDifficulty,
} = require('../src/rankDifficulty');

describe('rankDifficulty', () => {
  it('scores an exercise from weight, duration, reps, and sets', () => {
    const easy = exerciseDifficulty({
      weight: 0,
      reps: 5,
      sets: 3,
      durationSeconds: 0,
    });
    const hard = exerciseDifficulty({
      weight: 50,
      reps: 10,
      sets: 3,
      durationSeconds: 60,
    });
    expect(hard).toBeGreaterThan(easy);
  });

  it('averages exercise difficulty for a tier', () => {
    const tier = {
      name: 'CUSTOM',
      exercises: [
        { thresholds: { weight: 10, reps: 10, sets: 1 } },
        { thresholds: { weight: 0, reps: 1, sets: 1 } },
      ],
    };
    const a = exerciseDifficulty(tier.exercises[0].thresholds);
    const b = exerciseDifficulty(tier.exercises[1].thresholds);
    expect(tierDifficulty(tier)).toBeCloseTo((a + b) / 2);
  });

  it('keeps UNRANKED first and sorts others by ascending difficulty', () => {
    const tiers = [
      {
        name: 'HARD',
        exercises: [{ thresholds: { weight: 100, reps: 10, sets: 3 } }],
      },
      { name: 'UNRANKED', exercises: [] },
      {
        name: 'EASY',
        exercises: [{ thresholds: { weight: 0, reps: 1, sets: 1 } }],
      },
      {
        name: 'MID',
        exercises: [{ thresholds: { weight: 20, reps: 5, sets: 2 } }],
      },
    ];
    const sorted = sortTiersByDifficulty(tiers);
    expect(sorted.map((t) => t.name)).toEqual([
      'UNRANKED',
      'EASY',
      'MID',
      'HARD',
    ]);
  });

  it('counts bodyweight volume so renamed leaves still affect rank order', () => {
    const low = exerciseDifficulty({ weight: 0, reps: 4, sets: 3 });
    const high = exerciseDifficulty({ weight: 0, reps: 12, sets: 3 });
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0);
  });

  it('scores travel by scale×pace so short sprints do not beat long efforts', () => {
    // High pace, tiny distance, many reps - less impressive than a long loaded walk.
    const sprint = exerciseDifficulty({
      distance: 25 / 5280, // 25 ft in miles
      durationSeconds: 2,
      reps: 50,
      sets: 1,
    });
    const longWalk = exerciseDifficulty({
      distance: 2,
      durationSeconds: 20 * 60,
      weight: 3,
      reps: 2,
      sets: 1,
    });
    expect(longWalk).toBeGreaterThan(sprint);
    const heavier = exerciseDifficulty({
      distance: 2,
      durationSeconds: 20 * 60,
      weight: 20,
      reps: 2,
      sets: 1,
    });
    expect(heavier).toBeGreaterThan(longWalk);
  });

  it('preserves ladder order when difficulties tie after a rename/edit', () => {
    const shared = [{ thresholds: { weight: 0, reps: 10, sets: 3 } }];
    const tiers = [
      { name: 'UNRANKED', order: 0, exercises: [] },
      { name: 'SILVER I', order: 1, exercises: shared },
      {
        name: 'SILVER II',
        order: 2,
        exercises: [{ thresholds: { weight: 0, reps: 10, sets: 3 } }],
      },
      { name: 'GOLD I', order: 3, exercises: shared },
    ];
    // Simulate saveRank re-append: Silver II pulled out and pushed last with preserved order.
    const reshuffled = [
      tiers[0],
      tiers[1],
      tiers[3],
      {
        ...tiers[2],
        exercises: [
          {
            name: 'renamed-push',
            thresholds: { weight: 0, reps: 10, sets: 3 },
          },
        ],
      },
    ];
    const sorted = sortTiersByDifficulty(reshuffled);
    expect(sorted.map((t) => t.name)).toEqual([
      'UNRANKED',
      'SILVER I',
      'SILVER II',
      'GOLD I',
    ]);
  });

  it('places Silver III between Silver II and Gold I in defaults ranks.txt', () => {
    // Regression: Roman Chair was typed as 50m (3000s) instead of 50s, which
    // made Silver III score harder than Pro X.
    const filePath = path.join(__dirname, '..', 'data', 'defaults', 'ranks.txt');
    const loaded = ranks.loadRanks({ filePath });
    expect(loaded.ok).toBe(true);
    const sorted = sortTiersByDifficulty(loaded.data || []);
    const names = sorted.map((t) => t.name);
    const silverII = names.indexOf('SILVER II');
    const silverIII = names.indexOf('SILVER III');
    const goldI = names.indexOf('GOLD I');
    expect(silverII).toBeGreaterThan(-1);
    expect(silverIII).toBe(silverII + 1);
    expect(goldI).toBe(silverIII + 1);

    const silverIIITier = sorted[silverIII];
    const roman = (silverIIITier.exercises || []).find((e) =>
      /roman\s*chair/i.test(e.name || '')
    );
    expect(roman).toBeTruthy();
    expect(roman.thresholds.durationSeconds).toBe(50);
  });

  it('does not weigh 0h0m0s duration', () => {
    const withZero = exerciseDifficulty({
      weight: 0,
      reps: 10,
      sets: 3,
      durationSeconds: 0,
    });
    const without = exerciseDifficulty({
      weight: 0,
      reps: 10,
      sets: 3,
    });
    expect(withZero).toBe(without);
    expect(withZero).toBe(30);
  });

  it('weighs duration much smaller when Bronze I baseline is 0h0m0s', () => {
    const {
      DURATION_WEIGHT_PRIMARY,
      DURATION_WEIGHT_SECONDARY,
    } = require('../src/rankDifficulty');
    const thresholds = {
      weight: 0,
      reps: 1,
      sets: 3,
      durationSeconds: 60,
    };
    const primary = exerciseDifficulty(thresholds);
    const secondary = exerciseDifficulty(thresholds, { durationIsSecondary: true });
    expect(primary).toBe(1 * 3 + 60 * 3 * DURATION_WEIGHT_PRIMARY);
    expect(secondary).toBe(1 * 3 + 60 * 3 * DURATION_WEIGHT_SECONDARY);
    expect(secondary).toBeLessThan(primary * 0.1);

    const tiers = [
      { name: 'UNRANKED', order: 0, exercises: [] },
      {
        name: 'BRONZE I',
        order: 1,
        exercises: [
          {
            exerciseId: 'pike-push-ups',
            thresholds: { weight: 0, reps: 4, sets: 3, durationSeconds: 0 },
          },
          {
            exerciseId: 'plank-hold',
            thresholds: { weight: 0, reps: 1, sets: 3, durationSeconds: 20 },
          },
        ],
      },
      {
        name: 'SILVER I',
        order: 2,
        exercises: [
          {
            exerciseId: 'pike-push-ups',
            thresholds: { weight: 0, reps: 4, sets: 3, durationSeconds: 60 },
          },
          {
            exerciseId: 'plank-hold',
            thresholds: { weight: 0, reps: 1, sets: 3, durationSeconds: 40 },
          },
        ],
      },
    ];
    const { bronzeIDurationBaselines, tierDifficulty } = require('../src/rankDifficulty');
    const baselines = bronzeIDurationBaselines(tiers);
    expect(baselines['pike-push-ups']).toBe(0);
    expect(baselines['plank-hold']).toBe(20);

    const silver = tiers[2];
    const scored = tierDifficulty(silver, { bronzeIDurations: baselines });
    const pike = exerciseDifficulty(silver.exercises[0].thresholds, {
      durationIsSecondary: true,
    });
    const plank = exerciseDifficulty(silver.exercises[1].thresholds);
    expect(scored).toBeCloseTo((pike + plank) / 2);
  });

  it('defaults ranks.txt strength leaves use 0h0m0s placeholders', () => {
    const filePath = path.join(__dirname, '..', 'data', 'defaults', 'ranks.txt');
    const loaded = ranks.loadRanks({ filePath });
    expect(loaded.ok).toBe(true);
    const bronzeI = (loaded.data || []).find((t) => t.name === 'BRONZE I');
    expect(bronzeI).toBeTruthy();
    const pike = bronzeI.exercises.find((e) => e.exerciseId === 'pike-push-ups');
    expect(pike.thresholds.durationSeconds).toBe(0);
    const text = require('fs').readFileSync(filePath, 'utf8');
    expect(text).toMatch(/pike push-ups 0lb 0km 0h0m0s x4 x3/);
  });
});
