/**
 * Feature 8 — Active Workout
 * Spec: features/feature-8-Active-Workout.md
 */

const workout = require('./workout');
const { metricLabel } = require('./todayView');
const {
  isTimeDurationKey,
  splitDurationSeconds,
  combineDurationParts,
} = require('./parse/duration');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function groupByHeaders(items) {
  const groups = [];
  const map = new Map();
  for (const item of items) {
    const key = (item.headers || []).join(' › ') || 'General';
    if (!map.has(key)) {
      const g = { headerKey: key, headers: item.headers || [], items: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key).items.push(item);
  }
  return groups;
}

function schemaKeys(item) {
  if (item.targets && Object.keys(item.targets).length) return Object.keys(item.targets);
  return Object.keys(item.metrics || {});
}

function renderMetricField(item, key) {
  const disabled = item.checked ? '' : 'disabled';
  const label = escapeHtml(metricLabel(key));

  if (isTimeDurationKey(key)) {
    const raw = item.metrics && item.metrics[key] != null ? item.metrics[key] : null;
    const parts = raw == null || raw === '' ? null : splitDurationSeconds(raw);
    const showH = parts ? String(parts.hours) : '';
    const showM = parts ? String(parts.minutes) : '';
    const showS = parts ? String(parts.seconds) : '';
    return `<div class="field workout-metric workout-duration" data-duration-metric="${escapeHtml(key)}">
      <span class="workout-metric-label">${label}</span>
      <div class="duration-parts">
        <label class="duration-part">
          <input type="number" min="0" step="1" inputmode="numeric" name="metric-${escapeHtml(
            key
          )}-h" value="${escapeHtml(showH)}" ${disabled} data-duration-part="h" />
          <span class="duration-unit">h</span>
        </label>
        <label class="duration-part">
          <input type="number" min="0" step="1" inputmode="numeric" name="metric-${escapeHtml(
            key
          )}-m" value="${escapeHtml(showM)}" ${disabled} data-duration-part="m" />
          <span class="duration-unit">m</span>
        </label>
        <label class="duration-part">
          <input type="number" min="0" step="any" inputmode="decimal" name="metric-${escapeHtml(
            key
          )}-s" value="${escapeHtml(showS)}" ${disabled} data-duration-part="s" />
          <span class="duration-unit">s</span>
        </label>
      </div>
    </div>`;
  }

  const val = item.metrics && item.metrics[key] != null ? item.metrics[key] : '';
  return `<label class="field workout-metric">
    <span>${label}</span>
    <input type="text" name="metric-${escapeHtml(key)}" value="${escapeHtml(val)}" ${disabled} />
  </label>`;
}

/**
 * Mount Active Workout checklist into `root`.
 */
function mountActiveWorkoutView(root, options = {}) {
  const svc = options.workout || workout;
  const confirmFn = options.confirm || ((msg) => window.confirm(msg));
  const onComplete = options.onComplete || (() => {});
  const onCancel = options.onCancel || options.onBack || (() => {});
  let destroyed = false;
  let draft = null;
  let lastError = '';

  function destroy() {
    destroyed = true;
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  function ensureDraft() {
    if (draft) return draft;
    if (options.draft) {
      draft = options.draft;
      return draft;
    }
    const started = svc.start(options.localDate);
    if (!started.ok) {
      lastError = started.message || 'Failed to start workout.';
      draft = { sessionLocalDate: options.localDate || '', items: [], dirty: false };
      return draft;
    }
    draft = started.data;
    return draft;
  }

  function readDurationFromRow(rowEl, key) {
    const hEl = rowEl.querySelector(`[name="metric-${key}-h"]`);
    const mEl = rowEl.querySelector(`[name="metric-${key}-m"]`);
    const sEl = rowEl.querySelector(`[name="metric-${key}-s"]`);
    if (!hEl && !mEl && !sEl) return null;
    return combineDurationParts({
      hours: hEl ? hEl.value : '',
      minutes: mEl ? mEl.value : '',
      seconds: sEl ? sEl.value : '',
    });
  }

  function syncItemFromDom(rowEl) {
    if (!draft || !rowEl) return;
    const id = rowEl.getAttribute('data-exercise-id');
    const item = draft.items.find((i) => i.exerciseId === id);
    if (!item) return;
    const check = rowEl.querySelector('[data-check]');
    item.checked = Boolean(check && check.checked);
    const metrics = { ...item.metrics };
    for (const key of schemaKeys(item)) {
      if (isTimeDurationKey(key)) {
        const hEl = rowEl.querySelector(`[name="metric-${key}-h"]`);
        const mEl = rowEl.querySelector(`[name="metric-${key}-m"]`);
        const sEl = rowEl.querySelector(`[name="metric-${key}-s"]`);
        const allEmpty =
          (!hEl || hEl.value === '') && (!mEl || mEl.value === '') && (!sEl || sEl.value === '');
        if (allEmpty) {
          delete metrics[key];
          item._durationError = null;
          continue;
        }
        const combined = readDurationFromRow(rowEl, key);
        if (!combined) continue;
        if (!combined.ok) {
          item._durationError = combined.message;
          continue;
        }
        item._durationError = null;
        metrics[key] = combined.seconds;
        continue;
      }
      const input = rowEl.querySelector(`[name="metric-${key}"]`);
      if (!input) continue;
      const raw = input.value;
      if (raw === '' || raw == null) {
        delete metrics[key];
      } else {
        const n = Number(raw);
        metrics[key] = Number.isFinite(n) ? n : raw;
      }
    }
    item.metrics = metrics;
    draft.dirty = svc.isDirty ? svc.isDirty(draft) : true;
  }

  function syncAllFromDom() {
    root.querySelectorAll('.workout-row').forEach((row) => syncItemFromDom(row));
  }

  function requestCancel() {
    syncAllFromDom();
    const dirty = svc.isDirty ? svc.isDirty(draft) : draft && draft.dirty;
    if (dirty) {
      const ok = confirmFn('Discard this workout?');
      if (!ok) return;
    }
    svc.cancel();
    draft = null;
    onCancel();
  }

  function onCompleteClick() {
    syncAllFromDom();
    lastError = '';
    const bad = (draft.items || []).find((i) => i.checked && i._durationError);
    if (bad) {
      lastError = bad._durationError;
      render();
      return;
    }
    const result = svc.complete(draft);
    if (!result.ok) {
      lastError = result.message || 'Complete failed.';
      render();
      return;
    }
    draft = null;
    onComplete(result.data);
  }

  function render() {
    if (destroyed) return;
    const d = ensureDraft();
    const groups = groupByHeaders(d.items || []);

    const body =
      !d.items || d.items.length === 0
        ? `<p class="empty-state" data-empty="workout">No exercises expected today.</p>`
        : `<div class="workout-checklist" data-workout-checklist>${groups
            .map((group) => {
              const heading =
                group.headers && group.headers.length
                  ? `<h2 class="workout-group-heading" data-header-path="${escapeHtml(
                      group.headers.join('>')
                    )}">${escapeHtml(group.headers.join(' › '))}</h2>`
                  : '';
              const rows = group.items
                .map((item) => {
                  const keys = schemaKeys(item);
                  const fields = keys.map((key) => renderMetricField(item, key)).join('');
                  return `<li class="workout-row" data-exercise-id="${escapeHtml(item.exerciseId)}" data-checked="${
                    item.checked ? 'true' : 'false'
                  }">
                    <label class="workout-check-label">
                      <input type="checkbox" data-check ${item.checked ? 'checked' : ''} />
                      <span class="workout-exercise-name">${escapeHtml(item.name)}</span>
                    </label>
                    <div class="workout-metrics">${fields}</div>
                  </li>`;
                })
                .join('');
              return `<section class="workout-group">${heading}<ul class="workout-rows">${rows}</ul></section>`;
            })
            .join('')}</div>`;

    root.innerHTML = `
      <section class="panel active-workout-view" data-view="activeWorkout">
        <header class="workout-header">
          <h1>Workout</h1>
          <p class="workout-date" data-local-date>${escapeHtml(d.sessionLocalDate || '')}</p>
        </header>
        ${lastError ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
        ${body}
        <div class="workout-actions">
          <button type="button" class="ghost" data-action="cancel">Cancel</button>
          <button type="button" class="primary" data-action="complete">Complete</button>
        </div>
      </section>
    `;

    bind();
  }

  function bind() {
    root.querySelectorAll('[data-check]').forEach((check) => {
      check.addEventListener('change', () => {
        const row = check.closest('.workout-row');
        syncItemFromDom(row);
        render();
      });
    });

    root.querySelectorAll('.workout-row input[type="text"], .workout-row input[type="number"]').forEach((input) => {
      input.addEventListener('change', () => {
        const row = input.closest('.workout-row');
        syncItemFromDom(row);
      });
      input.addEventListener('input', () => {
        const row = input.closest('.workout-row');
        syncItemFromDom(row);
      });
    });

    const completeBtn = root.querySelector('[data-action="complete"]');
    if (completeBtn) completeBtn.addEventListener('click', onCompleteClick);

    const cancelBtn = root.querySelector('[data-action="cancel"]');
    if (cancelBtn) cancelBtn.addEventListener('click', requestCancel);
  }

  render();

  return {
    refresh,
    destroy,
    getRoot: () => root,
    /** test helper */
    getDraft: () => draft,
  };
}

module.exports = {
  mountActiveWorkoutView,
  groupByHeaders,
};
