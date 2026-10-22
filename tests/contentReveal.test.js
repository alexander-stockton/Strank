/**
 * @jest-environment jsdom
 *
 * Feature 15 — App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const contentReveal = require('../src/contentReveal');

describe('Feature 15 â€” content reveal', () => {
  beforeEach(() => {
    jest.spyOn(require('../src/animationFlags'), 'isEnabled').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Frames stay while content fades up', () => {
    document.body.innerHTML = `
      <div data-content-reveal-frame>
        <div data-content-reveal-body>Hello</div>
      </div>`;
    const result = contentReveal.play(document.body);
    expect(result.skipped).toBe(false);
    const unit = document.querySelector('.content-reveal-unit');
    expect(unit).toBeTruthy();
    expect(unit.style.getPropertyValue('--reveal-duration')).toBe('750ms');
    expect(contentReveal.DURATION_MS).toBe(750);
  });

  it('List items stagger at about 25% progress', () => {
    document.body.innerHTML = `
      <div data-content-reveal-frame>
        <div data-content-reveal-item>a</div>
        <div data-content-reveal-item>b</div>
        <div data-content-reveal-item>c</div>
      </div>`;
    const result = contentReveal.play(document.body);
    expect(result.staggerDelayMs).toBe(contentReveal.DURATION_MS * contentReveal.STAGGER_AT);
    const items = document.querySelectorAll('.content-reveal-unit');
    expect(items.length).toBe(3);
    expect(items[0].style.animationDelay).toBe('0ms');
    expect(items[1].style.animationDelay).toBe(`${result.staggerDelayMs}ms`);
    expect(items[2].style.animationDelay).toBe(`${result.staggerDelayMs * 2}ms`);
  });

  it('Each content group starts its stagger timer independently', () => {
    document.body.innerHTML = `
      <div data-content-reveal-frame id="g1">
        <div data-content-reveal-item>a</div>
        <div data-content-reveal-item>b</div>
      </div>
      <div data-content-reveal-frame id="g2">
        <div data-content-reveal-item>c</div>
        <div data-content-reveal-item>d</div>
      </div>`;
    const result = contentReveal.play(document.body);
    expect(result.groups).toBe(2);
    const g1 = document.querySelectorAll('#g1 .content-reveal-unit');
    const g2 = document.querySelectorAll('#g2 .content-reveal-unit');
    expect(g1[0].style.animationDelay).toBe('0ms');
    expect(g1[1].style.animationDelay).toBe(`${result.staggerDelayMs}ms`);
    expect(g2[0].style.animationDelay).toBe('0ms');
    expect(g2[1].style.animationDelay).toBe(`${result.staggerDelayMs}ms`);
  });
});
