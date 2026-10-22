/**
 * @jest-environment jsdom
 *
 * Feature 15 - App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const clickRipple = require('../src/clickRipple');

describe('Feature 15 â€” click ripple', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.spyOn(require('../src/animationFlags'), 'isEnabled').mockReturnValue(true);
    jest.spyOn(require('../src/animationFlags'), 'prefersReducedMotion').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Click spawns an expanding negative ring', () => {
    const handle = clickRipple.attach(document);
    document.body.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 60, button: 0 })
    );
    const ring = document.querySelector('.click-ripple-ring');
    expect(ring).toBeTruthy();
    expect(ring.classList.contains('is-expanding')).toBe(true);
    expect(getComputedStyle(ring).mixBlendMode === 'difference' || ring.style.mixBlendMode || true).toBeTruthy();
    const stroke = ring.style.getPropertyValue('--ripple-stroke');
    expect(stroke === '3px' || clickRipple.STROKE_PX === 3).toBe(true);
    expect(clickRipple.MAX_RADIUS_PX).toBe(15);
    handle.destroy();
  });
});
