/**
 * Feature 15 — App Animations (onboarding + privacy notice UI)
 * Spec: features/feature-15-App-Animations.md
 */

const onboarding = require('./onboarding');
const dayFocus = require('./dayFocus');
const backup = require('./backup');
const fileDialog = require('./fileDialog');
const contentReveal = require('./contentReveal');

const DAY_FOCUS_LABELS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'TH' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'Sa' },
  { key: 'sun', label: 'Su' },
];

const GROUP_FOCUS_LABELS = [
  { key: 'arms', label: 'Arms' },
  { key: 'core', label: 'Core' },
  { key: 'lungs', label: 'Lungs' },
  { key: 'legs', label: 'Legs' },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDayFocusEditors(schedule) {
  const sched = schedule || dayFocus.defaults();
  return GROUP_FOCUS_LABELS.map((group) => {
    const days = new Set(sched[group.key] || []);
    const boxes = DAY_FOCUS_LABELS.map((day) => {
      const checked = days.has(day.key) ? 'checked' : '';
      return `<label class="day-focus-day">
        <input type="checkbox" data-focus-group="${escapeHtml(group.key)}" data-focus-day="${escapeHtml(
        day.key
      )}" ${checked} />
        <span>${escapeHtml(day.label)}</span>
      </label>`;
    }).join('');
    return `<fieldset class="day-focus-group" data-focus-section="${escapeHtml(group.key)}">
      <legend>${escapeHtml(group.label)}</legend>
      <div class="day-focus-days">${boxes}</div>
    </fieldset>`;
  }).join('');
}

function privacyNoticeHtml() {
  const p = onboarding.privacyPaths();
  return `<section class="panel onboarding-privacy" data-view="privacy-notice" data-content-reveal-frame>
    <h1 data-content-reveal-item>Privacy Notice</h1>
    <p data-privacy-copy data-content-reveal-item>
      Strank runs entirely offline. This means all your data is completely owned by you!
      The developers of Strank have zero access to your data. Right now, your user data is stored in
      “<code data-privacy-user-path>${escapeHtml(p.userDataDir)}</code>”.
      You can find other data in
      “<code data-privacy-app-path>${escapeHtml(p.applicationDataDir)}</code>”.
      Take the tour to learn about how you can customize your Strank tracker!
    </p>
    <button type="button" class="primary outline" data-action="privacy-back" data-content-reveal-item>Back</button>
  </section>`;
}

function onboardingHtml(schedule) {
  return `<section class="panel onboarding-view" data-view="onboarding" data-content-reveal-frame>
    <h1 data-content-reveal-item>Welcome to Strank</h1>
    <label class="field" data-content-reveal-item>
      <span>Language:</span>
      <select data-onboarding-language aria-label="Language">
        <option value="en" selected>English</option>
      </select>
    </label>
    <div class="onboarding-day-focus" data-onboarding-day-focus data-content-reveal-item>
      <h2>Day focus</h2>
      <p class="muted">Which weekdays track each muscle group?</p>
      ${renderDayFocusEditors(schedule)}
    </div>
    <div class="onboarding-import" data-onboarding-import data-content-reveal-item>
      <h2>Import (optional)</h2>
      <div class="backup-toolbar">
        <button type="button" class="secondary" data-action="import-data">Import data</button>
        <button type="button" class="secondary" data-action="import-colors">Import colors</button>
        <button type="button" class="secondary" data-action="import-ranks">Import ranks</button>
      </div>
      <p class="inline-status" data-onboarding-import-status hidden></p>
    </div>
    <div class="onboarding-actions" data-content-reveal-item>
      <button type="button" class="primary outline" data-action="privacy-notice">Privacy Notice</button>
      <button type="button" class="primary" data-action="give-tour" disabled title="Tour coming soon">Give me a Tour</button>
      <button type="button" class="primary outline" data-action="skip-onboarding">Skip</button>
    </div>
  </section>`;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   onComplete?: () => void,
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

    const importData = root.querySelector('[data-action="import-data"]');
    if (importData) {
      importData.addEventListener('click', async () => {
        const source = await pickOpenPath({ accept: '.dat,.zip' });
        if (!source) return;
        const result = backup.importHistoryDat
          ? backup.importHistoryDat(source, { confirm })
          : backup.importZip
            ? backup.importZip(source, { confirm })
            : { ok: false, message: 'Import not available.' };
        setImportStatus(
          result.ok ? 'Data imported.' : result.message || 'Import failed.',
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
          result.ok ? 'Colors / config imported.' : result.message || 'Import failed.',
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
          result.ok ? 'Ranks imported.' : result.message || 'Import failed.',
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

module.exports = {
  mountOnboardingView,
  privacyNoticeHtml,
  onboardingHtml,
};
