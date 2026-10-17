/**
 * Feature 2 — Daily Exercise Log
 * Spec: features/feature-2-Daily-Exercise-Log.md
 */

const dailyLog = require('./dailyLog');
const catalog = require('./catalog');
const { parseDurationToSeconds } = require('./parse/duration');

const METRIC_LABELS = {
  weight: 'Weight',
  reps: 'Reps',
  sets: 'Sets',
  durationSeconds: 'Duration',
  durationGoSeconds: 'Go',
  durationRestSeconds: 'Rest',
  durationSteps: 'Steps',
};

function metricLabel(key) {
  return METRIC_LABELS[key] || key;
}

function formatMetricsSummary(metrics) {
  if (!metrics || typeof metrics !== 'object') return '';
  return Object.entries(metrics)
    .map(([k, v]) => `${metricLabel(k)} ${v}`)
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

  const tickMs = options.tickMs != null ? options.tickMs : 60000;
  let tickId = null;
  let onFocus = null;

  function loadCatalogList() {
    const loaded = cat.loadCatalog ? cat.loadCatalog() : { ok: true, data: [] };
    if (loaded && loaded.ok && Array.isArray(loaded.data)) return loaded.data;
    // cached catalog already loaded by bootstrap
    if (typeof cat.getExerciseById === 'function') {
      // Fall back: re-load
      const again = require('./catalog').loadCatalog();
      return again.ok ? again.data : [];
    }
    return [];
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
    saveBusy = false;
    render();
  }

  function resolveExercise(exerciseId) {
    return cat.getExerciseById(exerciseId);
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
      result = log.createToday({ exerciseId, ...metrics });
    } else {
      result = log.updateToday(dialogMode.entryId, { exerciseId, ...metrics });
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
    const result = log.deleteToday(entryId);
    if (!result.ok) {
      lastError = result.message || 'Delete failed.';
    }
    render();
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
        <form class="dialog" id="entry-form">
          <h2>${dialogMode.mode === 'add' ? 'Add exercise' : 'Edit exercise'}</h2>
          ${lastError ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
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

  function render() {
    if (destroyed) return;
    const today = log.currentLocalDate();
    const listed = log.listToday();
    const entries = listed.ok ? listed.data : [];
    const catalogList = loadCatalogList();

    if (!listed.ok && !lastError) {
      lastError = listed.message;
    }

    const rows =
      entries.length === 0
        ? `<p class="empty-state" data-empty="today">No exercises logged today.</p>`
        : `<ul class="entry-list" data-list="today">${entries
            .map((entry) => {
              const ex = resolveExercise(entry.exerciseId);
              const name = ex ? ex.name : entry.exerciseId;
              return `<li class="entry-row" data-entry-id="${escapeHtml(entry.entryId)}">
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
            .join('')}</ul>`;

    root.innerHTML = `
      <section class="panel today-view" data-view="today">
        <header class="today-header">
          <h1>Today</h1>
          <p class="today-date" data-local-date>${escapeHtml(today)}</p>
        </header>
        ${lastError && !dialogMode ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
        <div class="today-toolbar">
          <button type="button" class="primary" data-action="add-exercise">Add exercise</button>
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
  metricLabel,
  METRIC_LABELS,
};
