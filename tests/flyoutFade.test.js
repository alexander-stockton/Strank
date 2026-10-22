/**
 * @jest-environment jsdom
 *
 * Feature 15 � App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const flyoutFade = require('../src/flyoutFade');

describe('Feature 15 - flyout fade', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(require('../src/animationFlags'), 'isEnabled').mockReturnValue(true);
    document.body.innerHTML = '<div data-day-focus-menu-panel hidden></div><div data-exercise-help-tip hidden></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('Day focus menu fades in place', () => {
    const panel = document.querySelector('[data-day-focus-menu-panel]');
    flyoutFade.show(panel);
    expect(panel.hidden).toBe(false);
    expect(panel.classList.contains('flyout-fade-visible')).toBe(true);
    flyoutFade.hide(panel);
    expect(panel.classList.contains('flyout-fade-leaving')).toBe(true);
    jest.advanceTimersByTime(flyoutFade.DURATION_MS);
    expect(panel.hidden).toBe(true);
  });

  it('Exercise tooltip fades in place', () => {
    const tip = document.querySelector('[data-exercise-help-tip]');
    flyoutFade.show(tip);
    expect(tip.hidden).toBe(false);
    expect(tip.classList.contains('flyout-fade-visible')).toBe(true);
    flyoutFade.hide(tip);
    jest.advanceTimersByTime(250);
    expect(tip.hidden).toBe(true);
  });
});
