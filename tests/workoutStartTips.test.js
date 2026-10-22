/**
 * Feature 15 - App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const {
  selectTip,
  daysSinceLastEntry,
  TIPS,
  WELCOME,
} = require('../src/workoutStartTips');

describe('Feature 15 - workout start tips', () => {
  it('Notice shows a tip from the pool', () => {
    const tip = selectTip({
      today: '2026-10-20',
      lastEntryLocalDate: '2026-10-10',
      random: () => 0,
    });
    expect(TIPS.map((t) => t.id)).toContain(tip.id);
    expect(tip.id).not.toBe('welcome');
    expect(TIPS.some((t) => t.text === tip.text)).toBe(true);
  });

  it('Welcome back after two weeks without logs', () => {
    expect(daysSinceLastEntry('2026-10-20', '2026-10-06')).toBe(14);
    const tip = selectTip({
      today: '2026-10-20',
      lastEntryLocalDate: '2026-10-05',
    });
    expect(tip).toEqual(WELCOME);
    expect(tip.text).toBe('Welcome back! (me)');
  });

  it('Never logged shows welcome back', () => {
    const tip = selectTip({
      today: '2026-10-20',
      lastEntryLocalDate: null,
    });
    expect(tip.text).toBe('Welcome back! (me)');
    expect(tip.id).toBe('welcome');
  });
});
