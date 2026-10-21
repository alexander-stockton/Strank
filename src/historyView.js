/**
 * Feature 3 — Exercise History
 * Feature 5 — Dynamic Exercise Catalog
 * Spec: features/feature-3-Exercise-History.md
 * Spec: features/feature-5-Dynamic-Exercise-Catalog.md
 */

const history = require('./history');
const catalog = require('./catalog');
const dailyLog = require('./dailyLog');
const config = require('./config');
const { parseDurationToSeconds } = require('./parse/duration');
const { formatMetricsSummary, metricLabel } = require('./todayView');
const { renderExerciseHelp, descriptionForExercise } = require('./exerciseHelp');
const i18n = require('./i18n');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function groupByDate(entries) {
  const groups = [];
  const map = new Map();
  for (const entry of entries) {
    if (!map.has(entry.localDate)) {
      const g = { localDate: entry.localDate, entries: [] };
      map.set(entry.localDate, g);
      groups.push(g);
    }
    map.get(entry.localDate).entries.push(entry);
  }
  return groups;
}

function uniqueRegions(catalogList) {
  const set = new Set();
  for (const e of catalogList) {
    if (e.headers && e.headers[0]) set.add(e.headers[0]);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Mount the History view into `root`.
 */
function mountHistoryView(root, options = {}) {
  const svc = options.history || history;
  const cat = options.catalog || catalog;
  const confirmFn = options.confirm || ((msg) => window.confirm(msg));
  let destroyed = false;
  let dialogMode = null;
  let saveBusy = false;
  let lastError = '';
  let searchQuery = '';
  let catalogNotice = '';
  /** Draft filter inputs */
  let draftFilters = { localDate: '', exerciseId: '', region: '' };
  /** Applied filters */
  let appliedFilters = {};

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

  function resolveExercise(exerciseId) {
    if (typeof cat.getActiveExercise === 'function') {
      return cat.getActiveExercise(exerciseId);
    }
    return cat.getExerciseById(exerciseId);
  }

  function schemaKeysForDialog(exercise, mode) {
    if (exercise) return exercise.metrics || [];
    if (mode && mode.mode === 'edit' && mode.metrics) {
      return Object.keys(mode.metrics);
    }
    return [];
  }

  function openAdd() {
    dialogMode = {
      mode: 'add',
      exerciseId: '',
      localDate: dailyLog.currentLocalDate(),
      metrics: {},
    };
    lastError = '';
    searchQuery = '';
    render();
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
        // omit
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
    const localDate = form.querySelector('[name="localDate"]').value;
    const exercise = resolveExercise(exerciseId);
    const orphanEdit =
      !exercise && dialogMode.mode === 'edit' && dialogMode.exerciseId === exerciseId;
    if (!exercise && !orphanEdit) {
      lastError = i18n.t('validation.exerciseNotAllowed');
      render();
      return;
    }
    const metrics = collectMetricValues(form, schemaKeysForDialog(exercise, dialogMode));
    saveBusy = true;
    lastError = '';
    render();

    let result;
    if (dialogMode.mode === 'add') {
      result = svc.create({ exerciseId, localDate, ...metrics });
    } else {
      result = svc.update(dialogMode.entryId, { exerciseId, localDate, ...metrics });
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
    const result = svc.delete(entryId);
    if (!result.ok) {
      lastError = result.message || i18n.t('error.deleteFailed');
    }
    render();
  }

  function applyFilters() {
    appliedFilters = {};
    if (draftFilters.localDate) appliedFilters.localDate = draftFilters.localDate;
    if (draftFilters.exerciseId) appliedFilters.exerciseId = draftFilters.exerciseId;
    if (draftFilters.region) appliedFilters.region = draftFilters.region;
    lastError = '';
    render();
  }

  function clearFilters() {
    draftFilters = { localDate: '', exerciseId: '', region: '' };
    appliedFilters = {};
    lastError = '';
    render();
  }

  function hasAppliedFilters() {
    return Boolean(appliedFilters.localDate || appliedFilters.exerciseId || appliedFilters.region);
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
        <form class="dialog" id="history-entry-form">
          <h2>${dialogMode.mode === 'add' ? i18n.t('today.addExercise') : i18n.t('today.editExercise')}</h2>
          ${lastError ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
          ${catalogNotice ? `<p class="inline-alert" role="status">${escapeHtml(catalogNotice)}</p>` : ''}
          <label class="field">
            <span>${escapeHtml(i18n.t('common.date'))}</span>
            <input type="date" name="localDate" value="${escapeHtml(dialogMode.localDate || '')}" required />
          </label>
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

  function renderList(entries, catalogList) {
    if (entries.length === 0) {
      if (hasAppliedFilters()) {
        return `<p class="empty-state" data-empty="filtered">${escapeHtml(i18n.t('history.emptyFiltered'))}</p>`;
      }
      return `<p class="empty-state" data-empty="history">${escapeHtml(i18n.t('history.empty'))}</p>`;
    }

    const groups = groupByDate(entries);
    return `<div class="history-groups" data-list="history">${groups
      .map((group) => {
        const rows = group.entries
          .map((entry) => {
            const ex = resolveExercise(entry.exerciseId);
            const orphan =
              typeof cat.isOrphan === 'function' ? cat.isOrphan(entry) : !ex;
            const name = ex ? ex.name : entry.exerciseId;
            const orphanBadge = orphan
              ? `<span class="orphan-badge" data-orphan="true">${escapeHtml(i18n.t('today.removedFromCatalog'))}</span>`
              : '';
            return `<li class="entry-row" data-entry-id="${escapeHtml(entry.entryId)}" data-local-date="${escapeHtml(
              entry.localDate
            )}"${orphan ? ' data-orphan="true"' : ''}>
              <div class="entry-main">
                <span class="entry-title">
                  <span class="entry-name">${escapeHtml(name)}</span>${renderExerciseHelp(
                    descriptionForExercise(entry.exerciseId, cat),
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
          .join('');
        return `<section class="history-day" data-date-group="${escapeHtml(group.localDate)}">
          <h2 class="history-day-heading">${escapeHtml(group.localDate)}</h2>
          <ul class="entry-list">${rows}</ul>
        </section>`;
      })
      .join('')}</div>`;
  }

  function render() {
    if (destroyed) return;
    const catalogList = loadCatalogList();
    const listed = svc.list(appliedFilters);
    const entries = listed.ok ? listed.data : [];
    if (!listed.ok && !lastError) lastError = listed.message;

    const regions = uniqueRegions(catalogList);

    root.innerHTML = `
      <section class="panel history-view" data-view="history">
        <header class="history-header">
          <h1>${escapeHtml(i18n.t('history.title'))}</h1>
        </header>
        ${lastError && !dialogMode ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
        <div class="history-toolbar">
          <button type="button" class="primary" data-action="add-exercise">${escapeHtml(i18n.t('today.addExercise'))}</button>
          <button type="button" class="ghost" data-action="reload-catalog">${escapeHtml(i18n.t('shell.reloadExerciseData'))}</button>
        </div>
        <form class="history-filters" id="history-filters">
          <label class="field">
            <span>${escapeHtml(i18n.t('common.date'))}</span>
            <input type="date" name="filterDate" value="${escapeHtml(draftFilters.localDate)}" />
          </label>
          <label class="field">
            <span>${escapeHtml(i18n.t('common.exercise'))}</span>
            <select name="filterExercise">
              <option value="">${escapeHtml(i18n.t('history.allExercises'))}</option>
              ${catalogList
                .map(
                  (e) =>
                    `<option value="${escapeHtml(e.exerciseId)}" ${
                      draftFilters.exerciseId === e.exerciseId ? 'selected' : ''
                    }>${escapeHtml(e.name)}</option>`
                )
                .join('')}
            </select>
          </label>
          <label class="field">
            <span>${escapeHtml(i18n.t('common.region'))}</span>
            <select name="filterRegion">
              <option value="">${escapeHtml(i18n.t('history.allRegions'))}</option>
              ${regions
                .map(
                  (r) =>
                    `<option value="${escapeHtml(r)}" ${
                      draftFilters.region === r ? 'selected' : ''
                    }>${escapeHtml(r)}</option>`
                )
                .join('')}
            </select>
          </label>
          <div class="filter-actions">
            <button type="submit" class="primary" data-action="apply-filters">${escapeHtml(i18n.t('history.applyFilters'))}</button>
            <button type="button" class="ghost" data-action="clear-filters">${escapeHtml(i18n.t('history.clearFilters'))}</button>
          </div>
        </form>
        ${renderList(entries, catalogList)}
      </section>
      ${renderDialog(catalogList)}
    `;

    bind(entries);
  }

  function bind(entries) {
    const addBtn = root.querySelector('[data-action="add-exercise"]');
    if (addBtn) addBtn.addEventListener('click', openAdd);

    const reloadBtn = root.querySelector('[data-action="reload-catalog"]');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        if (typeof cat.reloadFromDisk === 'function') {
          cat.reloadFromDisk();
        } else if (typeof cat.loadLiveCatalog === 'function') {
          cat.loadLiveCatalog();
        }
        catalogNotice = '';
        render();
      });
    }

    const filterForm = root.querySelector('#history-filters');
    if (filterForm) {
      filterForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        draftFilters = {
          localDate: filterForm.querySelector('[name="filterDate"]').value || '',
          exerciseId: filterForm.querySelector('[name="filterExercise"]').value || '',
          region: filterForm.querySelector('[name="filterRegion"]').value || '',
        };
        applyFilters();
      });
    }

    const clearBtn = root.querySelector('[data-action="clear-filters"]');
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    root.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-entry-id');
        const entry = entries.find((e) => e.entryId === id);
        if (entry) openEdit(entry);
      });
    });

    root.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => onDelete(btn.getAttribute('data-entry-id')));
    });

    const cancel = root.querySelector('[data-action="cancel-dialog"]');
    if (cancel) cancel.addEventListener('click', closeDialog);

    const form = root.querySelector('#history-entry-form');
    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        onSave(form);
      });

      const dateInput = form.querySelector('[name="localDate"]');
      if (dateInput) {
        dateInput.addEventListener('change', () => {
          dialogMode = { ...dialogMode, localDate: dateInput.value };
        });
      }

      const search = form.querySelector('[name="exerciseSearch"]');
      if (search) {
        search.addEventListener('input', () => {
          searchQuery = search.value;
          const select = form.querySelector('[name="exerciseId"]');
          const dateEl = form.querySelector('[name="localDate"]');
          dialogMode = {
            ...dialogMode,
            exerciseId: select ? select.value : dialogMode.exerciseId,
            localDate: dateEl ? dateEl.value : dialogMode.localDate,
          };
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
          const dateEl = form.querySelector('[name="localDate"]');
          const prevId = dialogMode.exerciseId;
          const nextId = select.value;
          dialogMode = {
            ...dialogMode,
            exerciseId: nextId,
            localDate: dateEl ? dateEl.value : dialogMode.localDate,
            metrics: nextId === prevId ? dialogMode.metrics || {} : {},
          };
          lastError = '';
          render();
        });
      }
    }
  }

  function destroy() {
    destroyed = true;
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  render();

  return {
    refresh,
    destroy,
    getRoot: () => root,
    /** test helper */
    getAppliedFilters: () => ({ ...appliedFilters }),
  };
}

module.exports = {
  mountHistoryView,
  groupByDate,
};
