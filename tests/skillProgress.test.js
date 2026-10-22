/**
 * Feature 13 - Skill Progress Landing
 * Spec: features/feature-13-Skill-Progress-Landing.md
 *
 * feature-13-Skill-Progress-Landing.md
 *   L___ US-13.2 - See Per-Skill Weekly Average And Progress Bar
 *         L___ Scenario: Progress bar sits halfway between local ranks
 *               L___ tests/skillProgress.test.js -> it("Progress bar sits halfway between local ranks")
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_FORMAT = [
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- push-ups x[reps]',
  'CORE:',
  '\t- sit-ups x[reps]',
  'LUNGS:',
  '\t- running x[distance]',
  'LEGS:',
  '\t- squats x[reps]',
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
  '\t\t\t- push-ups x5',
  'CORE:',
  '\t- sit-ups x5',
  'LUNGS:',
  '\t- running x1',
  'LEGS:',
  '\t- squats x5',
  '',
  'BRONZE II:',
  '{badges/bronze-ii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- push-ups x10',
  'CORE:',
  '\t- sit-ups x10',
  'LUNGS:',
  '\t- running x2',
  'LEGS:',
  '\t- squats x10',
  '',
  'BRONZE III:',
  '{badges/bronze-iii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- push-ups x15',
  'CORE:',
  '\t- sit-ups x15',
  'LUNGS:',
  '\t- running x3',
  'LEGS:',
  '\t- squats x15',
  '',
  'SILVER I:',
  '{badges/silver-i.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- push-ups x20',
  'CORE:',
  '\t- sit-ups x20',
  'LUNGS:',
  '\t- running x4',
  'LEGS:',
  '\t- squats x20',
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

describe('Feature 13 - Skill Progress Landing', () => {
  let tempRoot;
  let dataDir;
  let storage;
  let catalog;
  let ranks;
  let ranking;
  let landingConfig;
  let skillProgress;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f13-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['navbar alignment: left', 'logging: false'].join('\n'),
      'utf8',
    );
    fs.writeFileSync(
      path.join(dataDir, 'landing-config.txt'),
      [
        'focus arms days: mon,thu',
        'focus core days: tue,fri',
        'focus lungs days: mon,wed,fri',
        'focus legs days: wed,sat',
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
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    storage = require('../src/storage');
    catalog = require('../src/catalog');
    ranks = require('../src/ranks');
    ranking = require('../src/ranking');
    landingConfig = require('../src/landingConfig');
    skillProgress = require('../src/skillProgress');

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    landingConfig.clearLandingConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    landingConfig.load();
    ranking.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');
  });

  afterEach(() => {
    ranking.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-13.2 - See Per-Skill Weekly Average And Progress Bar', () => {
    it('Progress bar sits halfway between local ranks', () => {
      // Week Mon 2026-10-12 ... Sat today 2026-10-17.
      // Arms focus: mon + thu -> 2026-10-12, 2026-10-15; avg reps 18.
      // BRONZE III push-ups = 15, SILVER I = 20 -> progress 0.5
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-12',
            metrics: { reps: 18 },
          }),
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-15',
            metrics: { reps: 18 },
          }),
        ],
      });

      const recent = skillProgress.mostRecentWeeklyAverage('push-ups', 'arms', {
        today: '2026-10-17',
        weekStartMonday: '2026-10-12',
      });
      expect(recent.averages).toBeTruthy();
      expect(recent.averages.reps).toBe(18);

      const local = skillProgress.localRankForExercise(
        'push-ups',
        recent.averages,
      );
      expect(local.name).toBe('BRONZE III');
      expect(local.index).toBe(3);

      const prog = skillProgress.progressTowardNext(
        'push-ups',
        recent.averages,
      );
      expect(prog.localRankName).toBe('BRONZE III');
      expect(prog.nextRankName).toBe('SILVER I');
      // FR-009: (18 - 15) / (20 - 15) = 0.6 (spec Gherkin “50%” misstated the arithmetic)
      expect(prog.progress).toBeCloseTo(0.6, 5);
      expect(prog.remainingLabel).toBe('2 to go!');
    });

    it('formats duration remaining as compact to-go text', () => {
      expect(skillProgress.formatRemainingAmount('durationSeconds', 165)).toBe(
        '2m45s',
      );
      expect(skillProgress.metricRemaining(915, 1080, 'durationSeconds')).toBe(
        165,
      );
      const label = skillProgress.remainingToGoLabel(
        { durationSeconds: 915 },
        { durationSeconds: 1080 },
      );
      expect(label).toBe('2m45s to go!');
    });

    it('formats pace remaining as duration per distance unit', () => {
      const formatted = skillProgress.formatRemainingAmount('pace', 90);
      expect(formatted).toMatch(/\/(mi|km)$/);
      expect(formatted).toContain('1m30s');
    });

    it('Days with no focus are excluded from skill averages', () => {
      // Sunday 2026-10-18 has no muscle groups checked; Monday 2026-10-12 is Arms.
      // Sunday log must not factor into the Arms weekly average.
      ranking.__setLocalDate('2026-10-18');
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-18',
            metrics: { reps: 100 },
          }),
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-12',
            metrics: { reps: 18 },
          }),
        ],
      });

      const avg = skillProgress.compileSkillWeekAverage(
        'push-ups',
        'arms',
        '2026-10-12',
        {
          today: '2026-10-18',
        },
      );
      expect(avg).toBeTruthy();
      // Arms focus-eligible days in the full week: Mon + Thu (2). Sunday excluded.
      // 1 recorded (Mon 18) + 1 zero pad -> (18+0)/2 = 9. Sunday's 100 must not appear.
      expect(avg.reps).toBe(9);
    });
  });

  describe('US-13.3 - Overall Rank Is Average Of Local Ranks', () => {
    it('Overall equals rounded mean of local indices', () => {
      // UNRANKED=0, BRONZE I=1, BRONZE II=2, BRONZE III=3
      // locals 1, 3, 3 -> mean 2.333... -> round half-up -> 2 -> BRONZE II
      const overall = skillProgress.getOverallFromLocals([
        { name: 'BRONZE I', index: 1 },
        { name: 'BRONZE III', index: 3 },
        { name: 'BRONZE III', index: 3 },
      ]);
      expect(overall.mean).toBeCloseTo(7 / 3, 5);
      expect(overall.overallRankIndex).toBe(2);
      expect(overall.overallRankName).toBe('BRONZE II');

      const model = skillProgress.getSkillProgressModel('2026-10-12', {
        today: '2026-10-17',
      });
      // With empty store all locals are UNRANKED -> overall UNRANKED
      expect(model.ok).toBe(true);
      expect(model.data.overallRankName).toBe('UNRANKED');

      // Seed locals: push-ups BRONZE I, sit-ups BRONZE III, squats BRONZE III
      // Focus: arms mon/thu (12,15), core tue/fri (13,16), legs wed/sat (14,17)
      storage.writeStore({
        schemaVersion: 1,
        entries: [
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-12',
            metrics: { reps: 5 },
          }),
          entry({
            exerciseId: 'push-ups',
            localDate: '2026-10-15',
            metrics: { reps: 5 },
          }),
          entry({
            exerciseId: 'sit-ups',
            localDate: '2026-10-13',
            metrics: { reps: 15 },
          }),
          entry({
            exerciseId: 'sit-ups',
            localDate: '2026-10-16',
            metrics: { reps: 15 },
          }),
          entry({
            exerciseId: 'squats',
            localDate: '2026-10-14',
            metrics: { reps: 15 },
          }),
          entry({
            exerciseId: 'squats',
            localDate: '2026-10-17',
            metrics: { reps: 15 },
          }),
        ],
      });

      const seeded = skillProgress.getSkillProgressModel('2026-10-12', {
        today: '2026-10-17',
      });
      expect(seeded.ok).toBe(true);
      const push = seeded.data.columns.arms.find(
        (s) => s.exerciseId === 'push-ups',
      );
      const sit = seeded.data.columns.core.find(
        (s) => s.exerciseId === 'sit-ups',
      );
      const squat = seeded.data.columns.legs.find(
        (s) => s.exerciseId === 'squats',
      );
      expect(push.localRankIndex).toBe(1);
      expect(sit.localRankIndex).toBe(3);
      expect(squat.localRankIndex).toBe(3);
      // Four skills including running UNRANKED(0): mean (1+3+0+3)/4 = 1.75 -> 2 BRONZE II
      expect(seeded.data.overallRankIndex).toBe(2);
      expect(seeded.data.overallRankName).toBe('BRONZE II');

      const landing = require('../src/landing');
      const landingModel = landing.getLandingModel('2026-10-17');
      expect(landingModel.ok).toBe(true);
      expect(landingModel.data.overallRankName).toBe('BRONZE II');
    });
  });
});
