/**
 * Feature 13 — Rank Editor (minimal shell for Feature 11 deep-link)
 * Spec: features/feature-13-Rank-Editor.md
 *
 * Full editor UI is Feature 13. Feature 11 only requires navigating here with
 * ranks.txt loaded.
 */

const fs = require('fs');
const paths = require('./paths');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {HTMLElement} root
 * @param {{ onBack?: Function }} [options]
 */
function mountRankEditorView(root, options = {}) {
  if (!root) throw new Error('mountRankEditorView requires root');

  let text = '';
  try {
    const file = paths.ranksTxtPath();
    if (fs.existsSync(file)) text = fs.readFileSync(file, 'utf8');
  } catch (_) {
    text = '';
  }

  root.innerHTML = `
    <section class="panel rank-editor-view" data-view="rank-editor">
      <header class="panel-header">
        <h1>Rank Editor</h1>
        <button type="button" class="ghost" data-action="back">Back</button>
      </header>
      <p class="hint">Editing <code>ranks.txt</code>. Full editor tools ship with Feature 13.</p>
      <textarea class="rank-editor-text" data-ranks-editor aria-label="ranks.txt editor">${escapeHtml(
        text
      )}</textarea>
    </section>`;

  const back = root.querySelector('[data-action="back"]');
  if (back) {
    back.addEventListener('click', () => {
      if (typeof options.onBack === 'function') options.onBack();
      else if (typeof window !== 'undefined') window.location.hash = '#/config';
    });
  }

  return {
    refresh() {},
    destroy() {
      root.innerHTML = '';
    },
    getRoot: () => root,
  };
}

module.exports = {
  mountRankEditorView,
};
