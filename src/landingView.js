/**
 * Feature 7 — Landing Page
 * Spec: features/feature-7-Landing-Page.md
 * Feature 13 — Skill Progress Landing
 * Spec: features/feature-13-Skill-Progress-Landing.md
 * Feature 14 — Landing Layout & Day Focus
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const landing = require('./landing');
const dayFocus = require('./dayFocus');
const landingLayout = require('./landingLayout');
const { formatMetricEntry, formatWeightDisplay, formatDistanceDisplay } = require('./todayView');
const { formatDurationSeconds, isTimeDurationKey } = require('./parse/duration');
const { renderExerciseHelp } = require('./exerciseHelp');
const { renderRankBadge } = require('./rankBadge');

const SKILL_COLUMN_LABELS = {
  arms: 'Arms',
  core: 'Core',
  lungs: 'Lungs',
  legs: 'Legs',
};

const DAY_FOCUS_LABELS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'TH' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'Sa' },
  { key: 'sun', label: 'Su' },
];

const GROUP_FOCUS_LABELS = [
  { key: 'arms', label: 'Arms' },
  { key: 'core', label: 'Core' },
  { key: 'lungs', label: 'Lungs' },
  { key: 'legs', label: 'Legs' },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMetricDisplayValue(key, value) {
  if (key === 'weight') return formatWeightDisplay(value);
  if (key === 'distance') return formatDistanceDisplay(value);
  if (isTimeDurationKey(key)) return formatDurationSeconds(value);
  return String(value);
}

/**
 * Display metrics for an expectation row: saved values when completed, else targets.
 */
function metricsForDisplay(row) {
  if (row && row.completed && row.savedMetrics && typeof row.savedMetrics === 'object') {
    return row.savedMetrics;
  }
  return (row && row.targets) || {};
}

function formatTargets(targets) {
  if (!targets || typeof targets !== 'object') return '';
  return Object.entries(targets)
    .map(([k, v]) => formatMetricEntry(k, v))
    .filter((part) => part != null && part !== '')
    .join(' · ');
}

