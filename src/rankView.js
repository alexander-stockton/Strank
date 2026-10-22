/**
 * Feature 4 — Weekly Ranking
 * Spec: features/feature-4-Weekly-Ranking.md
 *
 * Optional Rank diagnostic view (rankDebug).
 */

const ranking = require('./ranking');
const catalog = require('./catalog');
const { renderExerciseHelp, descriptionForExercise } = require('./exerciseHelp');
const { formatMetricsSummary } = require('./todayView');
const i18n = require('./i18n');
const { isUnrankedName } = require('./rankTokens');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMetrics(obj) {
  return formatMetricsSummary(obj);
}

function mountRankView(root, options = {}) {
  const svc = options.ranking || ranking;
  let destroyed = false;
  let selectedWeek = options.initialWeek || svc.defaultDiagnosticWeek();

  function refresh() {
    if (!destroyed) render();
  }

  function render() {
    if (destroyed) return;
    const weeksResult = svc.listAvailableWeeks();
    const weeks = weeksResult.ok ? weeksResult.data : [selectedWeek];
    if (!weeks.includes(selectedWeek) && weeks.length) {
      // keep selection even if not in list
    }

    const compared = svc.compareToRanks(selectedWeek);
    const result = compared.ok ? compared.data : null;

    const weekOptions = weeks
      .map(
        (w) =>
          `<option value="${escapeHtml(w)}" ${w === selectedWeek ? 'selected' : ''}>${escapeHtml(w)} – ${escapeHtml(
            svc.weekRange(w).end
          )}</option>`
      )
      .join('');

    let body = '';
    if (!result) {
      body = `<p class="inline-alert">${escapeHtml(compared.message || i18n.t('rank.computeFailed'))}</p>`;
    } else {
      const hero = result.overallTierName;
      const nextSummary =
        result.nextTierName != null
          ? i18n.t('rank.nextSummary', {
              name: result.nextTierName,
              met: result.nextTierMetCount,
              total: result.nextTierTotalLogged,
            })
          : !isUnrankedName(result.overallTierName)
            ? i18n.t('rank.maxReached')
            : '';
      const guidance =
        isUnrankedName(result.overallTierName)
          ? `<p class="empty-state">${escapeHtml(result.reason || i18n.t('rank.unranked'))}</p>`
          : '';

      const cards = (result.exercises || [])
        .map(
          (ex) => `<article class="rank-exercise-card" data-exercise-id="${escapeHtml(ex.exerciseId)}">
            <h3 class="entry-title">${escapeHtml(ex.name)}${renderExerciseHelp(
            descriptionForExercise(ex.exerciseId, catalog),
            { id: `rank-${ex.exerciseId}` }
          )}</h3>
            <p class="rank-avg">${escapeHtml(i18n.t('rank.avg', { metrics: formatMetrics(ex.averages) }))}</p>
            <p class="rank-target">${escapeHtml(i18n.t('rank.target', { name: ex.targetTierName, metrics: formatMetrics(ex.targets) }))}</p>
            <p class="rank-pass">${ex.meetsOverallTier ? i18n.t('rank.meetsOverall') : i18n.t('rank.belowOverall')}${
              result.nextTierName ? (ex.meetsNextTier ? ` · ${i18n.t('rank.meetsNext')}` : ` · ${i18n.t('rank.belowNext')}`) : ''
            }</p>
          </article>`
        )
        .join('');

      body = `
        <div class="rank-hero" data-hero-tier="${escapeHtml(hero)}">
          <span class="rank-hero-label">${escapeHtml(i18n.t('rank.standing'))}</span>
          <span class="rank-hero-name">${escapeHtml(hero)}</span>
          ${result.inProgress ? `<span class="rank-badge-progress">${escapeHtml(i18n.t('rank.inProgress'))}</span>` : ''}
        </div>
        <p class="rank-week-range" data-week-range>${escapeHtml(result.weekStart)} – ${escapeHtml(result.weekEnd)}</p>
        ${nextSummary ? `<p class="rank-next" data-next-tier>${escapeHtml(nextSummary)}</p>` : ''}
        ${guidance}
        <div class="rank-exercise-list" data-breakdown>${cards || `<p class="empty-state">${escapeHtml(i18n.t('rank.noExercisesWeek'))}</p>`}</div>
      `;
    }

    root.innerHTML = `
      <section class="panel rank-view" data-view="rankDebug">
        <header class="rank-header">
          <h1>${escapeHtml(i18n.t('rank.title'))}</h1>
          <label class="field">
            <span>${escapeHtml(i18n.t('rank.weekStarting'))}</span>
            <select name="weekSelect" data-week-select>${weekOptions}</select>
          </label>
        </header>
        ${body}
      </section>
    `;

    const select = root.querySelector('[data-week-select]');
    if (select) {
      select.addEventListener('change', () => {
        selectedWeek = select.value;
        render();
      });
    }
  }

  function destroy() {
    destroyed = true;
    root.innerHTML = '';
  }

  render();
  return {
    refresh,
    destroy,
    getSelectedWeek: () => selectedWeek,
    setSelectedWeek: (w) => {
      selectedWeek = w;
      render();
    },
    getRoot: () => root,
  };
}

module.exports = {
  mountRankView,
};
