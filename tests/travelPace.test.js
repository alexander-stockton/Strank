/**
 * Travel pace + scale helpers
 */

const travelPace = require('../src/travelPace');

describe('travelPace', () => {
  it('detects distance + active duration pairs', () => {
    expect(travelPace.hasTravelPair({ distance: 2, durationSeconds: 1800 })).toBe(true);
    expect(travelPace.hasTravelPair({ distance: 2, durationGoSeconds: 900 })).toBe(true);
    expect(travelPace.hasTravelPair({ distance: 2 })).toBe(false);
    expect(travelPace.hasTravelPair({ durationSeconds: 1800 })).toBe(false);
    expect(travelPace.hasTravelPair({ distance: 2, durationRestSeconds: 60 })).toBe(false);
  });

  it('computes time-per-unit (lower = faster)', () => {
    expect(travelPace.timePerUnit({ distance: 2, durationSeconds: 1800 })).toBe(900);
    expect(travelPace.timePerUnit({ distance: 3, durationSeconds: 3000 })).toBe(1000);
  });

  it('scale is load × volume × distance', () => {
    expect(travelPace.travelScale({ distance: 2 })).toBe(2);
    expect(travelPace.travelScale({ distance: 2, weight: 3, reps: 2, sets: 1 })).toBe(12);
    expect(travelPace.travelScale({ distance: 25 / 5280, reps: 50, sets: 1 })).toBeCloseTo(
      (25 / 5280) * 50,
      5
    );
  });

  it('travelScore favors long loaded work over tiny high-pace bursts', () => {
    const sprint = travelPace.travelScore({
      distance: 25 / 5280,
      durationSeconds: 2,
      reps: 50,
      sets: 1,
    });
    const longWalk = travelPace.travelScore({
      distance: 2,
      durationSeconds: 20 * 60,
      weight: 3,
      reps: 2,
      sets: 1,
    });
    expect(longWalk).toBeGreaterThan(sprint);
  });

  it('pace progress fills toward a faster next pace', () => {
    expect(travelPace.paceProgress(810, 900, 720)).toBeCloseTo(0.5);
    expect(travelPace.paceProgress(720, 900, 720)).toBe(1);
    expect(travelPace.paceProgress(900, 900, 720)).toBe(0);
  });

  it('scale progress fills toward a larger next scale', () => {
    expect(travelPace.scaleProgress(1, 0, 2)).toBeCloseTo(0.5);
    expect(travelPace.scaleProgress(2, 0, 2)).toBe(1);
    expect(travelPace.scaleProgress(0, 0, 2)).toBe(0);
  });
});