function groupByHeaders(expectations) {
  const groups = [];
  const map = new Map();
  for (const row of expectations) {
    const key = (row.headers || []).join(' › ') || 'General';
    if (!map.has(key)) {
      const g = { headerKey: key, headers: row.headers || [], rows: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key).rows.push(row);
  }
  return groups;
}

function renderExpectationList(expectations, listAttr) {
  if (!expectations.length) {
    return `<p class="empty-state" data-empty="${escapeHtml(listAttr)}">No rank expectations configured.</p>`;
  }
  const groups = groupByHeaders(expectations);
  return groups
    .map((group) => {
      const heading =
        group.headers && group.headers.length
          ? `<h3 class="expectation-group-heading" data-header-path="${escapeHtml(
              group.headers.join('>')
            )}">${escapeHtml(group.headers.join(' › '))}</h3>`
          : '';
      const items = group.rows
        .map((row) => {
          const done = row.completed ? ' is-completed' : '';
          const check = row.completed
            ? `<span class="expectation-done" aria-label="completed">Completed</span>`
            : '';
          return `<li class="expectation-row${done}" data-exercise-id="${escapeHtml(
            row.exerciseId
          )}" data-completed="${row.completed ? 'true' : 'false'}">
            <span class="expectation-title">
              <span class="expectation-name">${escapeHtml(row.name)}</span>${renderExerciseHelp(
            row.notes,
            { id: row.exerciseId }
          )}
            </span>
            ${check}
            <span class="expectation-targets" data-targets>${escapeHtml(
              formatTargets(metricsForDisplay(row))
            )}</span>
          </li>`;
        })
        .join('');
      return `<section class="expectation-group">${heading}<ul class="expectation-list">${items}</ul></section>`;
    })
    .join('');
}

function renderOverallBadge(model) {
  const name = model.overallRankName || 'UNRANKED';
  const img = model.overallBadgeUrl
    ? `<img class="overall-rank-badge-img" src="${escapeHtml(model.overallBadgeUrl)}" alt="${escapeHtml(
        name
      )}" data-overall-badge-img />`
    : `<span class="overall-rank-badge-fallback" data-overall-badge-fallback>${escapeHtml(name)}</span>`;
  return `<div class="overall-rank-badge" data-overall-rank="${escapeHtml(name)}" aria-label="Overall rank: ${escapeHtml(
    name
  )}">${img}<span class="overall-rank-name">${escapeHtml(name)}</span></div>`;
}

function formatAverageSummary(averages) {
  if (!averages || typeof averages !== 'object' || !Object.keys(averages).length) {
    return '—';
  }
  const text = formatTargets(averages);
  return text || '—';
}

function renderSkillRow(skill) {
  const progress = Number.isFinite(skill.progress) ? skill.progress : 0;
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const localName = skill.localRankName || 'UNRANKED';
  const localBadge = renderRankBadge(localName, {
    dataAttr: 'data-local-rank-badge',
    className: 'skill-rank-badge',
  });
  const nextHtml = skill.nextRankName
    ? `<span class="skill-next-rank" data-next-rank="${escapeHtml(skill.nextRankName)}">${renderRankBadge(
        skill.nextRankName,
        { dataAttr: 'data-next-rank-badge', className: 'skill-rank-badge skill-next-badge' }
      )}</span>`
    : localName.toUpperCase() !== 'UNRANKED'
      ? `<span class="skill-next-rank skill-next-max" data-next-rank="Max">Max</span>`
      : '';

  const toGo = skill.remainingLabel ? String(skill.remainingLabel) : '';
  const toGoSafe = escapeHtml(toGo);
  const ariaExtra = toGo ? `; ${toGo}` : '';

  return `<li class="skill-row" data-exercise-id="${escapeHtml(skill.exerciseId)}" data-muscle-group="${escapeHtml(
    skill.muscleGroup
  )}" data-local-rank="${escapeHtml(localName)}" data-progress="${pct}">
    <div class="skill-row-head">
      <span class="skill-name">${escapeHtml(skill.name)}</span>
      <span class="skill-local-rank" data-local-rank-label>${localBadge}</span>
    </div>
    <div class="skill-average" data-weekly-average>${escapeHtml(formatAverageSummary(skill.weeklyAverage))}</div>
    <div
      class="skill-progress-bar"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="${pct}"
      aria-label="Progress toward next rank: ${pct}%${escapeHtml(ariaExtra)}"
      data-progress-bar
    >
      <div class="skill-progress-fill" style="width: ${pct}%">${
        toGo ? `<span class="skill-to-go skill-to-go-in" data-to-go-in>${toGoSafe}</span>` : ''
      }</div>
      ${toGo ? `<span class="skill-to-go skill-to-go-out" data-to-go-out hidden>${toGoSafe}</span>` : ''}
    </div>
    ${nextHtml}
  </li>`;
}

/** Place “to go” text inside the fill when it fits; otherwise beside it in the track. */
function layoutSkillProgressLabels(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-progress-bar]').forEach((bar) => {
    const fill = bar.querySelector('.skill-progress-fill');
    const inLabel = bar.querySelector('[data-to-go-in]');
    const outLabel = bar.querySelector('[data-to-go-out]');
    if (!fill || !inLabel || !outLabel) return;

    inLabel.hidden = false;
    outLabel.hidden = true;
    // Force layout: if the label is wider than the fill (minus padding), put it beside.
    const pad = 8;
    if (fill.clientWidth <= pad || inLabel.scrollWidth > fill.clientWidth - pad) {
      inLabel.hidden = true;
      outLabel.hidden = false;
    }
  });
}

function renderSkillColumn(groupKey, skills) {
  const label = SKILL_COLUMN_LABELS[groupKey] || groupKey;
  const items = (skills || []).map(renderSkillRow).join('');
  return `<section class="skill-column" data-skill-column="${escapeHtml(groupKey)}" aria-label="${escapeHtml(label)}">
    <h3 class="skill-column-heading">${escapeHtml(label)}</h3>
    <ul class="skill-list">${items || ''}</ul>
  </section>`;
}

