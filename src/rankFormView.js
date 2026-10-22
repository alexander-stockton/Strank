/**
 * Feature 12 — Structured Create / Edit Rank form
 */

const rankManager = require('./rankManager');
const rankEditor = require('./rankEditor');
const fileDialog = require('./fileDialog');
const landing = require('./landing');
const { getWeightUnits, getDistanceUnits } = require('./config');
const {
  isTimeDurationKey,
  splitDurationSeconds,
  combineDurationParts,
} = require('./parse/duration');
const { metricLabel } = require('./todayView');
const { slugifyExerciseName } = require('./parse/metrics');

const DEFAULT_BADGE = 'badges/unranked.svg';
/** Max visible width for exercise name (~ "super ultra mega extremely awesome workout"). */
const EXERCISE_NAME_CH = 42;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function groupByHeaders(exercises) {
  const groups = [];
  const map = new Map();
  for (const ex of exercises) {
    const key = (ex.headers || []).join(' › ') || 'General';
    if (!map.has(key)) {
      const g = { headerKey: key, headers: ex.headers || [], items: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key).items.push(ex);
  }
  return groups;
}

function ensureUid(ex, index) {
  if (!ex._uid) ex._uid = `ex-${index}-${ex.exerciseId || slugifyExerciseName(ex.name) || 'x'}`;
  return ex._uid;
}

function cloneExercises(list) {
  return (list || []).map((ex, i) => {
    const copy = {
      exerciseId: ex.exerciseId || '',
      name: ex.name || '',
      headers: Array.isArray(ex.headers) ? [...ex.headers] : [],
      notes: ex.notes != null ? ex.notes : null,
      thresholds: { ...(ex.thresholds || {}) },
      metrics: Array.isArray(ex.metrics) ? [...ex.metrics] : Object.keys(ex.thresholds || {}),
      _uid: ex._uid || null,
      _expanded: ex._expanded === true,
    };
    ensureUid(copy, i);
    return copy;
  });
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   mode?: 'create' | 'edit',
 *   rankName?: string,
 *   onBack?: Function,
 *   onSaved?: Function,
 *   confirm?: Function,
 *   rankManager?: object,
 * }} [options]
 */
