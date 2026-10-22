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
  positionExerciseHelpTip,
  installExerciseHelpTooltips,
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

  it('elevates gallery/list hosts so tips stack above later siblings', () => {
    document.body.innerHTML = `
      <ul class="ranks-gallery-list">
        <li class="ranks-gallery-item">
          ${renderExerciseHelp('rear foot under something sturdy', { id: 'split-squats' })}
        </li>
        <li class="ranks-gallery-item">
          <span class="ranks-gallery-item-name">curl negatives</span>
        </li>
      </ul>`;
    const btn = document.querySelector('.exercise-help-btn');
    const wrap = document.querySelector('[data-exercise-help]');
    const item = document.querySelector('.ranks-gallery-item');
    const tip = document.querySelector('[data-exercise-help-tip]');
    tip.style.display = 'block';
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb();
      return 1;
    });
    jest.spyOn(tip, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      right: 100,
      top: 40,
      bottom: 80,
      width: 90,
      height: 40,
    });

    positionExerciseHelpTip(btn);
    expect(wrap.classList.contains('is-tip-elevated')).toBe(true);
    expect(item.classList.contains('is-tip-elevated')).toBe(true);

    const { clearExerciseHelpTip } = require('../src/exerciseHelp');
    clearExerciseHelpTip(btn);
    expect(wrap.classList.contains('is-tip-elevated')).toBe(false);
    expect(item.classList.contains('is-tip-elevated')).toBe(false);
  });

  it('positionExerciseHelpTip flips when tip overflows clip parent', () => {
    document.body.innerHTML = `
      <div class="panel-body" style="overflow:auto; width:180px; height:200px; position:relative;">
        ${renderExerciseHelp(
          'only raise the front half of your body with your arms to the side and fists pointing forward',
          { id: 'half-superman' }
        )}
      </div>`;

    const btn = document.querySelector('.exercise-help-btn');
    const tip = document.querySelector('[data-exercise-help-tip]');
    const clip = document.querySelector('.panel-body');
    tip.style.display = 'block';

    jest.spyOn(clip, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 180,
      top: 0,
      bottom: 200,
      width: 180,
      height: 200,
    });
    jest.spyOn(tip, 'getBoundingClientRect').mockImplementation(() => {
      if (tip.classList.contains('is-flipped')) {
        return { left: -40, right: 180, top: 40, bottom: 100, width: 220, height: 60 };
      }
      return { left: 20, right: 260, top: 40, bottom: 100, width: 240, height: 60 };
    });
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb();
      return 1;
    });

    positionExerciseHelpTip(btn);
    expect(tip.classList.contains('is-flipped')).toBe(true);
    // Flipped tip still past left edge -> width thinned into the clip box
    // (must also clear stylesheet min-width: 10rem)
    expect(tip.style.minWidth).toBe('0px');
    expect(tip.style.maxWidth).toMatch(/px$/);
    expect(tip.style.width).toMatch(/px$/);
    const w = parseFloat(tip.style.width);
    expect(w).toBeLessThanOrEqual(180);
    expect(w).toBeGreaterThanOrEqual(72);
  });

  it('installExerciseHelpTooltips flips on pointerover when overflowing', () => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div class="panel-body" style="overflow:auto; width:160px;">
        ${renderExerciseHelp('a long note that needs room to display fully without clipping', {
          id: 'note-1',
        })}
      </div>`;

    const uninstall = installExerciseHelpTooltips(document);
    const btn = document.querySelector('.exercise-help-btn');
    const tip = document.querySelector('[data-exercise-help-tip]');
    const clip = document.querySelector('.panel-body');

    tip.style.display = 'block';
    jest.spyOn(clip, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 160,
      top: 0,
      bottom: 300,
      width: 160,
      height: 300,
    });
    const tipRect = {
      left: 10,
      right: 220,
      top: 30,
      bottom: 80,
      width: 210,
      height: 50,
    };
    jest.spyOn(tip, 'getBoundingClientRect').mockImplementation(() => {
      if (tip.classList.contains('is-flipped')) {
        return { left: -50, right: 160, top: 30, bottom: 80, width: 210, height: 50 };
      }
      return tipRect;
    });

    const raf = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb();
        return 1;
      });

    btn.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(tip.classList.contains('is-flipped')).toBe(true);

    raf.mockRestore();
    uninstall();
    jest.useRealTimers();
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
    fs.writeFileSync(
      path.join(dataDir, 'landing-config.txt'),
      [
        'focus arms days: mon,tue,wed,thu,fri,sat,sun',
        'focus core days: mon,tue,wed,thu,fri,sat,sun',
        'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
        'focus legs days: mon,tue,wed,thu,fri,sat,sun',
      ].join('\n') + '\n',
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

    const storage = require('../src/storage');
    const catalog = require('../src/catalog');
    const ranks = require('../src/ranks');
    const ranking = require('../src/ranking');
    const config = require('../src/config');
    const landingConfig = require('../src/landingConfig');
    const { mountLandingView } = require('../src/landingView');

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    landingConfig.clearLandingConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();
    landingConfig.load();
    ranking.__resetTestHooks();
    ranking.__setLocalDate('2026-10-17');
    storage.writeStore({ schemaVersion: 1, entries: [], workouts: [] });

    document.body.innerHTML = `
      <nav class="app-navbar app-navbar-left"><div class="app-navbar-links"></div>
      <div class="app-navbar-end" data-landing-menu-host="navbar" hidden></div></nav>
      <div id="root"></div>`;
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
