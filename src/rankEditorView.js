/**
 * Feature 12 — Rank Editor
 * Spec: features/feature-12-Rank-Editor.md
 */

const rankEditor = require('./rankEditor');
const i18n = require('./i18n');
const flyoutFade = require('./flyoutFade');
const {
  renderRankColumn,
  bindGalleryInteractions,
} = require('./ranksGalleryView');

const PREVIEW_DEBOUNCE_MS = 250;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SEARCH_ICON = `<svg class="rank-editor-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
  <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

/**
 * @param {HTMLElement} root
 * @param {{
 *   onBack?: Function,
 *   confirm?: Function,
 *   rankEditor?: object,
 * }} [options]
 */
function mountRankEditorView(root, options = {}) {
  if (!root) throw new Error('mountRankEditorView requires root');

  const svc = options.rankEditor || rankEditor;
  const confirmFn =
    typeof options.confirm === 'function'
      ? options.confirm
      : (msg) => (typeof window !== 'undefined' && window.confirm ? window.confirm(msg) : true);

  const loaded = svc.loadDraft();
  let text = loaded.ok ? loaded.text : '';
  let savedBaseline = text;
  let status = loaded.ok ? null : { kind: 'alert', text: loaded.message || i18n.t('rankEditor.loadFailed') };
  let helpOpen = false;
  let searchOpen = false;
  let searchQuery = '';
  let previewTimer = null;
  let destroyed = false;
  let onKeyDown = null;

  function isDirty() {
    return text !== savedBaseline;
  }

  function parsePreview() {
    return svc.parseDraft(text);
  }

  function statusHtml() {
    if (!status || !status.text) return '';
    const tone = status.kind === 'alert' ? 'is-error' : 'is-success';
    const role = status.kind === 'alert' ? 'alert' : 'status';
    return `<p class="inline-alert config-inline-notice ${tone}" data-editor-status role="${role}">${escapeHtml(
      status.text
    )}</p>`;
  }

  function previewWarnHtml(parsed) {
    if (!parsed || !parsed.incomplete) return '';
    if (status && status.kind === 'alert') return '';
    const details = (parsed.errors || [])
      .map((e) => (e && e.message ? String(e.message) : ''))
      .filter(Boolean);
    const detailHtml = details.length
      ? `<ul class="rank-editor-warn-details" data-preview-warn-details>${details
          .map((m) => `<li>${escapeHtml(m)}</li>`)
          .join('')}</ul>`
      : '';
    return `<div class="rank-editor-warn" data-preview-warn role="status">
      <p class="hint rank-editor-warn-title">${escapeHtml(i18n.t('rankEditor.previewIncomplete'))}</p>
      ${detailHtml}
    </div>`;
  }

  function previewHtml(parsed) {
    const cols = (parsed && parsed.columns) || [];
    if (!cols.length) {
      return `<p class="empty-state" data-empty-preview">${escapeHtml(i18n.t('rankEditor.emptyPreview'))}</p>`;
    }
    return cols.map((col, i) => renderRankColumn(col, i)).join('');
  }

  let helpExampleText = '';

  function helpHtml() {
    if (!helpOpen) {
      helpExampleText = '';
      return '';
    }
    const help = svc.loadFormatHelp();
    if (!help.ok) {
      helpExampleText = '';
      return `
        <div class="dialog-backdrop" data-dialog="rank-help" role="dialog" aria-modal="true" aria-label="${escapeHtml(i18n.t('rankEditor.help.aria'))}">
          <div class="dialog rank-editor-help-dialog">
            <h2>${escapeHtml(i18n.t('rankEditor.help.heading'))}</h2>
            <p class="inline-alert is-error" role="alert">${escapeHtml(
              help.message || i18n.t('rankEditor.help.loadFailed')
            )}</p>
            <div class="dialog-actions">
              <button type="button" class="primary" data-action="close-help">${escapeHtml(i18n.t('common.close'))}</button>
            </div>
          </div>
        </div>`;
    }
    const rules = (help.data.rules || [])
      .map((r) => `<li>${escapeHtml(r)}</li>`)
      .join('');
    helpExampleText = String(help.data.exampleRankText || '');
    return `
      <div class="dialog-backdrop" data-dialog="rank-help" role="dialog" aria-modal="true" aria-label="${escapeHtml(i18n.t('rankEditor.help.aria'))}">
        <div class="dialog rank-editor-help-dialog">
          <h2>${escapeHtml(i18n.t('rankEditor.help.title'))}</h2>
          <ul class="rank-editor-help-rules" data-help-rules>${rules}</ul>
          <h3>${escapeHtml(i18n.t('rankEditor.help.example'))}</h3>
          <pre class="rank-editor-help-example" data-help-example></pre>
          <div class="dialog-actions">
            <button type="button" class="primary" data-action="close-help">${escapeHtml(i18n.t('common.close'))}</button>
          </div>
        </div>
      </div>`;
  }

  function searchBarHtml() {
    if (!searchOpen) return '';
    return `<div class="rank-editor-search" data-rank-search role="search">
      <label class="visually-hidden" for="rank-editor-search-input">${escapeHtml(i18n.t('rankEditor.searchLabel'))}</label>
      <input
        id="rank-editor-search-input"
        type="search"
        class="rank-editor-search-input"
        data-search-input
        value="${escapeHtml(searchQuery)}"
        placeholder="${escapeHtml(i18n.t('rankEditor.searchPlaceholder'))}"
        autocomplete="off"
      />
      <button type="button" class="secondary rank-editor-search-btn" data-action="search-prev">${escapeHtml(i18n.t('rankEditor.searchPrev'))}</button>
      <button type="button" class="secondary rank-editor-search-btn" data-action="search-next">${escapeHtml(i18n.t('rankEditor.searchNext'))}</button>
      <button type="button" class="ghost rank-editor-search-close" data-action="search-close" aria-label="${escapeHtml(i18n.t('rankEditor.searchClose'))}">×</button>
    </div>`;
  }

  function openSearch() {
    searchOpen = true;
    render({ focusSearch: true });
  }

  function closeSearch() {
    searchOpen = false;
    render({ focusEditor: true });
  }

  function scrollMatchIntoView(ta, index) {
    if (!ta || index == null || index < 0) return;
    const doc = ta.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const win = doc && doc.defaultView ? doc.defaultView : null;
    const styles = win && win.getComputedStyle ? win.getComputedStyle(ta) : null;
    const fontSize = styles ? parseFloat(styles.fontSize) || 14 : 14;
    let lineHeight = styles ? parseFloat(styles.lineHeight) : NaN;
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = fontSize * 1.4;
    const paddingTop = styles ? parseFloat(styles.paddingTop) || 0 : 0;
    const lineIndex = ta.value.slice(0, index).split('\n').length - 1;
    // Keep the match a couple of lines below the top so it isn't clipped
    const marginLines = 2.5;
    const target = paddingTop + lineIndex * lineHeight - marginLines * lineHeight;
    ta.scrollTop = Math.max(0, target);
  }

  function findMatch(direction) {
    const ta = root.querySelector('[data-ranks-editor]');
    const input = root.querySelector('[data-search-input]');
    if (!ta) return;
    const q = String((input && input.value) || searchQuery || '');
    searchQuery = q;
    if (!q) return;

    const hay = ta.value;
    const lower = hay.toLowerCase();
    const needle = q.toLowerCase();
    let idx = -1;

    if (direction === 'prev') {
      const start = Math.max((ta.selectionStart || 0) - 1, -1);
      idx = start >= 0 ? lower.lastIndexOf(needle, start) : -1;
      if (idx < 0) idx = lower.lastIndexOf(needle);
    } else {
      const start = ta.selectionEnd || 0;
      idx = lower.indexOf(needle, start);
      if (idx < 0) idx = lower.indexOf(needle, 0);
    }
    if (idx < 0) return;

    ta.focus();
    ta.setSelectionRange(idx, idx + q.length);
    // Override the browser's scroll-into-view after selection settles
    const applyScroll = () => scrollMatchIntoView(ta, idx);
    applyScroll();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        applyScroll();
        requestAnimationFrame(applyScroll);
      });
    } else if (typeof setTimeout === 'function') {
      setTimeout(applyScroll, 0);
    }
  }

  function render(opts = {}) {
    if (destroyed) return;
    const parsed = parsePreview();

    root.innerHTML = `
      <section class="panel rank-editor-view" data-view="rank-editor">
        <header class="panel-header rank-editor-header">
          <h1>${escapeHtml(i18n.t('rankEditor.title'))}</h1>
          <div class="rank-editor-header-actions">
            <button type="button" class="ghost rank-editor-icon-btn" data-action="search" aria-label="${escapeHtml(i18n.t('rankEditor.findAria'))}">${SEARCH_ICON}</button>
            <button type="button" class="ghost" data-action="help" aria-label="${escapeHtml(i18n.t('rankEditor.help.aria'))}">?</button>
            <button type="button" class="ghost" data-action="back">${escapeHtml(i18n.t('common.back'))}</button>
          </div>
        </header>
        ${searchBarHtml()}
        ${statusHtml()}
        ${previewWarnHtml(parsed)}
        <div class="rank-editor-body">
          <div class="rank-editor-pane rank-editor-pane-text">
            <label class="visually-hidden" for="ranks-editor-textarea">${escapeHtml(i18n.t('rankEditor.textareaLabel'))}</label>
            <textarea
              id="ranks-editor-textarea"
              class="rank-editor-text"
              data-ranks-editor
              aria-label="${escapeHtml(i18n.t('rankEditor.textareaLabel'))}"
              spellcheck="false"
            >${escapeHtml(text)}</textarea>
          </div>
          <div
            class="rank-editor-pane rank-editor-pane-preview"
            data-ranks-preview
            aria-label="${escapeHtml(i18n.t('rankEditor.previewAria'))}"
          >
            <div class="rank-editor-preview-scroller" data-preview-scroller>
              ${previewHtml(parsed)}
            </div>
          </div>
        </div>
        <footer class="rank-editor-footer">
          <span class="rank-editor-action-wrap">
            <button type="button" class="primary" data-action="save" aria-describedby="rank-editor-save-tip">${escapeHtml(i18n.t('common.save'))}</button>
            <span class="rank-editor-action-tip" role="tooltip" id="rank-editor-save-tip" data-action-tip hidden>${escapeHtml(i18n.t('rankEditor.saveTip'))}</span>
          </span>
          <span class="rank-editor-action-wrap">
            <button type="button" class="secondary" data-action="fix-syntax" aria-describedby="rank-editor-fix-syntax-tip">${escapeHtml(i18n.t('rankEditor.fixSyntax'))}</button>
            <span class="rank-editor-action-tip" role="tooltip" id="rank-editor-fix-syntax-tip" data-action-tip hidden>${escapeHtml(i18n.t('rankEditor.fixSyntaxTip'))}</span>
          </span>
          <button type="button" class="secondary" data-action="restore-defaults">${escapeHtml(i18n.t('rankEditor.restoreDefaults'))}</button>
        </footer>
        ${helpHtml()}
      </section>`;

    bind();
    const exampleEl = root.querySelector('[data-help-example]');
    if (exampleEl && helpExampleText) {
      exampleEl.textContent = helpExampleText;
    }
    if (opts.focusSearch) {
      const input = root.querySelector('[data-search-input]');
      if (input) {
        input.focus();
        input.select();
      }
    } else if (opts.focusEditor) {
      const ta = root.querySelector('[data-ranks-editor]');
      if (ta) ta.focus();
    }
  }

  function updatePreviewWarn(parsed) {
    const existing = root.querySelector('[data-preview-warn]');
    const html = previewWarnHtml(parsed);
    if (!html) {
      if (existing) existing.remove();
      return;
    }
    if (existing) {
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      existing.replaceWith(wrap.firstElementChild);
      return;
    }
    const statusNode = root.querySelector('[data-editor-status]');
    const header = root.querySelector('.rank-editor-header');
    const search = root.querySelector('[data-rank-search]');
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const node = wrap.firstElementChild;
    const anchor = statusNode || search || header;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(node, anchor.nextSibling);
    }
  }

  function refreshPreviewOnly() {
    const previewRoot = root.querySelector('[data-preview-scroller]');
    if (!previewRoot) {
      render();
      return;
    }
    const parsed = parsePreview();
    previewRoot.innerHTML = previewHtml(parsed);
    bindGalleryInteractions(previewRoot);
    updatePreviewWarn(parsed);
  }

  function schedulePreview() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewTimer = null;
      if (!destroyed) refreshPreviewOnly();
    }, PREVIEW_DEBOUNCE_MS);
  }

  function setTextFromEditor() {
    const ta = root.querySelector('[data-ranks-editor]');
    if (ta) text = ta.value;
  }

  function goBack() {
    if (isDirty()) {
      if (!confirmFn(i18n.t('rankEditor.discardUnsaved'))) return;
    }
    if (typeof options.onBack === 'function') options.onBack();
    else if (typeof window !== 'undefined') window.location.hash = '#/config';
  }

  function handleDrop(ev) {
    const files = ev.dataTransfer && ev.dataTransfer.files;
    if (!files || !files.length) return;
    const file = files[0];
    let result;
    if (file.path) {
      result = svc.importDroppedBadge(file.path);
    } else {
      status = { kind: 'alert', text: i18n.t('rankEditor.dropPathFailed') };
      render();
      return;
    }
    if (!result.ok) {
      status = { kind: 'alert', text: result.message || i18n.t('rankEditor.unsupportedImage') };
      render();
      return;
    }
    status = {
      kind: 'status',
      text: i18n.t('rankEditor.copiedTo', { path: result.data.relativePath }),
    };
    render();
  }

  function bind() {
    const back = root.querySelector('[data-action="back"]');
    if (back) back.addEventListener('click', goBack);

    const searchBtn = root.querySelector('[data-action="search"]');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        setTextFromEditor();
        openSearch();
      });
    }

    const searchClose = root.querySelector('[data-action="search-close"]');
    if (searchClose) {
      searchClose.addEventListener('click', () => {
        closeSearch();
      });
    }

    const searchPrev = root.querySelector('[data-action="search-prev"]');
    if (searchPrev) {
      searchPrev.addEventListener('click', () => findMatch('prev'));
    }

    const searchNext = root.querySelector('[data-action="search-next"]');
    if (searchNext) {
      searchNext.addEventListener('click', () => findMatch('next'));
    }

    const searchInput = root.querySelector('[data-search-input]');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
      });
      searchInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          findMatch(ev.shiftKey ? 'prev' : 'next');
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          closeSearch();
        }
      });
    }

    const helpBtn = root.querySelector('[data-action="help"]');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        setTextFromEditor();
        helpOpen = true;
        render();
        const close = root.querySelector('[data-action="close-help"]');
        if (close) close.focus();
      });
    }

    const closeHelp = root.querySelector('[data-action="close-help"]');
    if (closeHelp) {
      closeHelp.addEventListener('click', () => {
        helpOpen = false;
        render();
        const ta = root.querySelector('[data-ranks-editor]');
        if (ta) ta.focus();
      });
    }

    const backdrop = root.querySelector('[data-dialog="rank-help"]');
    if (backdrop) {
      backdrop.addEventListener('click', (ev) => {
        if (ev.target === backdrop) {
          helpOpen = false;
          render();
          const ta = root.querySelector('[data-ranks-editor]');
          if (ta) ta.focus();
        }
      });
    }

    const ta = root.querySelector('[data-ranks-editor]');
    if (ta) {
      ta.addEventListener('input', () => {
        text = ta.value;
        status = null;
        schedulePreview();
      });
    }

    function bindActionTip(btn) {
      if (!btn) return;
      const wrap = btn.closest('.rank-editor-action-wrap');
      const tip = wrap && wrap.querySelector('[data-action-tip]');
      if (!tip) return;
      // Hover the wrap (button + tip + gap bridge), not the button alone — the tip
      // sits above with a gap, so top-edge approach used to fire pointerleave early.
      const showTip = () => flyoutFade.show(tip);
      const hideTip = (ev) => {
        const related = ev && ev.relatedTarget;
        if (related && wrap.contains(related)) return;
        flyoutFade.hide(tip);
      };
      wrap.addEventListener('pointerenter', showTip);
      wrap.addEventListener('pointerleave', hideTip);
      btn.addEventListener('focus', showTip);
      btn.addEventListener('blur', hideTip);
    }

    const saveBtn = root.querySelector('[data-action="save"]');
    if (saveBtn) {
      bindActionTip(saveBtn);
      saveBtn.addEventListener('click', () => {
        setTextFromEditor();
        const result = svc.saveDraft(text, { confirm: confirmFn });
        if (result.cancelled) return;
        if (!result.ok) {
          status = { kind: 'alert', text: result.message || i18n.t('rankEditor.saveFailed') };
          render();
          return;
        }
        savedBaseline = text;
        status = { kind: 'status', text: i18n.t('rankEditor.saved') };
        if (typeof options.onSaved === 'function') options.onSaved();
        render();
      });
    }

    const fixBtn = root.querySelector('[data-action="fix-syntax"]');
    if (fixBtn) {
      bindActionTip(fixBtn);
      fixBtn.addEventListener('click', () => {
        setTextFromEditor();
        const fixed = svc.fixSyntax(text);
        text = fixed.text;
        const extra =
          fixed.unresolved && fixed.unresolved.length
            ? i18n.tn('rankEditor.unresolvedNotes', fixed.unresolved.length)
            : '';
        status = { kind: 'status', text: i18n.t('rankEditor.syntaxFixed', { extra }) };
        render();
      });
    }

    const restoreBtn = root.querySelector('[data-action="restore-defaults"]');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        if (
          !confirmFn(
            i18n.t('rankEditor.restoreConfirm')
          )
        ) {
          return;
        }
        text = svc.defaultRanksText();
        status = { kind: 'status', text: i18n.t('rankEditor.defaultsLoaded') };
        render();
      });
    }

    const view = root.querySelector('[data-view="rank-editor"]');
    if (view) {
      view.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      });
      view.addEventListener('drop', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        handleDrop(ev);
      });
    }

    const previewRoot = root.querySelector('[data-preview-scroller]');
    if (previewRoot) bindGalleryInteractions(previewRoot);
  }

  onKeyDown = (ev) => {
    if (destroyed) return;
    const isFind = (ev.ctrlKey || ev.metaKey) && String(ev.key || '').toLowerCase() === 'f';
    if (!isFind) return;
    const ta = root.querySelector('[data-ranks-editor]');
    const searchInput = root.querySelector('[data-search-input]');
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const inEditor = ta && (active === ta || (ta.contains && ta.contains(active)));
    const inSearch = searchInput && active === searchInput;
    if (!inEditor && !inSearch && active && root.contains && !root.contains(active)) return;
    // When focus is in the editor (or already in our search), use in-app find
    if (inEditor || inSearch || (active && root.contains(active))) {
      ev.preventDefault();
      ev.stopPropagation();
      setTextFromEditor();
      openSearch();
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeyDown, true);
  }

  render();

  return {
    refresh: render,
    destroy() {
      destroyed = true;
      if (previewTimer) clearTimeout(previewTimer);
      if (onKeyDown && typeof document !== 'undefined') {
        document.removeEventListener('keydown', onKeyDown, true);
      }
      root.innerHTML = '';
    },
    getRoot: () => root,
  };
}

module.exports = {
  mountRankEditorView,
};
