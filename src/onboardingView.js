/**
 * Feature 15 - App Animations (onboarding + privacy notice UI)
 * Spec: features/feature-15-App-Animations.md
 */

const onboarding = require('./onboarding');
const dayFocus = require('./dayFocus');
const backup = require('./backup');
const fileDialog = require('./fileDialog');
const contentReveal = require('./contentReveal');
const i18n = require('./i18n');

const DAY_FOCUS_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const GROUP_FOCUS_KEYS = ['arms', 'core', 'lungs', 'legs'];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDayFocusEditors(schedule) {
  const sched = schedule || dayFocus.defaults();
  return GROUP_FOCUS_KEYS.map((groupKey) => {
    const days = new Set(sched[groupKey] || []);
    const boxes = DAY_FOCUS_DAYS.map((dayKey) => {
      const checked = days.has(dayKey) ? 'checked' : '';
      return `<label class="day-focus-day">
        <input type="checkbox" data-focus-group="${escapeHtml(groupKey)}" data-focus-day="${escapeHtml(
        dayKey
      )}" ${checked} />
        <span>${escapeHtml(i18n.weekdayChip(dayKey))}</span>
      </label>`;
    }).join('');
    return `<fieldset class="day-focus-group" data-focus-section="${escapeHtml(groupKey)}">
      <legend>${escapeHtml(i18n.muscleLabel(groupKey))}</legend>
      <div class="day-focus-days">${boxes}</div>
    </fieldset>`;
  }).join('');
}

