/**
 * @jest-environment jsdom
 *
 * Exercise description help control (Feature 1 FR-005b)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  hasDescription,
  normalizeDescription,
  renderExerciseHelp,
} = require('../src/exerciseHelp');

describe('Exercise description help', () => {
  it('renders circled-? only when notes are present', () => {
    expect(hasDescription(null)).toBe(false);
    expect(hasDescription('')).toBe(false);
    expect(normalizeDescription('(description)')).toBeNull();
    expect(hasDescription('extended arms')).toBe(true);

    expect(renderExerciseHelp(null)).toBe('');
    const html = renderExerciseHelp('lay on back and hold', { id: 'dragon-flag' });
    expect(html).toMatch(/data-exercise-help/);
    expect(html).toMatch(/>\?<\/button>/);
    expect(html).toMatch(/lay on back and hold/);
  });

  it('Landing shows help control for exercises with notes', () => {
    jest.resetModules();
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-help-'));
    const dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'format.txt'),
      ['CORE:', '\tSTRENGTH:', '\t\t- chest-raises x[reps] x[sets]', ''].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'ranks.txt'),
      [
        'UNRANKED:',
        '{badges/unranked.svg}',
        '--------------',
        '',
        'BRONZE I:',
        '{badges/bronze-i.svg}',
        '--------------',
        'CORE:',
        '\tSTRENGTH:',
        '\t\t- chest-raises x8 x3 {lay on stomach, arms in L}',
        '',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['navbar alignment: left', 'logging: false'].join('\n'),
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
    }));

    const storage = require('../src/storage');
    const catalog = require('../src/catalog');
    const ranks = require('../src/ranks');
    const ranking = require('../src/ranking');
    const config = require('../src/config');
    const { mountLandingView } = require('../src/landingView');

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();
    ranking.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');
    storage.writeStore({ schemaVersion: 1, entries: [], workouts: [] });

    document.body.innerHTML = '<div id="root"></div>';
    const root = document.getElementById('root');
    const mount = mountLandingView(root, { localDate: '2026-10-17' });

    const row = root.querySelector('[data-exercise-id="chest-raises"]');
    expect(row).toBeTruthy();
    const help = row.querySelector('[data-exercise-help]');
    expect(help).toBeTruthy();
    expect(help.querySelector('[data-exercise-help-tip]').textContent).toMatch(/lay on stomach/i);

    mount.destroy();
    ranking.__resetTestHooks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });
});
