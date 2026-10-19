/**
 * Feature 6 — Custom Ranks (authoring entry)
 * Feature 11 — Config (Advanced → Edit ranks.txt)
 * Spec: features/feature-6-Custom-Ranks.md
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Minimal Config shell for Feature 6 US-6.4 — Advanced opens Rank Editor.
 * Full appearance/backup controls belong to Feature 11.
 */
function mountConfigView(root, options = {}) {
  const onEditRanks = options.onEditRanks || (() => {});
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
    root.innerHTML = `
      <section class="panel config-view" data-view="config">
        <header class="config-header">
          <button type="button" class="ghost" data-action="back">Back</button>
          <h1>Config</h1>
        </header>
        <section class="config-section" data-section="advanced" aria-label="Advanced">
          <h2>Advanced</h2>
          <button type="button" class="primary" data-action="edit-ranks">Edit ranks.txt</button>
          <p class="hint">Opens the Rank Editor with live gallery preview.</p>
        </section>
      </section>
    `;

    const back = root.querySelector('[data-action="back"]');
    if (back) back.addEventListener('click', () => onBack());

    const edit = root.querySelector('[data-action="edit-ranks"]');
    if (edit) {
      edit.addEventListener('click', () => {
        onEditRanks();
      });
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
  mountConfigView,
  escapeHtml,
};
