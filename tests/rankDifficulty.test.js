/**
 * Feature 12 — Rank difficulty scoring & auto-sort
 */

const {
  exerciseDifficulty,
  tierDifficulty,
  sortTiersByDifficulty,
} = require('../src/rankDifficulty');

describe('rankDifficulty', () => {
  it('scores an exercise from weight, duration, reps, and sets', () => {
    const easy = exerciseDifficulty({ weight: 0, reps: 5, sets: 3, durationSeconds: 0 });
    const hard = exerciseDifficulty({ weight: 50, reps: 10, sets: 3, durationSeconds: 60 });
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
      { name: 'HARD', exercises: [{ thresholds: { weight: 100, reps: 10, sets: 3 } }] },
      { name: 'UNRANKED', exercises: [] },
      { name: 'EASY', exercises: [{ thresholds: { weight: 0, reps: 1, sets: 1 } }] },
      { name: 'MID', exercises: [{ thresholds: { weight: 20, reps: 5, sets: 2 } }] },
    ];
    const sorted = sortTiersByDifficulty(tiers);
    expect(sorted.map((t) => t.name)).toEqual(['UNRANKED', 'EASY', 'MID', 'HARD']);
  });
});
