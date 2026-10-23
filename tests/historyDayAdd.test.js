/**
 * History day Add-exercise picker helpers
 */

const {
  hasPushPullSubsections,
  filterExercisesForPicker,
  defaultMetricsForSchema,
  normalizePickerSelection,
} = require('../src/historyDayAdd');

describe('historyDayAdd picker helpers', () => {
  const bank = [
    { exerciseId: 'pull-ups', name: 'pull-ups', headers: ['ARMS', 'STRENGTH', 'PULL'], metrics: ['reps', 'sets'] },
    { exerciseId: 'pike-push-ups', name: 'pike-push-ups', headers: ['ARMS', 'STRENGTH', 'PUSH'], metrics: ['reps', 'sets'] },
    { exerciseId: 'plank', name: 'plank', headers: ['CORE', 'STRENGTH'], metrics: ['durationSeconds'] },
    { exerciseId: 'jog', name: 'jog', headers: ['LEGS', 'ENDURANCE'], metrics: ['distance', 'durationSeconds'] },
  ];

  it('detects Push/Pull under ARMS STRENGTH but not CORE STRENGTH', () => {
    expect(hasPushPullSubsections(bank, 'arms', 'strength')).toBe(true);
    expect(hasPushPullSubsections(bank, 'core', 'strength')).toBe(false);
    expect(hasPushPullSubsections(bank, 'legs', 'endurance')).toBe(false);
  });

  it('filters skills by focus, type, and optional subtype', () => {
    const armsPush = filterExercisesForPicker(bank, {
      focus: 'arms',
      type: 'strength',
      subtype: 'push',
    });
    expect(armsPush.map((e) => e.exerciseId)).toEqual(['pike-push-ups']);

    const core = filterExercisesForPicker(bank, {
      focus: 'core',
      type: 'strength',
      subtype: null,
    });
    expect(core.map((e) => e.exerciseId)).toEqual(['plank']);
  });

  it('normalizes subtype away when Push/Pull is absent', () => {
    const sel = normalizePickerSelection(bank, {
      focus: 'core',
      type: 'strength',
      subtype: 'push',
      exerciseId: 'pull-ups',
    });
    expect(sel.needsSubtype).toBe(false);
    expect(sel.subtype).toBeNull();
    expect(sel.exerciseId).toBe('');
    expect(sel.filtered.map((e) => e.exerciseId)).toEqual(['plank']);
  });

  it('builds placeholder metrics accepted by history create rules', () => {
    expect(defaultMetricsForSchema(['reps', 'sets', 'weight', 'distance', 'durationSeconds'])).toEqual({
      reps: 1,
      sets: 1,
      weight: 0,
      distance: 0,
      durationSeconds: 1,
    });
  });
});
