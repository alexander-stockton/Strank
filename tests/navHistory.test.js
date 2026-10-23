/**
 * Back navigation uses last-visited hashes, not hierarchical parents.
 */

const { createNavHistory, normalizeNavHash } = require('../src/navHistory');

describe('navHistory', () => {
  it('normalizes empty hashes to landing', () => {
    expect(normalizeNavHash('')).toBe('#/');
    expect(normalizeNavHash('#')).toBe('#/');
    expect(normalizeNavHash('config')).toBe('#/config');
    expect(normalizeNavHash('#/ranks')).toBe('#/ranks');
  });

  it('Back returns to the most recently visited page', () => {
    const nav = createNavHistory();
    nav.record('#/');
    nav.record('#/history');
    nav.record('#/config');
    nav.record('#/rank-manager');

    expect(nav.consumeBack()).toBe('#/config');
    nav.record('#/config');
    expect(nav.consumeBack()).toBe('#/history');
    nav.record('#/history');
    expect(nav.consumeBack()).toBe('#/');
  });

  it('empty stack Back falls back to landing', () => {
    const nav = createNavHistory();
    nav.record('#/config');
    expect(nav.consumeBack()).toBe('#/');
  });

  it('replace redirects do not trap Back on the left page', () => {
    const nav = createNavHistory();
    nav.record('#/');
    nav.record('#/config');
    nav.record('#/rank-manager');
    nav.record('#/rank-create');
    // Save → manager (replace): Back from manager should be config, not create.
    nav.markReplace();
    nav.record('#/rank-manager');
    expect(nav.getStack()).toEqual(['#/', '#/config']);
    expect(nav.consumeBack()).toBe('#/config');
  });

  it('does not push when recording the same hash twice', () => {
    const nav = createNavHistory();
    nav.record('#/');
    nav.record('#/config');
    nav.record('#/config');
    expect(nav.getStack()).toEqual(['#/']);
  });
});
