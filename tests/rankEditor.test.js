/**
 * Feature 12 — Rank Editor
 * Spec: features/feature-12-Rank-Editor.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FIXTURE_FORMAT = `# ---------------------------------------------------- STRANK FORMATTING RULES ----------------------------------------------------
#
#   1. Only change RANK NAME #, badge image path, or list items for custom ranks, never header labels.
#   2. Badge images live in data/badges/  (example: badges/unranked.svg).
#  11. Keep tab-indentation intact, the parser depends on it.
#
# --------------------------------------------------------------------------------------------------------------------------------


RANK NAME #:
{badge image path (supported image types: .svg, .png, .jpg/.jpeg, .webp, .gif)}
--------------
ARMS:
	STRENGTH:
		PUSH:
			- exercise1 ([weight][unit]) ([distance][unit]) x[reps] x[sets] {(description)}
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

const DEFAULT_RANKS = [
  'UNRANKED:',
  '{badges/unranked.svg}',
  '--------------',
  '',
  'SILVER I:',
  '{badges/silver-i.svg}',
  '--------------',
  'ARMS:',
  '\tSTRENGTH:',
  '\t\tPUSH:',
  '\t\t\t- push-ups x12 x3',
  '',
].join('\n');

describe('Feature 12 — Rank Editor service', () => {
  let tempRoot;
  let dataDir;
  let rankEditor;
  let ranks;
  let catalog;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f12-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(path.join(dataDir, 'badges'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'defaults'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'format.txt'), FIXTURE_FORMAT, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'ranks.txt'), FIXTURE_RANKS, 'utf8');
    fs.writeFileSync(path.join(dataDir, 'defaults', 'ranks.txt'), DEFAULT_RANKS, 'utf8');

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

    rankEditor = require('../src/rankEditor');
    ranks = require('../src/ranks');
    catalog = require('../src/catalog');
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('Save writes ranks.txt and reloads', () => {
    const next = FIXTURE_RANKS.replace('BRONZE I', 'COPPER I');
    const result = rankEditor.saveDraft(next, { confirm: () => true });
    expect(result.ok).toBe(true);
    const disk = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
    expect(disk).toContain('COPPER I:');
    ranks.clearRanksCache();
    const loaded = ranks.loadRanks();
    expect(loaded.ok).toBe(true);
    expect(loaded.data.some((t) => t.name === 'COPPER I')).toBe(true);
    const live = catalog.reloadFromDisk();
    expect(live.ok).toBe(true);
  });

  it('Beautify reformats buffer only', () => {
    const messy = [
      'BRONZE I:',
      'badges/bronze-i.svg',
      '---',
      'ARMS:',
      '\tSTRENGTH:',
      '\t\tPUSH:',
      '\t\t\t- push-ups x10 x3   ',
      '',
      '',
      'BRONZE II:',
      '{badges/bronze-ii.svg}',
      '--------------',
      'ARMS:',
      '\tSTRENGTH:',
      '\t\tPUSH:',
      '\t\t\t- push-ups x12 x3',
    ].join('\n');
    const before = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
    const pretty = rankEditor.beautify(messy);
    expect(pretty).toContain('--------------');
    expect(pretty).toContain('{badges/bronze-i.svg}');
    expect(pretty).toMatch(/BRONZE I:[\s\S]*\n\nBRONZE II:/);
    expect(pretty).not.toMatch(/x10 x3[ \t]+/);
    expect(fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8')).toBe(before);
  });

  it('Fix syntax errors repairs buffer', () => {
    const broken = [
      'BRONZE I:',
      'badges/bronze-i.svg',
      'ARMS:',
      '\tSTRENGTH:',
      '\t\tPUSH:',
      '\t\t\t- push-ups x10 x3',
      '',
      'CORE:',
      '\tSTRENGTH:',
      '\t\t- crunches x10 x3',
    ].join('\n');
    const before = fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8');
    const fixed = rankEditor.fixSyntax(broken);
    expect(fixed.text).toContain('--------------');
    expect(fixed.text).toContain('{badges/bronze-i.svg}');
    // Must not treat CORE: as a rank tier
    expect(fixed.text).not.toMatch(/CORE:\s*\{badges\//);
    expect(fixed.text).toMatch(/CORE:\s*\n\tSTRENGTH:/);
    const parsed = rankEditor.parseDraft(fixed.text);
    expect(parsed.ok).toBe(true);
    expect(parsed.columns.some((c) => c.tierName === 'BRONZE I')).toBe(true);
    expect(parsed.columns.some((c) => c.tierName === 'CORE')).toBe(false);
    expect(fs.readFileSync(path.join(dataDir, 'ranks.txt'), 'utf8')).toBe(before);
  });

  it('Fix syntax errors repairs section header tab indentation', () => {
    const broken = [
      'BRONZE I:',
      '{badges/bronze-i.svg}',
      '--------------',
      'ARMS:',
      '\t\tSTRENGTH:',
      '\t\t\tPUSH:',
      '\t\t\t\t- push-ups x10 x3',
      'CORE:',
      '\t\tSTRENGTH:',
      '\t\t\t- crunches x10 x3',
      '',
    ].join('\n');
    const before = rankEditor.parseDraft(broken);
    expect(before.incomplete).toBe(true);
    expect(before.errors.some((e) => /indent/i.test(e.message))).toBe(true);

    const fixed = rankEditor.fixSyntax(broken);
    expect(fixed.text).toMatch(/ARMS:\n\tSTRENGTH:\n\t\tPUSH:\n\t\t\t- push-ups/);
    expect(fixed.text).toMatch(/CORE:\n\tSTRENGTH:\n\t\t- crunches/);
    const after = rankEditor.parseDraft(fixed.text);
    expect(after.incomplete).toBe(false);
    expect(after.ok).toBe(true);
  });

  it('parseDraft explains wrong section header depths', () => {
    const flat = [
      'BRONZE I:',
      '{badges/bronze-i.svg}',
      '--------------',
      'ARMS:',
      'STRENGTH:',
      'PUSH:',
      '- push-ups x10 x3',
      '',
    ].join('\n');
    const parsed = rankEditor.parseDraft(flat);
    expect(parsed.incomplete).toBe(true);
    expect(parsed.errors[0].message).toMatch(/STRENGTH.*1 tab/i);
    const fixed = rankEditor.fixSyntax(flat);
    expect(rankEditor.parseDraft(fixed.text).ok).toBe(true);
  });

  it('Fix syntax errors repairs exercise leaf dashes reps duration and notes', () => {
    expect(rankEditor.repairExerciseLeafLine('\t\t\tpike push-ups 0lb 0mi 4 x3')).toBe(
      '\t\t\t- pike push-ups 0lb 0mi x4 x3'
    );
    expect(
      rankEditor.repairExerciseLeafLine('- plank-hold 0lb 0mi 120 x1 x3 extended arms')
    ).toBe('- plank-hold 0lb 0mi 2m x1 x3 {extended arms}');
    expect(rankEditor.repairExerciseLeafLine('- pike push-ups 0lb 0mi {x3}')).toBe(
      '- pike push-ups 0lb 0mi x3 x1'
    );
    expect(rankEditor.repairExerciseLeafLine('- elbow-to-hand-ups 0lb 0mi x6 {x3}')).toBe(
      '- elbow-to-hand-ups 0lb 0mi x6 x3'
    );
    expect(
      rankEditor.repairExerciseLeafLine('- plank-hold 0m 20s x1 x3 extended arms}}')
    ).toBe('- plank-hold 0lb 0mi 20s x1 x3 {extended arms}');
    expect(rankEditor.repairExerciseLeafLine('- low-push hold 0lb 0mi 10s x1 {x3}')).toBe(
      '- low-push hold 0lb 0mi 10s x1 x3'
    );
    // Unclosed description brace — close/normalize; do not steal x3 into notes
    expect(rankEditor.repairExerciseLeafLine('- pike push-ups 0lb 0mi x4 x3 {test')).toBe(
      '- pike push-ups 0lb 0mi x4 x3 {test}'
    );
    // Nested/malformed description braces → single clean {notes}
    expect(rankEditor.repairExerciseLeafLine('- pike push-ups 0lb 0mi x4 x3 {tes{{t}')).toBe(
      '- pike push-ups 0lb 0mi x4 x3 {test}'
    );
    expect(rankEditor.repairExerciseLeafLine('- pike push-ups 0lb 0mi x4 x3 {tes{{t')).toBe(
      '- pike push-ups 0lb 0mi x4 x3 {test}'
    );

    const broken = [
      'BRONZE I:',
      '{badges/bronze-i.svg}',
      '--------------',
      'ARMS:',
      '\tSTRENGTH:',
      '\t\tPUSH:',
      '\t\t\t- pike push-ups 0lb 0mi {x3}',
      '\t\t\t- elbow-to-hand-ups 0lb 0mi x6 {x3}',
      '\t\tPULL:',
      '\t\t\t- heavy bookbag curls 10lb 0mi x10 {x1}',
      '\t\t\t- bed-lifts 0lb 0mi x5 {x3}',
      '\t\t\t- pull-ups 0lb 0mi x2 {x3}',
      '\tENDURANCE:',
      '\t\tPUSH:',
      '\t\t\t- plank-hold 0m 20s x1 x3 extended arms}}',
      '\t\t\t- low-push hold 0lb 0mi 10s x1 {x3}',
      '',
    ].join('\n');
    const fixed = rankEditor.fixSyntax(broken);
    expect(fixed.text).toContain('- pike push-ups 0lb 0mi x3 x1');
    expect(fixed.text).toContain('- elbow-to-hand-ups 0lb 0mi x6 x3');
    expect(fixed.text).toContain('- heavy bookbag curls 10lb 0mi x10 x1');
    expect(fixed.text).toContain('- bed-lifts 0lb 0mi x5 x3');
    expect(fixed.text).toContain('- pull-ups 0lb 0mi x2 x3');
    expect(fixed.text).toContain('- plank-hold 0lb 0mi 20s x1 x3 {extended arms}');
    expect(fixed.text).toContain('- low-push hold 0lb 0mi 10s x1 x3');
  });

  it('Fix syntax errors leaves valid ranks structure alone', () => {
    const valid = [
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
      'CORE:',
      '\tSTRENGTH:',
      '\t\t- crunches x10 x3',
      '',
      'BRONZE II:',
      '{badges/bronze-ii.svg}',
      '--------------',
      'ARMS:',
      '\tSTRENGTH:',
      '\t\tPUSH:',
      '\t\t\t- push-ups x12 x3',
      '',
    ].join('\n');
    const once = rankEditor.fixSyntax(valid);
    expect(once.text).not.toMatch(/CORE:\s*\{badges\//);
    expect(once.text).toContain('CORE:');
    expect(once.text).toContain('{badges/bronze-i.svg}');
    const twice = rankEditor.fixSyntax(once.text);
    expect(twice.text).toBe(once.text);
  });

  it('Restore to defaults loads bundled ladder', () => {
    const text = rankEditor.defaultRanksText();
    expect(text).toContain('SILVER I:');
    const parsed = rankEditor.parseDraft(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.columns.some((c) => c.tierName === 'SILVER I')).toBe(true);
  });

  it('Drop PNG copies into badges', () => {
    const src = path.join(tempRoot, 'my-badge.png');
    fs.writeFileSync(src, Buffer.from([137, 80, 78, 71, 0, 0, 0, 0]));
    const result = rankEditor.importDroppedBadge(src);
    expect(result.ok).toBe(true);
    expect(result.data.relativePath).toMatch(/^badges\/my-badge\.png$/);
    expect(fs.existsSync(result.data.absolutePath)).toBe(true);
  });

  it('Custom import copies into badges/custom', () => {
    const src = path.join(tempRoot, 'custom-mark.png');
    fs.writeFileSync(src, Buffer.from([137, 80, 78, 71, 0, 0, 0, 0]));
    const result = rankEditor.importDroppedBadge(src, { custom: true });
    expect(result.ok).toBe(true);
    expect(result.data.relativePath).toMatch(/^badges\/custom\/custom-mark\.png$/);
    expect(fs.existsSync(result.data.absolutePath)).toBe(true);
  });

  it('Import reuses path when file is already under badges/', () => {
    const existing = path.join(dataDir, 'badges', 'bronze-i.svg');
    fs.writeFileSync(existing, '<svg></svg>', 'utf8');
    const result = rankEditor.importDroppedBadge(existing, { custom: true });
    expect(result.ok).toBe(true);
    expect(result.data.reused).toBe(true);
    expect(result.data.relativePath).toBe('badges/bronze-i.svg');
  });
});
