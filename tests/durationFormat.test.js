/**
 * Duration parse / format helpers (h/m/s display + decimal seconds)
 */

const {
  parseDurationToSeconds,
  formatDurationSeconds,
  splitDurationSeconds,
  combineDurationParts,
  isTimeDurationKey,
} = require('../src/parse/duration');

describe('duration format helpers', () => {
  it('formats #h#m#s examples', () => {
    expect(formatDurationSeconds(20)).toBe('20s');
    expect(formatDurationSeconds(95)).toBe('1m35s');
    expect(formatDurationSeconds(6006)).toBe('1h40m6s');
    expect(formatDurationSeconds(60)).toBe('1m');
    expect(formatDurationSeconds(3600)).toBe('1h');
    expect(formatDurationSeconds(179.5)).toBe('2m59.5s');
    expect(formatDurationSeconds(3605)).toBe('1h0m5s');
    expect(formatDurationSeconds(3900)).toBe('1h5m');
  });

  it('parses hours and decimal seconds', () => {
    expect(parseDurationToSeconds('20s')).toBe(20);
    expect(parseDurationToSeconds('1m35s')).toBe(95);
    expect(parseDurationToSeconds('1h40m6s')).toBe(6006);
    expect(parseDurationToSeconds('1h')).toBe(3600);
    expect(parseDurationToSeconds('2m59.5s')).toBe(179.5);
    expect(parseDurationToSeconds('1h0m5s')).toBe(3605);
  });

  it('splits and combines h/m/s parts', () => {
    expect(splitDurationSeconds(6006)).toEqual({ hours: 1, minutes: 40, seconds: 6 });
    expect(splitDurationSeconds(179.5)).toEqual({ hours: 0, minutes: 2, seconds: 59.5 });
    const combined = combineDurationParts({ hours: 1, minutes: 5, seconds: '' });
    expect(combined.ok).toBe(true);
    expect(combined.seconds).toBe(3900);
    expect(combineDurationParts({ hours: '1', minutes: '0', seconds: '5' }).seconds).toBe(3605);
    expect(combineDurationParts({ hours: '1.5', minutes: 0, seconds: 0 }).ok).toBe(false);
    expect(combineDurationParts({ hours: 0, minutes: '1.5', seconds: 0 }).ok).toBe(false);
    expect(combineDurationParts({ hours: 0, minutes: 2, seconds: 59.5 }).seconds).toBe(179.5);
  });

  it('borrows from higher units when stepping down past zero', () => {
    const { borrowDurationOnStepDown } = require('../src/parse/duration');

    expect(borrowDurationOnStepDown({ hours: 4, minutes: 0, seconds: 0 }, 'minutes')).toEqual({
      ok: true,
      hours: 3,
      minutes: 59,
      seconds: 0,
      changed: true,
    });
    expect(borrowDurationOnStepDown({ hours: 0, minutes: 0, seconds: 0 }, 'minutes').changed).toBe(false);

    expect(borrowDurationOnStepDown({ hours: 4, minutes: 0, seconds: 0 }, 'seconds')).toEqual({
      ok: true,
      hours: 3,
      minutes: 59,
      seconds: 59,
      changed: true,
    });
    expect(borrowDurationOnStepDown({ hours: 4, minutes: 1, seconds: 0 }, 'seconds')).toEqual({
      ok: true,
      hours: 4,
      minutes: 0,
      seconds: 59,
      changed: true,
    });
    expect(borrowDurationOnStepDown({ hours: 0, minutes: 0, seconds: 0 }, 'seconds').changed).toBe(false);

    // Spinner underflow (-1) treated as step from 0
    expect(borrowDurationOnStepDown({ hours: 2, minutes: -1, seconds: 10 }, 'minutes')).toEqual({
      ok: true,
      hours: 1,
      minutes: 59,
      seconds: 10,
      changed: true,
    });
  });

  it('carries overflowing minutes and seconds into higher units', () => {
    const fromMinutes = combineDurationParts({ hours: 0, minutes: 241, seconds: 0 });
    expect(fromMinutes.ok).toBe(true);
    expect(fromMinutes.hours).toBe(4);
    expect(fromMinutes.minutes).toBe(1);
    expect(fromMinutes.secondsPart).toBe(0);
    expect(fromMinutes.seconds).toBe(4 * 3600 + 60);

    const fromSeconds = combineDurationParts({ hours: 0, minutes: 0, seconds: 241 });
    expect(fromSeconds.ok).toBe(true);
    expect(fromSeconds.hours).toBe(0);
    expect(fromSeconds.minutes).toBe(4);
    expect(fromSeconds.secondsPart).toBe(1);
    expect(fromSeconds.seconds).toBe(241);

    // Seconds carry can cascade into hours
    const cascade = combineDurationParts({ hours: 1, minutes: 59, seconds: 125 });
    expect(cascade.ok).toBe(true);
    expect(cascade.hours).toBe(2);
    expect(cascade.minutes).toBe(1);
    expect(cascade.secondsPart).toBe(5);
  });

  it('treats durationSteps as non-time', () => {
    expect(isTimeDurationKey('durationSeconds')).toBe(true);
    expect(isTimeDurationKey('durationGoSeconds')).toBe(true);
    expect(isTimeDurationKey('durationRestSeconds')).toBe(true);
    expect(isTimeDurationKey('durationSteps')).toBe(false);
    expect(isTimeDurationKey('reps')).toBe(false);
  });
});

describe('landing duration display', () => {
  const { formatTargets, metricsForDisplay } = require('../src/landingView');

  it('formats duration as #h#m#s with metric labels', () => {
    expect(formatTargets({ durationSeconds: 95, sets: 3 })).toBe('Duration 1m35s · Sets 3');
    expect(formatTargets({ durationSeconds: 3605 })).toBe('Duration 1h0m5s');
  });

  it('uses targets when incomplete and saved values when completed', () => {
    expect(
      metricsForDisplay({
        completed: false,
        targets: { durationSeconds: 60 },
        savedMetrics: { durationSeconds: 90 },
      })
    ).toEqual({ durationSeconds: 60 });
    expect(
      metricsForDisplay({
        completed: true,
        targets: { durationSeconds: 60 },
        savedMetrics: { durationSeconds: 90 },
      })
    ).toEqual({ durationSeconds: 90 });
  });
});
