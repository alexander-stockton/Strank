/**
 * @jest-environment node
 *
 * Reset User Data - restore defaults + remap rank badge paths by tier name.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('resetUserData', () => {
  let tempRoot;
  let dataDir;
  let backup;
  let config;
  let ranks;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-reset-'));
    dataDir = path.join(tempRoot, 'data');
    const defaults = path.join(dataDir, 'defaults');
    fs.mkdirSync(defaults, { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });

    fs.writeFileSync(
      path.join(defaults, 'config.txt'),
      'language: en\nfont size: 16\nalert color: #C9A227\nglow color: #1E3A5F\nonboarding completed: true\n'
    );
    fs.writeFileSync(
      path.join(defaults, 'landing-config.txt'),
      'focus arms days: mon\nfocus core days: mon\nfocus lungs days: mon\nfocus legs days: mon\n'
    );
    fs.writeFileSync(
      path.join(defaults, 'store.json'),
      JSON.stringify({ schemaVersion: 1, entries: [], workouts: [] }, null, 2)
    );
    fs.writeFileSync(
      path.join(defaults, 'ranks.txt'),
      [
        'UNRANKED:',
        '{badges/custom/wrong.svg}',
        '--------------',
        '',
        'BRONZE I:',
        '{badges/custom/other.png}',
        '--------------',
        'ARMS:',
        '\tSTRENGTH:',
        '\t\tPUSH:',
        '\t\t\t- push-ups x10 x3',
        '',
      ].join('\n')
    );

    // Dirty live copies
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'language: ja\nlogging: true\n');
    fs.writeFileSync(path.join(dataDir, 'landing-config.txt'), 'focus arms days: sun\n');
    fs.writeFileSync(
      path.join(dataDir, 'store.json'),
      JSON.stringify({ schemaVersion: 1, entries: [{ entryId: 'x' }] })
    );
    fs.writeFileSync(
      path.join(dataDir, 'ranks.txt'),
      'BRONZE I:\n{badges/nope.svg}\n--------------\nARMS:\n\t- push-ups x1 x1\n'
    );

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      getUserDataDir: () => dataDir,
      defaultsDir: () => defaults,
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      badgesDir: () => path.join(dataDir, 'badges'),
      localizationDir: () => path.join(dataDir, 'localization'),
      localizedDataFile: (_f, fallback) => fallback,
    }));

    fs.writeFileSync(path.join(dataDir, 'format.txt'), 'ARMS:\n\t- push-ups\n');

    backup = require('../src/backup');
    config = require('../src/config');
    ranks = require('../src/ranks');
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('rankNameToBadgeSlug maps BRONZE I -> bronze-i', () => {
    expect(backup.rankNameToBadgeSlug('BRONZE I')).toBe('bronze-i');
    expect(backup.rankNameToBadgeSlug('PRO X')).toBe('pro-x');
    expect(backup.rankNameToBadgeSlug('UNRANKED')).toBe('unranked');
  });

  it('reset restores defaults and remaps badge paths by rank name', () => {
    const result = backup.resetUserData({ confirm: () => true });
    expect(result.ok).toBe(true);

    const ranksText = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
    expect(ranksText).toMatch(/UNRANKED:\r?\n\{badges\/unranked\.svg\}/);
    expect(ranksText).toMatch(/BRONZE I:\r?\n\{badges\/bronze-i\.svg\}/);
    expect(ranksText).not.toMatch(/custom\/wrong/);

    config.clearConfigCache();
    config.load();
    expect(config.get()['alert color'].toUpperCase()).toBe('#C9A227');

    const store = JSON.parse(fs.readFileSync(path.join(dataDir, 'store.json'), 'utf8'));
    expect(store.entries || []).toEqual([]);

    ranks.clearRanksCache();
    const loaded = ranks.loadRanks();
    expect(loaded.ok).toBe(true);
    const bronze = loaded.data.find((t) => t.name === 'BRONZE I');
    expect(bronze.badgePath).toBe('badges/bronze-i.svg');
  });

  it('cancel leaves files unchanged', () => {
    const before = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
    const result = backup.resetUserData({ confirm: () => false });
    expect(result.cancelled).toBe(true);
    expect(fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8')).toBe(before);
  });

  it('restartApp uses the provided reload hook', () => {
    const reload = jest.fn();
    backup.restartApp({ reload });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('restartApp spawns a new process then quits (does not window-reload)', () => {
    const spawn = jest.fn(() => ({ unref: jest.fn() }));
    const quit = jest.fn();
    const prevNw = global.nw;
    global.nw = {
      App: {
        startPath: dataDir,
        argv: ['.'],
        fullArgv: ['.'],
        quit,
      },
    };
    try {
      backup.restartApp({
        spawn,
        execPath: 'nw-fake',
        cwd: dataDir,
        args: ['.'],
      });
      expect(spawn).toHaveBeenCalledWith(
        'nw-fake',
        ['.'],
        expect.objectContaining({ cwd: dataDir, detached: true, stdio: 'ignore' })
      );
      expect(quit).toHaveBeenCalledTimes(1);
    } finally {
      global.nw = prevNw;
    }
  });
});
