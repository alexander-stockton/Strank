/**
 * @jest-environment jsdom
 *
 * Feature 12 - Create Rank form
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
  '\t\t\t- push-ups 10lb 0mi x4 x3',
  '\t\tPULL:',
  '\t\t\t- pull-ups 0lb 0mi x2 x3',
  'CORE:',
  '\tSTRENGTH:',
  '\t\t- crunches 0lb 0mi x10 x3',
  '',
].join('\n');

describe('RankFormView', () => {
  let tempRoot;
  let dataDir;
  let root;
  let mount;
  let mountRankFormView;
  let saved;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-rfv-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'format.txt'), 'x\n', 'utf8');
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'weight units: lb\ndistance units: mi\n', 'utf8');

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

    ({ mountRankFormView } = require('../src/rankFormView'));
    root = document.createElement('div');
    document.body.appendChild(root);
    saved = null;
  });

  afterEach(() => {
    if (mount) mount.destroy();
    root.remove();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('create mode shows collapsed zeroed template exercises and sections', () => {
    mount = mountRankFormView(root, { mode: 'create' });
    expect(root.querySelector('[data-view="rank-form"]')).toBeTruthy();
    expect(root.querySelector('[data-badge-path]').textContent).toMatch(/unranked\.svg/);
    expect(root.querySelector('[data-rank-name]').value).toBe('');

    const sections = root.querySelectorAll('.rank-form-section');
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(root.textContent).toMatch(/ARMS › STRENGTH › PUSH/);

    expect(root.querySelector('.rank-form-exercise.is-collapsed')).toBeTruthy();
    expect(root.querySelector('[data-metric="reps"]')).toBeFalsy();

    root.querySelector('[data-action="toggle-exercise"]').click();
    expect(root.querySelector('.rank-form-exercise.is-expanded')).toBeTruthy();
    const reps = root.querySelector('[data-metric="reps"]');
    expect(reps).toBeTruthy();
    expect(reps.value).toBe('0');
    expect(root.querySelector('[data-metric="sets"]')).toBeTruthy();
    expect(root.querySelector('.rank-form-metrics-row')).toBeTruthy();
  });

  it('remove and add exercise within a section', () => {
    mount = mountRankFormView(root, { mode: 'create' });
    const before = root.querySelectorAll('.rank-form-exercise').length;
    root.querySelector('[data-action="remove-exercise"]').click();
    expect(root.querySelectorAll('.rank-form-exercise').length).toBe(before - 1);

    const addBtn = root.querySelector('[data-action="add-exercise"]');
    addBtn.click();
    expect(root.querySelectorAll('.rank-form-exercise').length).toBe(before);
    expect(root.querySelector('.rank-form-exercise.is-expanded')).toBeTruthy();
  });

  it('Done on an unnamed new exercise removes it instead of Untitled ghost', () => {
    mount = mountRankFormView(root, { mode: 'create' });
    const before = root.querySelectorAll('.rank-form-exercise').length;
    root.querySelector('[data-action="add-exercise"]').click();
    expect(root.querySelectorAll('.rank-form-exercise').length).toBe(before + 1);
    const expanded = root.querySelector('.rank-form-exercise.is-expanded');
    expect(expanded).toBeTruthy();
    const nameInput = expanded.querySelector('[data-ex-name]');
    expect(nameInput.value).toBe('');
    expanded.querySelector('[data-action="toggle-exercise"]').click();
    expect(root.querySelectorAll('.rank-form-exercise').length).toBe(before);
    expect(root.textContent).not.toMatch(/Untitled exercise/i);
  });

  it('confirm saves custom rank into ranks.txt', () => {
    mount = mountRankFormView(root, {
      mode: 'create',
      onSaved: (result) => {
        saved = result;
      },
    });

    root.querySelector('[data-rank-name]').value = 'MY RANK';
    root.querySelector('[data-action="confirm"]').click();

    expect(saved).toBeTruthy();
    expect(saved.ok).toBe(true);
    const text = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
    expect(text).toMatch(/MY RANK:/);
    expect(text).toMatch(/push-ups/);
  });

  it('dropping an image onto the form imports into badges/custom', () => {
    const src = path.join(tempRoot, 'drop-badge.png');
    fs.writeFileSync(src, Buffer.from([137, 80, 78, 71, 0, 0, 0, 0]));

    mount = mountRankFormView(root, { mode: 'create' });
    const form = root.querySelector('[data-view="rank-form"]');
    expect(form).toBeTruthy();

    const file = { name: 'drop-badge.png', path: src };
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [file],
        types: ['Files'],
        dropEffect: 'none',
      },
    });

    form.dispatchEvent(dropEvent);

    const pathEl = root.querySelector('[data-badge-path]');
    expect(pathEl.textContent).toMatch(/badges\/custom\/drop-badge\.png/);
    expect(fs.existsSync(path.join(dataDir, 'badges', 'custom', 'drop-badge.png'))).toBe(true);
  });
});
