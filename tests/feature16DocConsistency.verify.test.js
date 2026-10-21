/**
 * Feature 16 — Localization & Language Support
 * Spec: features/feature-16-Localization.md
 *
 * Ensures critical prose / FR anchors remain in the feature doc.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const doc = fs.readFileSync(
  path.join(__dirname, '..', 'features', 'feature-16-Localization.md'),
  'utf8'
);

describe('Feature 16 doc consistency anchors', () => {
  test('distance enum present', () => {
    expect(doc).toMatch(/\| `m` \| Meters \|/);
    expect(doc).toMatch(/\| `yd` \| Yards \|/);
    expect(doc).toMatch(/\| `ft` \| Feet \|/);
    expect(doc).toMatch(/\| `steps` \| Steps \|/);
  });

  test('weight stones present', () => {
    expect(doc).toMatch(/\| `st` \| Stones \|/);
    expect(doc).toMatch(/1 stone = 14/);
  });

  test('tooltip copy present', () => {
    expect(doc).toContain(
      'biological males and females have different strides at the same height'
    );
    expect(doc).toContain(
      'Strank needs your height to estimate how many steps it takes for you to walk one'
    );
    expect(doc).toMatch(/distance units previous/);
  });

  test('normative stride equations and checks present', () => {
    expect(doc).toContain('4.92');
    expect(doc).toContain('4.98');
    expect(doc).toContain('29.52');
    expect(doc).toContain('29.88');
    expect(doc).toContain('Do **not** treat the rounded literal `0.415`');
  });

  test('distance SI factors present', () => {
    expect(doc).toContain('1609.344');
    expect(doc).toContain('0.9144');
    expect(doc).toContain('0.3048');
    expect(doc).toContain('0.0254');
    expect(doc).toContain('63360');
  });

  test('weight normative hardcodes present', () => {
    expect(doc).toContain('0.45359237');
    expect(doc).toContain('6.35029318');
    expect(doc).toMatch(/1\/0\.45359237|\\frac\{1\}\{0\.45359237\}/);
    expect(doc).toContain('do not hardcode a truncated reciprocal');
  });

  test('convert-on-change FRs and stories present', () => {
    for (const id of [
      'FR-016',
      'FR-017',
      'FR-019',
      'FR-021',
      'FR-022',
      'FR-023',
      'FR-024',
      'FR-025',
      'FR-026',
      'FR-027',
      'FR-028',
      'FR-030',
      'US-16.4',
      'US-16.5',
      'US-16.6',
      'SC-006',
      'SC-007',
      'SC-008',
    ]) {
      expect(doc).toContain(id);
    }
  });

  test('custom distance superseded note present', () => {
    expect(doc).toMatch(/custom/);
    expect(doc).toMatch(/superseded/);
  });
});
