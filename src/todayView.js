/**
 * Feature 2 — Daily Exercise Log
 * Feature 5 — Dynamic Exercise Catalog
 * Spec: features/feature-2-Daily-Exercise-Log.md
 * Spec: features/feature-5-Dynamic-Exercise-Catalog.md
 */

const dailyLog = require('./dailyLog');
const catalog = require('./catalog');
const config = require('./config');
const i18n = require('./i18n');
const {
  parseDurationToSeconds,
  formatDurationSeconds,
  isTimeDurationKey,
} = require('./parse/duration');
const { renderExerciseHelp, descriptionForExercise } = require('./exerciseHelp');

const METRIC_LABELS = {
  weight: 'Weight',
  distance: 'Distance',
  reps: 'Reps',
  sets: 'Sets',
  durationSeconds: 'Duration',
  durationGoSeconds: 'Go',
  durationRestSeconds: 'Rest',
  durationSteps: 'Steps',
};

function metricLabel(key) {
  return i18n.metricLabel(key);
}

/** Weight display: `40 kgs` / `25 lbs` / `1 st` from config `weight units`. */
function formatWeightDisplay(value) {
  const unitConversion = require('./unitConversion');
  const unit = unitConversion.weightDisplayLabel(config.getWeightUnits());
  const n = unitConversion.roundMeasure(Number(value));
  return `${unitConversion.formatMeasureToken(Number.isFinite(n) ? n : 0)} ${unit}`;
}

/** Distance display from config `distance units`. */
function formatDistanceDisplay(value) {
  const unitConversion = require('./unitConversion');
  const unit = unitConversion.distanceDisplayLabel(config.getDistanceUnits());
  const n = unitConversion.roundMeasure(Number(value));
  return `${unitConversion.formatMeasureToken(Number.isFinite(n) ? n : 0)} ${unit}`;
}

function isZeroWeight(value) {
  const n = Number(value);
  return Number.isFinite(n) && n === 0;
}

function isZeroDistance(value) {
  const n = Number(value);
  return Number.isFinite(n) && n === 0;
}

function formatMetricValue(key, value) {
  if (key === 'weight') return formatWeightDisplay(value);
  if (key === 'distance') return formatDistanceDisplay(value);
  if (isTimeDurationKey(key)) return formatDurationSeconds(value);
  return String(value);
}

/**
 * One metric for lists/summaries: weight/distance are `### unit` (omitted when 0);
 * others keep `Label value`.
 */
function formatMetricEntry(key, value) {
  if (key === 'weight') {
    if (isZeroWeight(value)) return null;
    return formatWeightDisplay(value);
  }
  if (key === 'distance') {
    if (isZeroDistance(value)) return null;
    return formatDistanceDisplay(value);
  }
  return `${metricLabel(key)} ${formatMetricValue(key, value)}`;
}

