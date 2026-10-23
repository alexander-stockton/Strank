/**
 * Feature 8 - Active Workout
 * Spec: features/feature-8-Active-Workout.md
 */

const workout = require('./workout');
const { metricLabel } = require('./todayView');
const { getWeightUnits, getDistanceUnits } = require('./config');
const {
  isTimeDurationKey,
  splitDurationSeconds,
  combineDurationParts,
  borrowDurationOnStepDown,
} = require('./parse/duration');
const { renderExerciseHelp, descriptionForExercise } = require('./exerciseHelp');
const catalog = require('./catalog');
const { formatDisplayDate } = require('./appDate');
const { formatDuration, readElapsedMs } = require('./workoutTimer');
const dailyLog = require('./dailyLog');
const i18n = require('./i18n');
const { qualityFromHeaders } = require('./rankTokens');
const historyDayAdd = require('./historyDayAdd');
const { renderAddExerciseOverlay, bindAddExerciseOverlay } = require('./addExercisePicker');

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
    const key = (item.headers || []).join(' › ') || i18n.t('group.general');
    if (!map.has(key)) {
      const g = { headerKey: key, headers: item.headers || [], items: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key).items.push(item);
  }
  return groups;
}

/** Bucket by STRENGTH / ENDURANCE quality in header path. */
function qualityBucket(headers) {
  return qualityFromHeaders(headers);
}

function schemaKeys(item) {
  if (item.targets && Object.keys(item.targets).length) return Object.keys(item.targets);
  return Object.keys(item.metrics || {});
}