function renderSkillProgress(model) {
  const sp = model.skillProgress;
  if (!sp) {
    return `<p class="empty-state" data-skill-empty>No skills to show.</p>`;
  }
  if (sp.empty) {
    return `<p class="empty-state" data-skill-empty>No skills to show.</p>`;
  }
  const cols = sp.columns || {};
  return `<div class="skill-progress-grid" data-skill-progress-grid>
    ${renderSkillColumn('arms', cols.arms)}
    ${renderSkillColumn('core', cols.core)}
    ${renderSkillColumn('lungs', cols.lungs)}
    ${renderSkillColumn('legs', cols.legs)}
  </div>`;
}

function isDefaultPairOrder(order) {
  return (
    Array.isArray(order) &&
    order[0] === 'today-expectations' &&
    order[1] === 'next-rank' &&
    order[2] === 'skill-progress'
  );
}

function renderLayoutMenu(reorganizeOn) {
  return `<div class="landing-menu" data-landing-menu="layout">
    <button type="button" class="primary outline landing-menu-trigger" data-action="toggle-layout-menu"
      aria-haspopup="true" aria-expanded="false" aria-label="Reorganize layout">Layout</button>
    <div class="landing-menu-panel" data-layout-menu-panel hidden role="menu">
      <label class="landing-menu-check">
        <input type="checkbox" data-action="toggle-reorganize" ${reorganizeOn ? 'checked' : ''} />
        <span>Enable drag &amp; drop</span>
      </label>
      <button type="button" class="ghost landing-menu-item" data-action="reset-layout" role="menuitem">Reset layout</button>
      ${
        reorganizeOn
          ? `<button type="button" class="primary landing-menu-item" data-action="done-reorganize" role="menuitem">Done</button>`
          : ''
      }
      <p class="landing-menu-help">Drag cards to reorder landing components.</p>
    </div>
  </div>`;
}

function renderDayFocusMenu(schedule) {
  const sched = schedule || dayFocus.defaults();
  const sections = GROUP_FOCUS_LABELS.map((group) => {
    const days = new Set(sched[group.key] || []);
    const boxes = DAY_FOCUS_LABELS.map((day) => {
      const checked = days.has(day.key) ? 'checked' : '';
      return `<label class="day-focus-day">
        <input type="checkbox" data-focus-group="${escapeHtml(group.key)}" data-focus-day="${escapeHtml(
        day.key
      )}" ${checked} />
        <span>${escapeHtml(day.label)}</span>
      </label>`;
    }).join('');
    return `<fieldset class="day-focus-group" data-focus-section="${escapeHtml(group.key)}">
      <legend>${escapeHtml(group.label)}</legend>
      <div class="day-focus-days">${boxes}</div>
    </fieldset>`;
  }).join('');

  return `<div class="landing-menu" data-landing-menu="day-focus">
    <button type="button" class="primary outline landing-menu-trigger" data-action="toggle-day-focus-menu"
      aria-haspopup="true" aria-expanded="false" aria-label="Customize day focus">Day focus</button>
    <div class="landing-menu-panel day-focus-panel" data-day-focus-menu-panel hidden role="menu">
      ${sections}
    </div>
  </div>`;
}

function renderLandingMenusHtml(model) {
  const reorganizeOn = landingLayout.isReorganizeMode();
  const schedule = model.dayFocusSchedule || dayFocus.getSchedule();
  return `<div class="landing-menu-cluster" data-landing-menus>
    ${renderLayoutMenu(reorganizeOn)}
    ${renderDayFocusMenu(schedule)}
  </div>`;
}

function clearNavbarMenuHost(doc) {
  if (!doc || typeof doc.querySelector !== 'function') return;
  const host = doc.querySelector('[data-landing-menu-host="navbar"]');
  if (host) {
    host.innerHTML = '';
    host.hidden = true;
  }
}

