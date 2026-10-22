/**
 * @jest-environment jsdom
 *
 * Feature 7 - Landing Page
 * Spec: features/feature-7-Landing-Page.md
 * Feature 13 - Skill Progress Landing
 * Spec: features/feature-13-Skill-Progress-Landing.md
 * Feature 14 - Landing Day Focus
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const ALL_FOCUS_DAYS = [
  'focus arms days: mon,tue,wed,thu,fri,sat,sun',
  'focus core days: mon,tue,wed,thu,fri,sat,sun',
  'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
  'focus legs days: mon,tue,wed,thu,fri,sat,sun',
];

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_FORMAT = [
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x[reps] x[sets]',
  '\t\t\t- push-ups x[reps] x[sets]',
  '',
].join('\n');

const FIXTURE_RANKS = [
  'UNRANKED:',
  '{badges/unranked.svg}',
  '--------------',
  '',
  'BRONZE I:',
  '{badges/bronze-i.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x4 x3',
  '\t\t\t- push-ups x10 x3',
  '',
  'BRONZE II:',
  '{badges/bronze-ii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x6 x3',
  '',
  'BRONZE III:',
  '{badges/bronze-iii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x8 x3',
  '',
  'SILVER I:',
  '{badges/silver-i.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x12 x3',
  '\t\t\t- push-ups x20 x3',
  '',
].join('\n');

function entry(overrides) {
  return {
    entryId: overrides.entryId || `e_${overrides.localDate}_${overrides.exerciseId}`,
    exerciseId: overrides.exerciseId,
    localDate: overrides.localDate,
    createdAt: `${overrides.localDate}T10:00:00.000-05:00`,
    updatedAt: `${overrides.localDate}T10:00:00.000-05:00`,
    metrics: overrides.metrics,
  };
}

describe('Feature 7 - Landing Page (UI)', () => {
  let tempRoot;
  let dataDir;
  let landing;
  let ranking;
  let catalog;
  let ranks;
  let storage;
  let config;
  let mountLandingView;
  let renderAppNavbar;
  let root;
  let mount;

  function writeConfig(lines) {
    const globalLines = [];
    const landingLines = [];
    for (const line of lines) {
      if (/^landing\s|^focus\s/i.test(line.trim())) landingLines.push(line);
      else globalLines.push(line);
    }
    fs.writeFileSync(path.join(dataDir, 'config.txt'), globalLines.join('\n') + '\n', 'utf8');
    const focusAlready = landingLines.some((l) => /^focus\s/i.test(l.trim()));
    const landingOut = focusAlready ? landingLines : [...landingLines, ...ALL_FOCUS_DAYS];
    fs.writeFileSync(path.join(dataDir, 'landing-config.txt'), landingOut.join('\n') + '\n', 'utf8');
    config.clearConfigCache();
    config.load();
    const landingConfig = require('../src/landingConfig');
    landingConfig.clearLandingConfigCache();
    landingConfig.load();
  }

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f7-ui-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['navbar alignment: left', 'logging: false'].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'landing-config.txt'),
      [
        ...ALL_FOCUS_DAYS,
      ].join('\n'),
      'utf8'
    );

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranks = require('../src/ranks');
    ranking = require('../src/ranking');
    config = require('../src/config');
    landing = require('../src/landing');
    ({ mountLandingView } = require('../src/landingView'));
    ({ renderAppNavbar } = require('../src/appShell'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    const landingConfig = require('../src/landingConfig');
    landingConfig.clearLandingConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();
    landingConfig.load();
    ranking.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');

    document.body.innerHTML = `
      <nav class="app-navbar app-navbar-left" data-navbar-alignment="left">
        <div class="app-navbar-links"></div>
        <div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div>
      </nav>
      <div id="root"></div>`;
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    ranking.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-7.2 - See Next Rank Expectations', () => {
    it('Next tier listed center-right', () => {
      // Establish BRONZE III overall for the current week (Mon 2026-10-13 .. Sun 19)
      // BRONZE III only requires pike x8 - logging pike at 8 meets III; SILVER needs 12
      ranking.__setLocalDate('2026-10-17');
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 8, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 8, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-15', metrics: { reps: 8, sets: 3 } }),
        ],
      });

      const compared = ranking.compareToRanks('2026-10-13', { today: '2026-10-17' });
      expect(compared.data.overallTierName).toBe('BRONZE III');

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const nextPanel = root.querySelector('[data-panel="next-rank"]');
      expect(nextPanel).toBeTruthy();
      expect(nextPanel.querySelector('[data-next-tier-label]').textContent).toMatch(/SILVER I/);
      expect(nextPanel.querySelector('[data-exercise-id="pike-push-ups"]')).toBeTruthy();
      expect(nextPanel.textContent).toMatch(/Reps 12/);
    });

    it('at top of ladder shows among-the-best with no next badge', () => {
      ranking.__setLocalDate('2026-10-17');
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 12, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 12, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-15', metrics: { reps: 12, sets: 3 } }),
          entry({ exerciseId: 'push-ups', localDate: '2026-10-13', metrics: { reps: 20, sets: 3 } }),
          entry({ exerciseId: 'push-ups', localDate: '2026-10-14', metrics: { reps: 20, sets: 3 } }),
          entry({ exerciseId: 'push-ups', localDate: '2026-10-15', metrics: { reps: 20, sets: 3 } }),
        ],
      });

      const compared = ranking.compareToRanks('2026-10-13', { today: '2026-10-17' });
      expect(compared.data.overallTierName).toBe('SILVER I');

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const nextPanel = root.querySelector('[data-panel="next-rank"]');
      expect(nextPanel.querySelector('[data-next-rank-badge]')).toBeNull();
      expect(nextPanel.querySelector('.landing-next-tier-name')).toBeNull();
      expect(nextPanel.querySelector('[data-among-the-best]')).toBeTruthy();
      expect(nextPanel.textContent).toMatch(/among the best/i);
      expect(nextPanel.querySelector('[data-exercise-id]')).toBeNull();
    });
  });

  describe('US-7.3 - See Overall Rank Badge And Navbar', () => {
    it('Left navbar shows shell routes without a duplicate landing rank card', () => {
      writeConfig([
        'navbar alignment: left',
        'logging: false',
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });

      const shell = document.createElement('div');
      shell.innerHTML = renderAppNavbar('landing', 'left');
      expect(shell.querySelector('[data-navbar-alignment="left"]')).toBeTruthy();
      expect(shell.querySelector('.app-navbar-left')).toBeTruthy();
      expect(shell.querySelector('[data-route="landing"]')).toBeTruthy();
      expect(shell.querySelector('[data-route="history"]')).toBeTruthy();
      expect(shell.querySelector('[data-route="ranks"]')).toBeTruthy();
      expect(shell.querySelector('[data-route="config"]')).toBeTruthy();

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      expect(root.querySelector('[data-navbar-alignment="left"]')).toBeTruthy();
      expect(root.querySelector('[data-badge-slot="top-left"]')).toBeNull();
      expect(root.querySelector('[data-overall-rank]')).toBeNull();
      expect(root.querySelector('.landing-top-bar')).toBeNull();
    });

    it('Top navbar does not duplicate the header overall rank card on landing', () => {
      writeConfig([
        'navbar alignment: top',
        'logging: false',
        ...ALL_FOCUS_DAYS,
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });

      const shell = document.createElement('div');
      shell.innerHTML = renderAppNavbar('landing', 'top');
      expect(shell.querySelector('[data-navbar-alignment="top"]')).toBeTruthy();
      expect(shell.querySelector('.app-navbar-top')).toBeTruthy();

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      expect(root.querySelector('[data-navbar-alignment="top"]')).toBeTruthy();
      expect(root.querySelector('[data-badge-slot="top-right"]')).toBeNull();
      expect(root.querySelector('[data-overall-rank]')).toBeNull();
    });
  });

  describe('US-7.4 - See Completed State And Start Workout', () => {
    it('Get Started opens workout', () => {
      storage.writeStore({ schemaVersion: 1, entries: [] });
      let started = null;
      mount = mountLandingView(root, {
        localDate: '2026-10-17',
        onGetStarted: (model) => {
          started = model;
        },
      });

      const btn = root.querySelector('[data-action="get-started"]');
      expect(btn).toBeTruthy();
      btn.click();
      expect(started).toBeTruthy();
      expect(started.workoutComplete).toBe(false);

      // Simulate Feature 8 route mount
      const { mountActiveWorkoutView } = require('../src/activeWorkoutView');
      mount.destroy();
      mount = mountActiveWorkoutView(root, {
        localDate: started.localDate,
        expectations: started.todayExpectations,
      });
      expect(root.querySelector('[data-view="activeWorkout"]')).toBeTruthy();
      expect(root.textContent).toMatch(/Workout/);
      expect(root.querySelector('[data-workout-checklist]')).toBeTruthy();
    });

    it('Finished exercises show completed', () => {
      // Target when UNRANKED = BRONZE I (pike 4x3, push-ups 10x3)
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-17',
            metrics: { reps: 4, sets: 3 },
          }),
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-17',
            metrics: { reps: 10, sets: 3 },
          }),
        ],
      });

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const rows = root.querySelectorAll('[data-panel="today-expectations"] .expectation-row');
      expect(rows.length).toBeGreaterThanOrEqual(2);
      rows.forEach((row) => {
        expect(row.getAttribute('data-completed')).toBe('true');
        expect(row.classList.contains('is-completed')).toBe(true);
      });
      expect(root.querySelector('[data-workout-complete]')).toBeTruthy();
      expect(root.textContent).toMatch(/Today’s workout complete/);
      expect(root.querySelector('[data-action="get-started"]')).toBeNull();
    });

    it('shows logged metrics as completed even when below rank targets', () => {
      // Below BRONZE I pike target (4x3) — still a same-day workout log
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-17',
            metrics: { reps: 2, sets: 1 },
          }),
        ],
      });

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const row = root.querySelector(
        '[data-panel="today-expectations"] .expectation-row[data-exercise-id="pike-push-ups"]'
      );
      expect(row).toBeTruthy();
      expect(row.getAttribute('data-completed')).toBe('true');
      expect(row.classList.contains('is-completed')).toBe(true);
      expect(row.querySelector('[data-targets]').textContent).toMatch(/Reps\s*2/i);
      expect(row.querySelector('[data-targets]').textContent).toMatch(/Sets\s*1/i);
    });
  });

  describe('US-11.2 - Accessibility Options', () => {
    it('Screen reader mode exposes names', () => {
      config.set('screen reader mode', true);
      config.applyToDocument(document);
      storage.writeStore({ schemaVersion: 1, entries: [] });
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const btn = root.querySelector('[data-action="get-started"]');
      expect(btn).toBeTruthy();
      expect(btn.getAttribute('aria-label')).toBe('Get Started');
    });
  });


  describe('US-14.3 - Find Menus Relative To Navbar Alignment', () => {
    it('Left navbar puts menus at rail bottom', () => {
      writeConfig([
        'navbar alignment: left',
        'logging: false',
        ...ALL_FOCUS_DAYS,
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });
      // Even without a pre-built footer host, menus must appear on the left rail
      document.body.innerHTML = `
        <nav class="app-navbar app-navbar-left" data-navbar-alignment="left">
          <div class="app-navbar-links"></div>
        </nav>
        <div id="root"></div>`;
      root = document.getElementById('root');
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const host = document.querySelector('[data-landing-menu-host="navbar"]');
      expect(host).toBeTruthy();
      expect(host.hidden).toBe(false);
      expect(host.querySelector('[data-action="toggle-day-focus-menu"]')).toBeTruthy();
      expect(host.closest('.app-navbar-left')).toBeTruthy();
      expect(root.querySelector('[data-landing-menu-host="badge"]')).toBeNull();
    });

    it('Remounting Landing keeps Day focus (outgoing destroy must not clear new menus)', () => {
      writeConfig([
        'navbar alignment: left',
        'logging: false',
        ...ALL_FOCUS_DAYS,
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });
      document.body.innerHTML = `
        <nav class="app-navbar app-navbar-left" data-navbar-alignment="left">
          <div class="app-navbar-links"></div>
          <div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div>
        </nav>
        <main id="shell-main">
          <div id="pane-a"></div>
        </main>`;
      const paneA = document.getElementById('pane-a');
      const mountA = mountLandingView(paneA, { localDate: '2026-10-17' });
      expect(document.querySelector('[data-action="toggle-day-focus-menu"]')).toBeTruthy();

      const paneB = document.createElement('div');
      paneB.id = 'pane-b';
      document.getElementById('shell-main').appendChild(paneB);
      mount = mountLandingView(paneB, { localDate: '2026-10-17' });
      mountA.destroy();
      const host = document.querySelector('[data-landing-menu-host="navbar"]');
      expect(host.hidden).toBe(false);
      expect(host.querySelector('[data-action="toggle-day-focus-menu"]')).toBeTruthy();
    });

    it('Left rail menus use root.ownerDocument (NW.js Node require context)', () => {
      writeConfig([
        'navbar alignment: left',
        'logging: false',
        ...ALL_FOCUS_DAYS,
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });
      // Shell lives on a separate document (as in NW.js window DOM vs Node global)
      const appDoc = document.implementation.createHTMLDocument('strank-window');
      appDoc.body.innerHTML = `
        <nav class="app-navbar app-navbar-left" data-navbar-alignment="left">
          <div class="app-navbar-links"></div>
          <div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div>
        </nav>
        <div id="root"></div>`;
      root = appDoc.getElementById('root');
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const host = appDoc.querySelector('[data-landing-menu-host="navbar"]');
      expect(host).toBeTruthy();
      expect(host.hidden).toBe(false);
      expect(host.querySelector('[data-action="toggle-day-focus-menu"]')).toBeTruthy();
      // Global jsdom document must not be required for placement
      expect(document.querySelector('[data-landing-menus]')).toBeNull();
    });

    it('Top navbar puts menus on the trailing end of the nav bar', () => {
      writeConfig([
        'navbar alignment: top',
        'logging: false',
        ...ALL_FOCUS_DAYS,
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });
      document.body.innerHTML = `
        <nav class="app-navbar app-navbar-top" data-navbar-alignment="top">
          <div class="app-navbar-links"></div>
          <div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div>
        </nav>
        <div id="root"></div>`;
      root = document.getElementById('root');
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const board = root.querySelector('[data-landing-board]');
      expect(board.getAttribute('data-layout-mode')).toBe('default-tri');
      expect(root.querySelector('.landing-tri-today')).toBeTruthy();
      expect(root.querySelector('.landing-tri-next')).toBeTruthy();
      expect(root.querySelector('.landing-tri-skills')).toBeTruthy();
      // Menus live on the top navbar (right side), not beside the badge
      const host = document.querySelector('[data-landing-menu-host="navbar"]');
      expect(host).toBeTruthy();
      expect(host.hidden).toBe(false);
      expect(host.closest('.app-navbar-top')).toBeTruthy();
      expect(host.querySelector('[data-action="toggle-day-focus-menu"]')).toBeTruthy();
      expect(root.querySelector('[data-landing-menu-host="badge"]')).toBeNull();
      expect(root.querySelector('.landing-tri-chrome')).toBeNull();
      // Skill tab chrome (overall rank lives in the app header)
      expect(root.querySelector('[data-skill-tab]')).toBeTruthy();
      expect(root.querySelector('.landing-skill-badge [data-overall-rank]')).toBeNull();
      expect(root.querySelector('.landing-skill-body [data-skill-progress]')).toBeTruthy();
    });

    it('Left Day focus open marks navbar so the panel can paint over content', () => {
      writeConfig([
        'navbar alignment: left',
        'logging: false',
        ...ALL_FOCUS_DAYS,
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });
      document.body.innerHTML = `
        <div class="app-shell app-shell-nav-left">
          <nav class="app-navbar app-navbar-left" data-navbar-alignment="left">
            <div class="app-navbar-links"></div>
            <div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div>
          </nav>
          <main class="shell-main"><div id="root"></div></main>
        </div>`;
      root = document.getElementById('root');
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const nav = document.querySelector('.app-navbar-left');
      const btn = document.querySelector('[data-action="toggle-day-focus-menu"]');
      const panel = document.querySelector('[data-day-focus-menu-panel]');
      expect(nav.classList.contains('is-landing-menu-open')).toBe(false);
      expect(panel.hidden).toBe(true);
      btn.click();
      expect(nav.classList.contains('is-landing-menu-open')).toBe(true);
      expect(panel.hidden).toBe(false);
      mount.destroy();
      expect(nav.classList.contains('is-landing-menu-open')).toBe(false);
    });

    it('Top Day focus open marks navbar so the panel can paint over content', () => {
      writeConfig([
        'navbar alignment: top',
        'logging: false',
        ...ALL_FOCUS_DAYS,
      ]);
      storage.writeStore({ schemaVersion: 1, entries: [] });
      document.body.innerHTML = `
        <div class="app-shell app-shell-nav-top">
          <nav class="app-navbar app-navbar-top" data-navbar-alignment="top">
            <div class="app-navbar-links"></div>
            <div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div>
          </nav>
          <main class="shell-main"><div id="root"></div></main>
        </div>`;
      root = document.getElementById('root');
      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const nav = document.querySelector('.app-navbar-top');
      const btn = document.querySelector('[data-action="toggle-day-focus-menu"]');
      const panel = document.querySelector('[data-day-focus-menu-panel]');
      expect(nav.classList.contains('is-landing-menu-open')).toBe(false);
      btn.click();
      expect(nav.classList.contains('is-landing-menu-open')).toBe(true);
      expect(panel.hidden).toBe(false);
      mount.destroy();
      expect(nav.classList.contains('is-landing-menu-open')).toBe(false);
    });
  });

  describe('US-13.1 - See All Skills In Four Columns', () => {

    it('Skills appear under muscle-group columns', () => {
      const formatWithCore = [
        'ARMS:',
        '\tSTRENGTH:',
        '\t\tPUSH:',
        '\t\t\t- pike-push-ups x[reps] x[sets]',
        '\t\t\t- push-ups x[reps] x[sets]',
        'CORE:',
        '\t- sit-ups x[reps] x[sets]',
        '',
      ].join('\n');
      const ranksWithCore = [
        'UNRANKED:',
        '{badges/unranked.svg}',
        '--------------',
        '',
        'BRONZE I:',
        '{badges/bronze-i.svg}',
        '--------------',
        'ARMS:',
        '\tSTRENGTH:',
        '\t\tPUSH:',
        '\t\t\t- pike-push-ups x4 x3',
        '\t\t\t- push-ups x10 x3',
        'CORE:',
        '\t- sit-ups x10 x3',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(dataDir, 'format.txt'), formatWithCore, 'utf8');
      fs.writeFileSync(path.join(dataDir, 'ranks.txt'), ranksWithCore, 'utf8');
      catalog.clearCatalogCache();
      ranks.clearRanksCache();
      catalog.loadLiveCatalog();
      ranks.loadRanks();

      storage.writeStore({ schemaVersion: 1, entries: [] });

      mount = mountLandingView(root, { localDate: '2026-10-17' });
      const skills = root.querySelector('[data-panel="skill-progress"]');
      expect(skills).toBeTruthy();
      const arms = skills.querySelector('[data-skill-column="arms"]');
      const core = skills.querySelector('[data-skill-column="core"]');
      expect(arms).toBeTruthy();
      expect(core).toBeTruthy();
      expect(arms.querySelector('[data-exercise-id="push-ups"]')).toBeTruthy();
      expect(core.querySelector('[data-exercise-id="sit-ups"]')).toBeTruthy();
      expect(arms.querySelector('[data-exercise-id="sit-ups"]')).toBeNull();
      expect(core.querySelector('[data-exercise-id="push-ups"]')).toBeNull();
    });
  });
});
