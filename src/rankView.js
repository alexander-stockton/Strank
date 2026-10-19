/**
 * Feature 4 — Weekly Ranking
 * Spec: features/feature-4-Weekly-Ranking.md
 *
 * Optional Rank diagnostic view (rankDebug).
 */

const ranking = require('./ranking');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMetrics(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
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
      body = `<p class="inline-alert">${escapeHtml(compared.message || 'Could not compute rank.')}</p>`;
    } else {
      const hero = result.overallTierName;
      const nextSummary =
        result.nextTierName != null
          ? `Next: ${result.nextTierName} — ${result.nextTierMetCount}/${result.nextTierTotalLogged} logged exercises meet it`
          : result.overallTierName !== 'UNRANKED'
            ? 'Max rank reached.'
            : '';
      const guidance =
        result.overallTierName === 'UNRANKED'
          ? `<p class="empty-state">${escapeHtml(result.reason || 'UNRANKED')}</p>`
          : '';

      const cards = (result.exercises || [])
        .map(
          (ex) => `<article class="rank-exercise-card" data-exercise-id="${escapeHtml(ex.exerciseId)}">
            <h3>${escapeHtml(ex.name)}</h3>
            <p class="rank-avg">Avg: ${escapeHtml(formatMetrics(ex.averages))}</p>
            <p class="rank-target">Target (${escapeHtml(ex.targetTierName)}): ${escapeHtml(formatMetrics(ex.targets))}</p>
            <p class="rank-pass">${ex.meetsOverallTier ? 'Meets overall' : 'Below overall'}${
              result.nextTierName ? (ex.meetsNextTier ? ' · Meets next' : ' · Below next') : ''
            }</p>
          </article>`
        )
        .join('');

      body = `
        <div class="rank-hero" data-hero-tier="${escapeHtml(hero)}">
          <span class="rank-hero-label">Standing</span>
          <span class="rank-hero-name">${escapeHtml(hero)}</span>
          ${result.inProgress ? '<span class="rank-badge-progress">In progress</span>' : ''}
        </div>
        <p class="rank-week-range" data-week-range>${escapeHtml(result.weekStart)} – ${escapeHtml(result.weekEnd)}</p>
        ${nextSummary ? `<p class="rank-next" data-next-tier>${escapeHtml(nextSummary)}</p>` : ''}
        ${guidance}
        <div class="rank-exercise-list" data-breakdown>${cards || '<p class="empty-state">No exercises in this week.</p>'}</div>
      `;
    }

    root.innerHTML = `
      <section class="panel rank-view" data-view="rankDebug">
        <header class="rank-header">
          <h1>Rank</h1>
          <label class="field">
            <span>Week starting</span>
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
