/**
 * Shared Focus / Type / Push-Pull / Skill picker overlay (History Day + Active Workout).
 */

const historyDayAdd = require('./historyDayAdd');
const i18n = require('./i18n');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderToggleGroup(name, optionsList, selected, dataAttr) {
  return `<div class="history-add-toggle" role="group" aria-label="${escapeHtml(name)}">
    ${optionsList
      .map((opt) => {
        const active = opt.value === selected;
        return `<button type="button" class="history-add-toggle-btn${
          active ? ' is-active' : ''
        }" data-action="${escapeHtml(dataAttr)}" data-value="${escapeHtml(opt.value)}" aria-pressed="${
          active ? 'true' : 'false'
        }">${escapeHtml(opt.label)}</button>`;
      })
      .join('')}
  </div>`;
}

/**
 * @param {{
 *   addPicker: object,
 *   catalogList: Array,
 *   lastError?: string,
 *   saveBusy?: boolean,
 *   titleKey?: string,
 * }} opts
 * @returns {{ html: string, normalizedPicker: object }}
 */
function renderAddExerciseOverlay(opts) {
  const catalogList = opts.catalogList || [];
  const sel = historyDayAdd.normalizePickerSelection(catalogList, opts.addPicker || {});
  const normalizedPicker = {
    focus: sel.focus,
    type: sel.type,
    subtype: sel.subtype,
    exerciseId: sel.exerciseId,
  };

  const focusOptions = historyDayAdd.FOCUS_KEYS.map(
    (k) =>
      `<option value="${escapeHtml(k)}"${sel.focus === k ? ' selected' : ''}>${escapeHtml(
        i18n.muscleLabel(k)
      )}</option>`
  ).join('');

  const typeToggle = renderToggleGroup(
    i18n.t('history.addType'),
    [
      { value: 'strength', label: i18n.t('quality.strength') },
      { value: 'endurance', label: i18n.t('quality.endurance') },
    ],
    sel.type,
    'add-type'
  );

  const subtypeToggle = sel.needsSubtype
    ? `<label class="field history-add-field">
        <span>${escapeHtml(i18n.t('history.addDirection'))}</span>
        ${renderToggleGroup(
          i18n.t('history.addDirection'),
          [
            { value: 'push', label: i18n.t('quality.push') },
            { value: 'pull', label: i18n.t('quality.pull') },
          ],
          sel.subtype || 'push',
          'add-subtype'
        )}
      </label>`
    : '';

  const skillOptions = [
    `<option value="">${escapeHtml(i18n.t('history.addSkillPlaceholder'))}</option>`,
    ...sel.filtered.map(
      (ex) =>
        `<option value="${escapeHtml(ex.exerciseId)}"${
          sel.exerciseId === ex.exerciseId ? ' selected' : ''
        }>${escapeHtml(ex.name || ex.exerciseId)}</option>`
    ),
  ].join('');

  const addBtn = sel.exerciseId
    ? `<button type="button" class="primary" data-action="confirm-add" ${
        opts.saveBusy ? 'disabled' : ''
      }>${escapeHtml(i18n.t('common.add'))}</button>`
    : '';

  const title = i18n.t(opts.titleKey || 'history.addExercise');
  const err = opts.lastError
    ? `<p class="inline-alert" role="alert">${escapeHtml(opts.lastError)}</p>`
    : '';

  const html = `
      <div class="history-add-overlay" data-history-add-overlay>
        <div class="history-add-scrim" data-action="cancel-add" aria-hidden="true"></div>
        <div class="history-add-card" role="dialog" aria-modal="true" aria-labelledby="history-add-title">
          <p class="history-add-title" id="history-add-title">${escapeHtml(title)}</p>
          ${err}
          <label class="field history-add-field">
            <span>${escapeHtml(i18n.t('history.addFocus'))}</span>
            <select name="add-focus" data-add-focus>${focusOptions}</select>
          </label>
          <label class="field history-add-field">
            <span>${escapeHtml(i18n.t('history.addType'))}</span>
            ${typeToggle}
          </label>
          ${subtypeToggle}
          <label class="field history-add-field">
            <span>${escapeHtml(i18n.t('history.addSkill'))}</span>
            <select name="add-skill" data-add-skill>${skillOptions}</select>
          </label>
          <div class="history-add-actions">
            <button type="button" class="ghost" data-action="cancel-add">${escapeHtml(
              i18n.t('common.cancel')
            )}</button>
            ${addBtn}
          </div>
        </div>
      </div>`;

  return { html, normalizedPicker };
}

/**
 * @param {ParentNode} root - node containing [data-history-add-overlay]
 * @param {{
 *   onCancel: () => void,
 *   onConfirm: () => void,
 *   onPatch: (patch: object) => void,
 * }} handlers
 */
function bindAddExerciseOverlay(root, handlers) {
  const overlay = root.querySelector('[data-history-add-overlay]');
  if (!overlay) return;

  overlay.querySelectorAll('[data-action="cancel-add"]').forEach((el) => {
    el.addEventListener('click', () => handlers.onCancel && handlers.onCancel());
  });
  const focusSel = overlay.querySelector('[data-add-focus]');
  if (focusSel) {
    focusSel.addEventListener('change', () => {
      handlers.onPatch && handlers.onPatch({ focus: focusSel.value, exerciseId: '' });
    });
  }
  overlay.querySelectorAll('[data-action="add-type"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onPatch &&
        handlers.onPatch({ type: btn.getAttribute('data-value'), exerciseId: '' });
    });
  });
  overlay.querySelectorAll('[data-action="add-subtype"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onPatch &&
        handlers.onPatch({ subtype: btn.getAttribute('data-value'), exerciseId: '' });
    });
  });
  const skillSel = overlay.querySelector('[data-add-skill]');
  if (skillSel) {
    skillSel.addEventListener('change', () => {
      handlers.onPatch && handlers.onPatch({ exerciseId: skillSel.value || '' });
    });
  }
  const confirmAdd = overlay.querySelector('[data-action="confirm-add"]');
  if (confirmAdd) {
    confirmAdd.addEventListener('click', () => handlers.onConfirm && handlers.onConfirm());
  }
}

module.exports = {
  renderAddExerciseOverlay,
  bindAddExerciseOverlay,
  escapeHtml,
};
