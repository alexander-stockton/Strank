/**
 * Feature 7 - Landing Page
 * Spec: features/feature-7-Landing-Page.md
 * Feature 13 - Skill Progress Landing
 * Spec: features/feature-13-Skill-Progress-Landing.md
 * Feature 14 - Landing Day Focus
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const landing = require('./landing');
const navbarUtilities = require('./navbarUtilities');
const i18n = require('./i18n');
const { isUnrankedName } = require('./rankTokens');
const { formatMetricEntry, formatWeightDisplay, formatDistanceDisplay } = require('./todayView');
const { formatDurationSeconds, isTimeDurationKey } = require('./parse/duration');
const { renderExerciseHelp } = require('./exerciseHelp');
const { renderRankBadge } = require('./rankBadge');
const { formatDuration, formatCompletionClock } = require('./workoutTimer');

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
    .join(' - ');
}

function groupByHeaders(expectations) {
  const groups = [];
  const map = new Map();
  for (const row of expectations) {
    const key = (row.headers || []).join(' › ') || i18n.t('group.general');
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
    return `<p class="empty-state" data-empty="${escapeHtml(listAttr)}">${escapeHtml(i18n.t('landing.emptyExpectations'))}</p>`;
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
                <span class="expectation-done" aria-label="${escapeHtml(i18n.t('landing.completed'))}">${escapeHtml(i18n.t('landing.completed'))}</span>
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
    return ' - ';
  }
  const text = formatTargets(averages);
  return text || ' - ';
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
    : !isUnrankedName(localName)
      ? `<span class="skill-next-rank skill-next-max" data-next-rank="${escapeHtml(i18n.t('rank.max'))}">${escapeHtml(i18n.t('rank.max'))}</span>`
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
      aria-label="${escapeHtml(i18n.t('landing.progressAria', { pct }))}${escapeHtml(ariaExtra)}"
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
  const label = i18n.muscleLabel(groupKey);
  const items = (skills || []).map(renderSkillRow).join('');
  return `<section class="skill-column" data-skill-column="${escapeHtml(groupKey)}" aria-label="${escapeHtml(label)}">
    <h3 class="skill-column-heading">${escapeHtml(label)}</h3>
    <ul class="skill-list">${items || ''}</ul>
  </section>`;
}

function renderSkillProgress(model) {
  const sp = model.skillProgress;
  if (!sp) {
    return `<p class="empty-state" data-skill-empty>${escapeHtml(i18n.t('landing.emptySkills'))}</p>`;
  }
  if (sp.empty) {
    return `<p class="empty-state" data-skill-empty>${escapeHtml(i18n.t('landing.emptySkills'))}</p>`;
  }
  const cols = sp.columns || {};
  return `<div class="skill-progress-grid" data-skill-progress-grid>
    ${renderSkillColumn('arms', cols.arms)}
    ${renderSkillColumn('core', cols.core)}
    ${renderSkillColumn('lungs', cols.lungs)}
    ${renderSkillColumn('legs', cols.legs)}
  </div>`;
}

/**
 * Mount Landing view into `root`.
 * Uses `root.ownerDocument` (not global `document`) so NW.js Node-context
 * requires still find the window DOM for left-rail menu placement.
 * Day Focus / Edit Ranks / Privacy live in the shell navbar (navbarUtilities);
 * Landing only ensures the cluster exists when mounted in isolation (tests).
 */
