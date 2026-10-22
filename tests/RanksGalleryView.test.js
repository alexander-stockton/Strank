/**
 * @jest-environment jsdom
 *
 * Feature 6 — Custom Ranks
 * Feature 10 — Ranks Gallery
 * Spec: features/feature-6-Custom-Ranks.md
 * Spec: features/feature-10-Ranks-Gallery.md
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
  '\t\t\t- pike-push-ups x4 x3',
  '\t\t\t- push-ups x10 x3',
  '',
  'BRONZE II:',
  '{badges/bronze-ii.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- pike-push-ups x6 x3',
  '',
].join('\n');

describe('Feature 10 — Ranks Gallery', () => {
  let tempRoot;
  let dataDir;
  let storage;
  let catalog;
  let ranks;
  let config;
  let ranksGallery;
  let mountRanksGalleryView;
  let root;
  let mount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f10-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['navbar alignment: left', 'logging: false'].join('\n') + '\n',
      'utf8'
    );
    for (const name of ['unranked', 'bronze-i', 'bronze-ii']) {
      fs.writeFileSync(
        path.join(dataDir, 'badges', `${name}.svg`),
        `<svg xmlns="http://www.w3.org/2000/svg"><title>${name}</title></svg>`,
        'utf8'
      );
    }

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
    config = require('../src/config');
    ranksGallery = require('../src/ranksGallery');
    ({ mountRanksGalleryView } = require('../src/ranksGalleryView'));

    storage.ensureInitialized();
    catalog.clearCatalogCache();
    ranks.clearRanksCache();
    config.clearConfigCache();
    catalog.loadLiveCatalog();
    ranks.loadRanks();
    config.load();

    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-10.1 — Browse Rank Badges', () => {
    it('Badges follow ranks.txt order', () => {
      mount = mountRanksGalleryView(root, { ranksGallery });

      expect(root.querySelector('[data-view="ranksGallery"]')).toBeTruthy();
      const columns = [...root.querySelectorAll('[data-tier-name]')];
      const names = columns.map((el) => el.getAttribute('data-tier-name'));

      expect(names).not.toContain('UNRANKED');
      expect(names.indexOf('BRONZE I')).toBeLessThan(names.indexOf('BRONZE II'));
      expect(names[0]).toBe('BRONZE I');
      expect(names[1]).toBe('BRONZE II');

      const scroller = root.querySelector('[data-ranks-scroller]');
      expect(scroller).toBeTruthy();
      expect(getComputedStyle(scroller).overflowX === 'auto' || scroller.classList.contains('ranks-gallery-scroller')).toBe(
        true
      );
    });
  });

  describe('US-10.2 — See Weekly Expectations Per Rank', () => {
    it('Expectations listed under badge', () => {
      mount = mountRanksGalleryView(root, { ranksGallery });

      const bronzeI = root.querySelector('[data-tier-name="BRONZE I"]');
      expect(bronzeI).toBeTruthy();
      expect(bronzeI.querySelector('[data-tier-badge="BRONZE I"]')).toBeTruthy();

      const expectations = bronzeI.querySelector('[data-tier-expectations="BRONZE I"]');
      expect(expectations).toBeTruthy();

      expect(bronzeI.querySelector('.ranks-gallery-divider')).toBeTruthy();

      const pike = expectations.querySelector('[data-exercise-id="pike-push-ups"]');
      expect(pike).toBeTruthy();
      expect(pike.querySelector('.ranks-gallery-item-name').textContent).toMatch(/pike-push-ups/i);
      expect(pike.querySelector('.ranks-gallery-item-arrow')).toBeTruthy();

      const flyout = pike.querySelector('[data-targets]');
      expect(flyout).toBeTruthy();
      expect(flyout.getAttribute('aria-hidden')).toBe('true');
      expect(pike.classList.contains('is-expanded')).toBe(false);

      pike.click();
      expect(pike.classList.contains('is-expanded')).toBe(true);
      expect(pike.querySelector('[data-action="toggle-targets"]').getAttribute('aria-expanded')).toBe(
        'true'
      );
      expect(flyout.getAttribute('aria-hidden')).toBe('false');
      expect(flyout.textContent).toMatch(/Reps\s*4/);
      expect(flyout.textContent).toMatch(/Sets\s*3/);
    });
  });

  describe('US-10.3 — Return To Landing', () => {
    it('Back goes to landing', () => {
      let landed = false;
      mount = mountRanksGalleryView(root, {
        ranksGallery,
        onBack: () => {
          landed = true;
        },
      });

      expect(root.querySelector('[data-view="ranksGallery"]')).toBeTruthy();
      root.querySelector('[data-action="back"]').click();
      expect(landed).toBe(true);
    });
  });
});
