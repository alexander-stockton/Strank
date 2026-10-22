/**
 * @jest-environment jsdom
 *
 * Feature 17 - Contributing notice + GitHub FAB.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

describe('contributing', () => {
  let tempRoot;
  let dataDir;
  let mountContributingNoticeView;
  let installGithubFab;
  let REPO_URL;
  let MAINTAINER_EMAIL;
  let fillNavbarUtilities;
  let i18n;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-contrib-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'navbar alignment: left\nlanguage: en\n');
    fs.writeFileSync(
      path.join(dataDir, 'landing-config.txt'),
      [
        'focus arms days: mon,tue,wed,thu,fri,sat,sun',
        'focus core days: mon,tue,wed,thu,fri,sat,sun',
        'focus lungs days: mon,tue,wed,thu,fri,sat,sun',
        'focus legs days: mon,tue,wed,thu,fri,sat,sun',
      ].join('\n') + '\n'
    );
    fs.writeFileSync(path.join(dataDir, 'store.json'), '{"schemaVersion":1,"entries":[]}');

    const projectData = path.resolve(__dirname, '..', 'data');
    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      getUserDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      localizationDir: () => path.join(projectData, 'localization'),
      localizedDataFile: (_f, fallback) => fallback,
    }));

    document.body.innerHTML = `
      <nav class="app-navbar app-navbar-left" data-navbar-alignment="left">
        <div class="app-navbar-links"></div>
        <div class="app-navbar-end" data-landing-menu-host="navbar"></div>
      </nav>
      <div id="root"></div>
    `;

    const config = require('../src/config');
    config.clearConfigCache();
    config.load();
    i18n = require('../src/i18n');
    i18n.init();
    ({ mountContributingNoticeView, REPO_URL, MAINTAINER_EMAIL } = require('../src/contributingView'));
    ({ installGithubFab } = require('../src/githubFab'));
    ({ fillNavbarUtilities } = require('../src/navbarUtilities'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('renders panel with title, body, and Back', () => {
    const root = document.getElementById('root');
    mountContributingNoticeView(root);
    expect(root.querySelector('[data-view="contributing-notice"]')).toBeTruthy();
    expect(root.querySelector('[data-contributing-card="contributing"] h1').textContent).toMatch(
      /Contributing/i
    );
    expect(root.querySelector('[data-contributing-scroll]')).toBeTruthy();
    expect(root.querySelector('[data-contributing-footer] [data-action="contributing-back"]')).toBeTruthy();
  });

  it('Back calls onBack (prior page)', () => {
    const root = document.getElementById('root');
    const onBack = jest.fn();
    mountContributingNoticeView(root, { onBack });
    root.querySelector('[data-action="contributing-back"]').click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('body mentions GitHub issues, maintainer email, and forking for plugins', () => {
    const root = document.getElementById('root');
    mountContributingNoticeView(root);
    const copy = root.querySelector('[data-contributing-copy]').textContent;
    expect(copy).toMatch(/Want to contribute\?/i);
    expect(copy).toMatch(/, so /);
    expect(copy.toLowerCase()).toMatch(/issue/);
    expect(copy.toLowerCase()).toMatch(/github/);
    expect(copy).toContain(MAINTAINER_EMAIL);
    expect(copy).toContain('colo.anon.net@keemail.me');
    expect(copy.toLowerCase()).toMatch(/fork/);
    expect(copy.toLowerCase()).toMatch(/plugin/);
    expect(root.querySelector('[data-contributing-repo]').textContent).toBe(REPO_URL);
    expect(root.querySelector('[data-contributing-email]').textContent).toBe(MAINTAINER_EMAIL);
    const lines = root.querySelectorAll('[data-contributing-copy] .contributing-line');
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(root.querySelector('.contributing-contact [data-contributing-repo]')).toBeTruthy();
    expect(root.querySelector('.contributing-contact [data-contributing-email]')).toBeTruthy();
  });

  it('includes an AI use card beneath Contributing with file text', () => {
    const root = document.getElementById('root');
    const aiPath = path.join(tempRoot, 'AI use');
    fs.writeFileSync(aiPath, 'Agent-coded with human creative direction.\n', 'utf8');
    mountContributingNoticeView(root);
    const aiCard = root.querySelector('[data-contributing-card="ai-use"]');
    expect(aiCard).toBeTruthy();
    expect(aiCard.querySelector('h1').textContent).toMatch(/AI use/i);
    expect(root.querySelector('[data-ai-use-body]').textContent).toMatch(/Agent-coded/);
    const scroll = root.querySelector('[data-contributing-scroll]');
    const contrib = root.querySelector('[data-contributing-card="contributing"]');
    expect(
      contrib.compareDocumentPosition(aiCard) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(scroll.contains(contrib) && scroll.contains(aiCard)).toBe(true);
    expect(root.querySelector('[data-contributing-footer]').contains(aiCard)).toBe(false);
  });

  it('AI use body follows language selection', () => {
    const root = document.getElementById('root');
    const mount = mountContributingNoticeView(root);
    expect(root.querySelector('[data-ai-use-body]').textContent).toMatch(/offline emphasis and installer/i);

    i18n.setLanguage('es');
    mount.refresh();
    expect(root.querySelector('[data-contributing-card="ai-use"] h1').textContent).toMatch(/Uso de IA/i);
    expect(root.querySelector('[data-ai-use-body]').textContent).toMatch(/agentes de IA/i);
    expect(root.querySelector('[data-ai-use-body]').textContent).toMatch(/instalador/i);

    i18n.setLanguage('en');
    mount.refresh();
    expect(root.querySelector('[data-ai-use-body]').textContent).toMatch(/offline emphasis and installer/i);
  });

  it('navbar does not include Contributing (FAB is the entry)', () => {
    fillNavbarUtilities(document);
    const host = document.querySelector('[data-landing-menu-host="navbar"]');
    expect(host.querySelector('[data-action="open-privacy"]')).toBeTruthy();
    expect(host.querySelector('[data-action="open-contributing"]')).toBeFalsy();
  });

  it('GitHub FAB opens Contributing callback and stays fixed bottom-right', () => {
    const onOpen = jest.fn();
    const fab = installGithubFab(document, { onOpen });
    const btn = fab.getButton();
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('data-github-fab')).toBe('');
    btn.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
    fab.relayout();
    expect(btn.style.bottom || '').toBe('');
    fab.destroy();
  });
});