function mountLandingView(root, options = {}) {
  const svc = options.landing || landing;
  const onGetStarted = options.onGetStarted || (() => {});
  const doc = (root && root.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  let destroyed = false;

  function destroy() {
    destroyed = true;
    // Never clear navbar utilities HTML - the shell owns them. Clearing would wipe
    // an incoming Landing's Day Focus during view slides. Only reset open state.
    if (doc && typeof doc.querySelector === 'function') {
      const host = doc.querySelector('[data-landing-menu-host="navbar"]');
      if (host) {
        const nav = host.closest('.app-navbar');
        if (nav) nav.classList.remove('is-landing-menu-open');
        const panel = host.querySelector('[data-day-focus-menu-panel]');
        if (panel) panel.hidden = true;
        const btn = host.querySelector('[data-action="toggle-day-focus-menu"]');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    }
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  /** Ensure Day Focus exists for unit tests / stale shells; do not clear shell-owned chrome. */
  function ensureNavbarUtilities() {
    if (!doc || typeof doc.querySelector !== 'function') return;
    let host = doc.querySelector('[data-landing-menu-host="navbar"]');
    if (!host) {
      const nav = doc.querySelector('.app-navbar-left') || doc.querySelector('.app-navbar-top');
      if (!nav) return;
      host = doc.createElement('div');
      host.className = 'app-navbar-end';
      host.setAttribute('data-landing-menu-host', 'navbar');
      nav.appendChild(host);
    }
    host.hidden = false;
    host.removeAttribute('hidden');
    if (host.querySelector('[data-navbar-utilities]')) return;
    navbarUtilities.fillNavbarUtilities(doc, {
      onScheduleChange: () => refresh(),
    });
  }

  function buildTodayPanel(model, showCta) {
    const todayBadge = renderRankBadge(model.overallRankName || 'UNRANKED', {
      dataAttr: 'data-today-rank-badge',
      className: 'landing-heading-badge',
    });
    const todayCorner =
      model.workoutComplete
        ? `<p class="workout-complete-status landing-today-corner" data-workout-complete>${escapeHtml(i18n.t('landing.workoutComplete'))}</p>`
        : showCta
          ? `<button type="button" class="primary landing-today-corner" data-action="get-started" aria-label="${escapeHtml(i18n.t('landing.getStarted'))}">${escapeHtml(i18n.t('landing.getStarted'))}</button>`
          : '';
    const body = model.todayEmptyFocus
      ? `<p class="empty-state" data-empty-focus>${escapeHtml(i18n.t('landing.emptyFocus'))}</p>`
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
        <span class="landing-panel-title">${escapeHtml(i18n.t('landing.todayWorkout'))}</span>
        ${todayBadge}
      </h2>
      ${durationHtml}
      <div class="panel-body" data-today-list>${body}</div>
    </section>`;
  }

  function buildNextPanel(model) {
    let nextBody;
    let nextHeading;
    if (model.atTopOfLadder) {
      // Max ladder (e.g. Pro X): no next badge; celebrate instead of expectations.
      nextBody = `<p class="landing-among-best" data-at-top data-among-the-best><strong>${escapeHtml(
        i18n.t('landing.amongTheBest')
      )}</strong></p>`;
      nextHeading = `<h2 class="landing-panel-heading" data-next-tier-label>
            <span class="landing-panel-title">${escapeHtml(i18n.t('landing.nextRank'))}</span>
          </h2>`;
    } else {
      nextBody = renderExpectationList(model.nextRankExpectations, 'next-rank');
      nextHeading = model.nextTierName
        ? `<h2 class="landing-panel-heading" data-next-tier-label>
            <span class="landing-panel-title">${escapeHtml(i18n.t('landing.nextRank'))}</span>
            ${renderRankBadge(model.nextTierName, {
              dataAttr: 'data-next-rank-badge',
              className: 'landing-heading-badge',
            })}
            <span class="landing-next-tier-name">${escapeHtml(model.nextTierName)}</span>
          </h2>`
        : `<h2 class="landing-panel-heading" data-next-tier-label>
            <span class="landing-panel-title">${escapeHtml(i18n.t('landing.nextRankExpectations'))}</span>
          </h2>`;
    }
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
            <span class="landing-panel-title">${escapeHtml(i18n.t('landing.skillProgress'))}</span>
          </h2>
        </div>
        <section class="landing-skill-body" data-panel="skill-progress" aria-label="${escapeHtml(i18n.t('landing.skillProgress'))}">
          ${body}
        </section>
      </div>`;
    }
    return `<section class="landing-panel landing-skill-progress landing-card" data-panel="skill-progress" data-landing-card="skill-progress" data-content-reveal-frame aria-label="${escapeHtml(i18n.t('landing.skillProgress'))}">
      <h2 class="landing-panel-heading">
        <span class="landing-panel-title">${escapeHtml(i18n.t('landing.skillProgress'))}</span>
      </h2>
      ${body}
    </section>`;
  }

  function renderBoard(model, cardsById) {
    const skill = cardsById['skill-progress'] || '';

    // Top navbar: Today | Next | Skills
    if (model.navbarAlignment === 'top') {
      return `<div class="landing-board landing-board-tri" data-landing-board data-layout-mode="default-tri">
        <div class="landing-tri-today" data-landing-columns-slot="today">${cardsById['today-expectations']}</div>
        <div class="landing-tri-next" data-landing-columns-slot="next">${cardsById['next-rank']}</div>
        <div class="landing-tri-skills" data-landing-extensions>${skill}</div>
      </div>`;
    }

    // Left navbar: Today+Next on top, Skills below
    return `<div class="landing-board landing-board-default" data-landing-board data-layout-mode="default">
      <div class="landing-columns" data-landing-columns>
        ${cardsById['today-expectations']}
        ${cardsById['next-rank']}
      </div>
      ${skill ? `<div class="landing-extensions" data-landing-extensions>${skill}</div>` : ''}
    </div>`;
  }

  function render() {
    if (destroyed) return;
    const result = svc.getLandingModel(options.localDate);
    if (!result.ok) {
      root.innerHTML = `
        <section class="panel landing-view" data-view="landing">
          <p class="inline-alert" role="alert">${escapeHtml(result.message || i18n.t('landing.loadFailed'))}</p>
        </section>`;
      return;
    }

    const model = result.data;
    const isTop = model.navbarAlignment === 'top';
    const useTri = isTop;

    const cardsById = {
      'today-expectations': buildTodayPanel(model, true),
      'next-rank': buildNextPanel(model),
      'skill-progress': buildSkillPanel(model, { tabbed: useTri }),
    };

    ensureNavbarUtilities();

    const board = renderBoard(model, cardsById);
    const hasSkillsClass = ' has-skill-progress';
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
};
