/**
 * Persistent navbar utilities (Day Focus, Edit Ranks, Privacy).
 * Lives opposite the nav tabs on left and top navbar layouts.
 * Contributing is reached via the GitHub FAB (Feature 17), not the navbar.
 */

const i18n = require('./i18n');
const dayFocus = require('./dayFocus');
const flyoutFade = require('./flyoutFade');

const { t, th, muscleLabel, weekdayChip } = i18n;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function renderDayFocusMenu(schedule) {
  const sched = schedule || dayFocus.defaults();
  const groups = ['arms', 'core', 'legs', 'lungs'];
  const sections = groups
    .map((groupKey) => {
      const selected = new Set(sched[groupKey] || []);
      const boxes = DAY_KEYS.map((day) => {
        const checked = selected.has(day) ? 'checked' : '';
        return `<label class="day-focus-day">
        <input type="checkbox" data-focus-group="${escapeHtml(groupKey)}" data-focus-day="${escapeHtml(day)}" ${checked} />
        <span>${escapeHtml(weekdayChip(day))}</span>
      </label>`;
      }).join('');
      return `<fieldset class="day-focus-group" data-focus-section="${escapeHtml(groupKey)}">
      <legend>${escapeHtml(muscleLabel(groupKey))}</legend>
      <div class="day-focus-days">${boxes}</div>
    </fieldset>`;
    })
    .join('');

  return `<div class="landing-menu" data-landing-menu="day-focus">
    <button type="button" class="primary outline landing-menu-trigger" data-action="toggle-day-focus-menu"
      aria-haspopup="true" aria-expanded="false" aria-label="${th('landing.dayFocusAria')}">${escapeHtml(
        t('landing.dayFocus')
      )}</button>
    <div class="landing-menu-panel day-focus-panel" data-day-focus-menu-panel hidden role="menu">
      ${sections}
    </div>
  </div>`;
}

/** Markup for the cluster opposite the navigation tabs. */
function renderUtilitiesHtml(schedule) {
  return `<div class="landing-menu-cluster navbar-utility-cluster" data-landing-menus data-navbar-utilities>
    ${renderDayFocusMenu(schedule)}
    <button type="button" class="primary outline landing-menu-trigger" data-action="edit-ranks"
      aria-label="${th('nav.editRanksAria')}">${escapeHtml(t('nav.editRanks'))}</button>
    <button type="button" class="primary outline landing-menu-trigger" data-action="open-privacy"
      aria-label="${th('nav.privacyAria')}">${escapeHtml(t('nav.privacy'))}</button>
  </div>`;
}

/**
 * @param {ParentNode} scope
 * @param {{
 *   onEditRanks?: () => void,
 *   onPrivacy?: () => void,
 *   onScheduleChange?: () => void,
 * }} [handlers]
 * @returns {() => void} unbind
 */
