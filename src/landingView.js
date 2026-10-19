/**
 * Feature 7 — Landing Page
 * Spec: features/feature-7-Landing-Page.md
 */

const landing = require('./landing');
const { metricLabel } = require('./todayView');
const { formatDurationSeconds, isTimeDurationKey } = require('./parse/duration');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMetricDisplayValue(key, value) {
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
    .map(([k, v]) => `${metricLabel(k)} ${formatMetricDisplayValue(k, v)}`)
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
            <span class="expectation-name">${escapeHtml(row.name)}</span>
            <span class="expectation-targets" data-targets>${escapeHtml(
              formatTargets(metricsForDisplay(row))
            )}</span>
            ${check}
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

    const todayPanel = showToday
      ? `<section class="landing-panel landing-today" data-panel="today-expectations">
          <h2>Today’s expected exercises</h2>
          ${
            model.targetTierName
              ? `<p class="panel-sub" data-target-tier="${escapeHtml(model.targetTierName)}">Target: ${escapeHtml(
                  model.targetTierName
                )}</p>`
              : ''
          }
          <div class="panel-body" data-today-list>${renderExpectationList(model.todayExpectations, 'today')}</div>
          ${
            model.workoutComplete
              ? `<p class="workout-complete-status" data-workout-complete>Today’s workout complete</p>`
              : showCta
                ? `<button type="button" class="primary" data-action="get-started">Get Started</button>`
                : ''
          }
        </section>`
      : '';

    let nextBody;
    if (model.atTopOfLadder) {
      nextBody = `<p class="empty-state" data-at-top>You are at the top of the ladder.</p>`;
    } else {
      nextBody = renderExpectationList(model.nextRankExpectations, 'next-rank');
    }

    const nextPanel = showNext
      ? `<section class="landing-panel landing-next" data-panel="next-rank">
          <h2 data-next-tier-label>${
            model.nextTierName
              ? `Next rank: ${escapeHtml(model.nextTierName)}`
              : 'Next rank’s expectations'
          }</h2>
          <div class="panel-body" data-next-list>${nextBody}</div>
        </section>`
      : '';

    root.innerHTML = `
      <section class="panel landing-view" data-view="landing" data-navbar-alignment="${escapeHtml(
        model.navbarAlignment
      )}">
        <div class="landing-badge-slot" data-badge-slot="${
          model.navbarAlignment === 'top' ? 'top-right' : 'top-left'
        }">
          ${renderOverallBadge(model)}
          <!-- Feature 15 chrome attaches near badge / navbar -->
        </div>
        <div class="landing-columns" data-landing-columns>
          ${todayPanel}
          ${nextPanel}
        </div>
        <div class="landing-extensions" data-landing-extensions aria-hidden="true">
          <!-- Feature 14 skill progress · Feature 15 layout hooks -->
        </div>
      </section>
    `;

    const cta = root.querySelector('[data-action="get-started"]');
    if (cta) {
      cta.addEventListener('click', () => onGetStarted(model));
    }
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
};
