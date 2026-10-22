/**
 * @jest-environment jsdom
 *
 * Feature 12 — Ranks list UI
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
  '',
].join('\n');

describe('RankManagerView', () => {
  let tempRoot;
  let dataDir;
  let root;
  let mount;
  let mountRankManagerView;
  let navigated;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-rmv-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'format.txt'), 'x\n', 'utf8');
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'navbar alignment: left\n', 'utf8');

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

    ({ mountRankManagerView } = require('../src/rankManagerView'));
    root = document.createElement('div');
    document.body.appendChild(root);
    navigated = null;
  });

  afterEach(() => {
    if (mount) mount.destroy();
    root.remove();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('renders rows with badge, name, edit, and delete', () => {
    mount = mountRankManagerView(root, {
      onCreate: () => {
        navigated = 'create';
      },
      onEdit: (name) => {
        navigated = `edit:${name}`;
      },
      confirm: () => true,
    });

    expect(root.querySelector('[data-view="rank-manager"]')).toBeTruthy();
    const bronze = root.querySelector('[data-rank-name="BRONZE I"]');
    expect(bronze).toBeTruthy();
    expect(bronze.textContent).toMatch(/BRONZE I/);
    expect(bronze.querySelector('[data-action="edit-rank"]')).toBeTruthy();
    expect(bronze.querySelector('[data-action="delete-rank"]')).toBeTruthy();

    // UNRANKED has no edit/delete
    const unranked = root.querySelector('[data-rank-name="UNRANKED"]');
    expect(unranked.querySelector('[data-action="edit-rank"]')).toBeFalsy();
    expect(unranked.querySelector('[data-action="delete-rank"]')).toBeFalsy();
  });

  it('Custom Rank footer button invokes onCreate', () => {
    mount = mountRankManagerView(root, {
      onCreate: () => {
        navigated = 'create';
      },
    });
    expect(root.querySelector('.rank-manager-header [data-action="custom-rank"]')).toBeFalsy();
    root.querySelector('[data-action="custom-rank"]').click();
    expect(navigated).toBe('create');
  });

  it('Edit as text uses secondary (Edit) styling', () => {
    mount = mountRankManagerView(root, {});
    const raw = root.querySelector('[data-action="raw-editor"]');
    expect(raw).toBeTruthy();
    expect(raw.classList.contains('secondary')).toBe(true);
    expect(raw.classList.contains('ghost')).toBe(false);
  });

  it('Edit invokes onEdit with rank name', () => {
    mount = mountRankManagerView(root, {
      onEdit: (name) => {
        navigated = name;
      },
    });
    root.querySelector('[data-action="edit-rank"]').click();
    expect(navigated).toBe('BRONZE I');
  });
});
