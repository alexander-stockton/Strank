/**
 * Feature 3 — Exercise History
 * Spec: features/feature-3-Exercise-History.md
 */

const history = require('./history');
const catalog = require('./catalog');
const dailyLog = require('./dailyLog');
const { parseDurationToSeconds } = require('./parse/duration');
const { formatMetricsSummary, metricLabel } = require('./todayView');

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
  /** Draft filter inputs */
  let draftFilters = { localDate: '', exerciseId: '', region: '' };
  /** Applied filters */
  let appliedFilters = {};

  function loadCatalogList() {
    const loaded = cat.loadCatalog ? cat.loadCatalog() : { ok: false };
    if (loaded && loaded.ok && Array.isArray(loaded.data)) return loaded.data;
    const again = require('./catalog').loadCatalog();
    return again.ok ? again.data : [];
  }

  function resolveExercise(exerciseId) {
    return cat.getExerciseById(exerciseId);
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
    if (!exercise) {
      lastError = 'Exercise is not allowed.';
      render();
      return;
    }
    const metrics = collectMetricValues(form, exercise.metrics);
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
      lastError = result.message || 'Save failed.';
      render();
      return;
    }
    closeDialog();
  }

  function onDelete(entryId) {
    const ok = confirmFn('Delete this exercise entry?');
    if (!ok) return;
    const result = svc.delete(entryId);
    if (!result.ok) {
      lastError = result.message || 'Delete failed.';
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
    const filtered = catalogList.filter((e) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.exerciseId.toLowerCase().includes(q);
    });

    const metricFields = exercise
      ? exercise.metrics
          .map((key) => {
            const existing =
              dialogMode.metrics && dialogMode.metrics[key] != null ? dialogMode.metrics[key] : '';
            return `
            <label class="field">
              <span>${escapeHtml(metricLabel(key))}</span>
              <input type="text" name="metric-${escapeHtml(key)}" value="${escapeHtml(existing)}" />
            </label>`;
          })
          .join('')
      : '';

    return `
      <div class="dialog-backdrop" data-dialog="entry">
        <form class="dialog" id="history-entry-form">
          <h2>${dialogMode.mode === 'add' ? 'Add exercise' : 'Edit exercise'}</h2>
          ${lastError ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
          <label class="field">
            <span>Date</span>
            <input type="date" name="localDate" value="${escapeHtml(dialogMode.localDate || '')}" required />
          </label>
          <label class="field">
            <span>Search</span>
            <input type="search" name="exerciseSearch" value="${escapeHtml(searchQuery)}" placeholder="Filter exercises" />
          </label>
          <label class="field">
            <span>Exercise</span>
            <select name="exerciseId" required>
              <option value="">Select an exercise</option>
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
            <button type="button" class="ghost" data-action="cancel-dialog">Cancel</button>
            <button type="submit" class="primary" data-action="save" ${saveBusy ? 'disabled' : ''}>Save</button>
          </div>
        </form>
      </div>`;
  }

  function renderList(entries, catalogList) {
    if (entries.length === 0) {
      if (hasAppliedFilters()) {
        return `<p class="empty-state" data-empty="filtered">No exercises match these filters.</p>`;
      }
      return `<p class="empty-state" data-empty="history">No exercise history yet.</p>`;
    }

    const groups = groupByDate(entries);
    return `<div class="history-groups" data-list="history">${groups
      .map((group) => {
        const rows = group.entries
          .map((entry) => {
            const ex = resolveExercise(entry.exerciseId);
            const name = ex ? ex.name : entry.exerciseId;
            return `<li class="entry-row" data-entry-id="${escapeHtml(entry.entryId)}" data-local-date="${escapeHtml(
              entry.localDate
            )}">
              <div class="entry-main">
                <span class="entry-name">${escapeHtml(name)}</span>
                <span class="entry-metrics">${escapeHtml(formatMetricsSummary(entry.metrics))}</span>
              </div>
              <div class="entry-actions">
                <button type="button" data-action="edit" data-entry-id="${escapeHtml(entry.entryId)}">Edit</button>
                <button type="button" data-action="delete" data-entry-id="${escapeHtml(entry.entryId)}">Delete</button>
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
          <h1>History</h1>
        </header>
        ${lastError && !dialogMode ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
        <div class="history-toolbar">
          <button type="button" class="primary" data-action="add-exercise">Add exercise</button>
        </div>
        <form class="history-filters" id="history-filters">
          <label class="field">
            <span>Date</span>
            <input type="date" name="filterDate" value="${escapeHtml(draftFilters.localDate)}" />
          </label>
          <label class="field">
            <span>Exercise</span>
            <select name="filterExercise">
              <option value="">All exercises</option>
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
            <span>Region</span>
            <select name="filterRegion">
              <option value="">All regions</option>
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
            <button type="submit" class="primary" data-action="apply-filters">Apply filters</button>
            <button type="button" class="ghost" data-action="clear-filters">Clear filters</button>
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
