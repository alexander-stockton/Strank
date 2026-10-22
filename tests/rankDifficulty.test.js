/**
 * Feature 12 - Rank difficulty scoring & auto-sort
 */

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
});