function languageOptionsHtml() {
  const selected = i18n.getLanguage();
  return i18n
    .listLanguages()
    .map((lang) => {
      const label = lang.englishName && lang.englishName !== lang.name ? `${lang.name} - ${lang.englishName}` : lang.name;
      return `<option value="${escapeHtml(lang.tag)}" lang="${escapeHtml(lang.tag)}" ${
        lang.tag === selected ? 'selected' : ''
      }>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function privacyNoticeHtml() {
  const p = onboarding.privacyPaths();
  const body = i18n.tHtml('onboarding.privacyBody', {
    userPath: `<code data-privacy-user-path>${escapeHtml(p.userDataDir)}</code>`,
    appPath: `<code data-privacy-app-path>${escapeHtml(p.applicationDataDir)}</code>`,
  });
  return `<section class="panel onboarding-privacy" data-view="privacy-notice" data-content-reveal-frame>
    <h1 data-content-reveal-item>${escapeHtml(i18n.t('onboarding.privacyTitle'))}</h1>
    <p data-privacy-copy data-content-reveal-item>${body}</p>
    <button type="button" class="primary outline" data-action="privacy-back" data-content-reveal-item>${escapeHtml(i18n.t('common.back'))}</button>
  </section>`;
}

function onboardingHtml(schedule) {
  return `<section class="panel onboarding-view" data-view="onboarding" data-content-reveal-frame>
    <h1 data-content-reveal-item>${escapeHtml(i18n.t('onboarding.welcome'))}</h1>
    <label class="field" data-content-reveal-item>
      <span>${escapeHtml(i18n.t('onboarding.language'))}:</span>
      <select data-onboarding-language aria-label="${escapeHtml(i18n.t('onboarding.language'))}">
        ${languageOptionsHtml()}
      </select>
    </label>
    <div class="onboarding-day-focus" data-onboarding-day-focus data-content-reveal-item>
      <h2>${escapeHtml(i18n.t('onboarding.dayFocus'))}</h2>
      <p class="muted">${escapeHtml(i18n.t('onboarding.dayFocusHint'))}</p>
      ${renderDayFocusEditors(schedule)}
    </div>
    <div class="onboarding-import" data-onboarding-import data-content-reveal-item>
      <h2>${escapeHtml(i18n.t('onboarding.importHeading'))}</h2>
      <div class="backup-toolbar">
        <button type="button" class="secondary" data-action="import-data">${escapeHtml(i18n.t('onboarding.importData'))}</button>
        <button type="button" class="secondary" data-action="import-colors">${escapeHtml(i18n.t('onboarding.importColors'))}</button>
        <button type="button" class="secondary" data-action="import-ranks">${escapeHtml(i18n.t('onboarding.importRanks'))}</button>
      </div>
      <p class="inline-status" data-onboarding-import-status hidden></p>
    </div>
    <div class="onboarding-actions" data-content-reveal-item>
      <button type="button" class="primary outline" data-action="privacy-notice">${escapeHtml(i18n.t('onboarding.privacyNotice'))}</button>
      <button type="button" class="primary" data-action="give-tour">${escapeHtml(i18n.t('onboarding.tour'))}</button>
      <button type="button" class="primary outline" data-action="skip-onboarding">${escapeHtml(i18n.t('onboarding.skip'))}</button>
    </div>
  </section>`;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   onComplete?: () => void,
 *   onGiveTour?: () => void,
 *   pickOpenPath?: Function,
 *   confirm?: Function,
 * }} options
 */
function mountOnboardingView(root, options = {}) {
  let mode = 'onboarding';
  const schedule = onboarding.getDayFocusSchedule();

  function pickOpenPath(dialogOpts = {}) {
    if (typeof options.pickOpenPath === 'function') {
      return Promise.resolve(options.pickOpenPath(dialogOpts));
    }
    return fileDialog.pickOpenPath({
      ...dialogOpts,
      document: root.ownerDocument,
    });
  }

  function confirm(msg) {
    if (typeof options.confirm === 'function') return options.confirm(msg);
    if (typeof window !== 'undefined' && window.confirm) return window.confirm(msg);
    return true;
  }

  function setImportStatus(text, isError) {
    const el = root.querySelector('[data-onboarding-import-status]');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle('inline-alert', Boolean(isError));
  }

  function finish() {
    const lang = root.querySelector('[data-onboarding-language]');
    onboarding.complete({ language: (lang && lang.value) || 'en' });
    if (typeof options.onComplete === 'function') options.onComplete();
  }

  function bindOnboarding() {
    const lang = root.querySelector('[data-onboarding-language]');
    if (lang) {
      lang.addEventListener('change', () => {
        i18n.setLanguage(lang.value);
        const doc = root.ownerDocument;
        if (doc) i18n.applyToDocument(doc);
        render();
      });
    }

    root.querySelectorAll('[data-focus-group][data-focus-day]').forEach((input) => {
      input.addEventListener('change', () => {
        const group = input.getAttribute('data-focus-group');
        const day = input.getAttribute('data-focus-day');
        const current = dayFocus.getSchedule();
        const set = new Set(current[group] || []);
        if (input.checked) set.add(day);
        else set.delete(day);
        dayFocus.setSchedule({ [group]: [...set] });
      });
    });

    const privacyBtn = root.querySelector('[data-action="privacy-notice"]');
    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => {
        mode = 'privacy';
        render();
      });
    }

    const skip = root.querySelector('[data-action="skip-onboarding"]');
    if (skip) skip.addEventListener('click', () => finish());

    const tourBtn = root.querySelector('[data-action="give-tour"]');
    if (tourBtn) {
      tourBtn.addEventListener('click', () => {
        // Complete onboarding first so later Quit/Landing is not blocked by onboarding gate.
        const lang = root.querySelector('[data-onboarding-language]');
        onboarding.complete({ language: (lang && lang.value) || 'en' });
        if (typeof options.onGiveTour === 'function') options.onGiveTour();
        else if (typeof options.onComplete === 'function') options.onComplete();
      });
    }

    const importData = root.querySelector('[data-action="import-data"]');
    if (importData) {
      importData.addEventListener('click', async () => {
        const source = await pickOpenPath({ accept: '.dat,.zip' });
        if (!source) return;
        const result = backup.importHistoryDat
          ? backup.importHistoryDat(source, { confirm })
          : backup.importZip
            ? backup.importZip(source, { confirm })
            : { ok: false, message: i18n.t('error.importUnavailable') };
        setImportStatus(
          result.ok ? i18n.t('onboarding.dataImported') : result.message || i18n.t('error.importFailed'),
          !result.ok
        );
      });
    }

    const importColors = root.querySelector('[data-action="import-colors"]');
    if (importColors) {
      importColors.addEventListener('click', async () => {
        const source = await pickOpenPath({ accept: '.txt' });
        if (!source) return;
        const result = backup.importConfig(source, { confirm });
        setImportStatus(
          result.ok ? i18n.t('onboarding.colorsImported') : result.message || i18n.t('error.importFailed'),
          !result.ok
        );
      });
    }

    const importRanks = root.querySelector('[data-action="import-ranks"]');
    if (importRanks) {
      importRanks.addEventListener('click', async () => {
        const source = await pickOpenPath({ accept: '.txt' });
        if (!source) return;
        const result = backup.importRanks(source, { confirm });
        setImportStatus(
          result.ok ? i18n.t('onboarding.ranksImported') : result.message || i18n.t('error.importFailed'),
          !result.ok
        );
      });
    }
  }

  function bindPrivacy() {
    const back = root.querySelector('[data-action="privacy-back"]');
    if (back) {
      back.addEventListener('click', () => {
        mode = 'onboarding';
        render();
      });
    }
  }

  function render() {
    if (mode === 'privacy') {
      root.innerHTML = privacyNoticeHtml();
      bindPrivacy();
      contentReveal.play(root);
      return;
    }
    root.innerHTML = onboardingHtml(onboarding.getDayFocusSchedule());
    bindOnboarding();
    contentReveal.play(root);
  }

  render();

  return {
    destroy() {
      root.innerHTML = '';
    },
    refresh: render,
    getMode: () => mode,
  };
}

/**
 * Standalone Privacy notice (navbar entry). Back returns via options.onBack.
 * @param {HTMLElement} root
 * @param {{ onBack?: () => void }} [options]
 */
function mountPrivacyNoticeView(root, options = {}) {
  root.innerHTML = privacyNoticeHtml();
  contentReveal.play(root);
  const back = root.querySelector('[data-action="privacy-back"]');
  if (back) {
    back.addEventListener('click', () => {
      if (typeof options.onBack === 'function') options.onBack();
    });
  }
  return {
    destroy() {
      root.innerHTML = '';
    },
    refresh() {
      root.innerHTML = privacyNoticeHtml();
      contentReveal.play(root);
      const btn = root.querySelector('[data-action="privacy-back"]');
      if (btn) {
        btn.addEventListener('click', () => {
          if (typeof options.onBack === 'function') options.onBack();
        });
      }
    },
    getRoot: () => root,
  };
}

module.exports = {
  mountOnboardingView,
  mountPrivacyNoticeView,
  privacyNoticeHtml,
  onboardingHtml,
};
