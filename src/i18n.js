/**
 * Feature 16 - Localization & Language Support
 * Spec: features/feature-16-Localization.md
 *
 * App text lives in plaintext files under data/localization/[tag]/:
 *   language.txt - the language's own name, its English name, and text direction (ltr | rtl)
 *   ui-*.txt     - `key: text` lines; {name} placeholders; plural forms end in .zero/.one/.two/.few/.many/.other
 * Every folder with a language.txt is offered in Config. A key missing from a language falls back to English.
 * File text (exercise names, headers, notes, tier names) is never translated here (FR-006).
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_LANGUAGE = 'en';
const BUNDLED_ROOT = path.join(__dirname, '..', 'data', 'localization');
const LANGUAGE_FILE = 'language.txt';
const STRINGS_FILE_RE = /^ui-[A-Za-z0-9_-]+\.txt$/;
const KEY_RE = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/** Shipped languages in Config order (FR-001); folders added later follow, sorted by tag. */
const SHIPPED_ORDER = ['en', 'zh-Hans', 'hi', 'es', 'ar', 'fr', 'de', 'pt', 'ru', 'ja'];

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ENGLISH_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let rootOverride = null;
let current = DEFAULT_LANGUAGE;
let languageCache = null;
const stringCache = new Map();

function localizationRoot() {
  if (rootOverride) return rootOverride;
  try {
    const paths = require('./paths');
    if (typeof paths.localizationDir === 'function') {
      const dir = paths.localizationDir();
      if (dir && fs.existsSync(path.join(dir, DEFAULT_LANGUAGE, LANGUAGE_FILE))) return dir;
    }
  } catch (_) {
    /* bundled folder below */
  }
  return BUNDLED_ROOT;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescapeValue(value) {
  return value.replace(/\\(n|\\)/g, (_, c) => (c === 'n' ? '\n' : '\\'));
}

function contentLines(text) {
  return String(text == null ? '' : text)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/** Parse a ui-*.txt file into a Map of key -> text. Malformed lines are skipped. */
function parseStringsText(text) {
  const out = new Map();
  for (const line of contentLines(text)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!KEY_RE.test(key)) continue;
    out.set(key, unescapeValue(line.slice(idx + 1).trim()));
  }
  return out;
}

/** Parse language.txt -> { name, englishName, dir }. */
function parseLanguageText(text) {
  const fields = {};
  for (const line of contentLines(text)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    fields[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return {
    name: fields.name || '',
    englishName: fields['english name'] || '',
    dir: String(fields.direction || '').toLowerCase() === 'rtl' ? 'rtl' : 'ltr',
  };
}

function compareLanguages(a, b) {
  const ia = SHIPPED_ORDER.indexOf(a.tag);
  const ib = SHIPPED_ORDER.indexOf(b.tag);
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  return a.tag.localeCompare(b.tag);
}

/** Languages offered in Config: [{ tag, name, englishName, dir }]. */
function listLanguages() {
  if (!languageCache) {
    const root = localizationRoot();
    const found = [];
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch (_) {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      let text;
      try {
        text = fs.readFileSync(path.join(root, entry.name, LANGUAGE_FILE), 'utf8');
      } catch (_) {
        continue;
      }
      const meta = parseLanguageText(text);
      found.push({
        tag: entry.name,
        name: meta.name || entry.name,
        englishName: meta.englishName || meta.name || entry.name,
        dir: meta.dir,
      });
    }
    if (!found.some((l) => l.tag === DEFAULT_LANGUAGE)) {
      found.push({ tag: DEFAULT_LANGUAGE, name: 'English', englishName: 'English', dir: 'ltr' });
    }
    found.sort(compareLanguages);
    languageCache = found;
  }
  return languageCache.map((l) => ({ ...l }));
}

/** Canonical folder tag for `raw` (case-insensitive); unknown or empty -> `en` (FR-002). */
function resolveLanguageTag(raw) {
  const wanted = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase();
  if (!wanted) return DEFAULT_LANGUAGE;
  const match = listLanguages().find((l) => l.tag.toLowerCase() === wanted);
  return match ? match.tag : DEFAULT_LANGUAGE;
}

function loadStrings(tag) {
  if (stringCache.has(tag)) return stringCache.get(tag);
  const merged = new Map();
  const dir = path.join(localizationRoot(), tag);
  let files = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => STRINGS_FILE_RE.test(f))
      .sort();
  } catch (_) {
    files = [];
  }
  for (const file of files) {
    try {
      for (const [k, v] of parseStringsText(fs.readFileSync(path.join(dir, file), 'utf8'))) {
        merged.set(k, v);
      }
    } catch (_) {
      /* unreadable file -> its keys fall back to English */
    }
  }
  stringCache.set(tag, merged);
  return merged;
}

function lookupIn(tag, key) {
  const v = loadStrings(tag).get(key);
  return v == null || v === '' ? null : v;
}

function lookup(key) {
  if (current !== DEFAULT_LANGUAGE) {
    const own = lookupIn(current, key);
    if (own != null) return own;
  }
  return lookupIn(DEFAULT_LANGUAGE, key);
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(params, name) && params[name] != null ? String(params[name]) : whole
  );
}