function mountRankFormView(root, options = {}) {
  if (!root) throw new Error('mountRankFormView requires root');

  const svc = options.rankManager || rankManager;
  const mode = options.mode === 'edit' ? 'edit' : 'create';
  const replaceName = mode === 'edit' ? String(options.rankName || '').trim() : null;

  let name = mode === 'edit' ? replaceName || '' : '';
  let badgePath = DEFAULT_BADGE;
  let exercises = [];
  /** @type {string[][]} preserved section header paths (even when empty) */
  let sectionPaths = [];
  let status = null;
  let dropActive = false;

  function captureSectionPaths(list) {
    const seen = new Set();
    const paths = [];
    for (const ex of list || []) {
      const key = (ex.headers || []).join('\u0001');
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push(Array.isArray(ex.headers) ? [...ex.headers] : []);
    }
    return paths;
  }

  if (mode === 'edit' && replaceName) {
    const loaded = svc.getTierByName(replaceName);
    if (loaded.ok && loaded.data) {
      name = loaded.data.name;
      badgePath = loaded.data.badgePath || DEFAULT_BADGE;
      exercises = cloneExercises(
        (loaded.data.exercises || []).map((ex) => ({
          ...ex,
          thresholds: Object.keys(ex.thresholds || {}).length
            ? { ...ex.thresholds }
            : { weight: 0, distance: 0, reps: 0, sets: 0 },
          metrics: Object.keys(ex.thresholds || {}).length
            ? Object.keys(ex.thresholds)
            : ['weight', 'distance', 'reps', 'sets'],
        }))
      );
      sectionPaths = captureSectionPaths(exercises);
    } else {
      status = { kind: 'alert', text: loaded.message || 'Rank not found.' };
    }
  } else {
    const tpl = svc.getTemplateExercises();
    exercises = cloneExercises(tpl.ok ? tpl.data : []);
    sectionPaths = captureSectionPaths(exercises);
  }

  function findExercise(uid) {
    return exercises.find((ex) => ex._uid === uid) || null;
  }

  function badgePreviewUrl() {
    return (
      landing.resolveBadgeUrl({ name, badgePath }) ||
      svc.resolveBadgeUrl(badgePath) ||
      null
    );
  }

  function schemaKeys(ex) {
    if (Array.isArray(ex.metrics) && ex.metrics.length) return ex.metrics;
    return Object.keys(ex.thresholds || {});
  }

  function renderMetricField(ex, key) {
    const uid = escapeHtml(ex._uid);
    const label = escapeHtml(metricLabel(key));
    const t = ex.thresholds || {};

    if (isTimeDurationKey(key)) {
      const raw = t[key] != null ? t[key] : null;
      const parts = raw == null || raw === '' || Number(raw) === 0 ? null : splitDurationSeconds(raw);
      const showH = parts ? String(parts.hours) : '';
      const showM = parts ? String(parts.minutes) : '';
      const showS = parts ? String(parts.seconds) : '';
      return `<div class="field workout-metric workout-duration rank-form-metric-duration-like" data-duration-metric="${escapeHtml(key)}" data-ex-uid="${uid}">
        <span class="workout-metric-label">${label}</span>
        <div class="duration-parts">
          <label class="duration-part">
            <input type="number" min="0" max="200" step="1" inputmode="numeric" value="${escapeHtml(
              showH
            )}" data-metric="${escapeHtml(key)}" data-duration-part="h" class="metric-input-hours" />
            <span class="duration-unit">h</span>
          </label>
          <label class="duration-part">
            <input type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(
              showM
            )}" data-metric="${escapeHtml(key)}" data-duration-part="m" class="metric-input-minutes" />
            <span class="duration-unit">m</span>
          </label>
          <label class="duration-part">
            <input type="number" min="0" step="any" inputmode="decimal" value="${escapeHtml(
              showS
            )}" data-metric="${escapeHtml(key)}" data-duration-part="s" class="metric-input-seconds" />
            <span class="duration-unit">s</span>
          </label>
        </div>
      </div>`;
    }

    if (key === 'durationSteps') {
      const val = t.durationSteps != null ? t.durationSteps : 0;
      return `<label class="field workout-metric rank-form-metric-duration-like">
        <span>${label}</span>
        <input type="number" min="0" max="9999" step="1" inputmode="numeric" value="${escapeHtml(
          val
        )}" data-metric="durationSteps" />
      </label>`;
    }

    const val = t[key] != null ? t[key] : 0;
    if (key === 'weight') {
      const unit = escapeHtml(getWeightUnits());
      return `<label class="field workout-metric workout-metric-weight">
        <span>${label}</span>
        <span class="weight-input-wrap">
          <input type="number" min="0" max="9999" step="any" inputmode="decimal" value="${escapeHtml(
            val
          )}" data-metric="weight" class="metric-input-weight" />
          <span class="weight-unit">${unit}</span>
        </span>
      </label>`;
    }
    if (key === 'distance') {
      const unit = escapeHtml(getDistanceUnits());
      return `<label class="field workout-metric workout-metric-distance">
        <span>${label}</span>
        <span class="weight-input-wrap distance-input-wrap">
          <input type="number" min="0" max="9999" step="any" inputmode="decimal" value="${escapeHtml(
            val
          )}" data-metric="distance" class="metric-input-weight metric-input-distance" />
          <span class="weight-unit distance-unit">${unit}</span>
        </span>
      </label>`;
    }
    if (key === 'reps' || key === 'sets') {
      return `<label class="field workout-metric workout-metric-${escapeHtml(key)}">
        <span>${label}</span>
        <input type="number" min="0" max="9999" step="1" inputmode="numeric" value="${escapeHtml(
          val
        )}" data-metric="${escapeHtml(key)}" class="metric-input-${escapeHtml(key)}" />
      </label>`;
    }

    return `<label class="field workout-metric">
      <span>${label}</span>
      <input type="text" value="${escapeHtml(val)}" data-metric="${escapeHtml(key)}" />
    </label>`;
  }

  function orderedMetricKeys(ex) {
    const keys = schemaKeys(ex);
    const order = [];
    const take = (pred) => {
      for (const k of keys) {
        if (pred(k) && !order.includes(k)) order.push(k);
      }
    };
    take((k) => k === 'weight');
    take((k) => k === 'distance');
    take((k) => isTimeDurationKey(k) || k === 'durationSteps');
    take((k) => k === 'reps');
    take((k) => k === 'sets');
    take(() => true);
    return order;
  }

  function renderMetricRows(ex) {
    const keys = orderedMetricKeys(ex);
    if (!keys.length) return '';
    return `<div class="workout-metrics rank-form-metrics">
      <div class="workout-metric-row rank-form-metrics-row">
        ${keys.map((k) => renderMetricField(ex, k)).join('')}
      </div>
    </div>`;
  }

  function renderExerciseRow(ex) {
    const uid = escapeHtml(ex._uid);
    const expanded = ex._expanded === true;
    const nameBlock = expanded
      ? `<label class="field rank-form-exercise-name-field">
          <span class="visually-hidden">Exercise name</span>
          <input type="text" class="rank-form-exercise-name" data-ex-name value="${escapeHtml(
            ex.name || ''
          )}" placeholder="Exercise name" />
        </label>`
      : `<span class="rank-form-exercise-name rank-form-exercise-name-readonly" data-ex-name-display>${escapeHtml(
          ex.name || 'Untitled exercise'
        )}</span>
         <input type="hidden" data-ex-name value="${escapeHtml(ex.name || '')}" />`;

    const editors = expanded
      ? `${renderMetricRows(ex)}
      <label class="field rank-form-notes-field">
        <span>Notes</span>
        <input type="text" data-ex-notes value="${escapeHtml(ex.notes || '')}" placeholder="Optional notes" />
      </label>`
      : '';

    return `<li class="workout-row rank-form-exercise ${expanded ? 'is-expanded' : 'is-collapsed'}" data-ex-uid="${uid}" data-expanded="${
      expanded ? 'true' : 'false'
    }">
      <div class="rank-form-exercise-title-row">
        ${nameBlock}
        <div class="rank-form-exercise-actions">
          <button type="button" class="secondary" data-action="toggle-exercise" data-ex-uid="${uid}">${
            expanded ? 'Done' : 'Edit'
          }</button>
          <button type="button" class="secondary danger-text" data-action="remove-exercise" data-ex-uid="${uid}" title="Remove exercise">Remove</button>
        </div>
      </div>
      ${editors}
    </li>`;
  }

  function renderSections() {
    const byKey = new Map();
    for (const ex of exercises) {
      const key = (ex.headers || []).join('\u0001');
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(ex);
    }

    // Preserve template section order; append any unexpected paths at the end
    const ordered = sectionPaths.map((headers) => ({
      headers,
      key: headers.join('\u0001'),
      items: byKey.get(headers.join('\u0001')) || [],
    }));
    for (const [key, items] of byKey) {
      if (ordered.some((g) => g.key === key)) continue;
      ordered.push({ headers: key ? key.split('\u0001') : [], key, items });
    }

    if (!ordered.length) {
      return `<p class="empty-state">No exercise sections available.</p>`;
    }

    return ordered
      .map((group) => {
        const heading =
          group.headers && group.headers.length
            ? `<h2 class="workout-group-heading">${escapeHtml(group.headers.join(' › '))}</h2>`
            : `<h2 class="workout-group-heading">General</h2>`;
        const headerAttr = escapeHtml((group.headers || []).join('\u0001'));
        return `<section class="workout-group rank-form-section" data-section-headers="${headerAttr}">
          ${heading}
          <ul class="workout-rows">${group.items.map(renderExerciseRow).join('')}</ul>
          <button type="button" class="secondary rank-form-add-exercise" data-action="add-exercise" data-section-headers="${headerAttr}">+ Add exercise</button>
        </section>`;
      })
      .join('');
  }

  function render() {
    const bodyEl = root.querySelector('.rank-form-body');
    const savedScroll = bodyEl ? bodyEl.scrollTop : 0;

    const title = mode === 'edit' ? 'Edit Rank' : 'Create Rank';
    const url = badgePreviewUrl();
    const badgeHtml = url
      ? `<img class="rank-form-badge-preview" src="${escapeHtml(url)}" alt="Badge preview" data-badge-preview />`
      : `<span class="rank-form-badge-fallback" data-badge-preview>?</span>`;
    const statusHtml = status
      ? `<p class="rank-form-status ${status.kind === 'alert' ? 'status-alert' : 'status-ok'}" data-status>${escapeHtml(
          status.text
        )}</p>`
      : '';

    root.innerHTML = `
      <section class="panel rank-form-view ${dropActive ? 'rank-form-drop-active' : ''}" data-view="rank-form" data-mode="${mode}">
        <header class="panel-header rank-form-header">
          <h1>${escapeHtml(title)}</h1>
          <button type="button" class="ghost" data-action="back">Back</button>
        </header>
        ${statusHtml}
        <div class="rank-form-body">
          <div class="rank-form-badge-block" data-badge-drop>
            <div class="rank-form-badge-preview-wrap">${badgeHtml}</div>
            <div class="rank-form-badge-actions">
              <button type="button" class="secondary" data-action="select-badge">Select badge</button>
              <p class="rank-form-badge-hint">Or drop an image here. Default: unranked.svg</p>
              <p class="rank-form-badge-path" data-badge-path>${escapeHtml(badgePath)}</p>
            </div>
          </div>
          <label class="field rank-form-name-field">
            <span>Rank name</span>
            <input type="text" name="rank-name" data-rank-name value="${escapeHtml(name)}" placeholder="e.g. CUSTOM I" autocomplete="off" />
          </label>
          <hr class="rank-form-divider" />
          <div class="rank-form-exercises" data-exercises>
            ${renderSections()}
          </div>
        </div>
        <footer class="rank-form-footer">
          <button type="button" class="secondary" data-action="cancel">Cancel</button>
          <button type="button" class="primary" data-action="confirm">Confirm</button>
        </footer>
      </section>
    `;

    bind();
    const nextBody = root.querySelector('.rank-form-body');
    if (nextBody) nextBody.scrollTop = savedScroll;
  }

  function importBadge(source) {
    return rankEditor.importDroppedBadge(source, { custom: true });
  }

  function bufferFromArrayBuffer(ab) {
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      return Buffer.from(ab);
    }
    try {
      return require('buffer').Buffer.from(ab);
    } catch (_) {
      return null;
    }
  }

  function readDomIntoState() {
    const nameInput = root.querySelector('[data-rank-name]');
    if (nameInput) name = nameInput.value;

    root.querySelectorAll('.rank-form-exercise').forEach((row) => {
      const uid = row.getAttribute('data-ex-uid');
      const ex = findExercise(uid);
      if (!ex) return;
      const nameEl = row.querySelector('[data-ex-name]');
      if (nameEl) ex.name = nameEl.value;
      const notesEl = row.querySelector('[data-ex-notes]');
      if (notesEl) ex.notes = notesEl.value.trim() || null;

      const durationBlocks = row.querySelectorAll('[data-duration-metric]');
      durationBlocks.forEach((block) => {
        const key = block.getAttribute('data-duration-metric');
        const h = Number(block.querySelector('[data-duration-part="h"]')?.value || 0);
        const m = Number(block.querySelector('[data-duration-part="m"]')?.value || 0);
        const s = Number(block.querySelector('[data-duration-part="s"]')?.value || 0);
        ex.thresholds[key] = combineDurationParts({
          hours: Number.isFinite(h) ? h : 0,
          minutes: Number.isFinite(m) ? m : 0,
          seconds: Number.isFinite(s) ? s : 0,
        });
      });

      row.querySelectorAll('[data-metric]').forEach((input) => {
        if (input.getAttribute('data-duration-part')) return;
        const key = input.getAttribute('data-metric');
        if (!key || isTimeDurationKey(key)) return;
        const raw = input.value;
        if (raw === '' || raw == null) {
          ex.thresholds[key] = 0;
          return;
        }
        const n = Number(raw);
        ex.thresholds[key] = Number.isFinite(n) ? n : 0;
      });
    });
  }

  function applyImportResult(result) {
    if (result && result.ok) {
      badgePath = result.data.relativePath;
      status = { kind: 'ok', text: `Badge set to ${badgePath}` };
    } else {
      status = {
        kind: 'alert',
        text: (result && result.message) || 'Could not import badge.',
      };
    }
    render();
  }

  function applyBadgeSource(sourcePathOrFile) {
    // Absolute path string (NW.js file picker / File.path)
    if (typeof sourcePathOrFile === 'string' && sourcePathOrFile) {
      applyImportResult(importBadge(sourcePathOrFile));
      return;
    }

    // File-like with NW.js .path
    const pathOnFile =
      sourcePathOrFile && typeof sourcePathOrFile.path === 'string' && sourcePathOrFile.path
        ? sourcePathOrFile.path
        : null;
    if (pathOnFile) {
      applyImportResult(importBadge(pathOnFile));
      return;
    }

    // Browser-style File without path — read bytes
    if (sourcePathOrFile && typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        const buf = bufferFromArrayBuffer(reader.result);
        if (!buf) {
          applyImportResult({ ok: false, message: 'Could not read image.' });
          return;
        }
        applyImportResult(
          importBadge({
            buffer: buf,
            name: sourcePathOrFile.name || 'badge.png',
          })
        );
      };
      reader.onerror = () => applyImportResult({ ok: false, message: 'Could not read image.' });
      reader.readAsArrayBuffer(sourcePathOrFile);
      return;
    }

    applyImportResult({ ok: false, message: 'Could not import badge.' });
  }

  function handleBadgeDrop(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    dropActive = false;
    const dt = ev.dataTransfer;
    const file = dt && dt.files && dt.files[0] ? dt.files[0] : null;
    if (!file) {
      status = { kind: 'alert', text: 'No image file was dropped.' };
      render();
      return;
    }
    readDomIntoState();
    const filePath = fileDialog.pathFromFile(file) || (file.path || null);
    if (filePath) applyBadgeSource(filePath);
    else applyBadgeSource(file);
  }

  function bind() {
    const back = () => {
      if (typeof options.onBack === 'function') options.onBack();
    };

    root.querySelector('[data-action="back"]')?.addEventListener('click', back);
    root.querySelector('[data-action="cancel"]')?.addEventListener('click', back);

    root.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
      readDomIntoState();
      const trimmed = String(name || '').trim();
      if (!trimmed) {
        status = { kind: 'alert', text: 'Rank name is required.' };
        render();
        return;
      }
      const result = svc.saveRank(
        {
          name: trimmed,
          badgePath,
          exercises,
        },
        mode === 'edit' ? { replaceName } : {}
      );
      if (!result.ok) {
        status = { kind: 'alert', text: result.message || 'Could not save rank.' };
        render();
        return;
      }
      if (typeof options.onSaved === 'function') options.onSaved(result);
      else if (typeof options.onBack === 'function') options.onBack();
    });

    root.querySelector('[data-rank-name]')?.addEventListener('change', (ev) => {
      name = ev.target.value;
    });

    root.querySelector('[data-action="select-badge"]')?.addEventListener('click', () => {
      const doc = root.ownerDocument || (typeof document !== 'undefined' ? document : null);
      fileDialog
        .pickOpenPath({
          accept: 'image/*,.svg,.png,.jpg,.jpeg,.webp,.gif',
          document: doc,
        })
        .then((picked) => {
          if (!picked) return;
          readDomIntoState();
          applyBadgeSource(picked);
        });
    });

    // DnD on the whole form (same pattern as Rank Editor) so OS file drops register;
    // highlight only when over the badge block.
    const formView = root.querySelector('[data-view="rank-form"]');
    const dropZone = root.querySelector('[data-badge-drop]');
    let dragDepth = 0;

    const isFileDrag = (e) => {
      const types = e.dataTransfer && e.dataTransfer.types;
      if (!types) return false;
      if (typeof types.includes === 'function') return types.includes('Files');
      for (let i = 0; i < types.length; i += 1) {
        if (types[i] === 'Files') return true;
      }
      return false;
    };

    const setDropHighlight = (on) => {
      dropActive = on;
      if (formView) formView.classList.toggle('rank-form-drop-active', on);
      if (dropZone) dropZone.classList.toggle('is-drop-target', on);
    };

    const onDragOver = (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    if (formView) {
      formView.addEventListener('dragenter', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        dragDepth += 1;
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      });
      formView.addEventListener('dragover', onDragOver);
      formView.addEventListener('dragleave', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) setDropHighlight(false);
      });
      formView.addEventListener('drop', (e) => {
        dragDepth = 0;
        setDropHighlight(false);
        handleBadgeDrop(e);
      });
    }

    if (dropZone) {
      dropZone.addEventListener('dragenter', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropHighlight(true);
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      });
      dropZone.addEventListener('dragover', onDragOver);
      dropZone.addEventListener('dragleave', (e) => {
        // Only clear highlight when leaving the badge block entirely
        const related = e.relatedTarget;
        if (related && dropZone.contains(related)) return;
        setDropHighlight(false);
      });
      dropZone.addEventListener('drop', handleBadgeDrop);
    }

    root.querySelectorAll('[data-action="toggle-exercise"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        readDomIntoState();
        const uid = btn.getAttribute('data-ex-uid');
        const ex = findExercise(uid);
        if (!ex) return;
        ex._expanded = !ex._expanded;
        render();
      });
    });

    root.querySelectorAll('[data-action="remove-exercise"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        readDomIntoState();
        const uid = btn.getAttribute('data-ex-uid');
        exercises = exercises.filter((ex) => ex._uid !== uid);
        render();
      });
    });

    root.querySelectorAll('[data-action="add-exercise"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        readDomIntoState();
        const raw = btn.getAttribute('data-section-headers') || '';
        const headers = raw ? raw.split('\u0001') : [];
        const blank = svc.createEmptyExercise(headers);
        blank._expanded = true;
        // Insert after the last exercise in this section so serialize keeps one header block
        const key = headers.join('\u0001');
        let insertAt = exercises.length;
        for (let i = exercises.length - 1; i >= 0; i -= 1) {
          const exKey = (exercises[i].headers || []).join('\u0001');
          if (exKey === key) {
            insertAt = i + 1;
            break;
          }
        }
        exercises.splice(insertAt, 0, blank);
        render();
      });
    });
  }

  render();

  return {
    refresh: render,
    destroy() {
      root.innerHTML = '';
    },
    getRoot: () => root,
    /** @internal test helpers */
    _getState: () => ({ name, badgePath, exercises, mode }),
  };
}

module.exports = {
  mountRankFormView,
  groupByHeaders,
  DEFAULT_BADGE,
  EXERCISE_NAME_CH,
};
