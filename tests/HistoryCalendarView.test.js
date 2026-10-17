/**
 * @jest-environment jsdom
 *
 * Feature 4 — Weekly Ranking (History ranking contract)
 * Spec: features/feature-4-Weekly-Ranking.md
 */

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
  'badges/unranked.svg',
  '--------------',
  '',
  'BRONZE II:',
  'badges/bronze-ii.svg',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x4 x3',
  '',
  'SILVER I:',
  'badges/silver-i.svg',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x12 x3',
  '',
].join('\n');

function entry(overrides) {
  return {
    entryId: overrides.entryId || `e_${overrides.localDate}_${overrides.exerciseId}`,
    exerciseId: overrides.exerciseId,
    localDate: overrides.localDate,
    createdAt: `${overrides.localDate}T10:00:00.000-05:00`,
    updatedAt: `${overrides.localDate}T10:00:00.000-05:00`,
    metrics: overrides.metrics || { reps: 4, sets: 3 },
  };
}

describe('Feature 4 — History Calendar View', () => {
  let tempRoot;
  let dataDir;
  let ranking;
  let storage;
  let catalog;
  let ranksMod;
  let mountHistoryCalendarView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f4-cal-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranksMod = require('../src/ranks');
    ranking = require('../src/ranking');
    ({ mountHistoryCalendarView } = require('../src/historyCalendarView'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranksMod.clearRanksCache();
    catalog.loadCatalog();
    ranksMod.loadRanks();
    ranking.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');

    document.body.innerHTML = '<div id="root"></div>';
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

  it('Month view shows recorded styling and week ranks', () => {
    // Week starting 2026-09-28 intersects October (Sep 28–Oct 4)
    storage.writeStore({
      schemaVersion: 1,
      entries: [
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-09-28', metrics: { reps: 4, sets: 3 } }),
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-09-29', metrics: { reps: 4, sets: 3 } }),
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-09-30', metrics: { reps: 4, sets: 3 } }),
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-03', metrics: { reps: 4, sets: 3 } }),
      ],
    });

    mount = mountHistoryCalendarView(root, {
      ranking,
      today: '2026-10-17',
      year: 2026,
      month: 10,
    });

    expect(root.querySelector('[data-view="workoutHistory"]')).toBeTruthy();
    const day3 = root.querySelector('[data-date="2026-10-03"]');
    const day4 = root.querySelector('[data-date="2026-10-04"]');
    expect(day3.classList.contains('recorded')).toBe(true);
    expect(day4.classList.contains('unrecorded')).toBe(true);

    const weekRow = root.querySelector('[data-week-start="2026-09-28"]');
    expect(weekRow).toBeTruthy();
    expect(weekRow.querySelector('[data-week-badge]').getAttribute('data-week-badge')).toBe('BRONZE II');
  });

  it('Click year zooms out to years overview', () => {
    storage.writeStore({
      schemaVersion: 1,
      entries: [
        entry({ exerciseId: 'pike-push-ups', localDate: '2025-06-02', metrics: { reps: 4, sets: 3 } }),
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-03', metrics: { reps: 4, sets: 3 } }),
      ],
    });

    mount = mountHistoryCalendarView(root, {
      ranking,
      today: '2026-10-17',
      year: 2026,
      month: 10,
    });

    root.querySelector('[data-action="zoom-year"]').click();
    expect(root.querySelector('[data-view="historyYears"]')).toBeTruthy();
    expect(root.querySelector('[data-year="2025"]')).toBeTruthy();
    expect(root.querySelector('[data-year="2026"]')).toBeTruthy();
    expect(root.querySelector('[data-year-progression="2026"] .progression-arrow')).toBeTruthy();
    expect(root.querySelector('[data-year-progression="2025"] .badge-start')).toBeTruthy();
  });

  it('Click day zooms into day detail', () => {
    storage.writeStore({
      schemaVersion: 1,
      entries: [
        entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-03', metrics: { reps: 4, sets: 3 } }),
      ],
    });

    mount = mountHistoryCalendarView(root, {
      ranking,
      today: '2026-10-17',
      year: 2026,
      month: 10,
    });

    root.querySelector('.cal-day-btn[data-date="2026-10-03"]').click();
    expect(root.querySelector('[data-view="historyDay"]')).toBeTruthy();
    expect(root.querySelector('[data-day-rank]')).toBeTruthy();
    expect(root.querySelector('[data-day-heading]').textContent).toBe('2026-10-03');
  });
});