/** Translate `key` with {name} placeholders filled from `params` (plain text, not escaped). */
function t(key, params) {
  const text = lookup(key);
  if (text == null) return key;
  return interpolate(text, params);
}

function intlLocale(tag = current) {
  return `${tag}-u-nu-latn`;
}

function pluralCategory(tag, count) {
  try {
    return new Intl.PluralRules(intlLocale(tag)).select(Number(count));
  } catch (_) {
    return Number(count) === 1 ? 'one' : 'other';
  }
}

function pluralIn(tag, key, count) {
  return lookupIn(tag, `${key}.${pluralCategory(tag, count)}`) || lookupIn(tag, `${key}.other`);
}

/** Plural form of `key` for `count` (`{count}` is filled in automatically). */
function tn(key, count, params) {
  const all = { count, ...(params || {}) };
  let text = current !== DEFAULT_LANGUAGE ? pluralIn(current, key, count) : null;
  if (!text) text = pluralIn(DEFAULT_LANGUAGE, key, count);
  if (!text) return t(key, all);
  return interpolate(text, all);
}

/** `t()` escaped for innerHTML / attribute values. */
function th(key, params) {
  return escapeHtml(t(key, params));
}

/** `tn()` escaped for innerHTML / attribute values. */
function thn(key, count, params) {
  return escapeHtml(tn(key, count, params));
}

const METRIC_LABEL_KEYS = {
  weight: 'metric.weight',
  distance: 'metric.distance',
  reps: 'metric.reps',
  sets: 'metric.sets',
  durationSeconds: 'metric.durationSeconds',
  durationGoSeconds: 'metric.durationGoSeconds',
  durationRestSeconds: 'metric.durationRestSeconds',
  durationSteps: 'metric.durationSteps',
};

const FIELD_LABEL_KEYS = {
  weight: 'field.weight',
  distance: 'field.distance',
  reps: 'field.reps',
  sets: 'field.sets',
  durationSeconds: 'field.durationSeconds',
  durationGoSeconds: 'field.durationGoSeconds',
  durationRestSeconds: 'field.durationRestSeconds',
  durationSteps: 'field.durationSteps',
};

const MUSCLE_LABEL_KEYS = {
  arms: 'muscle.arms',
  core: 'muscle.core',
  lungs: 'muscle.lungs',
  legs: 'muscle.legs',
};

const WEEKDAY_CHIP_KEYS = {
  mon: 'weekday.mon',
  tue: 'weekday.tue',
  wed: 'weekday.wed',
  thu: 'weekday.thu',
  fri: 'weekday.fri',
  sat: 'weekday.sat',
  sun: 'weekday.sun',
};

const CAL_WEEKDAY_KEYS = {
  mon: 'cal.weekday.mon',
  tue: 'cal.weekday.tue',
  wed: 'cal.weekday.wed',
  thu: 'cal.weekday.thu',
  fri: 'cal.weekday.fri',
  sat: 'cal.weekday.sat',
  sun: 'cal.weekday.sun',
};

const TIP_KEYS = {
  welcome: 'tip.welcome',
  breaks: 'tip.breaks',
  hydration: 'tip.hydration',
  sleep: 'tip.sleep',
  food: 'tip.food',
};

/** Field label for a metric key ("Weight", "Reps", …); unknown keys come back unchanged. */
function metricLabel(metricKey) {
  const key = METRIC_LABEL_KEYS[metricKey];
  return key ? t(key) : String(metricKey);
}

/** Metric name inside validation messages ({field} in validation.required / validation.invalid). */
function fieldLabel(metricKey) {
  const key = FIELD_LABEL_KEYS[metricKey];
  return key ? t(key) : String(metricKey);
}

function requiredMessage(metricKey) {
  return t('validation.required', { field: fieldLabel(metricKey) });
}

function invalidMessage(metricKey) {
  return t('validation.invalid', { field: fieldLabel(metricKey) });
}

function muscleLabel(groupKey) {
  const key = MUSCLE_LABEL_KEYS[groupKey];
  return key ? t(key) : String(groupKey);
}

function weekdayChip(dayKey) {
  const key = WEEKDAY_CHIP_KEYS[dayKey];
  return key ? t(key) : String(dayKey);
}

function calendarWeekday(dayKey) {
  const key = CAL_WEEKDAY_KEYS[dayKey];
  return key ? t(key) : String(dayKey);
}

/** Escaped text with `htmlParams` inserted as-is - callers pass already-safe HTML. */
function tHtml(key, htmlParams) {
  const text = lookup(key);
  if (text == null) return escapeHtml(key);
  return interpolate(escapeHtml(text), htmlParams);
}

function getLanguage() {
  return current;
}

function getLanguageInfo(tag = current) {
  return (
    listLanguages().find((l) => l.tag === tag) || {
      tag: DEFAULT_LANGUAGE,
      name: 'English',
      englishName: 'English',
      dir: 'ltr',
    }
  );
}

function getDir() {
  return getLanguageInfo().dir === 'rtl' ? 'rtl' : 'ltr';
}

