/**
 * Ctrl+= / Ctrl+- adjusts config `font size` by 1 (8–24).
 * Only while the Strank window is the active (focused) window.
 */

/**
 * @param {KeyboardEvent} ev
 * @returns {1 | -1 | 0}
 */
function fontScaleDelta(ev) {
  if (!ev || !(ev.ctrlKey || ev.metaKey) || ev.altKey) return 0;
  const key = String(ev.key || '');
  const code = String(ev.code || '');
  // Grow: + / = / NumpadAdd (same chords browsers use for zoom-in)
  if (key === '+' || key === '=' || code === 'NumpadAdd' || code === 'Equal') return 1;
  // Shrink: - / _ / NumpadSubtract
  if (key === '-' || key === '_' || code === 'NumpadSubtract' || code === 'Minus') return -1;
  return 0;
}

/**
 * @param {Document} doc
 * @param {{
 *   onNudge?: (delta: number) => void,
 *   isWindowActive?: () => boolean,
 * }} [options]
 * @returns {{ destroy: () => void }}
 */
function installFontScaleHotkeys(doc, options = {}) {
  if (!doc) return { destroy() {} };
  const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);

  let windowActive =
    typeof options.isWindowActive === 'function'
      ? Boolean(options.isWindowActive())
      : typeof doc.hasFocus === 'function'
        ? doc.hasFocus()
        : true;

  const refreshActive = () => {
    if (typeof options.isWindowActive === 'function') {
      windowActive = Boolean(options.isWindowActive());
      return;
    }
    if (doc.visibilityState === 'hidden') {
      windowActive = false;
      return;
    }
    windowActive = typeof doc.hasFocus === 'function' ? doc.hasFocus() : true;
  };

  const onFocus = () => {
    windowActive = true;
  };
  const onBlur = () => {
    windowActive = false;
  };
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') windowActive = false;
    else refreshActive();
  };

  const onKeyDown = (ev) => {
    refreshActive();
    if (!windowActive) return;
    const delta = fontScaleDelta(ev);
    if (!delta) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof options.onNudge === 'function') options.onNudge(delta);
  };

  if (win) {
    win.addEventListener('focus', onFocus);
    win.addEventListener('blur', onBlur);
  }
  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('keydown', onKeyDown, true);

  return {
    destroy() {
      if (win) {
        win.removeEventListener('focus', onFocus);
        win.removeEventListener('blur', onBlur);
      }
      doc.removeEventListener('visibilitychange', onVisibility);
      doc.removeEventListener('keydown', onKeyDown, true);
    },
  };
}

module.exports = {
  installFontScaleHotkeys,
  fontScaleDelta,
};
