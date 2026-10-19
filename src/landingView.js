/**
 * Feature 7 — Landing Page
 * Spec: features/feature-7-Landing-Page.md
 * Feature 13 — Skill Progress Landing
 * Spec: features/feature-13-Skill-Progress-Landing.md
 */

const landing = require('./landing');
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

/**
 * Mount Landing view into `root`.
 */
function mountLandingView(root, options = {}) {
  const svc = options.landing || landing;
  const onGetStarted = options.onGetStarted || (() => {});
  let destroyed = false;

  function destroy() {
    destroyed = true;
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  function render() {
    if (destroyed) return;
    const result = svc.getLandingModel(options.localDate);
    if (!result.ok) {
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

    const todayPanel = showToday
      ? `<section class="landing-panel landing-today${todayCorner ? ' has-today-corner' : ''}" data-panel="today-expectations">
          ${todayCorner}
          <h2 class="landing-panel-heading">
            <span class="landing-panel-title">Today’s expected exercises</span>
            ${todayBadge}
          </h2>
          <div class="panel-body" data-today-list>${renderExpectationList(model.todayExpectations, 'today')}</div>
        </section>`
      : '';

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

    const nextPanel = showNext
      ? `<section class="landing-panel landing-next" data-panel="next-rank">
          ${nextHeading}
          <div class="panel-body" data-next-list>${nextBody}</div>
        </section>`
      : '';

    const customizeCorner =
      model.navbarAlignment === 'top' ? 'top-left' : 'top-right';

    const skillPanel = showSkills
      ? `<div class="landing-extensions" data-landing-extensions>
          <section class="landing-panel landing-skill-progress" data-panel="skill-progress" aria-label="Skill progress">
            <h2 class="landing-panel-heading">
              <span class="landing-panel-title">Skill progress</span>
            </h2>
            <div class="panel-body" data-skill-progress>${renderSkillProgress(model)}</div>
          </section>
        </div>`
      : '';

    root.innerHTML = `
      <section class="panel landing-view${showSkills ? ' has-skill-progress' : ''}" data-view="landing" data-navbar-alignment="${escapeHtml(
        model.navbarAlignment
      )}">
        <div class="landing-top-bar" data-customize-slot="${customizeCorner}">
          <div class="landing-badge-slot" data-badge-slot="${
            model.navbarAlignment === 'top' ? 'top-right' : 'top-left'
          }">
            ${renderOverallBadge(model)}
          </div>
          <button
            type="button"
            class="primary outline landing-customize-btn"
            data-action="customize"
            data-customize-corner="${customizeCorner}"
            aria-label="Customize"
          >Customize</button>
        </div>
        <div class="landing-columns" data-landing-columns>
          ${todayPanel}
          ${nextPanel}
        </div>
        ${skillPanel}
      </section>
    `;

    const cta = root.querySelector('[data-action="get-started"]');
    if (cta) {
      cta.addEventListener('click', () => onGetStarted(model));
    }
    // Feature 14: Customize opens landing-config options (not wired yet)
    const customize = root.querySelector('[data-action="customize"]');
    if (customize && typeof options.onCustomize === 'function') {
      customize.addEventListener('click', () => options.onCustomize(model));
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
