/**
 * Feature 6 — Custom Ranks
 * Feature 10 — Ranks Gallery
 * Spec: features/feature-6-Custom-Ranks.md
 * Spec: features/feature-10-Ranks-Gallery.md
 */

const ranksGallery = require('./ranksGallery');
const ranks = require('./ranks');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Shared rank card markup (gallery + Rank Editor preview).
 */
function renderRankCard(column) {
  const badge = column.badgeUrl
    ? `<img class="rank-badge-img" data-badge-img src="${escapeHtml(column.badgeUrl)}" alt="${escapeHtml(
        column.tierName
      )}" />`
    : `<span class="rank-badge-fallback" data-badge-fallback="${escapeHtml(column.tierName)}">${escapeHtml(
        column.tierName
      )}</span>`;

  const sections = (column.sections || [])
    .map((section) => {
      const items = section.items || [];
      if (items.length === 0) {
        return `<p class="empty-state" data-empty-requirements>No requirements listed.</p>`;
      }
      const list = items
        .map(
          (item) =>
            `<li class="rank-expectation" data-exercise-id="${escapeHtml(item.exerciseId)}">
              <span class="expectation-name">${escapeHtml(item.name)}</span>
              <span class="expectation-targets">${escapeHtml(item.targetSummary || '')}</span>
            </li>`
        )
        .join('');
      return `<ul class="rank-expectation-list">${list}</ul>`;
    })
    .join('');

  return `
    <article class="rank-column" data-tier-name="${escapeHtml(column.tierName)}" data-tier-id="${escapeHtml(
    column.tierId || ''
  )}" aria-label="Rank: ${escapeHtml(column.tierName)}">
      <div class="rank-column-badge">${badge}</div>
      <h2 class="rank-column-name">${escapeHtml(column.tierName)}</h2>
      <div class="rank-column-body">${sections}</div>
    </article>`;
}

function mountRanksGalleryView(root, options = {}) {
  const gallery = options.ranksGallery || ranksGallery;
  const ranksMod = options.ranks || ranks;
  const onBack = options.onBack || (() => {});
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
    if (typeof ranksMod.loadRanks === 'function') {
      ranksMod.loadRanks();
    }
    const columnsResult = gallery.getColumns({ ranks: ranksMod, catalog: options.catalog });
    const columns = columnsResult.ok ? columnsResult.data : [];
    const body =
      columns.length === 0
        ? `<p class="empty-state" data-empty="ranks">No ranks loaded.</p>`
        : `<div class="ranks-gallery-scroller" data-gallery-scroller>${columns
            .map((c) => renderRankCard(c))
            .join('')}</div>`;

    root.innerHTML = `
      <section class="panel ranks-gallery-view" data-view="ranksGallery">
        <header class="ranks-gallery-header">
          <button type="button" class="ghost" data-action="back">Back</button>
          <h1>Ranks</h1>
        </header>
        ${!columnsResult.ok ? `<p class="inline-alert" role="alert">${escapeHtml(columnsResult.message)}</p>` : ''}
        ${body}
      </section>
    `;

    const back = root.querySelector('[data-action="back"]');
    if (back) back.addEventListener('click', () => onBack());
  }

  render();

  return {
    refresh,
    destroy,
    getRoot: () => root,
  };
}

module.exports = {
  mountRanksGalleryView,
  renderRankCard,
};
