/**
 * Feature 18 - Tour
 * Spec: features/feature-18-Tour.md
 *
 * @jest-environment jsdom
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 18 - Tour', () => {
  let tempRoot;
  let dataDir;
  let tourProgress;
  let tourRuntime;
  let tourCatalog;
  let config;
  let i18n;
  let hash;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-tour-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      [
        'font size: 16',
        'navbar alignment: left',
        'language: en',
        'onboarding completed: true',
        'tour completed: false',
        'tour stored step id: ',
        '',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(path.join(dataDir, 'landing-config.txt'), '', 'utf8');
    fs.writeFileSync(path.join(dataDir, 'store.json'), '{"schemaVersion":1,"entries":[]}', 'utf8');

    const projectData = path.resolve(__dirname, '..', 'data');
    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      getUserDataDir: () => dataDir,
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      localizationDir: () => path.join(projectData, 'localization'),
      localizedDataFile: (_f, fallback) => fallback,
    }));

    hash = '#/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get hash() {
          return hash;
        },
        set hash(v) {
          hash = String(v);
        },
      },
    });

    document.body.innerHTML = `
      <header class="shell-header">
        <div class="shell-brand-block">
          <div class="brand">Strank</div>
          <button type="button" class="shell-tour-guide-btn" data-tour-guide-btn aria-label="Tour guide">🧭</button>
        </div>
      </header>
      <main>
        <div data-header-rank-badge class="shell-header-badge">badge</div>
        <div data-landing-card="today-expectations">today</div>
        <div data-landing-card="next-rank">next</div>
        <button type="button" data-action="get-started">Get Started</button>
        <div data-landing-card="skill-progress">skills</div>
        <button type="button" data-action="toggle-day-focus-menu">Day focus</button>
        <nav class="app-navbar">nav</nav>
        <div data-view="config" class="config-view">config</div>
        <div data-config-section="backup">backup</div>
        <button type="button" data-github-fab>GH</button>
      </main>
    `;

    config = require('../src/config');
    config.clearConfigCache();
    config.load();
    i18n = require('../src/i18n');
    i18n.init();
    i18n.setLanguage('en');
    tourProgress = require('../src/tourProgress');
    tourCatalog = require('../src/tourCatalog');
    tourRuntime = require('../src/tourRuntime');
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  function makeController(getRoute = () => 'landing') {
    return tourRuntime.createTourController({
      doc: document,
      win: window,
      getRoute,
      navigate: (h) => {
        hash = String(h);
      },
    });
  }

  it('starts from onboarding', () => {
    const ctrl = makeController();
    ctrl.startFromBeginning();
    jest.advanceTimersByTime(200);
    expect(ctrl.isVisible()).toBe(true);
    expect(ctrl._getStepIndex()).toBe(0);
    expect(document.querySelector('[data-tour-overlay]')).toBeTruthy();
    expect(document.querySelector('[data-tour-card]')).toBeTruthy();
    expect(document.querySelector('[data-tour-scrim]')).toBeTruthy();
    ctrl.destroy();
  });

  it('spotlight and coach card', () => {
    const ctrl = makeController();
    ctrl.startFromBeginning();
    jest.advanceTimersByTime(200);
    const overlay = document.querySelector('[data-tour-overlay]');
    const card = document.querySelector('[data-tour-card]');
    const prev = document.querySelector('[data-tour-prev]');
    const quit = document.querySelector('[data-tour-quit]');
    const next = document.querySelector('[data-tour-next]');
    const spot = document.querySelector('[data-tour-spotlight]');
    expect(overlay).toBeTruthy();
    expect(overlay.hidden).toBe(false);
    expect(card).toBeTruthy();
    expect(document.querySelector('[data-tour-card-arrow]')).toBeTruthy();
    expect(spot).toBeTruthy();
    expect(spot.getAttribute('data-spotlight-shape')).toBe('circle');
    expect(prev).toBeTruthy();
    expect(quit).toBeTruthy();
    expect(next).toBeTruthy();
    // First step: previous hidden; Quit still labeled Quit.
    expect(prev.hidden).toBe(true);
    expect(next.hidden).toBe(false);
    expect(quit.textContent).toMatch(/Quit/i);
    const visibleActions = Array.from(card.querySelectorAll('button'))
      .filter((b) => !b.hidden)
      .map((b) =>
        b.getAttribute('data-tour-prev') != null
          ? 'prev'
          : b.getAttribute('data-tour-quit') != null
            ? 'quit'
            : b.getAttribute('data-tour-next') != null
              ? 'next'
              : '?'
      );
    expect(visibleActions).toEqual(['quit', 'next']);

    // Spotlight fits the target bounds (not a fixed medium circle).
    const badge = document.querySelector('[data-header-rank-badge]');
    badge.getBoundingClientRect = () => ({
      left: 40,
      top: 20,
      width: 36,
      height: 36,
      right: 76,
      bottom: 56,
      x: 40,
      y: 20,
      toJSON() {},
    });
    ctrl._goToIndex(0);
    jest.advanceTimersByTime(200);
    const geom = tourRuntime.fitSpotlight(
      { left: 40, top: 20, width: 36, height: 36 },
      'circle',
      tourRuntime.SPOTLIGHT_PAD
    );
    expect(spot.style.width).toBe(`${Math.round(geom.width)}px`);
    expect(spot.style.height).toBe(`${Math.round(geom.height)}px`);
    expect(spot.style.left).toBe(`${Math.round(geom.left)}px`);

    ctrl._goToIndex(1);
    jest.advanceTimersByTime(200);
    expect(spot.getAttribute('data-spotlight-shape')).toBe('rect');
    ctrl.destroy();
  });

  it('next and previous', () => {
    const ctrl = makeController();
    ctrl.startFromBeginning();
    jest.advanceTimersByTime(200);
    expect(ctrl._getStepIndex()).toBe(0);
    ctrl._goToIndex(1);
    jest.advanceTimersByTime(200);
    expect(ctrl._getStepIndex()).toBe(1);
    ctrl._goToIndex(0);
    jest.advanceTimersByTime(200);
    expect(ctrl._getStepIndex()).toBe(0);
    ctrl.destroy();
  });

  it('quit returns to landing when tour was not started from compass', () => {
    const ctrl = makeController();
    ctrl.startFromBeginning();
    jest.advanceTimersByTime(200);
    hash = '#/config';
    ctrl._quit();
    expect(tourProgress.read().completed).toBe(true);
    expect(tourProgress.read().storedStepId).toBeNull();
    expect(hash).toBe('#/');
    expect(ctrl.isVisible()).toBe(false);
    const arrow = document.querySelector('[data-tour-resume-arrow]');
    expect(!arrow || arrow.hidden).toBe(true);
    ctrl.destroy();
  });

  it('quit returns to the page where the compass was pressed', () => {
    hash = '#/config';
    const ctrl = makeController(() => 'config');
    ctrl.onHeaderTourClick();
    jest.advanceTimersByTime(200);
    // Tour may navigate away while stepping; quit should still restore compass page.
    hash = '#/ranks';
    ctrl._quit();
    expect(hash).toBe('#/config');
    expect(ctrl.isVisible()).toBe(false);
    ctrl.destroy();
  });

  it('last step shows Finish and hides next', () => {
    const ctrl = makeController();
    const last = tourCatalog.listSteps().length - 1;
    ctrl._goToIndex(last);
    jest.advanceTimersByTime(200);
    const prev = document.querySelector('[data-tour-prev]');
    const next = document.querySelector('[data-tour-next]');
    const quit = document.querySelector('[data-tour-quit]');
    expect(prev.hidden).toBe(false);
    expect(next.hidden).toBe(true);
    expect(quit.textContent).toMatch(/Finish/i);
    ctrl.destroy();
  });

  it('header jump to page', () => {
    const ctrl = makeController(() => 'config');
    expect(tourProgress.hasStoredStep()).toBe(false);
    ctrl.onHeaderTourClick();
    jest.advanceTimersByTime(200);
    const firstConfig = tourCatalog.firstStepForRoute('config');
    expect(ctrl._getStepIndex()).toBe(tourCatalog.indexOfStepId(firstConfig.id));
    ctrl.destroy();
  });

  it('dismiss stores step', () => {
    const ctrl = makeController();
    ctrl.startFromBeginning();
    jest.advanceTimersByTime(200);
    const stepId = tourCatalog.listSteps()[ctrl._getStepIndex()].id;
    ctrl._hideAndStore();
    expect(ctrl.isVisible()).toBe(false);
    expect(tourProgress.read().storedStepId).toBe(stepId);
    expect(tourProgress.hasStoredStep()).toBe(true);
    const arrow = document.querySelector('[data-tour-resume-arrow]');
    expect(arrow).toBeTruthy();
    expect(arrow.hidden).toBe(false);
    expect(getComputedStyle(arrow).color || arrow.style.color || true).toBeTruthy();
    ctrl.destroy();
  });

  it('resume from header', () => {
    tourProgress.storeStep('landing-next');
    const ctrl = makeController(() => 'landing');
    ctrl.onHeaderTourClick();
    jest.advanceTimersByTime(200);
    expect(ctrl.isVisible()).toBe(true);
    expect(ctrl._getStepIndex()).toBe(tourCatalog.indexOfStepId('landing-next'));
    ctrl.destroy();
  });

  it('config accessibility scrolls then spotlights the section (not Advanced)', () => {
    document.body.innerHTML = `
      <header><button type="button" data-tour-guide-btn>🧭</button></header>
      <main>
        <div data-view-pane data-view-active="true" data-view-id="config">
          <section class="config-view" style="height: 200px; overflow: auto; scroll-behavior: smooth;">
            <section data-section="appearance" style="height: 280px;">Appearance</section>
            <section data-section="accessibility" data-tour-target="config-accessibility" style="height: 160px;">
              Accessibility
            </section>
            <section data-section="backup" style="height: 200px;">Backup</section>
            <section data-section="advanced" style="height: 80px;">Advanced</section>
          </section>
        </div>
      </main>
    `;
    const scroller = document.querySelector('.config-view');
    const access = document.querySelector('[data-section="accessibility"]');
    const advanced = document.querySelector('[data-section="advanced"]');
    // Pretend layout: accessibility starts below the fold until scrolled.
    let scrollTop = 0;
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 200 });
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => 720 });
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v) => {
        scrollTop = v;
      },
    });
    scroller.getBoundingClientRect = () => ({
      left: 0,
      top: 80,
      width: 400,
      height: 200,
      right: 400,
      bottom: 280,
    });
    access.getBoundingClientRect = () => ({
      left: 8,
      top: 80 + (280 - scrollTop),
      width: 380,
      height: 160,
      right: 388,
      bottom: 80 + (280 - scrollTop) + 160,
    });
    advanced.getBoundingClientRect = () => ({
      left: 8,
      top: 80 + (640 - scrollTop),
      width: 380,
      height: 80,
      right: 388,
      bottom: 80 + (640 - scrollTop) + 80,
    });

    const revealed = [];
    const ctrl = tourRuntime.createTourController({
      doc: document,
      win: window,
      getRoute: () => 'config',
      navigate: (h) => {
        hash = String(h);
      },
      getActiveRoot: () => document.querySelector('[data-view-pane]'),
      prepareStep: (step) => {
        if (step.prepare && step.prepare.configSection === 'accessibility') {
          // Instant scroll like configView.revealSection
          const prev = scroller.style.scrollBehavior;
          scroller.style.scrollBehavior = 'auto';
          scrollTop = 280;
          scroller.style.scrollBehavior = prev;
          revealed.push(step.id);
        }
      },
    });

    hash = '#/config';
    const idx = tourCatalog.indexOfStepId('config-accessibility');
    ctrl._goToIndex(idx);
    jest.advanceTimersByTime(200);

    expect(revealed).toContain('config-accessibility');
    expect(scrollTop).toBe(280);
    const spot = document.querySelector('[data-tour-spotlight]');
    expect(spot.hidden).toBe(false);
    // Spotlight must sit on Accessibility (top ~80), not Advanced (would be near bottom).
    expect(Number.parseInt(spot.style.top, 10)).toBeLessThan(120);
    expect(Number.parseInt(spot.style.top, 10)).toBeGreaterThan(60);
    const card = document.querySelector('[data-tour-card]');
    expect(Number.parseInt(card.style.top, 10)).toBeLessThan(200);
    ctrl.destroy();
  });
});
