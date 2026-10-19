/**
 * Shared rank badge image rendering (Feature 4 / 9).
 */

const ranks = require('./ranks');
const landing = require('./landing');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function findTierByName(tierName) {
  if (!tierName) return null;
  const loaded = ranks.loadRanks();
  if (!loaded.ok) return null;
  const target = String(tierName).toLowerCase();
  return (loaded.data || []).find((t) => String(t.name).toLowerCase() === target) || null;
}

/**
 * Render a rank badge image (or text fallback) for a tier name.
 * Preserves `dataAttr` (e.g. data-week-badge) for tests/selectors.
 */
function renderRankBadge(tierName, options = {}) {
  const name = tierName || 'UNRANKED';
  const tier = findTierByName(name);
  const url = landing.resolveBadgeUrl(tier);
  const dataAttr = options.dataAttr || 'data-rank-badge';
  const extraClass = options.className ? ` ${options.className}` : '';
  const safeName = escapeHtml(name);

  if (url) {
    return `<span class="rank-badge${extraClass}" ${dataAttr}="${safeName}" title="${safeName}" aria-label="${safeName}">
      <img class="rank-badge-img" src="${escapeHtml(url)}" alt="${safeName}" />
    </span>`;
  }

  return `<span class="rank-badge rank-badge-fallback${extraClass}" ${dataAttr}="${safeName}" title="${safeName}" aria-label="${safeName}">${safeName}</span>`;
}

module.exports = {
  renderRankBadge,
  findTierByName,
};
