/**
 * Feature 4 — Weekly Ranking
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
  '\t\tPULL:',
  '\t\t\t- pull-ups x[reps] x[sets]',
  'LUNGS:',
  '\tSTRENGTH:',
  '\t\t- burpee intervals ([duration go]) ([duration rest]) x[sets]',
  '',
].join('\n');

const FIXTURE_RANKS = [
  'UNRANKED:',
  'badges/unranked.svg',
  '--------------',
  '',
  'BRONZE I:',
  'badges/bronze-i.svg',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x4 x3',
  '\t\t\t- push-ups x10 x3',
  'LUNGS:',
  '\tSTRENGTH:',
  '\t\t- burpee intervals 10s 50s x4',
  '',
  'BRONZE II:',
  'badges/bronze-ii.svg',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x8 x3',
  '\t\t\t- push-ups x20 x3',
  'LUNGS:',
  '\tSTRENGTH:',
  '\t\t- burpee intervals 10s 40s x4',
  '',
  'SILVER I:',
  'badges/silver-i.svg',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x12 x3',
  '',
  'GOLD I:',
  'badges/gold-i.svg',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x20 x3',
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

describe('Feature 4 — Weekly Ranking', () => {
  let tempRoot;
  let dataDir;
  let ranking;
  let storage;
  let ranksMod;
  let catalog;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f4-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'format.dat'), Buffer.from(FIXTURE_FORMAT, 'utf8'));
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      formatDatPath: () => path.join(dataDir, 'format.dat'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranksMod = require('../src/ranks');
    ranking = require('../src/ranking');

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranksMod.clearRanksCache();
    catalog.loadLiveCatalog();
    ranksMod.loadRanks();
    ranking.__resetTestHooks();
  });

  afterEach(() => {
    ranking.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-4.1 — Compile Weekly Averages', () => {
    it('Averages multiple entries for one exercise', () => {
      // Week 2026-10-13..19 fully past relative to 2026-10-20
      ranking.__setLocalDate('2026-10-20');
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 4, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 6, sets: 3 } }),
          entry({ exerciseId: 'pull-ups', localDate: '2026-10-15', metrics: { reps: 2, sets: 3 } }),
        ],
      });

      const compiled = ranking.compileWeek('2026-10-13');
      expect(compiled.ok).toBe(true);
      expect(compiled.data.padCount).toBe(0);
      expect(compiled.data.averages['pike-push-ups'].reps).toBe(5);
      expect(compiled.data.averages['pike-push-ups'].sets).toBe(3);
    });

    it('In-progress week ignores future days', () => {
      ranking.__setLocalDate('2026-10-16'); // Thursday
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 4, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-18', metrics: { reps: 99, sets: 3 } }), // Saturday
        ],
      });

      const compiled = ranking.compileWeek('2026-10-13');
      expect(compiled.ok).toBe(true);
      expect(compiled.data.recordedDays).toEqual(['2026-10-13']);
      expect(compiled.data.averages['pike-push-ups'].reps).not.toBe(99);
      // padTarget=3, n=1 → pad 2 zeros: (4+0+0)/3
      expect(compiled.data.averages['pike-push-ups'].reps).toBe(round1(4 / 3));
    });

    it('Two recorded days pad with one all-zero', () => {
      ranking.__setLocalDate('2026-10-16'); // Thursday
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 6, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 6, sets: 3 } }),
        ],
      });

      const compiled = ranking.compileWeek('2026-10-13');
      expect(compiled.ok).toBe(true);
      expect(compiled.data.padCount).toBe(1);
      expect(compiled.data.averages['pike-push-ups'].reps).toBe(4);
    });

    it('Monday single recording is the weekly average', () => {
      ranking.__setLocalDate('2026-10-13'); // Monday
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 8, sets: 3 } }),
        ],
      });

      const compiled = ranking.compileWeek('2026-10-13');
      expect(compiled.ok).toBe(true);
      expect(compiled.data.padTarget).toBe(1);
      expect(compiled.data.padCount).toBe(0);
      expect(compiled.data.averages['pike-push-ups'].reps).toBe(8);
      expect(compiled.data.averages['pike-push-ups'].sets).toBe(3);
    });
  });

  describe('US-4.2 — Compare Against Rank Thresholds', () => {
    it('User reaches BRONZE I on logged exercises', () => {
      ranking.__setLocalDate('2026-10-20');
      // Meet BRONZE I (pike 4x3, push-ups 10x3) but fail BRONZE II (pike 8, push 20)
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 4, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 4, sets: 3 } }),
          entry({ exerciseId: 'push-ups', localDate: '2026-10-15', metrics: { reps: 10, sets: 3 } }),
        ],
      });

      const compared = ranking.compareToRanks('2026-10-13');
      expect(compared.ok).toBe(true);
      expect(compared.data.overallTierName).toBe('BRONZE I');
    });

    it('No entries means UNRANKED', () => {
      ranking.__setLocalDate('2026-10-20');
      storage.writeStore({ schemaVersion: 1, entries: [] });
      const compared = ranking.compareToRanks('2026-10-13');
      expect(compared.ok).toBe(true);
      expect(compared.data.overallTierName).toBe('UNRANKED');
      expect(compared.data.reason).toBe('No exercises logged this week.');
    });

    it('Rest duration is lower-is-better', () => {
      const meets = ranking.meetsThreshold(
        { durationGoSeconds: 10, durationRestSeconds: 60, sets: 4 },
        { durationGoSeconds: 10, durationRestSeconds: 50, sets: 4 }
      );
      expect(meets).toBe(false);
    });
  });

  describe('US-4.4 — Review a Selected Week', () => {
    it('User selects a past week', () => {
      ranking.__setLocalDate('2026-10-20');
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-06', metrics: { reps: 4, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-07', metrics: { reps: 4, sets: 3 } }),
          entry({ exerciseId: 'push-ups', localDate: '2026-10-08', metrics: { reps: 10, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-13', metrics: { reps: 20, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-14', metrics: { reps: 20, sets: 3 } }),
          entry({ exerciseId: 'push-ups', localDate: '2026-10-15', metrics: { reps: 20, sets: 3 } }),
        ],
      });

      const weekA = ranking.compileWeek('2026-10-06');
      expect(weekA.data.averages['pike-push-ups'].reps).toBe(4);
      expect(weekA.data.averages['pike-push-ups'].reps).not.toBe(20);

      const weekB = ranking.compileWeek('2026-10-13');
      expect(weekB.data.averages['pike-push-ups'].reps).toBe(20);
    });
  });

  describe('US-4.5 — Month / year progression', () => {
    it('Month heading shows start badge arrow trailing badge', () => {
      // Standing entering Oct 2026 = last completed week before Oct 1
      // Sep 2026: week ending Sep 27 (Mon Sep 21) → set as BRONZE I
      // Latest finished week in Oct with Sunday <= "today" mid-October → SILVER I
      ranking.__setLocalDate('2026-10-15');

      storage.writeStore({
        schemaVersion: 1,
        entries: [
          // Week Mon 2026-09-21 .. Sun 2026-09-27 — BRONZE I level
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-09-21', metrics: { reps: 4, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-09-22', metrics: { reps: 4, sets: 3 } }),
          entry({ exerciseId: 'push-ups', localDate: '2026-09-23', metrics: { reps: 10, sets: 3 } }),
          // Week Mon 2026-10-05 .. Sun 2026-10-11 finished — push silver via high pike only on silver ladder
          // SILVER I only has pike-push-ups x12 — if we only log pike at 12+, overall is SILVER I
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-05', metrics: { reps: 12, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-06', metrics: { reps: 12, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-10-07', metrics: { reps: 12, sets: 3 } }),
        ],
      });

      const prog = ranking.getMonthProgression(2026, 10);
      expect(prog.ok).toBe(true);
      expect(prog.data.startTierName).toBe('BRONZE I');
      expect(prog.data.endTierName).toBe('SILVER I');
      expect(prog.data.endKind).toBe('latestFinishedWeek');
    });

    it('Completed month uses month-finish badge', () => {
      ranking.__setLocalDate('2026-11-05');
      // Last week intersecting September 2026: Sep 28 week (Mon Sep 28 – Oct 4) contains Sep 30
      // For month finish of September, last day Sep 30 → mondayOf = Sep 28
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-09-28', metrics: { reps: 20, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-09-29', metrics: { reps: 20, sets: 3 } }),
          entry({ exerciseId: 'pike-push-ups', localDate: '2026-09-30', metrics: { reps: 20, sets: 3 } }),
        ],
      });

      const prog = ranking.getMonthProgression(2026, 9);
      expect(prog.ok).toBe(true);
      expect(prog.data.endKind).toBe('periodComplete');
      expect(prog.data.endTierName).toBe('GOLD I');
    });
  });
});

function round1(n) {
  return Math.round(n * 10) / 10;
}
