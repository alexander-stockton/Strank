/**
 * Feature 8 — workout timer helpers
 */

const {
  createTimerState,
  pauseTimer,
  resumeTimer,
  readElapsedMs,
  formatDuration,
  formatCompletionClock,
  formatWallClock,
  convertClockDisplay,
} = require('../src/workoutTimer');

describe('workout timer', () => {
  it('formats duration as H:MM:SS.mmm', () => {
    expect(formatDuration(0)).toBe('0:00:00.000');
    expect(formatDuration(3661001)).toBe('1:01:01.001');
  });

  it('accumulates only while running', () => {
    const timer = createTimerState();
    resumeTimer(timer, 1000);
    expect(readElapsedMs(timer, 1500)).toBe(500);
    pauseTimer(timer, 2000);
    expect(timer.elapsedMs).toBe(1000);
    expect(readElapsedMs(timer, 5000)).toBe(1000);
    resumeTimer(timer, 5000);
    expect(readElapsedMs(timer, 5300)).toBe(1300);
  });

  it('formats completion clock in 24hr and 12hr', () => {
    // Local constructor avoids TZ flake; formatCompletionClock reads getHours() etc.
    const evening = new Date(2026, 9, 20, 23, 50, 10, 1);
    const morning = new Date(2026, 9, 20, 0, 1, 1, 1);
    expect(formatCompletionClock(evening.toISOString(), { use24Hour: true })).toBe(
      formatWallClock(23, 50, 10, 1, true)
    );
    expect(formatCompletionClock(evening.toISOString(), { use24Hour: false })).toBe(
      formatWallClock(23, 50, 10, 1, false)
    );
    expect(formatCompletionClock(morning.toISOString(), { use24Hour: false })).toBe(
      formatWallClock(0, 1, 1, 1, false)
    );
    expect(formatCompletionClock(morning.toISOString(), { use24Hour: true })).toBe(
      formatWallClock(0, 1, 1, 1, true)
    );
  });

  it('converts clock display strings between 12hr and 24hr', () => {
    expect(convertClockDisplay('23:50:10.001', false)).toBe('11:50:10.001 PM');
    expect(convertClockDisplay('11:50:10.001 PM', true)).toBe('23:50:10.001');
    expect(convertClockDisplay('12:01:01.001 AM', true)).toBe('00:01:01.001');
    expect(convertClockDisplay('00:01:01.001', false)).toBe('12:01:01.001 AM');
    expect(convertClockDisplay('12:00:00.000 PM', true)).toBe('12:00:00.000');
    expect(formatWallClock(12, 0, 0, 0, false)).toBe('12:00:00.000 PM');
    expect(formatWallClock(0, 0, 0, 0, false)).toBe('12:00:00.000 AM');
  });
});
