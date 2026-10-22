/**
 * @jest-environment jsdom
 *
 * Feature 12 - Rank Editor
 * Spec: features/feature-12-Rank-Editor.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_FORMAT = `# ---------------------------------------------------- STRANK FORMATTING RULES ----------------------------------------------------
#
#   1. Only change RANK NAME #, badge image path, or list items for custom ranks, never header labels.
#   2. Badge images live in data/badges/.
#
# --------------------------------------------------------------------------------------------------------------------------------


RANK NAME #:
{badge image path}
--------------
ARMS:
	STRENGTH:
		PUSH:
			- exercise1 x[reps] x[sets]
`;

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
  '\t\t\t- push-ups x10 x3',
  '',
].join('\n');

describe('Feature 12 - Rank Editor view', () => {
  let tempRoot;
  let dataDir;
  let mountRankEditorView;
  let root;
  let mount;
  let navigated;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f12v-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'defaults'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'defaults', 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(
      path.join(dataDir, 'config.txt'),
      ['font size: 16', 'navbar alignment: left', 'logging: false'].join('\n') + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'badges', 'bronze-i.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'utf8'
    );
    fs.writeFileSync(
      path.join(dataDir, 'badges', 'unranked.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'utf8'
    );

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      defaultRanksTxtPath: () => path.join(dataDir, 'defaults', 'ranks.txt'),
      badgesDir: () => path.join(dataDir, 'badges'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    ({ mountRankEditorView } = require('../src/rankEditorView'));
    root = document.createElement('div');
    document.body.appendChild(root);
    navigated = null;
    mount = null;
  });

  afterEach(() => {
    if (mount) mount.destroy();
    mount = null;
    root.remove();
    jest.useRealTimers();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('Raw rank editor remains reachable from the Ranks list flow', () => {
    mount = mountRankEditorView(root, {
      onBack: () => {
        navigated = '/rank-manager';
      },
      confirm: () => true,
    });
    const ta = root.querySelector('[data-ranks-editor]');
    expect(ta).toBeTruthy();
    expect(ta.value).toContain('BRONZE I:');
    expect(ta.value).toContain(FIXTURE_RANKS.trim());
  });

  it('Back returns to Ranks list', () => {
    mount = mountRankEditorView(root, {
      onBack: () => {
        navigated = '/rank-manager';
      },
      confirm: () => true,
    });
    root.querySelector('[data-action="back"]').click();
    expect(navigated).toBe('/rank-manager');
  });

  it('Tier edit updates preview card', () => {
    mount = mountRankEditorView(root, { confirm: () => true });
    const ta = root.querySelector('[data-ranks-editor]');
    expect(root.querySelector('[data-tier-name="BRONZE I"]')).toBeTruthy();

    ta.value = ta.value.replace('BRONZE I:', 'COPPER I:');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    jest.advanceTimersByTime(300);

    expect(root.querySelector('[data-tier-name="COPPER I"]')).toBeTruthy();
    expect(fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8')).toContain('BRONZE I:');
  });

  it('Preview uses gallery-style cards', () => {
    mount = mountRankEditorView(root, { confirm: () => true });
    const card = root.querySelector('.ranks-gallery-column');
    expect(card).toBeTruthy();
    expect(card.querySelector('.ranks-gallery-badge')).toBeTruthy();
    expect(card.querySelector('.ranks-gallery-expectations')).toBeTruthy();
    expect(card.querySelector('.ranks-gallery-tier-caption').textContent).toBe('BRONZE I');
  });

  it('Help shows rules and example separately', () => {
    mount = mountRankEditorView(root, { confirm: () => true });
    root.querySelector('[data-action="help"]').click();
    expect(root.querySelector('[data-dialog="rank-help"]')).toBeTruthy();
    const rules = root.querySelector('[data-help-rules]');
    expect(rules).toBeTruthy();
    expect(rules.tagName).toBe('UL');
    expect(rules.textContent).toMatch(/1\.\s+Only change RANK NAME/);
    // Single in-string numbers only - no extra list markers like "1. 1."
    expect(rules.textContent).not.toMatch(/1\.\s*1\./);
    const example = root.querySelector('[data-help-example]');
    expect(example).toBeTruthy();
    expect(example.textContent).toMatch(/RANK NAME\s*#:/);
    expect(example.textContent).toMatch(/badge image path/);
    expect(example.textContent.trim().length).toBeGreaterThan(40);
  });

  it('Search icon opens find bar with Prev, Next, and close', () => {
    mount = mountRankEditorView(root, { confirm: () => true });
    expect(root.querySelector('[data-action="search"]')).toBeTruthy();
    root.querySelector('[data-action="search"]').click();
    expect(root.querySelector('[data-rank-search]')).toBeTruthy();
    expect(root.querySelector('[data-search-input]')).toBeTruthy();
    expect(root.querySelector('[data-action="search-prev"]')).toBeTruthy();
    expect(root.querySelector('[data-action="search-next"]')).toBeTruthy();
    expect(root.querySelector('[data-action="search-close"]')).toBeTruthy();
    root.querySelector('[data-action="search-close"]').click();
    expect(root.querySelector('[data-rank-search]')).toBeFalsy();
  });

  it('Find Next scrolls the textarea to the matched line', () => {
    mount = mountRankEditorView(root, { confirm: () => true });
    let ta = root.querySelector('[data-ranks-editor]');
    const marker = 'UNIQUE_FIND_MARKER_XYZ';
    const pad = Array.from({ length: 80 }, (_, i) => `# pad line ${i}`).join('\n');
    ta.value = `${pad}\n${marker}\nmore\n`;

    // Search re-renders from editor text; stub layout on the fresh textarea.
    root.querySelector('[data-action="search"]').click();
    ta = root.querySelector('[data-ranks-editor]');
    Object.defineProperty(ta, 'clientHeight', { configurable: true, value: 120 });
    Object.defineProperty(ta, 'scrollHeight', { configurable: true, value: 2400 });
    ta.scrollTop = 0;

    const input = root.querySelector('[data-search-input]');
    input.value = marker;
    root.querySelector('[data-action="search-next"]').click();

    ta = root.querySelector('[data-ranks-editor]');
    expect(ta.value).toContain(marker);
    expect(ta.selectionStart).toBe(ta.value.indexOf(marker));

    // Mirror measure + delayed Chromium caret-scroll overrides
    jest.advanceTimersByTime(100);
    expect(ta.scrollTop).toBeGreaterThan(40);
  });

  it('Omits Beautify and shows save / fix-syntax caution tips', () => {
    mount = mountRankEditorView(root, { confirm: () => true });
    expect(root.querySelector('[data-action="beautify"]')).toBeNull();
    const saveTip = root.querySelector('#rank-editor-save-tip');
    const fixTip = root.querySelector('#rank-editor-fix-syntax-tip');
    expect(saveTip).toBeTruthy();
    expect(fixTip).toBeTruthy();
    expect(saveTip.textContent).toMatch(/Rank data corrupts easily.*before saving/);
    expect(fixTip.textContent).toMatch(/Double-check the 'fixes'/);
    expect(saveTip.hidden).toBe(true);

    const saveWrap = root.querySelector('[data-action="save"]').closest('.rank-editor-action-wrap');
    saveWrap.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    expect(saveTip.hidden).toBe(false);
    expect(saveTip.classList.contains('flyout-fade-visible')).toBe(true);

    // Moving into the tip (above the button) must not dismiss early.
    saveWrap.dispatchEvent(
      Object.assign(new Event('pointerleave', { bubbles: true }), { relatedTarget: saveTip })
    );
    expect(saveTip.hidden).toBe(false);
  });
});