function formatMetricsSummary(metrics) {
  if (!metrics || typeof metrics !== 'object') return '';
  return Object.entries(metrics)
    .map(([k, v]) => formatMetricEntry(k, v))
    .filter((part) => part != null && part !== '')
    .join(' · ');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Mount the Today view into `root`.
 * @returns {{ refresh: Function, destroy: Function, getRoot: Function }}
 */
function mountTodayView(root, options = {}) {
  const log = options.dailyLog || dailyLog;
  const cat = options.catalog || catalog;
  const confirmFn = options.confirm || ((msg) => window.confirm(msg));
  let destroyed = false;
  let dialogMode = null; // null | { mode: 'add'|'edit', entryId?, exerciseId? }
  let saveBusy = false;
  let lastError = '';
  let searchQuery = '';
  let catalogNotice = '';

  const tickMs = options.tickMs != null ? options.tickMs : 60000;
  let tickId = null;
  let onFocus = null;

  function loadCatalogList() {
    if (typeof cat.loadLiveCatalog === 'function') {
      const loaded = cat.loadLiveCatalog();
      if (loaded && loaded.ok && Array.isArray(loaded.data)) return loaded.data;
    }
    if (typeof cat.loadCatalog === 'function') {
      const loaded = cat.loadCatalog();
      if (loaded && loaded.ok && Array.isArray(loaded.data)) return loaded.data;
    }
    return [];
  }

  function resolveActive(exerciseId) {
    if (typeof cat.getActiveExercise === 'function') {
      return cat.getActiveExercise(exerciseId);
    }
    return cat.getExerciseById(exerciseId);
  }

  function maybeReloadCatalog() {
    if (typeof cat.diskCatalogChanged === 'function' && cat.diskCatalogChanged()) {
      const prevSchema = dialogMode && dialogMode.exerciseId ? resolveActive(dialogMode.exerciseId) : null;
      const prevKeys = prevSchema ? (prevSchema.metrics || []).join(',') : '';
      if (typeof cat.reloadFromDisk === 'function') {
        cat.reloadFromDisk();
      } else if (typeof cat.loadLiveCatalog === 'function') {
        cat.loadLiveCatalog();
      }
      if (dialogMode && dialogMode.exerciseId) {
        const nextSchema = resolveActive(dialogMode.exerciseId);
        const nextKeys = nextSchema ? (nextSchema.metrics || []).join(',') : '';
        if (prevKeys !== nextKeys) {
          catalogNotice = i18n.t('today.catalogUpdated');
        }
      }
    }
  }

  function refresh() {
    if (destroyed) return;
    render();
  }

  function openAdd() {
    dialogMode = { mode: 'add', exerciseId: '' };
    lastError = '';
    searchQuery = '';
    render();
  }

  function openEdit(entry) {
    dialogMode = {
      mode: 'edit',
      entryId: entry.entryId,
      exerciseId: entry.exerciseId,
      metrics: { ...entry.metrics },
    };
    lastError = '';
    searchQuery = '';
    render();
  }

  function closeDialog() {
    dialogMode = null;
    lastError = '';
    catalogNotice = '';
    saveBusy = false;
    render();
  }

  function resolveExercise(exerciseId) {
    return resolveActive(exerciseId);
  }

  function schemaKeysForDialog(exercise, mode) {
    if (exercise) return exercise.metrics || [];
    if (mode && mode.mode === 'edit' && mode.metrics) {
      return Object.keys(mode.metrics);
    }
    return [];
  }

  function collectMetricValues(form, schemaKeys) {
    const values = {};
    for (const key of schemaKeys) {
      const input = form.querySelector(`[name="metric-${key}"]`);
      if (!input) continue;
      let raw = input.value;
      if (key.startsWith('duration') && key !== 'durationSteps' && typeof raw === 'string' && /[ms]/i.test(raw)) {
        const parsed = parseDurationToSeconds(raw);
        values[key] = parsed != null ? parsed : raw;
      } else if (raw === '' || raw == null) {
        // omit — validation will say required
      } else {
        const n = Number(raw);
        values[key] = Number.isFinite(n) ? n : raw;
      }
    }
    return values;
  }

  function onSave(form) {
    if (saveBusy || !dialogMode) return;
    const exerciseId = form.querySelector('[name="exerciseId"]').value;
    const exercise = resolveExercise(exerciseId);
    const orphanEdit =
      !exercise && dialogMode.mode === 'edit' && dialogMode.exerciseId === exerciseId;
    if (!exercise && !orphanEdit) {
      lastError = i18n.t('validation.exerciseNotAllowed');
      render();
      return;
    }
    const keys = schemaKeysForDialog(exercise, dialogMode);
    const metrics = collectMetricValues(form, keys);
    saveBusy = true;
    lastError = '';
    render();

    let result;
    if (dialogMode.mode === 'add') {
      result = log.createToday({ exerciseId, ...metrics });
    } else {
      result = log.updateToday(dialogMode.entryId, { exerciseId, ...metrics });
    }

    saveBusy = false;
    if (!result.ok) {
      lastError = result.message || i18n.t('error.saveFailed');
      render();
      return;
    }
    closeDialog();
  }

  function onDelete(entryId) {
    const ok = confirmFn(i18n.t('today.confirmDelete'));
    if (!ok) return;
    const result = log.deleteToday(entryId);
    if (!result.ok) {
      lastError = result.message || i18n.t('error.deleteFailed');
    }
    render();
  }

  function renderDialog(catalogList) {
    if (!dialogMode) return '';

    const exerciseId = dialogMode.exerciseId || '';
    const exercise = exerciseId ? resolveExercise(exerciseId) : null;
    const orphanEdit = Boolean(exerciseId && !exercise && dialogMode.mode === 'edit');
    const filtered = catalogList.filter((e) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.exerciseId.toLowerCase().includes(q);
    });

    const keys = schemaKeysForDialog(exercise, dialogMode);
    const metricFields = keys
      .map((key) => {
        const existing =
          dialogMode.metrics && dialogMode.metrics[key] != null ? dialogMode.metrics[key] : '';
        if (key === 'weight') {
          return `
            <label class="field workout-metric-weight">
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
          return `
            <label class="field workout-metric-distance">
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
        return `
            <label class="field">
              <span>${escapeHtml(metricLabel(key))}</span>
              <input type="text" name="metric-${escapeHtml(key)}" value="${escapeHtml(existing)}" />
            </label>`;
      })
      .join('');

    const orphanOption = orphanEdit
      ? `<option value="${escapeHtml(exerciseId)}" selected>${escapeHtml(exerciseId)} ${escapeHtml(i18n.t('today.removed'))}</option>`
      : '';

    return `
      <div class="dialog-backdrop" data-dialog="entry">
        <form class="dialog" id="entry-form">
          <h2>${dialogMode.mode === 'add' ? i18n.t('today.addExercise') : i18n.t('today.editExercise')}</h2>
          ${lastError ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
          ${catalogNotice ? `<p class="inline-alert" role="status">${escapeHtml(catalogNotice)}</p>` : ''}
          <label class="field">
            <span>${escapeHtml(i18n.t('common.search'))}</span>
            <input type="search" name="exerciseSearch" value="${escapeHtml(searchQuery)}" placeholder="${escapeHtml(i18n.t('today.searchPlaceholder'))}" />
          </label>
          <label class="field">
            <span>${escapeHtml(i18n.t('common.exercise'))}</span>
            <select name="exerciseId" required>
              <option value="">${escapeHtml(i18n.t('today.selectExercise'))}</option>
              ${orphanOption}
              ${filtered
                .map(
                  (e) =>
                    `<option value="${escapeHtml(e.exerciseId)}" ${
                      e.exerciseId === exerciseId ? 'selected' : ''
                    }>${escapeHtml(e.name)}${
                      e.headers && e.headers.length ? ` (${escapeHtml(e.headers.join(' › '))})` : ''
                    }</option>`
                )
                .join('')}
            </select>
          </label>
          <div class="metric-fields">${metricFields}</div>
          <div class="dialog-actions">
            <button type="button" class="ghost" data-action="cancel-dialog">${escapeHtml(i18n.t('common.cancel'))}</button>
            <button type="submit" class="primary" data-action="save" ${saveBusy ? 'disabled' : ''}>${escapeHtml(i18n.t('common.save'))}</button>
          </div>
        </form>
      </div>`;
  }

  function render() {
    if (destroyed) return;
    maybeReloadCatalog();
    const today = log.currentLocalDate();
    const listed = log.listToday();
    const entries = listed.ok ? listed.data : [];
    const catalogList = loadCatalogList();

    if (!listed.ok && !lastError) {
      lastError = listed.message;
    }

    const rows =
      entries.length === 0
        ? `<p class="empty-state" data-empty="today">${escapeHtml(i18n.t('today.empty'))}</p>`
        : `<ul class="entry-list" data-list="today">${entries
            .map((entry) => {
              const ex = resolveExercise(entry.exerciseId);
              const orphan =
                typeof cat.isOrphan === 'function' ? cat.isOrphan(entry) : !ex;
              const name = ex ? ex.name : entry.exerciseId;
              const orphanBadge = orphan
                ? `<span class="orphan-badge" data-orphan="true">${escapeHtml(i18n.t('today.removedFromCatalog'))}</span>`
                : '';
              return `<li class="entry-row" data-entry-id="${escapeHtml(entry.entryId)}"${
                orphan ? ' data-orphan="true"' : ''
              }>
                <div class="entry-main">
                  <span class="entry-title">
                    <span class="entry-name">${escapeHtml(name)}</span>${renderExerciseHelp(
                      descriptionForExercise(entry.exerciseId, catalog),
                      { id: entry.entryId || entry.exerciseId }
                    )}
                  </span>
                  ${orphanBadge}
                  <span class="entry-metrics">${escapeHtml(formatMetricsSummary(entry.metrics))}</span>
                </div>
                <div class="entry-actions">
                  <button type="button" data-action="edit" data-entry-id="${escapeHtml(entry.entryId)}">${escapeHtml(i18n.t('common.edit'))}</button>
                  <button type="button" data-action="delete" data-entry-id="${escapeHtml(entry.entryId)}">${escapeHtml(i18n.t('common.delete'))}</button>
                </div>
              </li>`;
            })
            .join('')}</ul>`;

    root.innerHTML = `
      <section class="panel today-view" data-view="today">
        <header class="today-header">
          <h1>${escapeHtml(i18n.t('today.title'))}</h1>
          <p class="today-date" data-local-date>${escapeHtml(today)}</p>
        </header>
        ${lastError && !dialogMode ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
        <div class="today-toolbar">
          <button type="button" class="primary" data-action="add-exercise">${escapeHtml(i18n.t('today.addExercise'))}</button>
          <button type="button" class="ghost" data-action="reload-catalog">${escapeHtml(i18n.t('shell.reloadExerciseData'))}</button>
        </div>
        ${rows}
      </section>
      ${renderDialog(catalogList)}
    `;

    bind();
  }

  function bind() {
    const addBtn = root.querySelector('[data-action="add-exercise"]');
    if (addBtn) addBtn.addEventListener('click', openAdd);

    const reloadBtn = root.querySelector('[data-action="reload-catalog"]');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        const prevSchema = dialogMode && dialogMode.exerciseId ? resolveActive(dialogMode.exerciseId) : null;
        const prevKeys = prevSchema ? (prevSchema.metrics || []).join(',') : '';
        if (typeof cat.reloadFromDisk === 'function') {
          cat.reloadFromDisk();
        } else if (typeof cat.loadLiveCatalog === 'function') {
          cat.loadLiveCatalog();
        }
        if (dialogMode && dialogMode.exerciseId) {
          const nextSchema = resolveActive(dialogMode.exerciseId);
          const nextKeys = nextSchema ? (nextSchema.metrics || []).join(',') : '';
          if (prevKeys !== nextKeys) {
            catalogNotice = i18n.t('today.catalogUpdated');
          }
        }
        render();
      });
    }

    root.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-entry-id');
        const listed = log.listToday();
        const entry = listed.ok && listed.data.find((e) => e.entryId === id);
        if (entry) openEdit(entry);
      });
    });

    root.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => onDelete(btn.getAttribute('data-entry-id')));
    });

    const cancel = root.querySelector('[data-action="cancel-dialog"]');
    if (cancel) cancel.addEventListener('click', closeDialog);

    const form = root.querySelector('#entry-form');
    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        onSave(form);
      });

      const search = form.querySelector('[name="exerciseSearch"]');
      if (search) {
        search.addEventListener('input', () => {
          searchQuery = search.value;
          const select = form.querySelector('[name="exerciseId"]');
          const current = select ? select.value : '';
          dialogMode = { ...dialogMode, exerciseId: current };
          render();
          const again = root.querySelector('[name="exerciseSearch"]');
          if (again) {
            again.focus();
            again.selectionStart = again.selectionEnd = again.value.length;
          }
        });
      }

      const select = form.querySelector('[name="exerciseId"]');
      if (select) {
        select.addEventListener('change', () => {
          dialogMode = {
            ...dialogMode,
            exerciseId: select.value,
            metrics: dialogMode.mode === 'edit' ? dialogMode.metrics : {},
          };
          lastError = '';
          render();
        });
      }
    }
  }

  function startWatchers() {
    if (typeof window !== 'undefined') {
      onFocus = () => refresh();
      window.addEventListener('focus', onFocus);
    }
    if (tickMs > 0) {
      tickId = setInterval(() => refresh(), tickMs);
    }
  }

  function destroy() {
    destroyed = true;
    if (tickId) clearInterval(tickId);
    if (onFocus && typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocus);
    }
    root.innerHTML = '';
  }

  render();
  startWatchers();

  return {
    refresh,
    destroy,
    getRoot: () => root,
  };
}

module.exports = {
  mountTodayView,
  formatMetricsSummary,
  formatMetricEntry,
  formatWeightDisplay,
  formatDistanceDisplay,
  isZeroWeight,
  isZeroDistance,
  metricLabel,
  METRIC_LABELS,
};
