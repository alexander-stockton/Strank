/**
 * @jest-environment jsdom
 *
 * Feature 15 — App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const { rankFor, direction, VIEW_RANKS, run } = require('../src/viewTransitions');

describe('Feature 15 — ranked view slides', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(require('../src/animationFlags'), 'isEnabled').mockReturnValue(true);
    document.body.innerHTML = '<main id="shell-main"></main>';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('Ascending rank slides current right and next up from below', () => {
    expect(rankFor('landing')).toBe(3);
    expect(rankFor('ranks')).toBe(8);
    expect(direction(3, 8)).toBe('ascend');
  });

  it('Descending rank slides current down and next in from the right', () => {
    expect(direction(rankFor('ranks'), rankFor('history-month'))).toBe('descend');
    expect(direction(8, 5)).toBe('descend');
  });

  it('History day is deeper than history month', () => {
    expect(VIEW_RANKS['history-month']).toBe(5);
    expect(VIEW_RANKS['history-day']).toBe(6);
    expect(direction(5, 6)).toBe('ascend');
  });

  it('run applies enter/exit classes on sibling panes', () => {
    const main = document.getElementById('shell-main');
    const fromEl = document.createElement('div');
    fromEl.className = 'view-slide-pane';
    const toEl = document.createElement('div');
    toEl.className = 'view-slide-pane';
    main.appendChild(fromEl);
    main.appendChild(toEl);
    const result = run({
      container: main,
      fromEl,
      toEl,
      fromView: 'landing',
      toView: 'ranks',
      doc: document,
      durationMs: 100,
    });
    expect(result.skipped).toBe(false);
    expect(result.direction).toBe('ascend');
    expect(fromEl.classList.contains('view-slide-exit-to-right')).toBe(true);
    expect(toEl.classList.contains('view-slide-enter-from-below')).toBe(true);
    expect(toEl.classList.contains('view-slide-enter-active')).toBe(true);
    jest.advanceTimersByTime(100);
    expect(fromEl.parentNode).toBeNull();
  });
});
