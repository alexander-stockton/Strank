/**
 * Feature 16 - unit conversion & convert-on-change
 * Spec: features/feature-16-Localization.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 16 - unitConversion', () => {
  let unitConversion;

  beforeEach(() => {
    jest.resetModules();
    unitConversion = require('../src/unitConversion');
  });

  test('Stride matches reference model', () => {
    expect(unitConversion.strideInches('female', 5)).toBeCloseTo(24.6, 12);
    expect(unitConversion.strideInches('male', 6)).toBeCloseTo(29.88, 12);
  });

  test('Weight converts on unit change', () => {
    expect(unitConversion.convertWeight(14, 'lbs', 'st')).toBe(1);
    expect(unitConversion.roundMeasure(unitConversion.convertWeight(1, 'st', 'lbs'))).toBe(14);
    expect(unitConversion.convertWeight(1, 'lbs', 'kg')).toBeCloseTo(0.45359237, 12);
  });

  test('Weight storage rounds lbs to int, kg to 0.5, st to 0.01', () => {
    expect(unitConversion.roundWeightForUnit(9.94, 'lbs')).toBe(10);
    expect(unitConversion.roundWeightForUnit(4.53, 'kg')).toBe(4.5);
    expect(unitConversion.roundWeightForUnit(4.74, 'kg')).toBe(4.5);
    expect(unitConversion.roundWeightForUnit(4.75, 'kg')).toBe(5);
    expect(unitConversion.roundWeightForUnit(0.71428, 'st')).toBe(0.71);

    expect(unitConversion.convertWeightForStorage(10, 'lbs', 'kg')).toBe(4.5);
    expect(unitConversion.convertWeightForStorage(10, 'lbs', 'st')).toBe(0.71);
    expect(unitConversion.convertWeightForStorage(4.5, 'kg', 'lbs')).toBe(10);
    expect(unitConversion.convertWeightForStorage(0.71, 'st', 'lbs')).toBe(10);
    expect(unitConversion.convertWeightForStorage(14, 'lbs', 'st')).toBe(1);
    expect(unitConversion.convertWeightForStorage(1, 'st', 'lbs')).toBe(14);

    const src = '- curl 10lb 0mi x10 x1\n';
    const toKg = unitConversion.rewriteRanksText(src, { weightFrom: 'lbs', weightTo: 'kg' });
    expect(toKg).toMatch(/4\.5kg/);
    const backLb = unitConversion.rewriteRanksText(toKg, { weightFrom: 'kg', weightTo: 'lbs' });
    expect(backLb).toMatch(/10lb/);
  });

  test('Distance converts on unit change including steps', () => {
    const profile = { sex: 'male', heightFt: 5 };
    // 1 ft = 12 in; stride male@5ft = 24.9 in -> steps = 12/24.9
    const steps = unitConversion.convertDistance(1, 'ft', 'steps', profile);
    expect(steps).toBeCloseTo(12 / 24.9, 10);
    const back = unitConversion.convertDistance(steps, 'steps', 'ft', profile);
    expect(back).toBeCloseTo(1, 10);
  });

  test('Distance storage conversion round-trips with parity', () => {
    // Ranks are authored in miles; switching away and back must restore exactly.
    const samples = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 1.87, 1.9, 2, 2.25, 2.8, 3, 3.2, 3.5, 4];
    const targets = ['km', 'm', 'yd', 'ft', 'in'];
    for (const value of samples) {
      for (const to of targets) {
        const mid = unitConversion.convertDistanceForStorage(value, 'mi', to);
        const back = unitConversion.convertDistanceForStorage(mid, to, 'mi');
        expect(back).toBe(unitConversion.roundMeasure(value));
      }
    }
    const profile = { sex: 'female', heightFt: 5.5 };
    for (const value of [0.25, 1, 2, 4]) {
      const steps = unitConversion.convertDistanceForStorage(value, 'mi', 'steps', profile);
      const back = unitConversion.convertDistanceForStorage(steps, 'steps', 'mi', profile);
      expect(back).toBe(unitConversion.roundMeasure(value));
    }

    const src = '- walk 0lb 0.25mi 15m x1 x1\n- run 0lb 1.87mi 26m x1 x1\n';
    const toKm = unitConversion.rewriteRanksText(src, { distanceFrom: 'mi', distanceTo: 'km' });
    const backMi = unitConversion.rewriteRanksText(toKm, { distanceFrom: 'km', distanceTo: 'mi' });
    expect(backMi).toBe(src);
  });

  test('roundMeasure enforces 6.2 precision', () => {
    expect(unitConversion.roundMeasure(1.239)).toBe(1.24);
    expect(unitConversion.roundMeasure(999999.999)).toBe(999999.99);
    expect(unitConversion.formatMeasureToken(10)).toBe('10');
    expect(unitConversion.formatMeasureToken(1.5)).toBe('1.5');
  });

  test('rewriteRanksText converts weight and distance tokens', () => {
    const src = 'ARMS:\n\t- curl 10lb 0mi x10 x1\n\t- walk 0lb 1mi 15m x1 x1\n';
    const out = unitConversion.rewriteRanksText(src, {
      weightFrom: 'lbs',
      weightTo: 'kg',
      distanceFrom: 'mi',
      distanceTo: 'km',
    });
    expect(out).toMatch(/4\.5kg/);
    expect(out).toMatch(/1\.61km/);
    expect(out).toMatch(/15m/);
    expect(out).not.toMatch(/\blb\b/);
    expect(out).not.toMatch(/\bmi\b/);
  });

  test('meters file token avoids duration clash', () => {
    const src = '- walk 0lb 0mi 15m x1 x1\n';
    const out = unitConversion.rewriteRanksText(src, {
      distanceFrom: 'mi',
      distanceTo: 'm',
    });
    expect(out).toMatch(/0meters/);
    expect(out).toMatch(/15m/);
  });
});

describe('Feature 16 - convert-on-change persistence', () => {
  let tempRoot;
  let dataDir;
  let unitConversion;
  let storage;
  let config;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f16-units-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'localization', 'en'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'ranks.txt'),
      ['UNRANKED:', '{badges/unranked.svg}', '--------------', '', 'BRONZE I:', '{badges/bronze-i.svg}', '--------------', 'ARMS:', '\tSTRENGTH:', '\t\t- curls 14lb 0mi x10 x1', ''].join(
        '\n'
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'localization', 'en', 'ranks.txt'),
      ['UNRANKED:', '{badges/unranked.svg}', '--------------', '', 'BRONZE I:', '{badges/bronze-i.svg}', '--------------', 'ARMS:', '\tSTRENGTH:', '\t\t- curls 14lb 0mi x10 x1', ''].join(
        '\n'
      ),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'localization', 'en', 'ranks.default'),
      fs.readFileSync(path.join(dataDir, 'localization', 'en', 'ranks.txt'), 'utf8'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'store.json'),
      JSON.stringify({
        schemaVersion: 1,
        entries: [{ entryId: 'e1', exerciseId: 'curls', localDate: '2026-10-01', metrics: { weight: 14, reps: 10, sets: 1 } }],
        workouts: [],
      }),
      'utf8'
    );
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'weight units: lbs\ndistance units: mi\n', 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      ranksTxtPath: () => path.join(dataDir, 'localization', 'en', 'ranks.txt'),
      defaultRanksTxtPath: () => path.join(dataDir, 'localization', 'en', 'ranks.default'),
      storePath: () => path.join(dataDir, 'store.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      localizationDir: () => path.join(dataDir, 'localization'),
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    unitConversion = require('../src/unitConversion');
    storage = require('../src/storage');
    config = require('../src/config');
    config.load();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  test('Weight converts on unit change', () => {
    const result = unitConversion.applyUnitChange({ weightFrom: 'lbs', weightTo: 'st' });
    expect(result.ok).toBe(true);
    const store = storage.readStore();
    expect(store.data.entries[0].metrics.weight).toBe(1);
    const ranksText = fs.readFileSync(path.join(dataDir, 'localization', 'en', 'ranks.txt'), 'utf8');
    expect(ranksText).toMatch(/1st/);
    const defaults = fs.readFileSync(path.join(dataDir, 'localization', 'en', 'ranks.default'), 'utf8');
    expect(defaults).toMatch(/1st/);
    const rootRanks = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
    expect(rootRanks).toMatch(/1st/);
  });

  test('Distance list includes new units', () => {
    expect(config.normalizeDistanceUnits('m')).toBe('m');
    expect(config.normalizeDistanceUnits('yd')).toBe('yd');
    expect(config.normalizeDistanceUnits('yrd')).toBe('yd');
    expect(config.normalizeDistanceUnits('ft')).toBe('ft');
    expect(config.normalizeDistanceUnits('in')).toBe('in');
    expect(config.normalizeDistanceUnits('steps')).toBe('mi');
  });

  test('Weight list includes stones', () => {
    expect(config.normalizeWeightUnits('st')).toBe('st');
    expect(config.normalizeWeightUnits('stones')).toBe('st');
    config.set('weight units', 'st');
    expect(config.get().language || 'en').toBeTruthy();
    expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toMatch(/^weight units: st$/m);
  });
});
