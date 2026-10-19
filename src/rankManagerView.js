/**
 * Feature 12 — Ranks list (between Config and Rank Editor / Create Rank)
 */

const rankManager = require('./rankManager');
const landing = require('./landing');
const ranks = require('./ranks');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function badgeImgHtml(badgePath, name) {
  const tier = { name, badgePath };
  const url = landing.resolveBadgeUrl(tier) || rankManager.resolveBadgeUrl(badgePath);
  const safe = escapeHtml(name || '');
  if (url) {
    return `<img class="rank-row-badge-img" src="${escapeHtml(url)}" alt="${safe}" />`;
  }
  return `<span class="rank-row-badge-fallback" aria-hidden="true">${safe.slice(0, 1) || '?'}</span>`;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   onBack?: Function,
 *   onCreate?: Function,
 *   onEdit?: Function,
 *   onRawEditor?: Function,
 *   confirm?: Function,
 *   rankManager?: object,
 * }} [options]
 */
function mountRankManagerView(root, options = {}) {
  if (!root) throw new Error('mountRankManagerView requires root');

  const svc = options.rankManager || rankManager;
  const confirmFn =
    typeof options.confirm === 'function'
      ? options.confirm
      : (msg) => (typeof window !== 'undefined' && window.confirm ? window.confirm(msg) : true);

  let status = null;

  function render() {
    const listed = svc.listRankRows();
    const rows = listed.ok ? listed.data || [] : [];
    if (!listed.ok) {
      status = { kind: 'alert', text: listed.message || 'Failed to load ranks.' };
    }

    const statusHtml = status
      ? `<p class="rank-manager-status ${status.kind === 'alert' ? 'status-alert' : 'status-ok'}" data-status>${escapeHtml(
          status.text
        )}</p>`
      : '';

    const listItems = rows
      .map((row) => {
        const isUnranked = row.isUnranked;
        const actions = isUnranked
          ? ''
          : `<div class="rank-row-actions">
              <button type="button" class="secondary" data-action="edit-rank" data-rank-name="${escapeHtml(
                row.name
              )}">Edit</button>
              <button type="button" class="secondary rank-row-delete" data-action="delete-rank" data-rank-name="${escapeHtml(
                row.name
              )}">Delete</button>
            </div>`;
        return `<li class="rank-row year-row" data-rank-name="${escapeHtml(row.name)}">
          <div class="rank-row-main">
            <span class="rank-row-badge">${badgeImgHtml(row.badgePath, row.name)}</span>
            <span class="rank-row-name year-label">${escapeHtml(row.name)}</span>
          </div>
          ${actions}
        </li>`;
      })
      .join('');

    root.innerHTML = `
      <section class="panel rank-manager-view" data-view="rank-manager">
        <header class="panel-header rank-manager-header">
          <h1>Ranks</h1>
          <div class="rank-manager-header-actions">
            <button type="button" class="secondary" data-action="raw-editor">Edit as text</button>
            <button type="button" class="ghost" data-action="back">Back</button>
          </div>
        </header>
        ${statusHtml}
        <hr class="rank-manager-divider" />
        <ul class="years-list ranks-manager-list" data-ranks-list>
          ${listItems || '<li class="empty-state">No ranks yet.</li>'}
        </ul>
        <div class="rank-manager-footer">
          <button type="button" class="primary" data-action="custom-rank">+ Custom Rank</button>
        </div>
      </section>
    `;

    bind();
  }

  function bind() {
    const back = root.querySelector('[data-action="back"]');
    if (back) {
      back.addEventListener('click', () => {
        if (typeof options.onBack === 'function') options.onBack();
      });
    }

    const raw = root.querySelector('[data-action="raw-editor"]');
    if (raw) {
      raw.addEventListener('click', () => {
        if (typeof options.onRawEditor === 'function') options.onRawEditor();
      });
    }

    root.querySelectorAll('[data-action="custom-rank"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof options.onCreate === 'function') options.onCreate();
      });
    });

    root.querySelectorAll('[data-action="edit-rank"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-rank-name');
        if (typeof options.onEdit === 'function') options.onEdit(name);
      });
    });

    root.querySelectorAll('[data-action="delete-rank"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-rank-name');
        if (!confirmFn(`Delete rank “${name}”? This cannot be undone.`)) return;
        const result = svc.deleteRank(name);
        if (!result.ok) {
          status = { kind: 'alert', text: result.message || 'Could not delete rank.' };
        } else {
          status = { kind: 'ok', text: `Deleted ${name}.` };
          try {
            ranks.clearRanksCache();
          } catch (_) {
            /* ignore */
          }
        }
        render();
      });
    });
  }

  render();

  return {
    refresh: render,
    destroy() {
      root.innerHTML = '';
    },
    getRoot: () => root,
  };
}

module.exports = {
  mountRankManagerView,
};
