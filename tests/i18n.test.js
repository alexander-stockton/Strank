/**
 * Feature 16 - Localization & Language Support
 * Spec: features/feature-16-Localization.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const LOCALIZATION_DIR = path.join(PROJECT_ROOT, 'data', 'localization');
const SHIPPED = ['en', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'de', 'pt', 'ru', 'ja'];
const PLURAL_SUFFIXES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const FILE_LIKE = /\.(txt|json|default|dat|js|css|html|md|svg|png|jpe?g|webp|gif)$/i;

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function englishCatalog() {
  const i18n = require('../src/i18n');
  const merged = new Map();
  const dir = path.join(LOCALIZATION_DIR, 'en');
  for (const file of fs.readdirSync(dir).filter((f) => /^ui-.+\.txt$/.test(f))) {
    for (const [k, v] of i18n.parseStringsText(fs.readFileSync(path.join(dir, file), 'utf8'))) merged.set(k, v);
  }
  return merged;
}

function pluralBase(key) {
  const parts = key.split('.');
  return parts.length > 1 && PLURAL_SUFFIXES.has(parts[parts.length - 1]) ? parts.slice(0, -1).join('.') : key;
}

function sourceCorpus() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.js')) files.push(p);
    }
  };
  walk(path.join(PROJECT_ROOT, 'src'));
  files.push(path.join(PROJECT_ROOT, 'index.html'));
  return files.map((f) => ({ file: path.relative(PROJECT_ROOT, f), text: fs.readFileSync(f, 'utf8') }));
}

describe('Feature 16 - i18n runtime', () => {
  let i18n;

  beforeEach(() => {
    jest.resetModules();
    i18n = require('../src/i18n');
  });

  test('parses key: text lines, comments, escapes, and skips malformed lines', () => {
    const map = i18n.parseStringsText(
      ['\uFEFF# comment', '', 'a.b: Hello {name}', 'multi: one\\ntwo', 'no colon here', 'bad key: x', '  spaced.key :  trimmed  '].join(
        '\r\n'
      )
    );
    expect(map.get('a.b')).toBe('Hello {name}');
    expect(map.get('multi')).toBe('one\ntwo');
    expect(map.get('spaced.key')).toBe('trimmed');
    expect(map.has('bad key')).toBe(false);
    expect(map.size).toBe(3);
  });

  test('Each supported language loads (US-16.2)', () => {
    const languages = i18n.listLanguages();
    expect(languages.map((l) => l.tag)).toEqual(SHIPPED);
    const names = Object.fromEntries(languages.map((l) => [l.tag, l.name]));
    expect(names).toMatchObject({
      en: 'English',
      'zh-Hans': '简体中文',
      hi: 'हिन्दी',
      es: 'Español',
      ar: 'العربية',
      fr: 'Français',
      de: 'Deutsch',
      pt: 'Português',
      ru: 'Русский',
      ja: '日本語',
    });
    for (const tag of SHIPPED) {
      expect(i18n.setLanguage(tag)).toBe(tag);
      const label = i18n.t('nav.landing');
      expect(label).not.toBe('nav.landing');
      expect(label.trim()).not.toBe('');
    }
  });

  test('unknown or empty language tags coerce to English; tags match case-insensitively', () => {
    expect(i18n.resolveLanguageTag('xx')).toBe('en');
    expect(i18n.resolveLanguageTag('')).toBe('en');
    expect(i18n.resolveLanguageTag(null)).toBe('en');
    expect(i18n.resolveLanguageTag('ZH-hans')).toBe('zh-Hans');
    expect(i18n.setLanguage('klingon')).toBe('en');
  });

  test('Arabic is right-to-left; every other shipped language is left-to-right', () => {
    for (const tag of SHIPPED) {
      i18n.setLanguage(tag);
      expect(i18n.getDir()).toBe(tag === 'ar' ? 'rtl' : 'ltr');
    }
  });

  describe('with a temporary localization folder', () => {
    let tempRoot;

    beforeEach(() => {
      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f16-i18n-'));
      writeFile(path.join(tempRoot, 'en', 'language.txt'), 'name: English\nenglish name: English\ndirection: ltr\n');
      writeFile(
        path.join(tempRoot, 'en', 'ui-a.txt'),
        [
          'greet: Hello {name}',
          'only.en: English only',
          'blank: English text',
          'items.one: {count} item',
          'items.other: {count} items',
        ].join('\n')
      );
      writeFile(path.join(tempRoot, 'en', 'ui-b.txt'), 'second.file: From file b\n');
      writeFile(path.join(tempRoot, 'ru', 'language.txt'), 'name: Русский\nenglish name: Russian\ndirection: ltr\n');
      writeFile(
        path.join(tempRoot, 'ru', 'ui-a.txt'),
        [
          'greet: Привет, {name}',
          'blank:',
          'items.one: {count} предмет',
          'items.few: {count} предмета',
          'items.many: {count} предметов',
          'items.other: {count} предмета',
        ].join('\n')
      );
      writeFile(path.join(tempRoot, 'zz', 'language.txt'), 'name: Zedish\ndirection: rtl\n');
      writeFile(path.join(tempRoot, 'notes', 'readme.txt'), 'not a language folder\n');
      i18n.setLocalizationRoot(tempRoot);
    });

    afterEach(() => {
      i18n.setLocalizationRoot(null);
      fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('discovers any folder with a language.txt (modder languages sort after shipped ones)', () => {
      expect(i18n.listLanguages()).toEqual([
        { tag: 'en', name: 'English', englishName: 'English', dir: 'ltr' },
        { tag: 'ru', name: 'Русский', englishName: 'Russian', dir: 'ltr' },
        { tag: 'zz', name: 'Zedish', englishName: 'Zedish', dir: 'rtl' },
      ]);
    });

    test('merges every ui-*.txt file in the folder', () => {
      expect(i18n.t('second.file')).toBe('From file b');
    });

    test('Missing key falls back to English (FR-007)', () => {
      i18n.setLanguage('ru');
      expect(i18n.t('greet', { name: 'Аня' })).toBe('Привет, Аня');
      expect(i18n.t('only.en')).toBe('English only');
      expect(i18n.t('blank')).toBe('English text');
      expect(i18n.t('second.file')).toBe('From file b');
      expect(i18n.t('no.such.key')).toBe('no.such.key');
    });

    test('interpolates {placeholders} and leaves unknown ones intact (FR-008)', () => {
      expect(i18n.t('greet', { name: 'Ana' })).toBe('Hello Ana');
      expect(i18n.t('greet')).toBe('Hello {name}');
      expect(i18n.th('greet', { name: '<b>&' })).toBe('Hello &lt;b&gt;&amp;');
      expect(i18n.tHtml('greet', { name: '<b>Ana</b>' })).toBe('Hello <b>Ana</b>');
    });

    test('plural forms follow each language’s rules, falling back to .other and then English', () => {
      expect(i18n.tn('items', 1)).toBe('1 item');
      expect(i18n.tn('items', 0)).toBe('0 items');
      expect(i18n.tn('items', 5)).toBe('5 items');
      i18n.setLanguage('ru');
      expect(i18n.tn('items', 1)).toBe('1 предмет');
      expect(i18n.tn('items', 3)).toBe('3 предмета');
      expect(i18n.tn('items', 5)).toBe('5 предметов');
      expect(i18n.tn('items', 21)).toBe('21 предмет');
      i18n.setLanguage('zz');
      expect(i18n.tn('items', 2)).toBe('2 items');
    });

    test('reload() picks up edited files', () => {
      expect(i18n.t('greet', { name: 'A' })).toBe('Hello A');
      writeFile(path.join(tempRoot, 'en', 'ui-a.txt'), 'greet: Hi {name}\n');
      expect(i18n.t('greet', { name: 'A' })).toBe('Hello A');
      i18n.reload();
      expect(i18n.t('greet', { name: 'A' })).toBe('Hi A');
    });
  });

  test('formats dates, months, and weekdays for the active language (FR-011)', () => {
    expect(i18n.formatDate('2026-10-17')).toBe('October 17, 2026');
    expect(i18n.formatDate('')).toBe('');
    expect(i18n.formatDate('not a date')).toBe('not a date');
    expect(i18n.formatMonthYear(2026, 10)).toBe('October 2026');
    expect(i18n.monthName(2, 'short')).toBe('Feb');
    expect(i18n.weekdayName(0)).toBe('Sun');
    expect(i18n.weekdayName(1, 'long')).toBe('Monday');
    i18n.setLanguage('fr');
    expect(i18n.formatDate('2026-10-17')).toBe('17 octobre 2026');
    expect(i18n.formatMonthYear(2026, 10)).toBe('octobre 2026');
    expect(i18n.weekdayName(1, 'long')).toBe('lundi');
    i18n.setLanguage('ja');
    expect(i18n.formatDate('2026-10-17')).toBe('2026年10月17日');
    i18n.setLanguage('ar');
    expect(i18n.formatDate('2026-10-17')).toMatch(/17/);
  });

  test('metric labels come from the catalog and unknown metric keys pass through', () => {
    expect(i18n.metricLabel('reps')).toBe('Reps');
    expect(i18n.fieldLabel('reps')).toBe('reps');
    expect(i18n.fieldLabel('durationSeconds')).toBe('duration');
    expect(i18n.metricLabel('mystery')).toBe('mystery');
  });

  test('Exercise names stay untranslated (FR-006)', () => {
    i18n.setLanguage('ja');
    expect(i18n.t('nav.landing')).toBe('ホーム');
    expect(i18n.t('pull-ups')).toBe('pull-ups');
    expect(i18n.t('BRONZE I')).toBe('BRONZE I');
  });

  test('switching language loads that folder’s ranks.txt', () => {
    const ranks = require('../src/ranks');
    const paths = require('../src/paths');
    const { slugifyExerciseName } = require('../src/parse/metrics');

    i18n.setLanguage('en');
    expect(paths.ranksTxtPath().replace(/\\/g, '/')).toMatch(/localization\/en\/ranks\.txt$/);
    let loaded = ranks.loadRanks();
    expect(loaded.ok).toBe(true);
    expect(loaded.data[0].name).toBe('UNRANKED');
    expect(loaded.data.some((t) => t.name === 'BRONZE I')).toBe(true);

    i18n.setLanguage('ja');
    expect(paths.ranksTxtPath().replace(/\\/g, '/')).toMatch(/localization\/ja\/ranks\.txt$/);
    expect(paths.formatTxtPath().replace(/\\/g, '/')).toMatch(/localization\/ja\/format\.txt$/);
    loaded = ranks.loadRanks();
    expect(loaded.ok).toBe(true);
    expect(loaded.data[0].name).toBe('ランクなし');
    expect(ranks.isUnrankedName(loaded.data[0].name)).toBe(true);
    expect(loaded.data.some((t) => t.name === 'ブロンズ I')).toBe(true);
    const pike = (loaded.data.find((t) => t.name === 'ブロンズ I').exercises || []).find((e) =>
      String(e.name).includes('パイク')
    );
    expect(pike).toBeTruthy();
    expect(pike.exerciseId).toBe(slugifyExerciseName(pike.name));
    expect(pike.exerciseId.length).toBeGreaterThan(0);
  });
});

describe('Feature 16 - language setting in config.txt', () => {
  let tempRoot;
  let dataDir;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f16-config-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));
  });

  afterEach(() => {
    jest.dontMock('../src/paths');
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('Language persists in config (US-16.1)', () => {
    const config = require('../src/config');
    const i18n = require('../src/i18n');
    config.load();
    expect(config.get().language).toBe('en');

    config.set('language', 'es');
    const text = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
    expect(text).toMatch(/^language: es$/m);

    // Relaunch: fresh modules read the saved file.
    jest.resetModules();
    const config2 = require('../src/config');
    const i18n2 = require('../src/i18n');
    config2.load();
    expect(config2.get().language).toBe('es');
    expect(i18n2.init()).toBe('es');
    expect(i18n2.getLanguage()).toBe('es');
    expect(i18n.getLanguage()).toBe('en');
  });

  test('omitted or unknown language -> en without resetting other settings (FR-002)', () => {
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'language: tlh\nnavbar alignment: top\n', 'utf8');
    const config = require('../src/config');
    const result = config.load();
    expect(result.resetToDefaults).toBeUndefined();
    expect(config.get().language).toBe('en');
    expect(config.get()['navbar alignment']).toBe('top');
  });

  test('config.txt comment header follows the saved language; keys stay English', () => {
    const config = require('../src/config');
    config.load();
    config.set('language', 'fr');
    const fr = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
    expect(fr).toMatch(/^# Valeurs possibles :$/m);
    expect(fr).toMatch(/^font size: 16$/m);
    config.set('language', 'en');
    const en = fs.readFileSync(path.join(dataDir, 'config.txt'), 'utf8');
    expect(en).toMatch(/^# Possible values:$/m);
    expect(en).toMatch(/^#   language: en, zh-Hans, hi, es, ar, fr, de, pt, ru, ja$/m);
  });

  test('landing-config.txt comment header follows the active language', () => {
    const i18n = require('../src/i18n');
    const landingConfig = require('../src/landingConfig');
    landingConfig.load();
    i18n.setLanguage('de');
    landingConfig.set('focus arms days', 'mon');
    const text = fs.readFileSync(path.join(dataDir, 'landing-config.txt'), 'utf8');
    expect(text).toMatch(/^# Mögliche Werte:$/m);
    expect(text).toMatch(/^focus arms days: mon$/m);
  });
});

describe('Feature 16 - English catalog matches the code', () => {
  const corpus = sourceCorpus();
  const english = englishCatalog();
  const namespaces = new Set([...english.keys()].map((k) => k.split('.')[0]));
  const bases = new Set([...english.keys()].map(pluralBase));

  test('every key the code asks for exists in data/localization/en', () => {
    const missing = [];
    const callRe = /\b(?:t|th|tn|thn|tHtml)\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g;
    const literalRe = /['"`]([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)+)['"`]/g;
    for (const { file, text } of corpus) {
      for (const m of text.matchAll(callRe)) {
        if (!english.has(m[1]) && !bases.has(m[1])) missing.push(`${file}: ${m[1]}`);
      }
      for (const m of text.matchAll(literalRe)) {
        const key = m[1];
        if (FILE_LIKE.test(key) || !namespaces.has(key.split('.')[0])) continue;
        if (!english.has(key) && !bases.has(key)) missing.push(`${file}: ${key}`);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  test('every English key is used somewhere (no orphaned text)', () => {
    const all = corpus.map((c) => c.text).join('\n');
    const unused = [...bases].filter(
      (base) => !all.includes(`'${base}'`) && !all.includes(`"${base}"`) && !all.includes(`\`${base}\``)
    );
    expect(unused).toEqual([]);
  });

  test('every shipped language catalog covers every English key', () => {
    const i18n = require('../src/i18n');
    const englishKeys = [...english.keys()].sort();
    const missing = [];
    for (const tag of SHIPPED.filter((t) => t !== 'en')) {
      const dir = path.join(LOCALIZATION_DIR, tag);
      const merged = new Map();
      for (const file of fs.readdirSync(dir).filter((f) => /^ui-.+\.txt$/.test(f))) {
        for (const [k, v] of i18n.parseStringsText(fs.readFileSync(path.join(dir, file), 'utf8'))) merged.set(k, v);
      }
      for (const key of englishKeys) {
        const value = merged.get(key);
        if (!value) missing.push(`${tag}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
