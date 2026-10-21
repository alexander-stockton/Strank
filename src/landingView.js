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
const flyoutFade = require('./flyoutFade');
const { formatMetricEntry, formatWeightDisplay, formatDistanceDisplay } = require('./todayView');
const { formatDurationSeconds, isTimeDurationKey } = require('./parse/duration');
const { renderExerciseHelp } = require('./exerciseHelp');
const { renderRankBadge } = require('./rankBadge');
const { formatDuration, formatCompletionClock } = require('./workoutTimer');

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
            ? `<span class="expectation-done-block">
                <span class="expectation-done" aria-label="completed">Completed</span>
                ${
                  row.completedAt
                    ? `<span class="expectation-completed-at" data-completed-at="${escapeHtml(
                        row.completedAt
                      )}">${escapeHtml(formatCompletionClock(row.completedAt))}</span>`
                    : ''
                }
              </span>`
            : '';
          return `<li class="expectation-row${done}" data-content-reveal-item data-exercise-id="${escapeHtml(
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
  const schedule = model.dayFocusSchedule || dayFocus.getSchedule();
  return `<div class="landing-menu-cluster" data-landing-menus>
    ${renderDayFocusMenu(schedule)}
  </div>`;
}

function clearNavbarMenuHost(doc) {
  if (!doc || typeof doc.querySelector !== 'function') return;
  const host = doc.querySelector('[data-landing-menu-host="navbar"]');
  if (host) {
    host.innerHTML = '';
    host.hidden = true;
    const nav = host.closest('.app-navbar');
    if (nav) nav.classList.remove('is-landing-menu-open');
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
  let dayFocusMenuOpen = false;

  function destroy() {
    destroyed = true;
    // During view slides / double-render, the outgoing mount destroys while the
    // incoming Landing has already called placeMenus. Only clear the navbar host
    // when no *other* Landing remains outside this root (otherwise Day focus
    // vanishes until the user leaves and revisits Landing).
    let otherLanding = false;
    if (doc && typeof doc.querySelectorAll === 'function') {
      otherLanding = Array.from(doc.querySelectorAll('[data-view="landing"]')).some(
        (el) => root && !root.contains(el)
      );
    }
    if (!otherLanding) clearNavbarMenuHost(doc);
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  function closeMenus() {
    dayFocusMenuOpen = false;
  }

  function applyMenuOpenState(scope) {
    if (!scope) return;
    const dayPanel = scope.querySelector('[data-day-focus-menu-panel]');
    const dayBtn = scope.querySelector('[data-action="toggle-day-focus-menu"]');
    // Keep overflow:visible on the nav until the fade-out finishes, otherwise the
    // panel drops into the navbar scroll layer mid-dismiss and flashes a scrollbar.
    const nav = scope.closest ? scope.closest('.app-navbar') : null;
    if (dayPanel) {
      if (dayFocusMenuOpen) {
        if (nav) nav.classList.add('is-landing-menu-open');
        flyoutFade.show(dayPanel);
      } else {
        flyoutFade.hide(dayPanel, {
          onDone: () => {
            if (!dayFocusMenuOpen && nav) nav.classList.remove('is-landing-menu-open');
          },
        });
      }
    } else if (nav) {
      nav.classList.toggle('is-landing-menu-open', dayFocusMenuOpen);
    }
    if (dayBtn) dayBtn.setAttribute('aria-expanded', dayFocusMenuOpen ? 'true' : 'false');
  }

  function bindMenuEvents(scope, model) {
    if (!scope) return;
    applyMenuOpenState(scope);

    const dayBtn = scope.querySelector('[data-action="toggle-day-focus-menu"]');
    if (dayBtn) {
      dayBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        dayFocusMenuOpen = !dayFocusMenuOpen;
        applyMenuOpenState(scope);
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
          const trigger = scope.querySelector('[data-action="toggle-day-focus-menu"]');
          if (trigger) trigger.focus();
        }
      });
    });

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

  function buildTodayPanel(model, showCta) {
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
    const durationHtml =
      model.workoutComplete && Number.isFinite(model.workoutDurationMs)
        ? `<p class="landing-workout-duration" data-workout-duration>${escapeHtml(
            formatDuration(model.workoutDurationMs)
          )}</p>`
        : '';
    return `<section class="landing-panel landing-today landing-card${
      todayCorner ? ' has-today-corner' : ''
    }" data-panel="today-expectations" data-landing-card="today-expectations" data-content-reveal-frame>
      ${todayCorner}
      <h2 class="landing-panel-heading">
        <span class="landing-panel-title">Today’s workout</span>
        ${todayBadge}
      </h2>
      ${durationHtml}
      <div class="panel-body" data-today-list>${body}</div>
    </section>`;
  }

  function buildNextPanel(model) {
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
    return `<section class="landing-panel landing-next landing-card" data-panel="next-rank" data-landing-card="next-rank" data-content-reveal-frame>
      ${nextHeading}
      <div class="panel-body" data-next-list>${nextBody}</div>
    </section>`;
  }

  function buildSkillPanel(model, opts = {}) {
    const body = `<div class="panel-body" data-skill-progress>${renderSkillProgress(model)}</div>`;
    if (opts.tabbed) {
      return `<div class="landing-skill-stack" data-landing-card="skill-progress" data-content-reveal-frame>
        <div class="landing-skill-chrome" data-landing-skill-chrome>
          <h2 class="landing-skill-tab" data-skill-tab>
            <span class="landing-panel-title">Skill progress</span>
          </h2>
        </div>
        <section class="landing-skill-body" data-panel="skill-progress" aria-label="Skill progress">
          ${body}
        </section>
      </div>`;
    }
    return `<section class="landing-panel landing-skill-progress landing-card" data-panel="skill-progress" data-landing-card="skill-progress" data-content-reveal-frame aria-label="Skill progress">
      <h2 class="landing-panel-heading">
        <span class="landing-panel-title">Skill progress</span>
      </h2>
      ${body}
    </section>`;
  }

  function renderBoard(model, cardsById, order) {
    const useDefaultPair =
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

    const visibleOrder = order.filter((id) => cardsById[id]);
    const stacked = visibleOrder.map((id) => cardsById[id]).join('');
    return `<div class="landing-board landing-board-stack" data-landing-board data-layout-mode="stack">
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
    const order = (model.layout && model.layout.order) || landingLayout.defaultOrder();
    const isTop = model.navbarAlignment === 'top';
    const useDefaultPair = isDefaultPairOrder(order) && showToday && showNext;
    const useTri = isTop && useDefaultPair && showSkills;

    const cardsById = {};
    if (showToday) cardsById['today-expectations'] = buildTodayPanel(model, showCta);
    if (showNext) cardsById['next-rank'] = buildNextPanel(model);
    if (showSkills) {
      cardsById['skill-progress'] = buildSkillPanel(model, { tabbed: useTri });
    }

    const menusHtml = renderLandingMenusHtml(model);
    placeMenus(model, menusHtml);

    const board = renderBoard(model, cardsById, order);
    const hasSkillsClass = showSkills ? ' has-skill-progress' : '';
    const triClass = useTri ? ' has-tri-layout' : '';

    // Overall rank lives in the app header; landing no longer duplicates that badge card.
    root.innerHTML = `
      <section class="panel landing-view${hasSkillsClass}${triClass}" data-view="landing" data-navbar-alignment="${escapeHtml(
        model.navbarAlignment
      )}">
        ${board}
      </section>
    `;

    const cta = root.querySelector('[data-action="get-started"]');
    if (cta) {
      cta.addEventListener('click', () => onGetStarted(model));
    }

    const onDocClick = (ev) => {
      if (destroyed) return;
      const t = ev.target;
      if (t && t.closest && t.closest('[data-landing-menus]')) return;
      if (dayFocusMenuOpen) {
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
