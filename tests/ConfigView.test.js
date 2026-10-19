/**
 * @jest-environment jsdom
 *
 * Feature 6 — Custom Ranks
 * Spec: features/feature-6-Custom-Ranks.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 6 — Config opens Rank Editor', () => {
  let tempRoot;
  let dataDir;
  let mountConfigView;
  let mountRankEditorView;
  let root;
  let configMount;
  let editorMount;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f6-config-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'ranks.txt'),
      [
        'COPPER I:',
        '{badges/custom/copper-i.png}',
        '--------------',
        'ARMS:',
        '\tSTRENGTH:',
        '\t\t- pull-ups x5 x3',
        '',
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(path.join(dataDir, 'format.txt'), 'ARMS:\n\t- pull-ups x[reps] x[sets]\n', 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    ({ mountConfigView } = require('../src/configView'));
    ({ mountRankEditorView } = require('../src/rankEditorView'));

    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
  });

  afterEach(() => {
    if (editorMount) editorMount.destroy();
    if (configMount) configMount.destroy();
    editorMount = null;
    configMount = null;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-6.4 — Edit Via Rank Editor', () => {
    it('Config opens Rank Editor', () => {
      configMount = mountConfigView(root, {
        onEditRanks: () => {
          configMount.destroy();
          configMount = null;
          editorMount = mountRankEditorView(root, {
            onBack: () => {},
          });
        },
      });

      expect(root.querySelector('[data-view="config"]')).toBeTruthy();
      expect(root.querySelector('[data-section="advanced"]')).toBeTruthy();

      root.querySelector('[data-action="edit-ranks"]').click();

      expect(root.querySelector('[data-view="rank-editor"]')).toBeTruthy();
      const ta = root.querySelector('[name="ranksText"]');
      expect(ta).toBeTruthy();
      expect(ta.value).toContain('COPPER I:');
      expect(ta.value).toContain('--------------');
      expect(editorMount.getBuffer()).toContain('pull-ups');
    });
  });
});
