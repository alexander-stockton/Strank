/**
 * Feature 11 — Config, Accessibility & Backup
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */

const config = require('./config');
const backup = require('./backup');
const fileDialog = require('./fileDialog');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function boolAttr(v) {
  return v ? 'checked' : '';
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   onBack?: Function,
 *   onNavigate?: Function,
 *   onSettingsChanged?: Function,
 *   pickSavePath?: Function,
 *   pickOpenPath?: Function,
 *   confirm?: Function,
 * }} [options]
 */
function mountConfigView(root, options = {}) {
  if (!root) throw new Error('mountConfigView requires root');

  config.load();

  let backupNotice = null; // { kind: 'status'|'alert', text }
  let advancedNotice = null;
  let colorDialogOpen = false;
  /** Snapshot of theme colors when the advanced modal opened (for Cancel). */
  let colorDialogSnapshot = null;
  let advancedOpen = false;

  const COLOR_FIELD_LABELS = {
    'accent color': 'Accent',
    'background color': 'Background',
    'panel color': 'Panel',
    'text color': 'Text',
    'muted color': 'Muted text',
    'danger color': 'Danger',
    'ok color': 'Success',
    'glow color': 'Background glow',
  };

  function settings() {
    return config.get();
  }

  function notifyChanged() {
    if (typeof options.onSettingsChanged === 'function') {
      options.onSettingsChanged(config.get());
    }
  }

  function applyAppearance() {
    const doc = dialogDoc();
    if (doc) config.applyToDocument(doc);
    notifyChanged();
  }

  function scrollParent() {
    return root.querySelector('.config-view') || root;
  }

  function captureScroll() {
    const el = scrollParent();
    return el ? el.scrollTop : 0;
  }

  function restoreScroll(top) {
    const el = scrollParent();
    if (!el) return;
    el.scrollTop = top;
    // After layout (font-size / accordion), restore again
    requestAnimationFrame(() => {
      el.scrollTop = top;
    });
  }

  function colorInputValue(hex) {
    // <input type="color"> only accepts #rrggbb lowercase
    const v = String(hex || '').trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toLowerCase();
    return '#000000';
  }

  function colorFieldName(optionKey) {
    return String(optionKey || '')
      .replace(/\s+color$/, '')
      .replace(/\s+/g, '-');
  }

  function colorFieldHtml(optionKey, value) {
    const label = COLOR_FIELD_LABELS[optionKey] || optionKey;
    const name = colorFieldName(optionKey);
    return `
      <label class="field color-field">
        <span>${escapeHtml(label)}</span>
        <input
          type="color"
          name="${escapeHtml(name)}"
          data-color-key="${escapeHtml(optionKey)}"
          value="${escapeHtml(colorInputValue(value))}"
        />
      </label>`;
  }

  function renderSimpleColors(s) {
    const fields = config.SIMPLE_COLOR_KEYS.map((key) => colorFieldHtml(key, s[key])).join('');
    return `
      <div class="config-colors-simple" data-simple-colors>
        <div class="config-colors-grid">${fields}</div>
        <div class="field-row">
          <button type="button" class="secondary" data-action="more-colors">More</button>
        </div>
      </div>`;
  }

  function renderColorDialog(s) {
    if (!colorDialogOpen) return '';
    const fields = config.ADVANCED_COLOR_KEYS.map((key) => colorFieldHtml(key, s[key])).join('');
    return `
      <div class="dialog-backdrop" data-dialog="colors" role="dialog" aria-label="Choose colors">
        <form class="dialog color-picker-dialog" id="color-picker-form">
          <h2>Choose colors</h2>
          <p class="dialog-hint">Advanced theme colors (rank badges stay fixed).</p>
          <div class="config-colors-grid config-colors-grid-advanced">${fields}</div>
          <div class="dialog-actions">
            <button type="button" class="ghost" data-action="cancel-colors">Cancel</button>
            <button type="submit" class="primary" data-action="confirm-colors">Confirm</button>
          </div>
        </form>
      </div>`;
  }

  function readColorsFromForm(form) {
    if (!form) return null;
    const patch = {};
    form.querySelectorAll('[data-color-key]').forEach((el) => {
      const key = el.getAttribute('data-color-key');
      if (!key) return;
      patch[key] = String(el.value || '').trim();
    });
    return patch;
  }

  function persistColors(patch) {
    if (!patch || !Object.keys(patch).length) return;
    config.update(patch);
    applyAppearance();
  }

  function confirmAdvancedColors(form) {
    const patch = readColorsFromForm(form);
    persistColors(patch);
    colorDialogOpen = false;
    colorDialogSnapshot = null;
    render();
  }

  function cancelAdvancedColors() {
    if (colorDialogSnapshot) {
      config.update(colorDialogSnapshot);
      applyAppearance();
    }
    colorDialogOpen = false;
    colorDialogSnapshot = null;
    render();
  }

  function noticeHtml(notice, attr) {
    if (!notice || !notice.text) return '';
    const isError = notice.kind === 'alert';
    const role = isError ? 'alert' : 'status';
    const tone = isError ? 'is-error' : 'is-success';
    return `<p class="inline-alert config-inline-notice ${tone}" data-notice="${escapeHtml(
      attr
    )}" role="${role}">${escapeHtml(notice.text)}</p>`;
  }

  function render() {
    const savedScroll = captureScroll();
    const s = settings();
    const fontPx = config.fontSizeToPx(s['font size']);
    const fontPreset = config.fontSizePresetLabel(fontPx);
    root.innerHTML = `
      <section class="panel config-view" data-view="config">
        <header class="panel-header">
          <h1>Config</h1>
          <button type="button" class="ghost" data-action="back">Back</button>
        </header>

        <section class="config-section" data-section="appearance">
          <h2>Appearance</h2>
          <div class="field font-size-field">
            <span>Font size</span>
            <div class="font-size-controls">
              <label class="font-size-input-wrap">
                <span class="visually-hidden">Font size in pixels</span>
                <input
                  type="number"
                  min="8"
                  max="24"
                  step="1"
                  inputmode="numeric"
                  name="font-size-px"
                  class="metric-input-reps font-size-input"
                  data-font-size-input
                  aria-label="Font size in pixels"
                  value="${escapeHtml(fontPx)}"
                />
              </label>
              <select
                name="font-size-preset"
                class="font-size-preset"
                data-font-size-preset
                aria-label="Font size preset"
              >
                <option value="" ${fontPreset === '' ? 'selected' : ''}>Custom</option>
                <option value="small" ${fontPreset === 'small' ? 'selected' : ''}>Small</option>
                <option value="medium" ${fontPreset === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="large" ${fontPreset === 'large' ? 'selected' : ''}>Large</option>
              </select>
            </div>
          </div>
          <div class="field config-colors-block">
            <span>Colors</span>
            ${renderSimpleColors(s)}
          </div>
          <fieldset class="field">
            <legend>Navbar alignment</legend>
            <label class="radio-inline">
              <input type="radio" name="navbar-alignment" value="left" data-config-key="navbar alignment"
                ${s['navbar alignment'] === 'left' ? 'checked' : ''} />
              Left
            </label>
            <label class="radio-inline">
              <input type="radio" name="navbar-alignment" value="top" data-config-key="navbar alignment"
                ${s['navbar alignment'] === 'top' ? 'checked' : ''} />
              Top
            </label>
          </fieldset>
          <fieldset class="field">
            <legend>Clock</legend>
            <label class="radio-inline">
              <input type="radio" name="clock-24hr" value="f" data-config-key="24hr"
                ${s['24hr'] ? '' : 'checked'} />
              12-hour
            </label>
            <label class="radio-inline">
              <input type="radio" name="clock-24hr" value="t" data-config-key="24hr"
                ${s['24hr'] ? 'checked' : ''} />
              24-hour
            </label>
          </fieldset>
          <label class="field">
            <span>Weight units</span>
            <select name="weight-units" data-config-key="weight units" aria-label="Weight units">
              <option value="lbs" ${s['weight units'] === 'lbs' ? 'selected' : ''}>lbs</option>
              <option value="kg" ${s['weight units'] === 'kg' ? 'selected' : ''}>kgs</option>
            </select>
          </label>
          <label class="field">
            <span>Distance units</span>
            <select name="distance-units" data-config-key="distance units" aria-label="Distance units">
              <option value="mi" ${s['distance units'] === 'mi' ? 'selected' : ''}>mi</option>
              <option value="km" ${s['distance units'] === 'km' ? 'selected' : ''}>km</option>
            </select>
          </label>
        </section>

        <section class="config-section" data-section="accessibility">
          <h2>Accessibility</h2>
          <label class="field">
            <span>Colorblind filter</span>
            <select name="colorblind" data-config-key="colorblind filter" aria-label="Colorblind filter">
              <option value="none" ${s['colorblind filter'] === 'none' ? 'selected' : ''}>None</option>
              <option value="protanopia" ${s['colorblind filter'] === 'protanopia' ? 'selected' : ''}>Protanopia</option>
              <option value="deuteranopia" ${s['colorblind filter'] === 'deuteranopia' ? 'selected' : ''}>Deuteranopia</option>
              <option value="tritanopia" ${s['colorblind filter'] === 'tritanopia' ? 'selected' : ''}>Tritanopia</option>
            </select>
          </label>
          <label class="field checkbox-field">
            <span>Screen reader mode</span>
            <input type="checkbox" name="screen-reader" data-config-key="screen reader mode"
              ${boolAttr(s['screen reader mode'])} />
          </label>
        </section>

        <section class="config-section" data-section="backup">
          <h2>Backup</h2>
          <div class="backup-toolbar">
            <div class="field-row">
              <button type="button" class="secondary" data-action="export-backup">Export data backup</button>
              <button type="button" class="secondary" data-action="import-backup">Import data backup</button>
            </div>
            <div class="field-row">
              <button type="button" class="secondary" data-action="export-config">Export Config</button>
              <button type="button" class="secondary" data-action="import-config">Import Config</button>
            </div>
            <div class="field-row">
              <button type="button" class="secondary" data-action="export-ranks">Export ranks</button>
              <button type="button" class="secondary" data-action="import-ranks">Import ranks</button>
            </div>
            ${noticeHtml(backupNotice, 'backup')}
          </div>
        </section>

        <section
          class="config-section config-advanced"
          data-section="advanced"
          data-open="${advancedOpen ? 'true' : 'false'}"
        >
          <button
            type="button"
            class="config-accordion-toggle"
            data-action="toggle-advanced"
            aria-expanded="${advancedOpen ? 'true' : 'false'}"
            aria-controls="config-advanced-panel"
          >
            <h2>Advanced</h2>
            <span class="config-accordion-chevron" aria-hidden="true"></span>
          </button>
          <div class="config-accordion-panel" id="config-advanced-panel">
            <div class="config-accordion-panel-inner">
              ${noticeHtml(advancedNotice, 'advanced')}
              <label class="field checkbox-field">
                <span>Desktop notifications</span>
                <input type="checkbox" name="notifications" data-config-key="notifications enabled"
                  ${boolAttr(s['notifications enabled'])} />
              </label>
              <label class="field checkbox-field">
                <span>Completion sounds</span>
                <input type="checkbox" name="sounds" data-config-key="completion sounds enabled"
                  ${boolAttr(s['completion sounds enabled'])} />
              </label>
              <label class="field checkbox-field">
                <span>Logging</span>
                <input type="checkbox" name="logging" data-config-key="logging"
                  ${boolAttr(s.logging)} />
              </label>
              <fieldset class="config-animations" data-section="animations">
                <legend>Animations</legend>
                <label class="field checkbox-field">
                  <span>Workout start transition</span>
                  <input type="checkbox" data-config-key="animation workout start"
                    ${boolAttr(s['animation workout start'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>Click ripple</span>
                  <input type="checkbox" data-config-key="animation click ripple"
                    ${boolAttr(s['animation click ripple'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>View slide transitions</span>
                  <input type="checkbox" data-config-key="animation view slides"
                    ${boolAttr(s['animation view slides'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>Content reveal</span>
                  <input type="checkbox" data-config-key="animation content reveal"
                    ${boolAttr(s['animation content reveal'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>Flyout / tooltip fades</span>
                  <input type="checkbox" data-config-key="animation flyout fade"
                    ${boolAttr(s['animation flyout fade'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>Elevated button motion</span>
                  <input type="checkbox" data-config-key="animation elevated buttons"
                    ${boolAttr(s['animation elevated buttons'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>Outline button motion</span>
                  <input type="checkbox" data-config-key="animation outline buttons"
                    ${boolAttr(s['animation outline buttons'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>Accordion expand / retract</span>
                  <input type="checkbox" data-config-key="animation accordions"
                    ${boolAttr(s['animation accordions'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>Smooth card scrolling</span>
                  <input type="checkbox" data-config-key="animation smooth card scroll"
                    ${boolAttr(s['animation smooth card scroll'] !== false)} />
                </label>
              </fieldset>
              <div class="field-row">
                <button type="button" class="secondary" data-action="edit-ranks">Edit ranks.txt</button>
              </div>
            </div>
          </div>
        </section>
        ${renderColorDialog(s)}
      </section>`;

    bind();
    restoreScroll(savedScroll);
  }

  function dialogDoc() {
    return (root && root.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  }

  function pickSavePath(dialogOpts = {}) {
    if (typeof options.pickSavePath === 'function') {
      return Promise.resolve(options.pickSavePath(dialogOpts));
    }
    return fileDialog.pickSavePath({
      ...dialogOpts,
      document: dialogDoc(),
    });
  }

  function pickOpenPath(dialogOpts = {}) {
    if (typeof options.pickOpenPath === 'function') {
      return Promise.resolve(options.pickOpenPath(dialogOpts));
    }
    return fileDialog.pickOpenPath({
      ...dialogOpts,
      document: dialogDoc(),
    });
  }

  function confirm(msg) {
    if (typeof options.confirm === 'function') return options.confirm(msg);
    if (typeof window !== 'undefined' && window.confirm) return window.confirm(msg);
    return true;
  }

  function setAdvancedOpen(open) {
    advancedOpen = Boolean(open);
    const section = root.querySelector('[data-section="advanced"]');
    const toggle = root.querySelector('[data-action="toggle-advanced"]');
    if (section) section.setAttribute('data-open', advancedOpen ? 'true' : 'false');
    if (toggle) toggle.setAttribute('aria-expanded', advancedOpen ? 'true' : 'false');
  }

  function bind() {
    const back = root.querySelector('[data-action="back"]');
    if (back) {
      back.addEventListener('click', () => {
        if (typeof options.onBack === 'function') options.onBack();
        else if (typeof options.onNavigate === 'function') options.onNavigate('/');
      });
    }

    const advancedToggle = root.querySelector('[data-action="toggle-advanced"]');
    if (advancedToggle) {
      advancedToggle.addEventListener('click', () => {
        setAdvancedOpen(!advancedOpen);
      });
    }

    const applyFontSize = (raw) => {
      backupNotice = null;
      advancedNotice = null;
      config.set('font size', raw);
      notifyChanged();
      render();
    };

    const fontInput = root.querySelector('[data-font-size-input]');
    if (fontInput) {
      const commitFontInput = () => {
        applyFontSize(fontInput.value);
      };
      fontInput.addEventListener('change', commitFontInput);
      fontInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          commitFontInput();
        }
      });
    }

    const fontPreset = root.querySelector('[data-font-size-preset]');
    if (fontPreset) {
      fontPreset.addEventListener('change', () => {
        const preset = fontPreset.value;
        if (!preset) return;
        applyFontSize(preset);
      });
    }

    root.querySelectorAll('[data-config-key]').forEach((el) => {
      const key = el.getAttribute('data-config-key');
      const handler = () => {
        let value;
        if (el.type === 'checkbox') value = el.checked;
        else value = el.value;
        if (key === 'notifications enabled' && value === true) {
          if (options.notificationsBlocked) {
            el.checked = false;
            config.set(key, false);
            advancedNotice = {
              kind: 'alert',
              text: 'Notifications are blocked by the system.',
            };
            setAdvancedOpen(true);
            render();
            return;
          }
        }
        config.set(key, value);
        notifyChanged();
        if (
          key === 'navbar alignment' ||
          key === '24hr' ||
          key === 'colorblind filter' ||
          key === 'screen reader mode'
        ) {
          render();
        }
      };
      el.addEventListener('change', handler);
    });

    root.querySelectorAll('[data-simple-colors] [data-color-key]').forEach((el) => {
      const applySimple = () => {
        const key = el.getAttribute('data-color-key');
        if (!key) return;
        persistColors({ [key]: String(el.value || '').trim() });
      };
      el.addEventListener('input', applySimple);
      el.addEventListener('change', applySimple);
    });

    const moreColors = root.querySelector('[data-action="more-colors"]');
    if (moreColors) {
      moreColors.addEventListener('click', () => {
        colorDialogSnapshot = config.themeColorSnapshot();
        colorDialogOpen = true;
        render();
      });
    }

    const cancelColors = root.querySelector('[data-action="cancel-colors"]');
    if (cancelColors) {
      cancelColors.addEventListener('click', () => {
        cancelAdvancedColors();
      });
    }

    const colorForm = root.querySelector('#color-picker-form');
    if (colorForm) {
      colorForm.querySelectorAll('[data-color-key]').forEach((el) => {
        const preview = () => {
          const patch = readColorsFromForm(colorForm);
          if (!patch) return;
          const doc = dialogDoc();
          if (!doc) return;
          const merged = { ...config.get(), ...patch };
          if (doc.documentElement) config.applyThemeVars(doc.documentElement, merged);
          if (doc.body) config.applyThemeVars(doc.body, merged);
        };
        el.addEventListener('input', preview);
        el.addEventListener('change', preview);
      });
      colorForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        confirmAdvancedColors(colorForm);
      });
      const confirmColors = colorForm.querySelector('[data-action="confirm-colors"]');
      if (confirmColors) {
        confirmColors.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          confirmAdvancedColors(colorForm);
        });
      }
    }

    const exportBtn = root.querySelector('[data-action="export-backup"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const target = await pickSavePath({
          defaultName: 'strank-history.dat',
          accept: '.dat',
        });
        if (!target) return;
        const result = backup.exportHistoryDat(target);
        backupNotice = result.ok
          ? { kind: 'status', text: 'Data backup exported.' }
          : { kind: 'alert', text: result.message || 'Backup file is invalid.' };
        render();
      });
    }

    const importBtn = root.querySelector('[data-action="import-backup"]');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const source = await pickOpenPath({ accept: '.dat' });
        if (!source) return;
        const result = backup.importHistoryDat(source, { confirm });
        if (result.cancelled) return;
        backupNotice = result.ok
          ? { kind: 'status', text: 'Data backup imported.' }
          : { kind: 'alert', text: result.message || 'Backup file is invalid.' };
        if (result.ok) notifyChanged();
        render();
      });
    }

    const exportConfigBtn = root.querySelector('[data-action="export-config"]');
    if (exportConfigBtn) {
      exportConfigBtn.addEventListener('click', async () => {
        const target = await pickSavePath({
          defaultName: 'config.txt',
          accept: '.txt',
        });
        if (!target) return;
        const result = backup.exportConfig(target);
        backupNotice = result.ok
          ? { kind: 'status', text: 'Config exported.' }
          : { kind: 'alert', text: result.message || 'Config file is invalid.' };
        render();
      });
    }

    const importConfigBtn = root.querySelector('[data-action="import-config"]');
    if (importConfigBtn) {
      importConfigBtn.addEventListener('click', async () => {
        const source = await pickOpenPath({ accept: '.txt' });
        if (!source) return;
        const result = backup.importConfig(source, { confirm });
        if (result.cancelled) return;
        if (!result.ok) {
          backupNotice = { kind: 'alert', text: result.message || 'Config file is invalid.' };
        } else {
          backupNotice = {
            kind: 'status',
            text: result.resetToDefaults
              ? 'Config imported (reset to defaults).'
              : 'Config imported.',
          };
          notifyChanged();
        }
        render();
      });
    }

    const exportRanksBtn = root.querySelector('[data-action="export-ranks"]');
    if (exportRanksBtn) {
      exportRanksBtn.addEventListener('click', async () => {
        const target = await pickSavePath({
          defaultName: 'ranks.txt',
          accept: '.txt',
        });
        if (!target) return;
        const result = backup.exportRanks(target);
        backupNotice = result.ok
          ? { kind: 'status', text: 'Ranks exported.' }
          : { kind: 'alert', text: result.message || 'Ranks file is invalid.' };
        render();
      });
    }

    const importRanksBtn = root.querySelector('[data-action="import-ranks"]');
    if (importRanksBtn) {
      importRanksBtn.addEventListener('click', async () => {
        const source = await pickOpenPath({ accept: '.txt' });
        if (!source) return;
        const result = backup.importRanks(source, { confirm });
        if (result.cancelled) return;
        backupNotice = result.ok
          ? { kind: 'status', text: 'Ranks imported.' }
          : { kind: 'alert', text: result.message || 'Ranks file is invalid.' };
        if (result.ok) notifyChanged();
        render();
      });
    }

    const editRanks = root.querySelector('[data-action="edit-ranks"]');
    if (editRanks) {
      editRanks.addEventListener('click', () => {
        if (typeof options.onNavigate === 'function') options.onNavigate('/rank-manager');
        else if (typeof window !== 'undefined') window.location.hash = '#/rank-manager';
      });
    }
  }

  render();
  notifyChanged();

  return {
    refresh: render,
    destroy() {
      root.innerHTML = '';
    },
    getRoot: () => root,
  };
}

module.exports = {
  mountConfigView,
};
