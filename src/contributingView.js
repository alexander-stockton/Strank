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

/** Fallback when `AI use` is missing from the project root (tests / packaging). */
const AI_USE_FALLBACK = `The vast majority of this project was coded by various different AI agents. No creative decisions were made on their end. Pieces of this project directly created by me include:

FILES:

- English ranks.txt
- config.txt
- landing-config.txt
- icon.png (the app icon)

ASSETS:

- defaults folder
- quote attributions
- English text for buttons, headers, notices, pages, etc

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
`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadAiUseText() {
  try {
    const filePath = path.join(paths.getProjectRoot(), 'AI use');
    if (fs.existsSync(filePath)) {
      const text = fs.readFileSync(filePath, 'utf8');
      if (String(text).trim()) return String(text).replace(/\r\n/g, '\n').trimEnd() + '\n';
    }
  } catch (_) {
    /* fall through */
  }
  return AI_USE_FALLBACK;
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