/** Ensure the navbar menu host exists (create if shell markup is stale). */
function ensureNavbarMenuHost(doc) {
  if (!doc || typeof doc.querySelector !== 'function') return null;
  let host = doc.querySelector('[data-landing-menu-host="navbar"]');
  if (host) return host;
  const nav = doc.querySelector('.app-navbar-left') || doc.querySelector('.app-navbar-top');
  if (!nav) return null;
  host = doc.createElement('div');
  host.className = 'app-navbar-end';
  host.setAttribute('data-landing-menu-host', 'navbar');
  nav.appendChild(host);
  return host;
}

/**
 * Mount Landing view into `root`.
 * Uses `root.ownerDocument` (not global `document`) so NW.js Node-context
 * requires still find the window DOM for left-rail menu placement.
 */
function mountLandingView(root, options = {}) {
  const svc = options.landing || landing;
  const onGetStarted = options.onGetStarted || (() => {});
  const doc = (root && root.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  let destroyed = false;
  let layoutMenuOpen = false;
  let dayFocusMenuOpen = false;
  let dragSourceId = null;

  function destroy() {
    destroyed = true;
    landingLayout.setReorganizeMode(false);
    clearNavbarMenuHost(doc);
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  function closeMenus() {
    layoutMenuOpen = false;
    dayFocusMenuOpen = false;
  }

  function applyMenuOpenState(scope) {
    if (!scope) return;
    const layoutPanel = scope.querySelector('[data-layout-menu-panel]');
    const dayPanel = scope.querySelector('[data-day-focus-menu-panel]');
    const layoutBtn = scope.querySelector('[data-action="toggle-layout-menu"]');
    const dayBtn = scope.querySelector('[data-action="toggle-day-focus-menu"]');
    if (layoutPanel) layoutPanel.hidden = !layoutMenuOpen;
    if (dayPanel) dayPanel.hidden = !dayFocusMenuOpen;
    if (layoutBtn) layoutBtn.setAttribute('aria-expanded', layoutMenuOpen ? 'true' : 'false');
    if (dayBtn) dayBtn.setAttribute('aria-expanded', dayFocusMenuOpen ? 'true' : 'false');
  }

  function bindMenuEvents(scope, model) {
    if (!scope) return;
    applyMenuOpenState(scope);

    const layoutBtn = scope.querySelector('[data-action="toggle-layout-menu"]');
    if (layoutBtn) {
      layoutBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        layoutMenuOpen = !layoutMenuOpen;
        if (layoutMenuOpen) dayFocusMenuOpen = false;
        applyMenuOpenState(scope);
      });
    }

    const dayBtn = scope.querySelector('[data-action="toggle-day-focus-menu"]');
    if (dayBtn) {
      dayBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        dayFocusMenuOpen = !dayFocusMenuOpen;
        if (dayFocusMenuOpen) layoutMenuOpen = false;
        applyMenuOpenState(scope);
      });
    }

    const reorganize = scope.querySelector('[data-action="toggle-reorganize"]');
    if (reorganize) {
      reorganize.addEventListener('change', () => {
        landingLayout.setReorganizeMode(reorganize.checked);
        layoutMenuOpen = true;
        refresh();
      });
    }

    const done = scope.querySelector('[data-action="done-reorganize"]');
    if (done) {
      done.addEventListener('click', () => {
        landingLayout.setReorganizeMode(false);
        layoutMenuOpen = false;
        refresh();
      });
    }

    const reset = scope.querySelector('[data-action="reset-layout"]');
    if (reset) {
      reset.addEventListener('click', () => {
        landingLayout.reset();
        landingLayout.setReorganizeMode(false);
        layoutMenuOpen = false;
        refresh();
      });
    }

    scope.querySelectorAll('[data-focus-group][data-focus-day]').forEach((input) => {
      input.addEventListener('change', () => {
        const group = input.getAttribute('data-focus-group');
        const day = input.getAttribute('data-focus-day');
        const schedule = dayFocus.getSchedule();
        const set = new Set(schedule[group] || []);
        if (input.checked) set.add(day);
        else set.delete(day);
        dayFocus.setSchedule({ [group]: [...set] });
        dayFocusMenuOpen = true;
        refresh();
      });
    });

    scope.querySelectorAll('.landing-menu-panel').forEach((panel) => {
      panel.addEventListener('click', (ev) => ev.stopPropagation());
      panel.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          closeMenus();
          applyMenuOpenState(scope);
          const trigger = scope.querySelector(
            panel.hasAttribute('data-layout-menu-panel')
              ? '[data-action="toggle-layout-menu"]'
              : '[data-action="toggle-day-focus-menu"]'
          );
          if (trigger) trigger.focus();
        }
      });
    });

    // silence unused model lint in some bundlers
    void model;
  }

  function placeMenus(model, menusHtml) {
    clearNavbarMenuHost(doc);
    const host = ensureNavbarMenuHost(doc);
    if (host) {
      host.hidden = false;
      host.removeAttribute('hidden');
      host.innerHTML = menusHtml;
      bindMenuEvents(host, model);
    }
    void model;
  }

  function bindDragDrop(board) {
    if (!board || !landingLayout.isReorganizeMode()) return;
    const cards = [...board.querySelectorAll('[data-landing-card]')];
    cards.forEach((card) => {
      card.setAttribute('draggable', 'true');
      card.classList.add('is-draggable');
      card.addEventListener('dragstart', (ev) => {
        dragSourceId = card.getAttribute('data-landing-card');
        card.classList.add('is-dragging');
        if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = 'move';
          ev.dataTransfer.setData('text/plain', dragSourceId || '');
        }
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        cards.forEach((c) => c.classList.remove('is-drop-target'));
        dragSourceId = null;
      });
      card.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
        card.classList.add('is-drop-target');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drop-target');
      });
      card.addEventListener('drop', (ev) => {
        ev.preventDefault();
        card.classList.remove('is-drop-target');
        const sourceId =
          (ev.dataTransfer && ev.dataTransfer.getData('text/plain')) || dragSourceId;
        const targetId = card.getAttribute('data-landing-card');
        if (!sourceId || !targetId || sourceId === targetId) return;
        const current = landingLayout.get().order.slice();
        const from = current.indexOf(sourceId);
        const to = current.indexOf(targetId);
        if (from < 0 || to < 0) return;
        current.splice(from, 1);
        current.splice(to, 0, sourceId);
        landingLayout.set(current);
        refresh();
      });
    });
  }

  function buildTodayPanel(model, showCta, reorganizeOn) {
    const todayBadge = renderRankBadge(model.overallRankName || 'UNRANKED', {
      dataAttr: 'data-today-rank-badge',
      className: 'landing-heading-badge',
    });
    const todayCorner =
      model.workoutComplete
        ? `<p class="workout-complete-status landing-today-corner" data-workout-complete>Today’s workout complete</p>`
        : showCta
          ? `<button type="button" class="primary landing-today-corner" data-action="get-started" aria-label="Get Started">Get Started</button>`
          : '';
    const body = model.todayEmptyFocus
      ? `<p class="empty-state" data-empty-focus>No muscle groups scheduled for today.</p>`
      : renderExpectationList(model.todayExpectations, 'today');
    return `<section class="landing-panel landing-today landing-card${
      todayCorner ? ' has-today-corner' : ''
    }${reorganizeOn ? ' is-draggable' : ''}" data-panel="today-expectations" data-landing-card="today-expectations">
      ${todayCorner}
      <h2 class="landing-panel-heading">
        <span class="landing-panel-title">Today’s expected exercises</span>
        ${todayBadge}
      </h2>
      <div class="panel-body" data-today-list>${body}</div>
    </section>`;
  }

  function buildNextPanel(model, reorganizeOn) {
    let nextBody;
    if (model.atTopOfLadder) {
      nextBody = `<p class="empty-state" data-at-top>You are at the top of the ladder.</p>`;
    } else {
      nextBody = renderExpectationList(model.nextRankExpectations, 'next-rank');
    }
    const nextHeading = model.nextTierName
      ? `<h2 class="landing-panel-heading" data-next-tier-label>
            <span class="landing-panel-title">Next rank:</span>
            ${renderRankBadge(model.nextTierName, {
              dataAttr: 'data-next-rank-badge',
              className: 'landing-heading-badge',
            })}
            <span class="landing-next-tier-name">${escapeHtml(model.nextTierName)}</span>
          </h2>`
      : `<h2 class="landing-panel-heading" data-next-tier-label>
            <span class="landing-panel-title">Next rank’s expectations</span>
          </h2>`;
    return `<section class="landing-panel landing-next landing-card${
      reorganizeOn ? ' is-draggable' : ''
    }" data-panel="next-rank" data-landing-card="next-rank">
      ${nextHeading}
      <div class="panel-body" data-next-list>${nextBody}</div>
    </section>`;
  }

  function buildSkillPanel(model, reorganizeOn, opts = {}) {
    const body = `<div class="panel-body" data-skill-progress>${renderSkillProgress(model)}</div>`;
    if (opts.tabbed) {
      // Stepped tab + full-width body share one opaque face (no top border on body → no seam).
      // Badge stays a disconnected sibling in the top-right leftover space.
      return `<div class="landing-skill-stack${
        reorganizeOn ? ' is-draggable landing-card' : ''
      }" data-landing-card="skill-progress">
        <div class="landing-skill-chrome" data-landing-skill-chrome>
          <h2 class="landing-skill-tab" data-skill-tab>
            <span class="landing-panel-title">Skill progress</span>
          </h2>
          <div class="landing-badge-slot landing-skill-badge" data-badge-slot="top-right">${renderOverallBadge(
            model
          )}</div>
        </div>
        <section class="landing-skill-body" data-panel="skill-progress" aria-label="Skill progress">
          ${body}
        </section>
      </div>`;
    }
    return `<section class="landing-panel landing-skill-progress landing-card${
      reorganizeOn ? ' is-draggable' : ''
    }" data-panel="skill-progress" data-landing-card="skill-progress" aria-label="Skill progress">
      <h2 class="landing-panel-heading">
        <span class="landing-panel-title">Skill progress</span>
      </h2>
      ${body}
    </section>`;
  }

  function renderBoard(model, cardsById, order, reorganizeOn) {
    const visibleOrder = order.filter((id) => cardsById[id]);
    const useDefaultPair =
      !reorganizeOn &&
      isDefaultPairOrder(order) &&
      cardsById['today-expectations'] &&
      cardsById['next-rank'];

    // Top navbar default: Today | Next | Skills (tabbed skills + badge)
    if (useDefaultPair && model.navbarAlignment === 'top') {
      const skill = cardsById['skill-progress'] || '';
      return `<div class="landing-board landing-board-tri" data-landing-board data-layout-mode="default-tri">
        <div class="landing-tri-today" data-landing-columns-slot="today">${cardsById['today-expectations']}</div>
        <div class="landing-tri-next" data-landing-columns-slot="next">${cardsById['next-rank']}</div>
        <div class="landing-tri-skills" data-landing-extensions>${skill}</div>
      </div>`;
    }

    // Left navbar default: Today+Next on top, Skills below
    if (useDefaultPair) {
      const skill = cardsById['skill-progress'] || '';
      return `<div class="landing-board landing-board-default" data-landing-board data-layout-mode="default">
        <div class="landing-columns" data-landing-columns>
          ${cardsById['today-expectations']}
          ${cardsById['next-rank']}
        </div>
        ${skill ? `<div class="landing-extensions" data-landing-extensions>${skill}</div>` : ''}
      </div>`;
    }

    const stacked = visibleOrder.map((id) => cardsById[id]).join('');
    return `<div class="landing-board landing-board-stack${
      reorganizeOn ? ' is-reorganize' : ''
    }" data-landing-board data-layout-mode="custom">
      ${stacked}
    </div>`;
  }

  function render() {
    if (destroyed) return;
    const result = svc.getLandingModel(options.localDate);
    if (!result.ok) {
      clearNavbarMenuHost(doc);
      root.innerHTML = `
        <section class="panel landing-view" data-view="landing">
          <p class="inline-alert" role="alert">${escapeHtml(result.message || 'Failed to load landing.')}</p>
        </section>`;
      return;
    }

    const model = result.data;
    const showToday = model.visibility.expectations !== false;
    const showNext = model.visibility.nextRank !== false;
    const showCta = model.visibility.getStarted !== false;
    const showSkills = model.visibility.skillProgress !== false;
    const reorganizeOn = landingLayout.isReorganizeMode();
    const order = (model.layout && model.layout.order) || landingLayout.defaultOrder();
    const isTop = model.navbarAlignment === 'top';
    const useDefaultPair =
      !reorganizeOn &&
      isDefaultPairOrder(order) &&
      showToday &&
      showNext;
    const useTri = isTop && useDefaultPair && showSkills;

    const cardsById = {};
    if (showToday) cardsById['today-expectations'] = buildTodayPanel(model, showCta, reorganizeOn);
    if (showNext) cardsById['next-rank'] = buildNextPanel(model, reorganizeOn);
    if (showSkills) {
      cardsById['skill-progress'] = buildSkillPanel(model, reorganizeOn, { tabbed: useTri });
    }

    const menusHtml = renderLandingMenusHtml(model);
    placeMenus(model, menusHtml);

    const board = renderBoard(model, cardsById, order, reorganizeOn);
    const hasSkillsClass = showSkills ? ' has-skill-progress' : '';
    const reorganizeClass = reorganizeOn ? ' is-reorganize' : '';
    const triClass = useTri ? ' has-tri-layout' : '';

    // Tri layout embeds the overall badge beside the skill tab; otherwise badge stays in the top bar
    const topBar = useTri
      ? ''
      : isTop
        ? `<div class="landing-top-bar" data-badge-alignment="top-right">
            <div class="landing-top-end" data-landing-top-end>
              <div class="landing-badge-slot" data-badge-slot="top-right">${renderOverallBadge(model)}</div>
            </div>
          </div>`
        : `<div class="landing-top-bar" data-badge-alignment="top-left">
            <div class="landing-badge-slot" data-badge-slot="top-left">${renderOverallBadge(model)}</div>
          </div>`;

    root.innerHTML = `
      <section class="panel landing-view${hasSkillsClass}${reorganizeClass}${triClass}" data-view="landing" data-navbar-alignment="${escapeHtml(
        model.navbarAlignment
      )}">
        ${topBar}
        ${board}
      </section>
    `;

    const cta = root.querySelector('[data-action="get-started"]');
    if (cta) {
      cta.addEventListener('click', () => onGetStarted(model));
    }

    const boardEl = root.querySelector('[data-landing-board]');
    bindDragDrop(boardEl);

    const onDocClick = (ev) => {
      if (destroyed) return;
      const t = ev.target;
      if (t && t.closest && t.closest('[data-landing-menus]')) return;
      if (layoutMenuOpen || dayFocusMenuOpen) {
        closeMenus();
        const hosts = [];
        if (doc) {
          doc.querySelectorAll('[data-landing-menus]').forEach((el) => hosts.push(el.parentElement || el));
        }
        hosts.forEach((h) => applyMenuOpenState(h));
        root.querySelectorAll('[data-landing-menu-host]').forEach((h) => applyMenuOpenState(h));
        const navHost = ensureNavbarMenuHost(doc);
        if (navHost) applyMenuOpenState(navHost);
      }
    };
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('click', onDocClick, { once: true });
    }

    layoutSkillProgressLabels(root);
  }

  render();

  return {
    refresh,
    destroy,
    getRoot: () => root,
  };
}

module.exports = {
  mountLandingView,
  renderExpectationList,
  groupByHeaders,
  formatTargets,
  metricsForDisplay,
  formatMetricDisplayValue,
  renderSkillProgress,
  formatAverageSummary,
  layoutSkillProgressLabels,
  renderLandingMenusHtml,
  isDefaultPairOrder,
};
