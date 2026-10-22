/**
 * Feature 18 - Tour
 * Spec: features/feature-18-Tour.md
 *
 * @jest-environment node
 */

const tourCatalog = require('../src/tourCatalog');

describe('Feature 18 - tour catalog', () => {
  it('history combined step', () => {
    const rules = tourCatalog.assertCatalogRules();
    expect(rules.historyCombinedStep).toBe(true);
    const step = tourCatalog.stepById('history-calendar');
    expect(step).toBeTruthy();
    expect(step.bodyKey).toBe('tour.step.historyCalendar.body');
  });

  it('landing multi-step', () => {
    const rules = tourCatalog.assertCatalogRules();
    expect(rules.landingCount).toBeGreaterThan(1);
    const landing = tourCatalog.listSteps().filter((s) => s.family === 'landing');
    const ids = landing.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining(['landing-today', 'landing-badge', 'landing-get-started'])
    );
  });

  it('privacy and contributing rules', () => {
    const rules = tourCatalog.assertCatalogRules();
    expect(rules.privacyCount).toBe(0);
    expect(rules.contributingCount).toBe(1);
    expect(rules.missingSpotlightShape).toBe(0);
    const contrib = tourCatalog.listSteps().filter((s) => s.family === 'contributing');
    expect(contrib).toHaveLength(1);
    expect(contrib[0].id).toBe('github-fab');
    expect(contrib[0].target).toContain('data-github-fab');
    expect(contrib[0].spotlight).toBe('circle');
    expect(contrib[0].hash).not.toBe('#/privacy');
  });

  it('every step stores a spotlight shape', () => {
    for (const step of tourCatalog.listSteps()) {
      expect(['circle', 'rect', 'none']).toContain(step.spotlight);
    }
    expect(tourCatalog.stepById('landing-badge').spotlight).toBe('circle');
    expect(tourCatalog.stepById('landing-today').spotlight).toBe('rect');
    expect(tourCatalog.stepById('history-week-badges').targetUnion).toBe(true);
    expect(tourCatalog.stepById('history-weekly-avg-2').spotlight).toBe('none');
    expect(tourCatalog.stepById('history-day').prepare).toEqual({ historyZoom: 'day' });
    expect(tourCatalog.stepById('history-year').target).toContain('zoom-year');
    expect(tourCatalog.stepById('config-appearance').target).toContain('data-tour-appearance-core');
    expect(tourCatalog.stepById('config-accessibility').target).toContain('data-section="accessibility"');
    expect(tourCatalog.stepById('config-backup').target).toContain('data-section="backup"');
    expect(tourCatalog.stepById('config-advanced').prepare).toEqual({ configSection: 'advanced-core' });
    expect(tourCatalog.stepById('config-advanced').targetUnion).toBe(true);
    expect(tourCatalog.stepById('config-advanced').target).toContain('data-tour-advanced-core');
  });

  it('firstStepForRoute maps config to config family', () => {
    const step = tourCatalog.firstStepForRoute('config');
    expect(step).toBeTruthy();
    expect(step.family).toBe('config');
    expect(step.id).toBe('config-appearance');
  });
});