function clampNumberInput(raw, { min = 0, max = Infinity, integer = false } = {}) {
  if (raw === '' || raw == null) return '';
  let n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (integer) n = Math.trunc(n);
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
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
          <input type="number" min="0" max="200" step="1" inputmode="numeric" name="metric-${escapeHtml(
            key
          )}-h" value="${escapeHtml(showH)}" ${disabled} data-duration-part="h" class="metric-input-hours" />
          <span class="duration-unit">${escapeHtml(i18n.t('common.hours'))}</span>
        </label>
        <label class="duration-part">
          <input type="number" min="-1" step="1" inputmode="numeric" name="metric-${escapeHtml(
            key
          )}-m" value="${escapeHtml(showM)}" ${disabled} data-duration-part="m" class="metric-input-minutes" />
          <span class="duration-unit">${escapeHtml(i18n.t('common.minutes'))}</span>
        </label>
        <label class="duration-part">
          <input type="number" min="-1" step="any" inputmode="decimal" name="metric-${escapeHtml(
            key
          )}-s" value="${escapeHtml(showS)}" ${disabled} data-duration-part="s" class="metric-input-seconds" />
          <span class="duration-unit">${escapeHtml(i18n.t('common.seconds'))}</span>
        </label>
      </div>
    </div>`;
  }

  const val = item.metrics && item.metrics[key] != null ? item.metrics[key] : '';
  if (key === 'weight') {
    const unitConversion = require('./unitConversion');
    const unit = escapeHtml(unitConversion.weightDisplayLabel(getWeightUnits()));
    return `<label class="field workout-metric workout-metric-weight">
      <span>${label}</span>
      <span class="weight-input-wrap">
        <input type="number" min="0" max="999999.99" step="0.01" inputmode="decimal" name="metric-${escapeHtml(
          key
        )}" value="${escapeHtml(val)}" ${disabled} class="metric-input-weight" />
        <span class="weight-unit" data-weight-unit>${unit}</span>
      </span>
    </label>`;
  }
  if (key === 'distance') {
    const unitConversion = require('./unitConversion');
    const unit = escapeHtml(unitConversion.distanceDisplayLabel(getDistanceUnits()));
    return `<label class="field workout-metric workout-metric-distance">
      <span>${label}</span>
      <span class="weight-input-wrap distance-input-wrap">
        <input type="number" min="0" max="999999.99" step="0.01" inputmode="decimal" name="metric-${escapeHtml(
          key
        )}" value="${escapeHtml(val)}" ${disabled} class="metric-input-weight metric-input-distance" />
        <span class="weight-unit distance-unit" data-distance-unit>${unit}</span>
      </span>
    </label>`;
  }
  if (key === 'reps' || key === 'sets') {
    return `<label class="field workout-metric workout-metric-${escapeHtml(key)}">
      <span>${label}</span>
      <input type="number" min="1" max="9999" step="1" inputmode="numeric" name="metric-${escapeHtml(
        key
      )}" value="${escapeHtml(val)}" ${disabled} class="metric-input-${escapeHtml(key)}" />
    </label>`;
  }

  return `<label class="field workout-metric">
    <span>${label}</span>
    <input type="text" name="metric-${escapeHtml(key)}" value="${escapeHtml(val)}" ${disabled} />
  </label>`;
}

function renderMetricRows(item) {
  const keys = schemaKeys(item);
  const primary = keys.filter((k) => k === 'weight' || k === 'distance' || isTimeDurationKey(k));
  const secondary = keys.filter((k) => k === 'reps' || k === 'sets');
  const rest = keys.filter((k) => !primary.includes(k) && !secondary.includes(k));

  const rows = [];
  if (primary.length) {
    rows.push(
      `<div class="workout-metric-row workout-metric-row-primary">${primary
        .map((k) => renderMetricField(item, k))
        .join('')}</div>`
    );
  }
  if (secondary.length) {
    rows.push(
      `<div class="workout-metric-row workout-metric-row-secondary">${secondary
        .map((k) => renderMetricField(item, k))
        .join('')}</div>`
    );
  }
  if (rest.length) {
    rows.push(
      `<div class="workout-metric-row">${rest.map((k) => renderMetricField(item, k)).join('')}</div>`
    );
  }
  return `<div class="workout-metrics">${rows.join('')}</div>`;
}

function renderExerciseRow(item) {
  return `<li class="workout-row" data-exercise-id="${escapeHtml(item.exerciseId)}" data-checked="${
    item.checked ? 'true' : 'false'
  }">
    <div class="workout-check-row">
      <label class="workout-check-label">
        <input type="checkbox" data-check ${item.checked ? 'checked' : ''} />
        <span class="workout-exercise-name">${escapeHtml(item.name)}</span>
      </label>
      ${renderExerciseHelp(
        item.notes != null ? item.notes : descriptionForExercise(item.exerciseId, catalog),
        { id: item.exerciseId }
      )}
    </div>
    ${renderMetricRows(item)}
  </li>`;
}

function renderHeaderGroups(items) {
  const groups = groupByHeaders(items);
  return groups
    .map((group) => {
      const heading =
        group.headers && group.headers.length
          ? `<h2 class="workout-group-heading" data-header-path="${escapeHtml(
              group.headers.join('>')
            )}">${escapeHtml(group.headers.join(' › '))}</h2>`
          : '';
      const rows = group.items.map(renderExerciseRow).join('');
      return `<section class="workout-group">${heading}<ul class="workout-rows">${rows}</ul></section>`;
    })
    .join('');
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
  let timerRaf = null;
  let addPicker = null;
  let addBusy = false;

  function loadCatalogList() {
    if (typeof catalog.loadLiveCatalog === 'function') {
      const loaded = catalog.loadLiveCatalog();
      if (loaded && loaded.ok && Array.isArray(loaded.data)) return loaded.data;
    }
    return [];
  }

  function openAddPicker() {
    syncAllFromDom();
    addPicker = { focus: 'arms', type: 'strength', subtype: 'push', exerciseId: '' };
    lastError = '';
    render();
  }

  function closeAddPicker() {
    addPicker = null;
    lastError = '';
    render();
  }

  function patchAddPicker(patch) {
    addPicker = { ...(addPicker || {}), ...patch };
    render();
  }

  function submitAddExercise() {
    if (!addPicker || addBusy) return;
    const catalogList = loadCatalogList();
    const sel = historyDayAdd.normalizePickerSelection(catalogList, addPicker);
    if (!sel.exerciseId) {
      lastError = i18n.t('validation.exerciseNotAllowed');
      render();
      return;
    }
    if (typeof svc.addCustomExercise !== 'function') {
      lastError = i18n.t('workout.completeFailed');
      render();
      return;
    }
    addBusy = true;
    const result = svc.addCustomExercise(sel.exerciseId);
    addBusy = false;
    if (!result.ok) {
      lastError = result.message || i18n.t('error.saveFailed');
      render();
      return;
    }
    draft = result.data || svc.getDraft();
    addPicker = null;
    lastError = '';
    render();
  }

  function stopTimerLoop() {
    if (timerRaf != null) {
      clearInterval(timerRaf);
      timerRaf = null;
    }
  }

  function paintTimer() {
    const el = root.querySelector('[data-workout-timer]');
    if (!el || !draft) return;
    const ms =
      typeof svc.getSessionElapsedMs === 'function'
        ? svc.getSessionElapsedMs()
        : readElapsedMs(draft.timer);
    el.textContent = formatDuration(ms);
  }

  function startTimerLoop() {
    stopTimerLoop();
    paintTimer();
    // setInterval is more reliable than rAF in NW.js after long overlays / remounts
    timerRaf = setInterval(() => {
      if (destroyed) {
        stopTimerLoop();
        return;
      }
      paintTimer();
    }, 50);
  }

  function destroy() {
    destroyed = true;
    stopTimerLoop();
    // Pause only when no other Active Workout remains on screen. Remounts / view
    // slides can destroy an outgoing pane while the incoming one already owns the
    // same draft - pausing then freezes the timer permanently.
    const doc = root.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const otherAw =
      doc &&
      Array.from(doc.querySelectorAll('[data-view="activeWorkout"]')).some(
        (el) => root && !root.contains(el)
      );
    if (!otherAw && typeof svc.pauseSessionTimer === 'function') {
      svc.pauseSessionTimer();
    }
    root.innerHTML = '';
  }

  /** Keep DOM when the workout pane is cached off-screen; pause the session timer. */
  function suspend() {
    if (destroyed) return;
    stopTimerLoop();
    if (typeof svc.pauseSessionTimer === 'function') svc.pauseSessionTimer();
  }

  /** Resume after returning from the previous-view cache. */
  function resume() {
    if (destroyed) return;
    if (typeof svc.resumeSessionTimer === 'function') svc.resumeSessionTimer();
    startTimerLoop();
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
    if (typeof svc.getDraft === 'function') {
      const existing = svc.getDraft();
      if (existing && existing.sessionLocalDate === (options.localDate || existing.sessionLocalDate)) {
        draft = existing;
        return draft;
      }
    }
    const started = svc.start(options.localDate);
    if (!started.ok) {
      lastError = started.message || i18n.t('workout.startFailed');
      draft = { sessionLocalDate: options.localDate || '', items: [], dirty: false, timer: null };
      return draft;
    }
    draft = started.data;
    return draft;
  }

  function durationPartsFromRow(rowEl, key) {
    const hEl = rowEl.querySelector(`[name="metric-${key}-h"]`);
    const mEl = rowEl.querySelector(`[name="metric-${key}-m"]`);
    const sEl = rowEl.querySelector(`[name="metric-${key}-s"]`);
    return {
      hEl,
      mEl,
      sEl,
      hours: hEl ? hEl.value : '',
      minutes: mEl ? mEl.value : '',
      seconds: sEl ? sEl.value : '',
    };
  }

  function writeDurationParts(rowEl, key, parts) {
    const hEl = rowEl.querySelector(`[name="metric-${key}-h"]`);
    const mEl = rowEl.querySelector(`[name="metric-${key}-m"]`);
    const sEl = rowEl.querySelector(`[name="metric-${key}-s"]`);
    if (hEl) hEl.value = String(parts.hours);
    if (mEl) mEl.value = String(parts.minutes);
    if (sEl) sEl.value = String(parts.seconds != null ? parts.seconds : parts.secondsPart);
  }

  /** Handle spinner/arrow decrement past 0 on minutes or seconds. */
  function applyDurationBorrow(rowEl, key, field) {
    const parts = durationPartsFromRow(rowEl, key);
    const borrowed = borrowDurationOnStepDown(
      { hours: parts.hours, minutes: parts.minutes, seconds: parts.seconds },
      field
    );
    if (!borrowed.ok) return false;
    writeDurationParts(rowEl, key, borrowed);
    return borrowed.changed;
  }

  function syncItemFromDom(rowEl) {
    if (!draft || !rowEl) return;
    const id = rowEl.getAttribute('data-exercise-id');
    const item = draft.items.find((i) => i.exerciseId === id);
    if (!item) return;
    const check = rowEl.querySelector('[data-check]');
    const nextChecked = Boolean(check && check.checked);
    if (nextChecked && !item.checked) {
      item.completedAt = dailyLog.toIsoWithOffset(dailyLog.now());
    } else if (!nextChecked) {
      item.completedAt = null;
    }
    item.checked = nextChecked;
    const metrics = { ...item.metrics };
    for (const key of schemaKeys(item)) {
      if (isTimeDurationKey(key)) {
        const parts = durationPartsFromRow(rowEl, key);
        const { hEl, mEl, sEl } = parts;
        // Spinner stepped below 0 -> borrow from higher unit
        if (mEl && Number(mEl.value) < 0) {
          applyDurationBorrow(rowEl, key, 'minutes');
        }
        if (sEl && Number(sEl.value) < 0) {
          applyDurationBorrow(rowEl, key, 'seconds');
        }
        const refreshed = durationPartsFromRow(rowEl, key);
        const allEmpty =
          (!refreshed.hEl || refreshed.hEl.value === '') &&
          (!refreshed.mEl || refreshed.mEl.value === '') &&
          (!refreshed.sEl || refreshed.sEl.value === '');
        if (allEmpty) {
          delete metrics[key];
          item._durationError = null;
          continue;
        }
        // Carry overflow: s>=60 -> minutes; m>=60 -> hours (e.g. 241m -> 4h 1m)
        const combined = combineDurationParts({
          hours: refreshed.hours,
          minutes: refreshed.minutes,
          seconds: refreshed.seconds,
        });
        if (!combined.ok) {
          item._durationError = combined.message;
          continue;
        }
        writeDurationParts(rowEl, key, {
          hours: combined.hours,
          minutes: combined.minutes,
          seconds: combined.secondsPart,
        });
        item._durationError = null;
        metrics[key] = combined.seconds;
        continue;
      }
      const input = rowEl.querySelector(`[name="metric-${key}"]`);
      if (!input) continue;
      let raw = input.value;
      if (raw === '' || raw == null) {
        delete metrics[key];
        continue;
      }
      if (key === 'weight' || key === 'distance') {
        const unitConversion = require('./unitConversion');
        raw = clampNumberInput(raw, { min: 0, max: unitConversion.MEASURE_MAX });
        if (raw !== '' && Number.isFinite(Number(raw))) {
          if (key === 'weight') {
            const config = require('./config');
            raw = unitConversion.roundWeightForUnit(Number(raw), config.getWeightUnits());
          } else {
            raw = unitConversion.roundMeasure(Number(raw));
          }
        }
        input.value = raw === '' ? '' : String(raw);
      } else if (key === 'reps' || key === 'sets') {
        raw = clampNumberInput(raw, { min: 1, max: 9999, integer: true });
        input.value = raw === '' ? '' : String(raw);
      }
      const n = Number(raw);
      metrics[key] = Number.isFinite(n) ? n : raw;
    }
    item.metrics = metrics;
    draft.dirty = svc.isDirty ? svc.isDirty(draft) : true;
  }

  function syncAllFromDom() {
    root.querySelectorAll('.workout-row').forEach((row) => syncItemFromDom(row));
  }

  function applyCheckedState(rowEl) {
    const checked = Boolean(rowEl.querySelector('[data-check]') && rowEl.querySelector('[data-check]').checked);
    rowEl.setAttribute('data-checked', checked ? 'true' : 'false');
    rowEl.querySelectorAll('input[type="number"], input[type="text"]').forEach((input) => {
      if (input.hasAttribute('data-check')) return;
      input.disabled = !checked;
    });
  }

  function requestCancel() {
    syncAllFromDom();
    const dirty = svc.isDirty ? svc.isDirty(draft) : draft && draft.dirty;
    if (dirty) {
      const ok = confirmFn(i18n.t('workout.discard'));
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
      lastError = result.message || i18n.t('workout.completeFailed');
      render();
      return;
    }
    draft = null;
    onComplete(result.data);
  }

  function render() {
    if (destroyed) return;
    const d = ensureDraft();
    const items = d.items || [];

    let body;
    if (!items.length) {
      body = `<p class="empty-state" data-empty="workout">${escapeHtml(i18n.t('workout.empty'))}</p>`;
    } else {
      const isCustom =
        typeof svc.isCustomItem === 'function'
          ? (i) => svc.isCustomItem(i)
          : (i) =>
              i.custom === true ||
              (i.headers || []).some((h) => String(h).trim().toLowerCase() === 'custom');
      const custom = items.filter((i) => isCustom(i));
      const planned = items.filter((i) => !isCustom(i));
      const strength = planned.filter((i) => qualityBucket(i.headers) === 'strength');
      const endurance = planned.filter((i) => qualityBucket(i.headers) === 'endurance');
      const other = planned.filter((i) => qualityBucket(i.headers) === 'other');

      const cols = [];
      if (strength.length) {
        cols.push(
          `<div class="workout-col workout-col-strength" data-workout-col="strength">
            <h2 class="workout-col-heading">${escapeHtml(i18n.t('quality.strength'))}</h2>
            ${renderHeaderGroups(strength)}
          </div>`
        );
      }
      if (endurance.length) {
        cols.push(
          `<div class="workout-col workout-col-endurance" data-workout-col="endurance">
            <h2 class="workout-col-heading">${escapeHtml(i18n.t('quality.endurance'))}</h2>
            ${renderHeaderGroups(endurance)}
          </div>`
        );
      }
      if (other.length) {
        cols.push(
          `<div class="workout-col workout-col-other" data-workout-col="other">
            ${renderHeaderGroups(other)}
          </div>`
        );
      }
      if (custom.length) {
        // Column heading is already "Custom"; skip redundant group path headings.
        const customRows = custom.map(renderExerciseRow).join('');
        cols.push(
          `<div class="workout-col workout-col-custom" data-workout-col="custom">
            <h2 class="workout-col-heading">${escapeHtml(i18n.t('workout.custom'))}</h2>
            <section class="workout-group"><ul class="workout-rows">${customRows}</ul></section>
          </div>`
        );
      }

      const multiCol = [strength.length, endurance.length, custom.length].filter(Boolean).length > 1;
      const colClass = multiCol
        ? 'workout-checklist workout-checklist-columns'
        : 'workout-checklist';
      body = `<div class="${colClass}" data-workout-checklist>${cols.join('')}</div>`;
    }

    let addOverlayHtml = '';
    if (addPicker) {
      const rendered = renderAddExerciseOverlay({
        addPicker,
        catalogList: loadCatalogList(),
        lastError,
        saveBusy: addBusy,
      });
      addPicker = rendered.normalizedPicker;
      addOverlayHtml = rendered.html;
    }

    const elapsed =
      typeof svc.getSessionElapsedMs === 'function'
        ? svc.getSessionElapsedMs()
        : readElapsedMs(d.timer);

    root.innerHTML = `
      <section class="panel active-workout-view" data-view="activeWorkout">
        <header class="workout-header">
          <h1>${escapeHtml(i18n.t('workout.title'))}</h1>
          <p class="workout-date" data-local-date="${escapeHtml(d.sessionLocalDate || '')}">${escapeHtml(
            formatDisplayDate(d.sessionLocalDate || '')
          )}</p>
        </header>
        ${lastError && !addPicker ? `<p class="inline-alert" role="alert">${escapeHtml(lastError)}</p>` : ''}
        ${body}
        <div class="workout-footer">
          <div class="workout-footer-start">
            ${renderExerciseHelp(i18n.t('workout.stayHelp'), {
              id: 'workout-stay',
              ariaLabel: i18n.t('workout.stayHelpAria'),
            })}
            <div class="workout-timer" data-workout-timer aria-live="off">${escapeHtml(
              formatDuration(elapsed)
            )}</div>
          </div>
          <div class="workout-actions">
            <button type="button" class="primary outline" data-action="add-exercise">${escapeHtml(
              i18n.t('history.addExercise')
            )}</button>
            <button type="button" class="ghost" data-action="cancel">${escapeHtml(i18n.t('common.cancel'))}</button>
            <button type="button" class="primary" data-action="complete">${escapeHtml(i18n.t('common.complete'))}</button>
          </div>
        </div>
      </section>
      ${addOverlayHtml}
    `;

    bind();
    if (typeof svc.resumeSessionTimer === 'function') svc.resumeSessionTimer();
    startTimerLoop();
  }

  function bind() {
    const addBtn = root.querySelector('[data-action="add-exercise"]');
    if (addBtn) addBtn.addEventListener('click', openAddPicker);

    bindAddExerciseOverlay(root, {
      onCancel: closeAddPicker,
      onConfirm: submitAddExercise,
      onPatch: patchAddPicker,
    });

    root.querySelectorAll('[data-check]').forEach((check) => {
      check.addEventListener('change', () => {
        const row = check.closest('.workout-row');
        syncItemFromDom(row);
        // Enable/disable fields in place - do not re-render (preserves scroll position)
        applyCheckedState(row);
      });
    });

    root.querySelectorAll('.workout-row input[type="text"], .workout-row input[type="number"]').forEach((input) => {
      const part = input.getAttribute('data-duration-part');

      // ArrowDown / spinner at 0 on minutes or seconds -> borrow from higher unit
      if (part === 'm' || part === 's') {
        input.addEventListener('keydown', (ev) => {
          if (ev.key !== 'ArrowDown') return;
          const current = input.value === '' ? 0 : Number(input.value);
          if (!Number.isFinite(current) || current > 0) return;
          ev.preventDefault();
          const row = input.closest('.workout-row');
          const key = (input.getAttribute('name') || '').replace(/^metric-/, '').replace(/-[ms]$/, '');
          applyDurationBorrow(row, key, part === 'm' ? 'minutes' : 'seconds');
          syncItemFromDom(row);
        });
      }

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
    suspend,
    resume,
    getRoot: () => root,
    /** test helper */
    getDraft: () => draft,
  };
}

module.exports = {
  mountActiveWorkoutView,
  groupByHeaders,
  qualityBucket,
};