/** Switch the running UI language (unknown -> `en`). Persisting is Config's job (`language:` key). */
function setLanguage(tag) {
  const next = resolveLanguageTag(tag);
  if (next !== current) {
    current = next;
    try {
      require('./ranks').clearRanksCache();
    } catch (_) {
      /* ranks optional during early load */
    }
    try {
      require('./catalog').clearCatalogCache();
    } catch (_) {
      /* catalog optional during early load */
    }
  } else {
    current = next;
  }
  return current;
}

/** Adopt the `language` setting from config.txt. */
function init() {
  let tag = DEFAULT_LANGUAGE;
  try {
    tag = require('./config').get().language;
  } catch (_) {
    tag = DEFAULT_LANGUAGE;
  }
  return setLanguage(tag);
}

/** `<html lang dir>` for the active language (FR-009). */
function applyToDocument(doc) {
  if (!doc || !doc.documentElement) return;
  doc.documentElement.setAttribute('lang', current);
  doc.documentElement.setAttribute('dir', getDir());
}

/** Drop cached files so edited or newly added language folders are read again. */
function reload() {
  languageCache = null;
  stringCache.clear();
}

/** Read language files from `dir` instead (tests); null restores the default location. */
function setLocalizationRoot(dir) {
  rootOverride = dir || null;
  reload();
}

/** Absolute path of a file inside the active language folder (e.g. format.txt), or null when absent. */
function languageFilePath(fileName, tag = current) {
  const file = path.join(localizationRoot(), tag, fileName);
  return fs.existsSync(file) ? file : null;
}

/** Leading `#` comment block of a language folder file (e.g. config.default), newline-terminated; null when absent. */
function languageFileHeader(fileName, tag = current) {
  const file = languageFilePath(fileName, tag);
  if (!file) return null;
  try {
    const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
    const header = [];
    for (const line of lines) {
      if (!line.startsWith('#')) break;
      header.push(line);
    }
    return header.length ? `${header.join('\n')}\n` : null;
  } catch (_) {
    return null;
  }
}

function intlFormat(date, options) {
  try {
    return new Intl.DateTimeFormat(intlLocale(), options).format(date);
  } catch (_) {
    return new Intl.DateTimeFormat('en', options).format(date);
  }
}

function toDateParts(isoOrDate) {
  if (typeof isoOrDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(isoOrDate)) {
    return {
      y: parseInt(isoOrDate.slice(0, 4), 10),
      m: parseInt(isoOrDate.slice(5, 7), 10),
      d: parseInt(isoOrDate.slice(8, 10), 10),
    };
  }
  const dt = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

/** Long display date for `YYYY-MM-DD` or a Date: "October 17, 2026" / "17 octobre 2026" (FR-011). */
function formatDate(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return '';
  const parts = toDateParts(isoOrDate);
  if (!parts || !parts.y || !parts.m || !parts.d || parts.m < 1 || parts.m > 12) return String(isoOrDate);
  if (current === DEFAULT_LANGUAGE) return `${ENGLISH_MONTHS[parts.m - 1]} ${parts.d}, ${parts.y}`;
  return intlFormat(new Date(parts.y, parts.m - 1, parts.d), { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Month heading: "October 2026" / "octobre 2026" (`month` is 1-12). */
function formatMonthYear(year, month) {
  if (current === DEFAULT_LANGUAGE) return `${ENGLISH_MONTHS[month - 1]} ${year}`;
  return intlFormat(new Date(year, month - 1, 15), { year: 'numeric', month: 'long' });
}

/** Month name (`month` is 1-12); style 'long' | 'short'. */
function monthName(month, style = 'long') {
  if (current === DEFAULT_LANGUAGE) {
    const name = ENGLISH_MONTHS[month - 1] || '';
    return style === 'short' ? name.slice(0, 3) : name;
  }
  return intlFormat(new Date(2024, month - 1, 15), { month: style });
}

/** Weekday name (`day` 0 = Sunday … 6 = Saturday); style 'long' | 'short' | 'narrow'. */
function weekdayName(day, style = 'short') {
  if (current === DEFAULT_LANGUAGE) {
    const name = ENGLISH_WEEKDAYS[day] || '';
    if (style === 'short') return name.slice(0, 3);
    if (style === 'narrow') return name.slice(0, 1);
    return name;
  }
  // 2023-01-01 was a Sunday.
  return intlFormat(new Date(2023, 0, 1 + day), { weekday: style });
}

module.exports = {
  DEFAULT_LANGUAGE,
  PLURAL_SUFFIXES,
  init,
  setLanguage,
  getLanguage,
  getLanguageInfo,
  getDir,
  listLanguages,
  resolveLanguageTag,
  applyToDocument,
  t,
  tn,
  th,
  thn,
  tHtml,
  metricLabel,
  fieldLabel,
  requiredMessage,
  invalidMessage,
  muscleLabel,
  weekdayChip,
  calendarWeekday,
  formatDate,
  formatMonthYear,
  monthName,
  weekdayName,
  languageFilePath,
  languageFileHeader,
  parseStringsText,
  parseLanguageText,
  reload,
  setLocalizationRoot,
};
