/**
 * Feature 6 — Custom Ranks
 * Feature 10 — Ranks Gallery
 * Spec: features/feature-6-Custom-Ranks.md
 * Spec: features/feature-10-Ranks-Gallery.md
 */

const ranksGallery = require('./ranksGallery');
const { formatTargets } = require('./landingView');
const { renderExerciseHelp } = require('./exerciseHelp');

const EMPHASIS_TIERS = new Set([
  'BRONZE III',
  'SILVER III',
  'GOLD III',
  'DIAMOND IV',
  'PRO IV',
  'PRO VII',
  'PRO IX',
  'PRO X',
]);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Badge scale token for CSS (25% base bump applied in CSS).
 * Pro ≈ +10% vs non-pro; listed tiers slightly larger; Pro X +10% vs Pro IX.
 */
function badgeScaleToken(tierName) {
  const name = String(tierName || '')
    .toUpperCase()
    .trim();
  if (name === 'PRO X') return 'pro-x';
  const isPro = name.startsWith('PRO ');
  const emphasis = EMPHASIS_TIERS.has(name);
  if (isPro && emphasis) return 'pro-emphasis';
  if (isPro) return 'pro';
  if (emphasis) return 'emphasis';
  return 'base';
}

function renderBadge(column) {
  const name = column.tierName || '';
  const safe = escapeHtml(name);
  const scale = badgeScaleToken(name);
  const media = column.badgeUrl
    ? `<img class="ranks-gallery-badge-img" src="${escapeHtml(column.badgeUrl)}" alt="${safe}" data-badge-img />`
    : `<span class="ranks-gallery-badge-fallback" data-badge-fallback>${safe}</span>`;
  return `<div class="ranks-gallery-badge-media" data-badge-scale="${scale}">${media}</div>`;
}

function renderSections(sections, columnKey) {
  if (!sections || !sections.length) {
    return `<p class="empty-state" data-empty="requirements">No requirements listed.</p>`;
  }
  const hasItems = sections.some((s) => s.items && s.items.length);
  if (!hasItems) {
    return `<p class="empty-state" data-empty="requirements">No requirements listed.</p>`;
  }

  return sections
    .map((section) => {
      const heading =
        section.headerPath && section.headerPath.length
          ? `<h3 class="ranks-gallery-section-heading" data-header-path="${escapeHtml(
              section.headerPath.join('>')
            )}">${escapeHtml(section.headerPath.join(' › '))}</h3>`
          : '';
      const items = (section.items || [])
        .map((item) => {
          const id = escapeHtml(item.exerciseId);
          const helpId = `gallery-${escapeHtml(columnKey)}-${item.exerciseId}`;
          const targets = escapeHtml(formatTargets(item.targets));
          return `<li class="ranks-gallery-item" data-exercise-id="${id}" data-expandable>
            <button type="button" class="ranks-gallery-item-toggle" data-action="toggle-targets" aria-expanded="false">
              <span class="ranks-gallery-item-arrow" aria-hidden="true"></span>
              <span class="ranks-gallery-item-name">${escapeHtml(item.name)}</span>
            </button>${renderExerciseHelp(item.notes, { id: helpId })}
            <div class="ranks-gallery-item-flyout" data-targets hidden>
              <span class="ranks-gallery-item-targets">${targets}</span>
            </div>
          </li>`;
        })
        .join('');
      return `<section class="ranks-gallery-section">${heading}<ul class="ranks-gallery-list">${items}</ul></section>`;
    })
    .join('');
}

function setExpanded(item, expanded) {
  const toggle = item.querySelector('[data-action="toggle-targets"]');
  const flyout = item.querySelector('[data-targets]');
  if (!toggle || !flyout) return;
  item.classList.toggle('is-expanded', expanded);
  toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (expanded) flyout.removeAttribute('hidden');
  else flyout.setAttribute('hidden', '');
}

function bindGalleryInteractions(root) {
  root.querySelectorAll('[data-expandable]').forEach((item) => {
    item.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-exercise-help]')) return;
      const expanded = item.classList.contains('is-expanded');
      setExpanded(item, !expanded);
    });
  });
}

/**
 * Mount Ranks gallery into `root` (FR-001–FR-008).
 */
function mountRanksGalleryView(root, options = {}) {
  const svc = options.ranksGallery || ranksGallery;
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
    const result = svc.getColumns();
    if (!result.ok) {
      root.innerHTML = `
        <section class="panel ranks-gallery-view" data-view="ranksGallery">
          <header class="ranks-gallery-header">
            <h1>Ranks</h1>
            <button type="button" class="ghost" data-action="back">Back</button>
          </header>
          <p class="inline-alert" role="alert">${escapeHtml(result.message || 'Failed to load ranks.')}</p>
        </section>`;
      root.querySelector('[data-action="back"]').addEventListener('click', onBack);
      return;
    }

    const columns = result.data || [];
    const colsHtml = columns
      .map((col, index) => {
        const name = escapeHtml(col.tierName);
        return `<article class="ranks-gallery-column" data-tier-name="${name}" data-tier-index="${index}" aria-label="Rank: ${name}">
          <div class="ranks-gallery-badge" data-tier-badge="${name}">
            ${renderBadge(col)}
            <p class="ranks-gallery-tier-caption">${name}</p>
          </div>
          <div class="ranks-gallery-divider" aria-hidden="true"></div>
          <div class="ranks-gallery-expectations" data-tier-expectations="${name}">
            ${renderSections(col.sections, col.tierName || index)}
          </div>
        </article>`;
      })
      .join('');

    root.innerHTML = `
      <section class="panel ranks-gallery-view" data-view="ranksGallery">
        <header class="ranks-gallery-header">
          <h1>Ranks</h1>
          <button type="button" class="ghost" data-action="back">Back</button>
        </header>
        <div class="ranks-gallery-scroller" data-ranks-scroller>
          ${colsHtml || '<p class="empty-state">No ranks configured.</p>'}
        </div>
      </section>
    `;

    root.querySelector('[data-action="back"]').addEventListener('click', onBack);
    bindGalleryInteractions(root);
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
  renderSections,
  badgeScaleToken,
};
