/**
 * Feature 4 - Weekly Ranking
 * Spec: features/feature-4-Weekly-Ranking.md
 * Spec: features/feature-6-Custom-Ranks.md
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
    entryId:
      overrides.entryId || `e_${overrides.localDate}_${overrides.exerciseId}`,
    exerciseId: overrides.exerciseId,
    localDate: overrides.localDate,
    createdAt: `${overrides.localDate}T10:00:00.000-05:00`,
    updatedAt: `${overrides.localDate}T10:00:00.000-05:00`,
    metrics: overrides.metrics,
  };
}

describe('Feature 4 - Weekly Ranking', () => {
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
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'landing-config.txt'),
      [
        'focus arms days: mon,tue,wed,thu,fri,sat,sun',
        'focus core days: mon,tue,wed,thu,fri,sat,sun',
        'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
        'focus legs days: mon,tue,wed,thu,fri,sat,sun',
      ].join('\n'),
      'utf8',
    );

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranksMod = require('../src/ranks');
    ranking = require('../src/ranking');
    const landingConfig = require('../src/landingConfig');

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranksMod.clearRanksCache();
    landingConfig.clearLandingConfigCache();
    catalog.loadLiveCatalog();
    ranksMod.loadRanks();
    landingConfig.load();
    ranking.__resetTestHooks();
  });

  afterEach(() => {
    ranking.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-4.1 - Compile Weekly Averages', () => {
    it('Averages multiple entries for one exercise', () => {
      // Week 2026-10-13..19 fully past relative to 2026-10-20
      ranking.__setLocalDate('2026-10-20');
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-13',
            metrics: { reps: 4, sets: 3 },
          }),
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-14',
            metrics: { reps: 6, sets: 3 },
          }),
          entry({
            exerciseId: 'pull-ups',
            localDate: '2026-10-15',
            metrics: { reps: 2, sets: 3 },
          }),
        ],
      });

      const compiled = ranking.compileWeek('2026-10-13');
      expect(compiled.ok).toBe(true);
      // Fully past week, all days are focus slots. padCount is max skipped slots
      // across exercises (pull-ups recorded 1 day → 6 zeros).
      expect(compiled.data.padCount).toBe(6);
      // Day means Mon:4 Tue:6 + five zeros → (4+6)/7
      expect(compiled.data.averages['pike-push-ups'].reps).toBe(round1(10 / 7));
      expect(compiled.data.averages['pike-push-ups'].sets).toBe(round1(6 / 7));
    });

    it('In-progress week ignores future days', () => {
      ranking.__setLocalDate('2026-10-16'); // Thursday
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-13',
            metrics: { reps: 4, sets: 3 },
          }),
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-18',
            metrics: { reps: 99, sets: 3 },
          }), // Saturday
        ],
      });

      const compiled = ranking.compileWeek('2026-10-13');
      expect(compiled.ok).toBe(true);
      expect(compiled.data.recordedDays).toEqual(['2026-10-13']);
      expect(compiled.data.averages['pike-push-ups'].reps).not.toBe(99);
      // Mon..Thu focus buffer: [4,0,0,0] → 1
      expect(compiled.data.averages['pike-push-ups'].reps).toBe(1);
    });

    it('Skipped focus day inserts a zero slot in the buffer', () => {
      const dayFocus = require('../src/dayFocus');
      dayFocus.setSchedule({ arms: ['mon', 'thu'] });
      ranking.__setLocalDate('2026-10-16'); // Thursday
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-13',
            metrics: { reps: 6, sets: 3 },
          }),
        ],
      });

      const compiled = ranking.compileWeek('2026-10-13');
      expect(compiled.ok).toBe(true);
      // Buffer [Mon:6, Thu:0]
      expect(compiled.data.padCount).toBe(1);
      expect(compiled.data.averages['pike-push-ups'].reps).toBe(3);
    });

    it('Monday single recording is the weekly average', () => {
      ranking.__setLocalDate('2026-10-13'); // Monday
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-13',
            metrics: { reps: 8, sets: 3 },
          }),
        ],
      });

      const compiled = ranking.compileWeek('2026-10-13');
      expect(compiled.ok).toBe(true);
      // Buffer length 1 (Monday only) — no flat leading zeros
      expect(compiled.data.padTarget).toBe(1);
      expect(compiled.data.padCount).toBe(0);
      expect(compiled.data.averages['pike-push-ups'].reps).toBe(8);
      expect(compiled.data.averages['pike-push-ups'].sets).toBe(3);
    });
  });

  describe('US-4.2 - Compare Against Rank Thresholds', () => {
    it('User reaches BRONZE I on logged exercises', () => {
      ranking.__setLocalDate('2026-10-20');
      // Meet BRONZE I every focus day (all weekdays) so zeros do not dilute.
      const days = ['13', '14', '15', '16', '17', '18', '19'];
      storage.writeStore({
        schemaVersion: 1,
        entries: days.flatMap((d) => [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: `2026-10-${d}`,
            metrics: { reps: 4, sets: 3 },
          }),
          entry({
            exerciseId: 'push-ups',
            localDate: `2026-10-${d}`,
            metrics: { reps: 10, sets: 3 },
          }),
        ]),
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

    it('cleared focus groups do not gate overall rank', () => {
      // Week Mon 2026-10-12 .. Sun 2026-10-18
      ranking.__setLocalDate('2026-10-20');
      const dayFocus = require('../src/dayFocus');
      dayFocus.setSchedule({
        arms: ['mon', 'thu'],
        lungs: [],
      });
      expect(dayFocus.getSchedule().lungs).toEqual([]);

      // Arms meet BRONZE II on Mon+Thu; weak lungs log must not gate.
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-12',
            metrics: { reps: 8, sets: 3 },
          }),
          entry({
            exerciseId: 'pike-push-ups',
            localDate: '2026-10-15',
            metrics: { reps: 8, sets: 3 },
          }),
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-12',
            metrics: { reps: 20, sets: 3 },
          }),
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-15',
            metrics: { reps: 20, sets: 3 },
          }),
          entry({
            exerciseId: 'burpee-intervals-50s',
            localDate: '2026-10-14',
            metrics: {
              durationGoSeconds: 10,
              durationRestSeconds: 50,
              sets: 4,
            },
          }),
        ],
      });

      const compared = ranking.compareToRanks('2026-10-12');
      expect(compared.ok).toBe(true);
      expect(compared.data.overallTierName).toBe('BRONZE II');
      expect(
        compared.data.exercises.some((e) =>
          String(e.exerciseId).startsWith('burpee'),
        ),
      ).toBe(false);
    });

    it('Rest duration is lower-is-better', () => {
      const meets = ranking.meetsThreshold(
        { durationGoSeconds: 10, durationRestSeconds: 60, sets: 4 },
        { durationGoSeconds: 10, durationRestSeconds: 50, sets: 4 },
      );
      expect(meets).toBe(false);
    });

    it('Travel needs pace and scale (distance×load×volume)', () => {
      // Target: 2 mi in 30 min. Actual: 3 mi in 50 min -> slower pace -> fail.
      expect(
        ranking.meetsThreshold(
          { distance: 3, durationSeconds: 50 * 60 },
          { distance: 2, durationSeconds: 30 * 60 },
        ),
      ).toBe(false);
      // Same distance, faster pace -> meet.
      expect(
        ranking.meetsThreshold(
          { distance: 2, durationSeconds: 28 * 60 },
          { distance: 2, durationSeconds: 30 * 60 },
        ),
      ).toBe(true);
      // Same/better pace but half the distance -> fail on scale.
      expect(
        ranking.meetsThreshold(
          { distance: 1, durationSeconds: 14 * 60 },
          { distance: 2, durationSeconds: 30 * 60 },
        ),
      ).toBe(false);
    });

    it('Travel scale folds in weight×reps×sets', () => {
      expect(
        ranking.meetsThreshold(
          {
            distance: 2,
            durationSeconds: 28 * 60,
            weight: 10,
            reps: 1,
            sets: 1,
          },
          {
            distance: 2,
            durationSeconds: 30 * 60,
            weight: 20,
            reps: 1,
            sets: 1,
          },
        ),
      ).toBe(false);
      expect(
        ranking.meetsThreshold(
          {
            distance: 2,
            durationSeconds: 28 * 60,
            weight: 20,
            reps: 1,
            sets: 1,
          },
          {
            distance: 2,
            durationSeconds: 30 * 60,
            weight: 20,
            reps: 1,
            sets: 1,
          },
        ),
      ).toBe(true);
    });
  });

  describe('US-4.4 - Review a Selected Week', () => {
    it('User selects a past week', () => {
      ranking.__setLocalDate('2026-10-20');
      const weekADays = ['05', '06', '07', '08', '09', '10', '11'];
      const weekBDays = ['13', '14', '15', '16', '17', '18', '19'];
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          ...weekADays.map((d) =>
            entry({
              exerciseId: 'pike-push-ups',
              localDate: `2026-10-${d}`,
              metrics: { reps: 4, sets: 3 },
            }),
          ),
          ...weekBDays.map((d) =>
            entry({
              exerciseId: 'pike-push-ups',
              localDate: `2026-10-${d}`,
              metrics: { reps: 20, sets: 3 },
            }),
          ),
        ],
      });

      const weekA = ranking.compileWeek('2026-10-05');
      expect(weekA.data.averages['pike-push-ups'].reps).toBe(4);
      expect(weekA.data.averages['pike-push-ups'].reps).not.toBe(20);

      const weekB = ranking.compileWeek('2026-10-13');
      expect(weekB.data.averages['pike-push-ups'].reps).toBe(20);
    });
  });

  describe('US-4.5 - Month / year progression', () => {
    it('Month heading shows start badge arrow trailing badge', () => {
      // Standing entering Oct 2026 = last completed week before Oct 1
      // Sep 2026: week ending Sep 27 (Mon Sep 21) -> set as BRONZE I
      // Latest finished week in Oct with Sunday <= "today" mid-October -> SILVER I
      ranking.__setLocalDate('2026-10-15');

      const sepWeek = ['21', '22', '23', '24', '25', '26', '27'];
      const octWeek = ['05', '06', '07', '08', '09', '10', '11'];
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          ...sepWeek.flatMap((d) => [
            entry({
              exerciseId: 'pike-push-ups',
              localDate: `2026-09-${d}`,
              metrics: { reps: 4, sets: 3 },
            }),
            entry({
              exerciseId: 'push-ups',
              localDate: `2026-09-${d}`,
              metrics: { reps: 10, sets: 3 },
            }),
          ]),
          // SILVER I only has pike-push-ups x12
          ...octWeek.map((d) =>
            entry({
              exerciseId: 'pike-push-ups',
              localDate: `2026-10-${d}`,
              metrics: { reps: 12, sets: 3 },
            }),
          ),
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
      // Last week intersecting September 2026: Sep 28 week (Mon Sep 28 - Oct 4) contains Sep 30
      // For month finish of September, last day Sep 30 -> mondayOf = Sep 28
      // Week Mon Sep 28 .. Sun Oct 4 (month-finish uses this week for September)
      storage.writeStore({
        schemaVersion: 1,
        entries: ['28', '29', '30']
          .map((d) => `2026-09-${d}`)
          .concat(['01', '02', '03', '04'].map((d) => `2026-10-${d}`))
          .map((localDate) =>
            entry({
              exerciseId: 'pike-push-ups',
              localDate,
              metrics: { reps: 20, sets: 3 },
            }),
          ),
      });

      const prog = ranking.getMonthProgression(2026, 9);
      expect(prog.ok).toBe(true);
      expect(prog.data.endKind).toBe('periodComplete');
      expect(prog.data.endTierName).toBe('GOLD I');
    });
  });

  describe('US-6.2 — Change Requirements', () => {
    it('Raised threshold fails prior average', () => {
      ranking.__setLocalDate('2026-10-20');
      // Record every day of the past week at 4.5 so focus zeros do not dilute.
      storage.writeStore({
        schemaVersion: 1,
        entries: ['13', '14', '15', '16', '17', '18', '19'].map((d) =>
          entry({
            exerciseId: 'pike-push-ups',
            localDate: `2026-10-${d}`,
            metrics: { reps: 4.5, sets: 3 },
          }),
        ),
      });

      const week = ranking.compileWeek('2026-10-13');
      expect(week.ok).toBe(true);
      const avgReps = week.data.averages['pike-push-ups'].reps;
      expect(avgReps).toBe(4.5);

      const bronzeBefore = ranksMod.getTierByName('BRONZE I');
      expect(bronzeBefore.thresholds['pike-push-ups'].reps).toBe(4);
      expect(
        ranking.meetsThreshold(week.data.averages['pike-push-ups'], bronzeBefore.thresholds['pike-push-ups'])
      ).toBe(true);

      fs.writeFileSync(
        path.join(dataDir, 'ranks.txt'),
        FIXTURE_RANKS.replace('- pike-push-ups x4 x3', '- pike-push-ups x5 x3'),
        'utf8'
      );
      ranksMod.clearRanksCache();
      catalog.reloadFromDisk();
      ranksMod.loadRanks();

      const bronzeAfter = ranksMod.getTierByName('BRONZE I');
      expect(bronzeAfter.thresholds['pike-push-ups'].reps).toBe(5);
      expect(
        ranking.meetsThreshold(week.data.averages['pike-push-ups'], bronzeAfter.thresholds['pike-push-ups'])
      ).toBe(false);
    });
  });
});

function round1(n) {
  return Math.round(n * 10) / 10;
}
