/**
 * Feature 12 — Rank manager (list / save / sort / serialize)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE = [
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
  '\t\t\t- push-ups 0lb 0mi x4 x3',
  '\t\tPULL:',
  '\t\t\t- pull-ups 0lb 0mi x2 x3',
  'CORE:',
  '\tSTRENGTH:',
  '\t\t- crunches 0lb 0mi x10 x3',
  '',
  'SILVER I:',
  '{badges/silver-i.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- push-ups 20lb 0mi x10 x3',
  '\t\tPULL:',
  '\t\t\t- pull-ups 0lb 0mi x8 x3',
  'CORE:',
  '\tSTRENGTH:',
  '\t\t- crunches 0lb 0mi x20 x3',
  '',
].join('\n');

describe('rankManager', () => {
  let tempRoot;
  let dataDir;
  let rankManager;
  let ranks;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-rm-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'format.txt'), 'CORE:\n\tSTRENGTH:\n\t\t- plank x[reps] x[sets]\n', 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      badgesDir: () => path.join(dataDir, 'badges'),
      defaultRanksTxtPath: () => path.join(dataDir, 'defaults', 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    rankManager = require('../src/rankManager');
    ranks = require('../src/ranks');
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('lists rank rows with badge and name', () => {
    const listed = rankManager.listRankRows();
    expect(listed.ok).toBe(true);
    expect(listed.data.map((r) => r.name)).toEqual(['UNRANKED', 'BRONZE I', 'SILVER I']);
    expect(listed.data[1].badgePath).toMatch(/bronze-i/);
  });

  it('templates exercises with zeroed values', () => {
    const tpl = rankManager.getTemplateExercises();
    expect(tpl.ok).toBe(true);
    expect(tpl.data.length).toBeGreaterThan(0);
    expect(tpl.data[0].name).toBe('push-ups');
    expect(tpl.data[0].headers).toEqual(['ARMS', 'STRENGTH', 'PUSH']);
    expect(tpl.data[0].thresholds.reps).toBe(0);
    expect(tpl.data[0].thresholds.sets).toBe(0);
  });

  it('saves a custom rank and auto-sorts by difficulty', () => {
    const tpl = rankManager.getTemplateExercises();
    const exercises = tpl.data.map((ex) => ({
      ...ex,
      thresholds: { ...ex.thresholds, weight: 5, reps: 5, sets: 2 },
    }));

    const saved = rankManager.saveRank({
      name: 'CUSTOM MID',
      badgePath: 'badges/unranked.svg',
      exercises,
    });
    expect(saved.ok).toBe(true);

    const listed = rankManager.listRankRows();
    const names = listed.data.map((r) => r.name);
    expect(names[0]).toBe('UNRANKED');
    expect(names).toContain('CUSTOM MID');
    expect(names).toContain('BRONZE I');
    expect(names).toContain('SILVER I');
    // Mid custom should sit between bronze (easier) and silver (harder)
    const customIdx = names.indexOf('CUSTOM MID');
    expect(customIdx).toBeGreaterThan(names.indexOf('BRONZE I'));
    expect(customIdx).toBeLessThan(names.indexOf('SILVER I'));

    const text = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
    expect(text).toMatch(/CUSTOM MID:/);
    expect(text).toMatch(/push-ups/);
  });

  it('deletes a rank', () => {
    const result = rankManager.deleteRank('BRONZE I');
    expect(result.ok).toBe(true);
    const listed = rankManager.listRankRows();
    expect(listed.data.map((r) => r.name)).toEqual(['UNRANKED', 'SILVER I']);
  });

  it('refuses to delete UNRANKED', () => {
    expect(rankManager.deleteRank('UNRANKED').ok).toBe(false);
  });

  it('round-trips serialize through ranks parser', () => {
    const loaded = rankManager.loadTiers();
    const text = rankManager.serializeAllTiers(loaded.data);
    const parsed = ranks.parseRanksText(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.map((t) => t.name)).toEqual(loaded.data.map((t) => t.name));
    const bronze = parsed.data.find((t) => t.name === 'BRONZE I');
    expect(bronze.exercises.some((e) => e.name === 'push-ups')).toBe(true);
  });

  it('serialize groups same-section exercises into one header block', () => {
    const body = rankManager.serializeExercisesBody([
      { name: 'a', headers: ['ARMS', 'STRENGTH', 'PUSH'], thresholds: { reps: 1, sets: 1 } },
      { name: 'b', headers: ['ARMS', 'STRENGTH', 'PULL'], thresholds: { reps: 1, sets: 1 } },
      { name: 'c', headers: ['CORE', 'STRENGTH'], thresholds: { reps: 1, sets: 1 } },
      { name: 'd', headers: ['ARMS', 'STRENGTH', 'PULL'], thresholds: { reps: 2, sets: 2 } },
    ]);
    expect(body.match(/ARMS:/g) || []).toHaveLength(1);
    expect(body.match(/PULL:/g) || []).toHaveLength(1);
    expect(body.indexOf('- b ')).toBeLessThan(body.indexOf('- d '));
    expect(body.indexOf('PULL:')).toBeLessThan(body.indexOf('CORE:'));
  });
});