function bindUtilities(scope, handlers = {}) {
  if (!scope || typeof scope.querySelector !== 'function') return () => {};

  let dayFocusMenuOpen = false;
  const cleanups = [];

  function applyMenuOpenState() {
    const dayPanel = scope.querySelector('[data-day-focus-menu-panel]');
    const dayBtn = scope.querySelector('[data-action="toggle-day-focus-menu"]');
    const nav = scope.closest ? scope.closest('.app-navbar') : null;
    if (dayPanel) {
      if (dayFocusMenuOpen) {
        if (nav) nav.classList.add('is-landing-menu-open');
        flyoutFade.show(dayPanel);
      } else {
        flyoutFade.hide(dayPanel, {
          onDone: () => {
            if (!dayFocusMenuOpen && nav) nav.classList.remove('is-landing-menu-open');
          },
        });
      }
    } else if (nav) {
      nav.classList.toggle('is-landing-menu-open', dayFocusMenuOpen);
    }
    if (dayBtn) dayBtn.setAttribute('aria-expanded', dayFocusMenuOpen ? 'true' : 'false');
  }

  function closeMenus() {
    dayFocusMenuOpen = false;
    applyMenuOpenState();
  }

  const dayBtn = scope.querySelector('[data-action="toggle-day-focus-menu"]');
  if (dayBtn) {
    const onClick = (ev) => {
      ev.stopPropagation();
      dayFocusMenuOpen = !dayFocusMenuOpen;
      applyMenuOpenState();
    };
    dayBtn.addEventListener('click', onClick);
    cleanups.push(() => dayBtn.removeEventListener('click', onClick));
  }

  scope.querySelectorAll('[data-focus-group][data-focus-day]').forEach((input) => {
    const onChange = () => {
      const group = input.getAttribute('data-focus-group');
      const day = input.getAttribute('data-focus-day');
      const schedule = dayFocus.getSchedule();
      const set = new Set(schedule[group] || []);
      if (input.checked) set.add(day);
      else set.delete(day);
      dayFocus.setSchedule({ [group]: [...set] });
      dayFocusMenuOpen = true;
      applyMenuOpenState();
      if (typeof handlers.onScheduleChange === 'function') handlers.onScheduleChange();
    };
    input.addEventListener('change', onChange);
    cleanups.push(() => input.removeEventListener('change', onChange));
  });

  scope.querySelectorAll('.landing-menu-panel').forEach((panel) => {
    const stop = (ev) => ev.stopPropagation();
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        closeMenus();
        if (dayBtn) dayBtn.focus();
      }
    };
    panel.addEventListener('click', stop);
    panel.addEventListener('keydown', onKey);
    cleanups.push(() => {
      panel.removeEventListener('click', stop);
      panel.removeEventListener('keydown', onKey);
    });
  });

  const editBtn = scope.querySelector('[data-action="edit-ranks"]');
  if (editBtn && typeof handlers.onEditRanks === 'function') {
    const onEdit = (ev) => {
      ev.preventDefault();
      handlers.onEditRanks();
    };
    editBtn.addEventListener('click', onEdit);
    cleanups.push(() => editBtn.removeEventListener('click', onEdit));
  }

  const privacyBtn = scope.querySelector('[data-action="open-privacy"]');
  if (privacyBtn && typeof handlers.onPrivacy === 'function') {
    const onPrivacy = (ev) => {
      ev.preventDefault();
      handlers.onPrivacy();
    };
    privacyBtn.addEventListener('click', onPrivacy);
    cleanups.push(() => privacyBtn.removeEventListener('click', onPrivacy));
  }

  const doc = scope.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (doc) {
    const onDocClick = (ev) => {
      const t = ev.target;
      if (t && t.closest && t.closest('[data-landing-menus]')) return;
      if (dayFocusMenuOpen) closeMenus();
    };
    doc.addEventListener('click', onDocClick);
    cleanups.push(() => doc.removeEventListener('click', onDocClick));
  }

  applyMenuOpenState();
  return () => {
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch (_) {
        /* ignore */
      }
    });
  };
}

function fillNavbarUtilities(navOrDoc, handlers = {}) {
  const root =
    navOrDoc && navOrDoc.querySelector
      ? navOrDoc
      : typeof document !== 'undefined'
        ? document
        : null;
  if (!root) return () => {};
  let host = root.querySelector('[data-landing-menu-host="navbar"]');
  if (!host && root.classList && root.classList.contains('app-navbar')) {
    host = root.querySelector('.app-navbar-end') || null;
  }
  if (!host) return () => {};
  host.hidden = false;
  host.removeAttribute('hidden');
  host.innerHTML = renderUtilitiesHtml(dayFocus.getSchedule());
  return bindUtilities(host, handlers);
}

module.exports = {
  escapeHtml,
  renderDayFocusMenu,
  renderUtilitiesHtml,
  bindUtilities,
  fillNavbarUtilities,
};
