/**
 * @jest-environment jsdom
 *
 * Feature 15 - App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const {
  rankFor,
  direction,
  VIEW_RANKS,
  run,
  prepare,
  randomLeadInMs,
  LEAD_IN_MIN_MS,
  LEAD_IN_MAX_MS,
} = require('../src/viewTransitions');

describe('Feature 15 - ranked view slides', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(require('../src/animationFlags'), 'isEnabled')
      .mockReturnValue(true);
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => setTimeout(() => cb(Date.now()), 0));
    jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => clearTimeout(id));
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
    expect(direction(rankFor('ranks'), rankFor('history-month'))).toBe(
      'descend',
    );
    expect(direction(8, 5)).toBe('descend');
  });

  it('History day is deeper than history month', () => {
    expect(VIEW_RANKS['history-month']).toBe(5);
    expect(VIEW_RANKS['history-day']).toBe(6);
    expect(direction(5, 6)).toBe('ascend');
  });

  it('randomLeadInMs stays between 0.05s and 0.5s', () => {
    expect(LEAD_IN_MIN_MS).toBe(50);
    expect(LEAD_IN_MAX_MS).toBe(500);
    expect(randomLeadInMs(() => 0)).toBe(50);
    expect(randomLeadInMs(() => 1)).toBe(500);
    expect(randomLeadInMs(() => 0.5)).toBe(275);
  });

  it('prepare parks the incoming pane off-screen without activating motion', () => {
    const main = document.getElementById('shell-main');
    const fromEl = document.createElement('div');
    fromEl.className = 'view-slide-pane';
    const toEl = document.createElement('div');
    toEl.className = 'view-slide-pane';
    main.appendChild(fromEl);
    main.appendChild(toEl);
    const prepared = prepare({
      container: main,
      fromEl,
      toEl,
      fromView: 'landing',
      toView: 'ranks',
      doc: document,
    });
    expect(prepared.skipped).toBe(false);
    expect(toEl.classList.contains('view-slide-enter-from-below')).toBe(true);
    expect(toEl.classList.contains('view-slide-prepared')).toBe(true);
    expect(toEl.classList.contains('view-slide-enter-active')).toBe(false);
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
    // Double rAF before enter-active (parked pose paints first).
    expect(toEl.classList.contains('view-slide-enter-active')).toBe(false);
    jest.runOnlyPendingTimers(); // first rAF
    jest.runOnlyPendingTimers(); // second rAF -> startMotion
    expect(toEl.classList.contains('view-slide-enter-active')).toBe(true);
    expect(fromEl.classList.contains('view-slide-exit-active')).toBe(true);
    jest.advanceTimersByTime(100);
    expect(fromEl.parentNode).toBeNull();
  });

  it('immediate starts motion without waiting on rAF', () => {
    const main = document.getElementById('shell-main');
    const fromEl = document.createElement('div');
    fromEl.className = 'view-slide-pane';
    const toEl = document.createElement('div');
    toEl.className =
      'view-slide-pane view-slide-enter-from-right view-slide-prepared';
    main.appendChild(fromEl);
    main.appendChild(toEl);
    run({
      container: main,
      fromEl,
      toEl,
      fromView: 'ranks',
      toView: 'landing',
      doc: document,
      durationMs: 100,
      retainFromEl: true,
      immediate: true,
    });
    expect(toEl.classList.contains('view-slide-enter-active')).toBe(true);
    expect(fromEl.classList.contains('view-slide-exit-active')).toBe(true);
  });

  it('cancel aborts without calling onComplete', () => {
    const main = document.getElementById('shell-main');
    const fromEl = document.createElement('div');
    fromEl.className = 'view-slide-pane';
    const toEl = document.createElement('div');
    toEl.className = 'view-slide-pane';
    main.appendChild(fromEl);
    main.appendChild(toEl);
    let completed = 0;
    let cancelled = 0;
    const result = run({
      container: main,
      fromEl,
      toEl,
      fromView: 'landing',
      toView: 'ranks',
      doc: document,
      durationMs: 100,
      retainFromEl: true,
      onComplete: () => {
        completed += 1;
      },
      onCancel: () => {
        cancelled += 1;
      },
    });
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    expect(toEl.classList.contains('view-slide-enter-active')).toBe(true);
    result.cancel();
    expect(cancelled).toBe(1);
    expect(completed).toBe(0);
    expect(toEl.classList.contains('view-slide-enter-active')).toBe(false);
    jest.advanceTimersByTime(100);
    expect(completed).toBe(0);
  });

  it('retainFromEl parks the outgoing pane instead of removing it', () => {
    const main = document.getElementById('shell-main');
    const fromEl = document.createElement('div');
    fromEl.className = 'view-slide-pane';
    const toEl = document.createElement('div');
    toEl.className = 'view-slide-pane';
    main.appendChild(fromEl);
    main.appendChild(toEl);
    run({
      container: main,
      fromEl,
      toEl,
      fromView: 'landing',
      toView: 'ranks',
      doc: document,
      durationMs: 100,
      retainFromEl: true,
    });
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    jest.advanceTimersByTime(100);
    expect(fromEl.parentNode).toBe(main);
    expect(fromEl.classList.contains('view-slide-enter-from-right')).toBe(true);
    expect(fromEl.classList.contains('view-slide-prepared')).toBe(true);
  });
});
