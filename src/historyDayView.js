/**
 * Feature 9 — Workout History Calendar
 * Spec: features/feature-9-Workout-History-Calendar.md
 */

const historyCalendar = require('./historyCalendar');
const history = require('./history');
const catalog = require('./catalog');
const config = require('./config');
const { formatMetricsSummary, metricLabel } = require('./todayView');
const { parseDurationToSeconds, isTimeDurationKey, splitDurationSeconds, combineDurationParts } =
  require('./parse/duration');
const { renderExerciseHelp, descriptionForExercise } = require('./exerciseHelp');
const { renderRankBadge } = require('./rankBadge');
const { formatDisplayDate } = require('./appDate');
const { formatDuration, formatCompletionClock } = require('./workoutTimer');
const i18n = require('./i18n');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Mount day detail: entries, day-rank badge, edit/delete via Feature 3 (FR-005–FR-007, FR-009).
 */
function mountHistoryDayView(root, options = {}) {
  const cal = options.historyCalendar || historyCalendar;
  const hist = options.history || history;
  const cat = options.catalog || catalog;
  const confirmFn = options.confirm || ((msg) => window.confirm(msg));
  const onBack = options.onBack || (() => {});
  const onNavigateDay = options.onNavigateDay || (() => {});
  let localDate = options.localDate;
  let destroyed = false;
  let dialogMode = null;
  let saveBusy = false;
  let lastError = '';

  function destroy() {
    destroyed = true;
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  function setLocalDate(next) {
    localDate = next;
    dialogMode = null;
    lastError = '';
    render();
  }

  function resolveExercise(exerciseId) {
    if (typeof cat.getActiveExercise === 'function') {
      return cat.getActiveExercise(exerciseId);
    }
    return cat.getExerciseById(exerciseId);
  }

  function openEdit(entry) {
    dialogMode = {
      mode: 'edit',
      entryId: entry.entryId,
      exerciseId: entry.exerciseId,
      localDate: entry.localDate,
      metrics: { ...entry.metrics },
    };
    lastError = '';
    render();
  }

  function closeDialog() {
    dialogMode = null;
    lastError = '';
    saveBusy = false;
    render();
  }

  function collectMetricsFromForm(form, schemaKeys) {
    const metrics = {};
    for (const key of schemaKeys) {
      if (isTimeDurationKey(key)) {
        const hInput = form.querySelector(`[name="metric-${key}-h"]`);
        const mInput = form.querySelector(`[name="metric-${key}-m"]`);
        const sInput = form.querySelector(`[name="metric-${key}-s"]`);
        const combined = combineDurationParts({
          hours: hInput ? hInput.value : '',
          minutes: mInput ? mInput.value : '',
          seconds: sInput ? sInput.value : '',
        });
        if (!combined.ok) return combined;
        metrics[key] = combined.seconds;
        continue;
      }
      const input = form.querySelector(`[name="metric-${key}"]`);
      if (!input) continue;
      let raw = input.value;
      if (raw === '' || raw == null) continue;
      if (typeof raw === 'string' && /[hms]/i.test(raw)) {
        const parsed = parseDurationToSeconds(raw);
        metrics[key] = parsed != null ? parsed : raw;
      } else {
        const n = Number(raw);
        metrics[key] = Number.isFinite(n) ? n : raw;
      }
    }
    return { ok: true, metrics };
  }

  function renderMetricFields(metrics, schemaKeys) {
    return schemaKeys
      .map((key) => {
        const existing = metrics && metrics[key] != null ? metrics[key] : '';
        if (isTimeDurationKey(key)) {
          const parts = existing === '' ? { hours: '', minutes: '', seconds: '' } : splitDurationSeconds(existing);
          const showH = existing === '' ? '' : String(parts.hours);
          const showM = existing === '' ? '' : String(parts.minutes);
          const showS = existing === '' ? '' : String(parts.seconds);
          return `<div class="field workout-duration">
            <span>${escapeHtml(metricLabel(key))}</span>
            <div class="duration-parts">
              <label class="duration-part">
                <input type="number" min="0" step="1" inputmode="numeric" name="metric-${escapeHtml(
                  key
                )}-h" value="${escapeHtml(showH)}" class="metric-input-hours" />
                <span class="duration-unit">${escapeHtml(i18n.t('common.hours'))}</span>
              </label>
              <label class="duration-part">
                <input type="number" min="0" step="1" inputmode="numeric" name="metric-${escapeHtml(
                  key
                )}-m" value="${escapeHtml(showM)}" class="metric-input-minutes" />
                <span class="duration-unit">${escapeHtml(i18n.t('common.minutes'))}</span>
              </label>
              <label class="duration-part">
                <input type="number" min="0" step="any" inputmode="decimal" name="metric-${escapeHtml(
                  key
                )}-s" value="${escapeHtml(showS)}" class="metric-input-seconds" />
                <span class="duration-unit">${escapeHtml(i18n.t('common.seconds'))}</span>
              </label>
            </div>
          </div>`;
        }
        if (key === 'weight') {
          return `<label class="field workout-metric-weight">
          <span>${escapeHtml(metricLabel(key))}</span>
          <span class="weight-input-wrap">
            <input type="number" min="0" max="9999" step="any" inputmode="decimal" name="metric-${escapeHtml(
              key
            )}" value="${escapeHtml(existing)}" class="metric-input-weight" />
            <span class="weight-unit" data-weight-unit>${escapeHtml(config.getWeightUnits())}</span>
          </span>
        </label>`;
        }
        if (key === 'distance') {
          return `<label class="field workout-metric-distance">
          <span>${escapeHtml(metricLabel(key))}</span>
          <span class="weight-input-wrap distance-input-wrap">
            <input type="number" min="0" max="9999" step="any" inputmode="decimal" name="metric-${escapeHtml(
              key
            )}" value="${escapeHtml(existing)}" class="metric-input-weight metric-input-distance" />
            <span class="weight-unit distance-unit" data-distance-unit>${escapeHtml(
              config.getDistanceUnits()
            )}</span>
          </span>
        </label>`;
        }
        return `<label class="field">
          <span>${escapeHtml(metricLabel(key))}</span>
          <input type="text" name="metric-${escapeHtml(key)}" value="${escapeHtml(existing)}" />
        </label>`;
      })
      .join('');
  }

  function renderDialog() {
    if (!dialogMode) return '';
    const exercise = resolveExercise(dialogMode.exerciseId);
    const schemaKeys = exercise
      ? exercise.metrics || []
      : Object.keys(dialogMode.metrics || {});
    return `
      <div class="dialog-backdrop" data-dialog="day-entry">
        <form class="dialog" id="history-day-entry-form">
          <h2>${escapeHtml(i18n.t('today.editExercise'))}</h2>
          ${lastError ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
          <p class="hint"><strong>${escapeHtml(dialogMode.exerciseId)}</strong> · ${escapeHtml(
            dialogMode.localDate
          )}</p>
          <div class="metric-fields">${renderMetricFields(dialogMode.metrics, schemaKeys)}</div>
          <div class="dialog-actions">
            <button type="button" class="ghost" data-action="cancel-dialog">${escapeHtml(i18n.t('common.cancel'))}</button>
            <button type="submit" class="primary" data-action="save" ${saveBusy ? 'disabled' : ''}>${escapeHtml(i18n.t('common.save'))}</button>
          </div>
        </form>
      </div>`;
  }

  function render() {
    if (destroyed) return;
    const model = cal.getDay(localDate, { today: options.today });
    if (!model.ok) {
      root.innerHTML = `
        <section class="panel history-day-view" data-view="historyDay">
          <p class="inline-alert" role="alert">${escapeHtml(model.message || i18n.t('history.loadDayFailed'))}</p>
          <button type="button" class="ghost" data-action="back">${escapeHtml(i18n.t('common.back'))}</button>
        </section>`;
      root.querySelector('[data-action="back"]').addEventListener('click', onBack);
      return;
    }

    const { tierName, entries, workoutDurationMs } = model.data;
    const list =
      entries.length === 0
        ? `<p class="empty-state" data-empty="day">${escapeHtml(i18n.t('history.emptyDay'))}</p>`
        : `<ul class="entry-list" data-day-entries>${entries
            .map((e) => {
              const ex = resolveExercise(e.exerciseId);
              const name = ex ? ex.name : e.exerciseId;
              const completedAt = e.completedAt || e.updatedAt || e.createdAt || null;
              return `<li class="entry-row" data-entry-id="${escapeHtml(e.entryId)}" data-exercise-id="${escapeHtml(
                e.exerciseId
              )}">
                <div class="entry-main">
                  <span class="entry-title">
                    <span class="entry-name">${escapeHtml(name)}</span>${renderExerciseHelp(
                      descriptionForExercise(e.exerciseId, cat),
                      { id: e.entryId || e.exerciseId }
                    )}
                  </span>
                  <span class="entry-metrics" data-metrics>${escapeHtml(formatMetricsSummary(e.metrics))}</span>
                  ${
                    completedAt
                      ? `<span class="entry-completed-at" data-completed-at="${escapeHtml(
                          completedAt
                        )}">${escapeHtml(formatCompletionClock(completedAt))}</span>`
                      : ''
                  }
                </div>
                <div class="entry-actions">
                  <button type="button" data-action="edit" data-entry-id="${escapeHtml(e.entryId)}">${escapeHtml(i18n.t('common.edit'))}</button>
                  <button type="button" data-action="delete" data-entry-id="${escapeHtml(e.entryId)}">${escapeHtml(i18n.t('common.delete'))}</button>
                </div>
              </li>`;
            })
            .join('')}</ul>`;

    const durationHtml =
      Number.isFinite(workoutDurationMs)
        ? `<p class="history-day-duration" data-workout-duration>${escapeHtml(
            formatDuration(workoutDurationMs)
          )}</p>`
        : '';

    root.innerHTML = `
      <section class="panel history-day-view" data-view="historyDay">
        <header class="cal-header day-detail-header">
          <div class="cal-nav">
            <button type="button" class="ghost" data-action="prev-day" title="${escapeHtml(i18n.t('history.prevDayTitle'))}">${escapeHtml(i18n.t('history.prevDay'))}</button>
          </div>
          <div class="cal-title-block day-title-block">
            <h1 data-day-heading data-local-date="${escapeHtml(localDate)}">${escapeHtml(
              formatDisplayDate(localDate)
            )}</h1>
            ${renderRankBadge(tierName, { dataAttr: 'data-day-rank', className: 'day-rank-badge' })}
          </div>
          <div class="cal-nav">
            <button type="button" class="ghost" data-action="next-day" title="${escapeHtml(i18n.t('history.nextDayTitle'))}">${escapeHtml(i18n.t('history.nextDay'))}</button>
          </div>
        </header>
        ${durationHtml}
        ${lastError && !dialogMode ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
        ${list}
        <button type="button" class="ghost" data-action="back">${escapeHtml(i18n.t('common.back'))}</button>
      </section>
      ${renderDialog()}
    `;

    bind(entries);
  }

  function bind(entries) {
    root.querySelector('[data-action="back"]').addEventListener('click', onBack);
    root.querySelector('[data-action="prev-day"]').addEventListener('click', () => {
      const prev = cal.adjacentDay(localDate, -1);
      setLocalDate(prev);
      onNavigateDay(prev);
    });
    root.querySelector('[data-action="next-day"]').addEventListener('click', () => {
      const next = cal.adjacentDay(localDate, 1);
      setLocalDate(next);
      onNavigateDay(next);
    });

    root.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-entry-id');
        const entry = entries.find((e) => e.entryId === id);
        if (entry) openEdit(entry);
      });
    });

    root.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-entry-id');
        if (!confirmFn(i18n.t('history.confirmDeleteEntry'))) return;
        const result = hist.delete(id);
        if (!result.ok) {
          lastError = result.message || i18n.t('error.deleteFailed');
          render();
          return;
        }
        lastError = '';
        render();
      });
    });

    const form = root.querySelector('#history-day-entry-form');
    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (saveBusy || !dialogMode) return;
        const exercise = resolveExercise(dialogMode.exerciseId);
        const schemaKeys = exercise
          ? exercise.metrics || []
          : Object.keys(dialogMode.metrics || {});
        const collected = collectMetricsFromForm(form, schemaKeys);
        if (!collected.ok) {
          lastError = collected.message;
          render();
          return;
        }
        saveBusy = true;
        const result = hist.update(dialogMode.entryId, { metrics: collected.metrics });
        saveBusy = false;
        if (!result.ok) {
          lastError = result.message || i18n.t('error.saveFailed');
          render();
          return;
        }
        dialogMode = null;
        lastError = '';
        render();
      });
      const cancel = root.querySelector('[data-action="cancel-dialog"]');
      if (cancel) cancel.addEventListener('click', closeDialog);
    }
  }

  render();

  return {
    refresh,
    destroy,
    getRoot: () => root,
    getLocalDate: () => localDate,
    setLocalDate,
  };
}

module.exports = {
  mountHistoryDayView,
};
