/**
 * Feature 17 — Contributing notice (+ AI use credits)
 * Spec: features/feature-17-Contributing.md
 */

const fs = require('fs');
const path = require('path');
const contentReveal = require('./contentReveal');
const i18n = require('./i18n');
const paths = require('./paths');

const REPO_URL = 'https://github.com/alexander-stockton/Strank';
const MAINTAINER_EMAIL = 'colo.anon.net@keemail.me';

/** Fallback when localization + root `AI use` are missing (tests). Keep in sync with `/AI use`. */
const AI_USE_FALLBACK = `The vast majority of this project was coded by various different AI agents. No creative decisions were made on their end. Pieces of this project directly created by me include:

All translations are AI generated. If the translation is off, feel free to open an issue with the correct translation.

FILES:

- English ranks.txt
- config.txt
- landing-config.txt
- icon.png (the app icon)

ASSETS:

- defaults folder
- quote attributions
- English text for buttons, headers, notices, pages, etc
- Tooltip text
- Basically all the English text in the default UI

CREATIVE ELEMENTS:

- decisions on
  - how to organize pages and navigation
  - which config options to implement
  - which languages to include for generated localization
  - where UI elements sat, how they looked, how they functioned, how big they were, etc
  - measurement types, conversions, and rounding
  - basic modding support
- badge design drafts (which were subsequently converted directly to animated svg's by AI)
- animation descriptions
- application name, description, etc

TECHNICAL DIRECTION:

- default colors
- repository management
- supported filetypes
- early Q/A testing
- early distribution
- early community management
- framework and library selection
- offline emphasis and installer

With that out of the way, come join our discord community at:
https://discord.gg/TxzjhXxBb6
`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeAiUseText(text) {
  return `${String(text).replace(/\r\n/g, '\n').replace(/\s+$/g, '')}\n`;
}

/** Root `AI use` file (English source of truth; also shipped in packaged builds). */
function readAiUseFile() {
  try {
    const filePath = path.join(paths.getProjectRoot(), 'AI use');
    if (!fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, 'utf8');
    if (!String(text).trim()) return null;
    return normalizeAiUseText(text);
  } catch (_) {
    return null;
  }
}

/**
 * Localized AI use notice.
 * - Non-English: `contributing.aiUseBody` from the active language (falls back to English UI text).
 * - English: prefer the root `AI use` file when present so packaged builds match the repo notice.
 */
function loadAiUseText() {
  const lang =
    typeof i18n.resolveLanguageTag === 'function'
      ? i18n.resolveLanguageTag(i18n.getLanguage())
      : i18n.getLanguage();

  if (lang === 'en') {
    const fromFile = readAiUseFile();
    if (fromFile) return fromFile;
  }

  const translated = i18n.t('contributing.aiUseBody');
  if (translated && translated !== 'contributing.aiUseBody') {
    return normalizeAiUseText(translated);
  }

  const fromFile = readAiUseFile();
  if (fromFile) return fromFile;
  return normalizeAiUseText(AI_USE_FALLBACK);
}

function contributingBodyHtml() {
  return `<div class="contributing-copy" data-contributing-copy>
      <p class="contributing-line">${escapeHtml(i18n.t('contributing.lead'))}</p>
      <p class="contributing-line">${escapeHtml(i18n.t('contributing.issueLine'))}</p>
      <p class="contributing-line contributing-contact"><code data-contributing-repo>${escapeHtml(REPO_URL)}</code></p>
      <p class="contributing-line">${escapeHtml(i18n.t('contributing.emailLine'))}</p>
      <p class="contributing-line contributing-contact"><code data-contributing-email>${escapeHtml(MAINTAINER_EMAIL)}</code></p>
      <p class="contributing-line">${escapeHtml(i18n.t('contributing.forkLine'))}</p>
    </div>`;
}

function contributingNoticeHtml() {
  const aiText = loadAiUseText();
  return `<section class="panel onboarding-privacy contributing-notice" data-view="contributing-notice" data-content-reveal-frame>
    <div class="contributing-scroll" data-contributing-scroll data-content-reveal-item>
      <article class="contributing-section-card" data-contributing-card="contributing">
        <h1 class="contributing-section-title">${escapeHtml(i18n.t('contributing.title'))}</h1>
        <div class="contributing-inner-card">
          ${contributingBodyHtml()}
        </div>
      </article>
      <article class="contributing-section-card" data-contributing-card="ai-use">
        <h1 class="contributing-section-title">${escapeHtml(i18n.t('contributing.aiUseTitle'))}</h1>
        <div class="contributing-inner-card">
          <pre class="contributing-ai-body" data-ai-use-body>${escapeHtml(aiText)}</pre>
        </div>
      </article>
    </div>
    <div class="contributing-footer" data-contributing-footer>
      <button type="button" class="primary outline" data-action="contributing-back" data-content-reveal-item>${escapeHtml(
        i18n.t('common.back')
      )}</button>
    </div>
  </section>`;
}

/**
 * Standalone Contributing notice. Back returns via options.onBack (prior hash).
 * @param {HTMLElement} root
 * @param {{ onBack?: () => void }} [options]
 */
function mountContributingNoticeView(root, options = {}) {
  function bindBack() {
    const back = root.querySelector('[data-action="contributing-back"]');
    if (back) {
      back.addEventListener('click', () => {
        if (typeof options.onBack === 'function') options.onBack();
      });
    }
  }

  root.innerHTML = contributingNoticeHtml();
  contentReveal.play(root);
  bindBack();

  return {
    destroy() {
      root.innerHTML = '';
    },
    refresh() {
      root.innerHTML = contributingNoticeHtml();
      contentReveal.play(root);
      bindBack();
    },
    getRoot: () => root,
  };
}

module.exports = {
  mountContributingNoticeView,
  contributingNoticeHtml,
  loadAiUseText,
  REPO_URL,
  MAINTAINER_EMAIL,
  AI_USE_FALLBACK,
};
