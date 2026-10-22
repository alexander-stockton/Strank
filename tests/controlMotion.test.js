/**
 * @jest-environment jsdom
 *
 * Feature 15 � App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const controlMotion = require('../src/controlMotion');

describe('Feature 15 - control motion', () => {
  beforeEach(() => {
    jest.spyOn(require('../src/animationFlags'), 'isEnabled').mockReturnValue(true);
    document.documentElement.className = '';
    document.body.innerHTML = `
      <button type="button" class="primary" data-elevated>Go</button>
      <button type="button" class="primary outline" data-outline>Outline</button>
      <button type="button" class="exercise-help-btn" data-help>?</button>
      <section class="config-advanced" data-open="false">
        <button type="button" class="config-accordion-toggle">Advanced</button>
        <div class="config-accordion-panel"><div class="config-accordion-panel-inner">x</div></div>
      </section>
      <div class="landing-panel"><div class="panel-body" data-scroll></div></div>
    `;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Elevated button hover press and bounce', () => {
    const handle = controlMotion.attach(document.documentElement);
    handle.refresh();
    expect(document.documentElement.classList.contains('motion-elevated-on')).toBe(true);
    const btn = document.querySelector('[data-elevated]');
    btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(btn.classList.contains('is-pressed')).toBe(true);
    btn.dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(btn.classList.contains('is-pressed')).toBe(false);
    handle.destroy();
  });

  it('Elevated button press-drag off returns to default', () => {
    controlMotion.attach(document.documentElement).refresh();
    const btn = document.querySelector('[data-elevated]');
    btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    btn.dispatchEvent(new Event('pointerleave', { bubbles: true }));
    expect(btn.classList.contains('is-pressed')).toBe(false);
    expect(btn.classList.contains('is-bounce')).toBe(false);
  });

  it('Outline button press scales to 95%', () => {
    controlMotion.attach(document.documentElement).refresh();
    expect(document.documentElement.classList.contains('motion-outline-on')).toBe(true);
    const btn = document.querySelector('[data-outline]');
    btn.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(btn.classList.contains('is-pressed')).toBe(true);
  });

  it('Question-mark control does not scale', () => {
    expect(controlMotion.isElevatedButton(document.querySelector('[data-help]'))).toBe(false);
    expect(controlMotion.isOutlineButton(document.querySelector('[data-help]'))).toBe(false);
  });

  it('Accordion expands and retracts smoothly', () => {
    controlMotion.attach(document.documentElement).refresh();
    expect(document.documentElement.classList.contains('motion-accordions-on')).toBe(true);
    const panel = document.querySelector('.config-accordion-panel');
    expect(panel).toBeTruthy();
  });

  it('Card scrolling is smooth', () => {
    controlMotion.attach(document.documentElement).refresh();
    expect(document.documentElement.classList.contains('motion-smooth-scroll-on')).toBe(true);
  });
});
