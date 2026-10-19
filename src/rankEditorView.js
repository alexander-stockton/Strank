/**
 * Feature 6 — Custom Ranks (authoring path)
 * Feature 13 — Rank Editor (minimal open/load for Feature 6)
 * Spec: features/feature-6-Custom-Ranks.md
 * Spec: features/feature-13-Rank-Editor.md
 */

const fs = require('fs');
const { ranksTxtPath } = require('./paths');
const ranks = require('./ranks');
const ranksGallery = require('./ranksGallery');
const { renderRankCard } = require('./ranksGalleryView');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Minimal Rank Editor: load ranks.txt + gallery-style preview.
 * Full Save/Beautify/Fix/Restore/DnD belong to Feature 13.
 */
function mountRankEditorView(root, options = {}) {
  const ranksMod = options.ranks || ranks;
  const gallery = options.ranksGallery || ranksGallery;
  const filePath = options.filePath || ranksTxtPath();
  const onBack = options.onBack || (() => {});
  let destroyed = false;
  let buffer = '';

  function readFileText() {
    try {
      if (options.initialText != null) return String(options.initialText);
      if (!fs.existsSync(filePath)) return '';
      return fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      return '';
    }
  }

  function destroy() {
    destroyed = true;
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  function previewColumns(text) {
    const parsed = ranksMod.parseRanksText(text);
    if (!parsed.ok) {
      return { ok: false, message: parsed.message, data: [] };
    }
    return gallery.getColumns({ tiers: parsed.data, ranks: ranksMod, catalog: options.catalog });
  }

  function render() {
    if (destroyed) return;
    if (!buffer) buffer = readFileText();

    const preview = previewColumns(buffer);
    const cards =
      preview.ok && preview.data.length
        ? preview.data.map((c) => renderRankCard(c)).join('')
        : `<p class="empty-state">${escapeHtml(preview.message || 'No ranks to preview.')}</p>`;

    root.innerHTML = `
      <section class="panel rank-editor-view" data-view="rank-editor">
        <header class="rank-editor-header">
          <button type="button" class="ghost" data-action="back">Back</button>
          <h1>Rank Editor</h1>
        </header>
        <div class="rank-editor-panes">
          <label class="rank-editor-pane" aria-label="Ranks text editor">
            <span class="pane-label">ranks.txt</span>
            <textarea name="ranksText" class="ranks-plaintext" spellcheck="false">${escapeHtml(buffer)}</textarea>
          </label>
          <div class="rank-editor-pane rank-editor-preview" aria-label="Rank cards preview" data-preview>
            ${cards}
          </div>
        </div>
      </section>
    `;

    const back = root.querySelector('[data-action="back"]');
    if (back) back.addEventListener('click', () => onBack());

    const ta = root.querySelector('[name="ranksText"]');
    if (ta) {
      ta.addEventListener('input', () => {
        buffer = ta.value;
        const next = previewColumns(buffer);
        const previewEl = root.querySelector('[data-preview]');
        if (!previewEl) return;
        previewEl.innerHTML =
          next.ok && next.data.length
            ? next.data.map((c) => renderRankCard(c)).join('')
            : `<p class="empty-state">${escapeHtml(next.message || 'No ranks to preview.')}</p>`;
      });
    }
  }

  render();

  return {
    refresh,
    destroy,
    getRoot: () => root,
    /** test helper */
    getBuffer: () => buffer,
  };
}

module.exports = {
  mountRankEditorView,
};
