/**
 * Feature 11 - Config, Accessibility & Backup
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */

const path = require('path');
const config = require('./config');
const backup = require('./backup');
const fileDialog = require('./fileDialog');
const i18n = require('./i18n');
const unitConversion = require('./unitConversion');
const windowState = require('./windowState');
const paths = require('./paths');
const storage = require('./storage');
const catalog = require('./catalog');
const ranks = require('./ranks');
const landingConfig = require('./landingConfig');

const { t, th } = i18n;

const WEIGHT_UNIT_OPTIONS = [
  { value: 'lbs', label: 'lbs' },
  { value: 'kg', label: 'kgs' },
  { value: 'st', label: 'stones' },
];

const DISTANCE_UNIT_OPTIONS = [
  { value: 'mi', label: 'mi' },
  { value: 'km', label: 'km' },
  { value: 'm', label: 'm' },
  { value: 'yd', label: 'yd' },
  { value: 'ft', label: 'ft' },
  { value: 'in', label: 'in' },
];

function unitOptionsHtml(options, selected) {
  return options
    .map(
      (opt) =>
        `<option value="${escapeHtml(opt.value)}" ${opt.value === selected ? 'selected' : ''}>${escapeHtml(
          opt.label
        )}</option>`
    )
    .join('');
}

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
  /** Debounce disk writes while dragging `<input type="color">`. */
  let colorPersistTimer = null;
  const COLOR_PERSIST_MS = 280;

  const COLOR_FIELD_LABEL_KEYS = {
    'accent color': 'config.colors.accent',
    'background color': 'config.colors.background',
    'panel color': 'config.colors.panel',
    'text color': 'config.colors.text',
    'muted color': 'config.colors.muted',
    'danger color': 'config.colors.danger',
    'ok color': 'config.colors.ok',
    'glow color': 'config.colors.glow',
    'alert color': 'config.colors.alert',
  };

  function settings() {
    return config.get();
  }

  function notifyChanged() {
    if (typeof options.onSettingsChanged === 'function') {
      options.onSettingsChanged(config.get());
    }
  }

  /** Paint theme CSS vars only - safe to call on every color-drag frame. */
  function applyThemeOnly() {
    const doc = dialogDoc();
    if (doc) config.applyToDocument(doc);
  }

  /** Theme paint + notify shell (navbar / chrome). Avoid on color-drag input. */
  function applyAppearance() {
    applyThemeOnly();
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
    const labelKey = COLOR_FIELD_LABEL_KEYS[optionKey];
    const label = labelKey ? t(labelKey) : optionKey;
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

  /** Native names (FR-003), with the English name alongside so anyone can switch back. */
  function renderLanguageOptions(selectedTag) {
    return i18n
      .listLanguages()
      .map((lang) => {
        const label = lang.englishName && lang.englishName !== lang.name ? `${lang.name} - ${lang.englishName}` : lang.name;
        return `<option value="${escapeHtml(lang.tag)}" lang="${escapeHtml(lang.tag)}" ${
          lang.tag === selectedTag ? 'selected' : ''
        }>${escapeHtml(label)}</option>`;
      })
      .join('');
  }

  function renderSimpleColors(s) {
    const fields = config.SIMPLE_COLOR_KEYS.map((key) => colorFieldHtml(key, s[key])).join('');
    return `
      <div class="config-colors-simple" data-simple-colors>
        <div class="config-colors-grid">${fields}</div>
        <div class="field-row">
          <button type="button" class="secondary" data-action="more-colors">${th('common.more')}</button>
        </div>
      </div>`;
  }

  function renderColorDialog(s) {
    if (!colorDialogOpen) return '';
    const fields = config.ADVANCED_COLOR_KEYS.map((key) => colorFieldHtml(key, s[key])).join('');
    return `
      <div class="dialog-backdrop" data-dialog="colors" role="dialog" aria-label="${th('config.colors.dialogTitle')}">
        <form class="dialog color-picker-dialog" id="color-picker-form">
          <h2>${th('config.colors.dialogTitle')}</h2>
          <p class="dialog-hint">${th('config.colors.dialogHint')}</p>
          <div class="config-colors-grid config-colors-grid-advanced">${fields}</div>
          <div class="dialog-actions">
            <button type="button" class="ghost" data-action="cancel-colors">${th('common.cancel')}</button>
            <button type="submit" class="primary" data-action="confirm-colors">${th('common.confirm')}</button>
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

  function clearColorPersistTimer() {
    if (colorPersistTimer) {
      clearTimeout(colorPersistTimer);
      colorPersistTimer = null;
    }
  }

  /** Flush any pending debounced color write to disk. */
  function flushColorPersist() {
    clearColorPersistTimer();
    config.rewrite();
  }

  /**
   * Apply color patch to memory + live theme immediately (no shell notify / no disk).
   * Disk write is debounced while dragging; `{ immediate: true }` flushes + notifies once.
   */
  function persistColors(patch, opts = {}) {
    if (!patch || !Object.keys(patch).length) return;
    const immediate = Boolean(opts.immediate);
    config.update(patch, { persist: false });
    // Theme only - notifyChanged -> applyConfigChrome used to config.load() from disk
    // (wiping the preview) and reload the catalog on every input frame.
    applyThemeOnly();
    if (immediate) {
      flushColorPersist();
      notifyChanged();
      return;
    }
    clearColorPersistTimer();
    colorPersistTimer = setTimeout(() => {
      colorPersistTimer = null;
      config.rewrite();
    }, COLOR_PERSIST_MS);
  }

  function confirmAdvancedColors(form) {
    const patch = readColorsFromForm(form);
    persistColors(patch, { immediate: true });
    colorDialogOpen = false;
    colorDialogSnapshot = null;
    render();
  }

  function cancelAdvancedColors() {
    clearColorPersistTimer();
    if (colorDialogSnapshot) {
      config.update(colorDialogSnapshot, { persist: true });
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
          <h1>${th('config.title')}</h1>
          <button type="button" class="ghost" data-action="back">${th('common.back')}</button>
        </header>

        <section class="config-section" data-section="language">
          <h2>${th('config.language.heading')}</h2>
          <label class="field">
            <span>${th('config.language.label')}</span>
            <select name="language" data-config-language aria-label="${th('config.language.label')}">
              ${renderLanguageOptions(s.language)}
            </select>
          </label>
        </section>

        <section class="config-section" data-section="appearance">
          <div data-tour-appearance-core>
          <h2>${th('config.appearance.heading')}</h2>
          <div class="field font-size-field">
            <span>${th('config.fontSize.label')}</span>
            <div class="font-size-controls">
              <label class="font-size-input-wrap">
                <span class="visually-hidden">${th('config.fontSize.pixels')}</span>
                <input
                  type="number"
                  min="8"
                  max="24"
                  step="1"
                  inputmode="numeric"
                  name="font-size-px"
                  class="metric-input-reps font-size-input"
                  data-font-size-input
                  aria-label="${th('config.fontSize.pixels')}"
                  value="${escapeHtml(fontPx)}"
                />
              </label>
              <select
                name="font-size-preset"
                class="font-size-preset"
                data-font-size-preset
                aria-label="${th('config.fontSize.preset')}"
              >
                <option value="" ${fontPreset === '' ? 'selected' : ''}>${th('config.fontSize.custom')}</option>
                <option value="small" ${fontPreset === 'small' ? 'selected' : ''}>${th('config.fontSize.small')}</option>
                <option value="medium" ${fontPreset === 'medium' ? 'selected' : ''}>${th('config.fontSize.medium')}</option>
                <option value="large" ${fontPreset === 'large' ? 'selected' : ''}>${th('config.fontSize.large')}</option>
              </select>
            </div>
          </div>
          <div class="field config-colors-block">
            <span>${th('config.colors.label')}</span>
            ${renderSimpleColors(s)}
          </div>
          <fieldset class="field">
            <legend>${th('config.navbar.legend')}</legend>
            <label class="radio-inline">
              <input type="radio" name="navbar-alignment" value="left" data-config-key="navbar alignment"
                ${s['navbar alignment'] === 'left' ? 'checked' : ''} />
              ${th('config.navbar.left')}
            </label>
            <label class="radio-inline">
              <input type="radio" name="navbar-alignment" value="top" data-config-key="navbar alignment"
                ${s['navbar alignment'] === 'top' ? 'checked' : ''} />
              ${th('config.navbar.top')}
            </label>
          </fieldset>
          <fieldset class="field">
            <legend>${th('config.clock.legend')}</legend>
            <label class="radio-inline">
              <input type="radio" name="clock-24hr" value="f" data-config-key="24hr"
                ${s['24hr'] ? '' : 'checked'} />
              ${th('config.clock.12h')}
            </label>
            <label class="radio-inline">
              <input type="radio" name="clock-24hr" value="t" data-config-key="24hr"
                ${s['24hr'] ? 'checked' : ''} />
              ${th('config.clock.24h')}
            </label>
          </fieldset>
          </div>
          <label class="field">
            <span>${th('config.weightUnits.label')}</span>
            <select name="weight-units" data-config-key="weight units" aria-label="${th('config.weightUnits.label')}">
              ${unitOptionsHtml(WEIGHT_UNIT_OPTIONS, s['weight units'])}
            </select>
          </label>
          <label class="field">
            <span>${th('config.distanceUnits.label')}</span>
            <select name="distance-units" data-config-key="distance units" aria-label="${th('config.distanceUnits.label')}">
              ${unitOptionsHtml(DISTANCE_UNIT_OPTIONS, s['distance units'])}
            </select>
          </label>
        </section>

        <section class="config-section" data-section="accessibility" data-tour-target="config-accessibility">
          <h2>${th('config.accessibility.heading')}</h2>
          <label class="field">
            <span>${th('config.colorblind.label')}</span>
            <select name="colorblind" data-config-key="colorblind filter" aria-label="${th('config.colorblind.label')}">
              <option value="none" ${s['colorblind filter'] === 'none' ? 'selected' : ''}>${th('config.colorblind.none')}</option>
              <option value="protanopia" ${s['colorblind filter'] === 'protanopia' ? 'selected' : ''}>${th('config.colorblind.protanopia')}</option>
              <option value="deuteranopia" ${s['colorblind filter'] === 'deuteranopia' ? 'selected' : ''}>${th('config.colorblind.deuteranopia')}</option>
              <option value="tritanopia" ${s['colorblind filter'] === 'tritanopia' ? 'selected' : ''}>${th('config.colorblind.tritanopia')}</option>
            </select>
          </label>
          <label class="field checkbox-field">
            <span>${th('config.screenReader.label')}</span>
            <input type="checkbox" name="screen-reader" data-config-key="screen reader mode"
              ${boolAttr(s['screen reader mode'])} />
          </label>
          <label class="field checkbox-field">
            <span>${th('config.fullscreen.label')}</span>
            <input type="checkbox" name="fullscreen" data-config-key="fullscreen"
              ${boolAttr(s.fullscreen)} />
          </label>
        </section>

        <section class="config-section" data-section="backup">
          <h2>${th('config.backup.heading')}</h2>
          <div class="backup-toolbar">
            <div class="field-row">
              <button type="button" class="secondary" data-action="export-backup">${th('config.backup.exportData')}</button>
              <button type="button" class="secondary" data-action="import-backup">${th('config.backup.importData')}</button>
            </div>
            <div class="field-row">
              <button type="button" class="secondary" data-action="export-config">${th('config.backup.exportConfig')}</button>
              <button type="button" class="secondary" data-action="import-config">${th('config.backup.importConfig')}</button>
            </div>
            <div class="field-row">
              <button type="button" class="secondary" data-action="export-ranks">${th('config.backup.exportRanks')}</button>
              <button type="button" class="secondary" data-action="import-ranks">${th('config.backup.importRanks')}</button>
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
            data-tour-advanced-header
            aria-expanded="${advancedOpen ? 'true' : 'false'}"
            aria-controls="config-advanced-panel"
          >
            <h2>${th('config.advanced.heading')}</h2>
            <span class="config-accordion-chevron" aria-hidden="true"></span>
          </button>
          <div class="config-accordion-panel" id="config-advanced-panel">
            <div class="config-accordion-panel-inner">
              ${noticeHtml(advancedNotice, 'advanced')}
              <div data-tour-advanced-core>
              <div class="config-advanced-top">
                <div class="config-advanced-toggles">
                  <label class="field checkbox-field">
                    <span>${th('config.notifications.label')}</span>
                    <input type="checkbox" name="notifications" data-config-key="notifications enabled"
                      ${boolAttr(s['notifications enabled'])} />
                  </label>
                  <label class="field checkbox-field">
                    <span>${th('config.sounds.label')}</span>
                    <input type="checkbox" name="sounds" data-config-key="completion sounds enabled"
                      ${boolAttr(s['completion sounds enabled'])} />
                  </label>
                  <label class="field checkbox-field">
                    <span>${th('config.logging.label')}</span>
                    <input type="checkbox" name="logging" data-config-key="logging"
                      ${boolAttr(s.logging)} />
                  </label>
                </div>
                <div class="config-advanced-actions">
                  <button type="button" class="secondary danger-outline" data-action="reset-user-data">${th(
                    'config.advanced.resetUserData'
                  )}</button>
                </div>
              </div>
              <fieldset class="config-animations" data-section="animations">
                <legend>${th('config.animations.legend')}</legend>
                <label class="field checkbox-field">
                  <span>${th('config.animations.workoutStart')}</span>
                  <input type="checkbox" data-config-key="animation workout start"
                    ${boolAttr(s['animation workout start'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>${th('config.animations.clickRipple')}</span>
                  <input type="checkbox" data-config-key="animation click ripple"
                    ${boolAttr(s['animation click ripple'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>${th('config.animations.viewSlides')}</span>
                  <input type="checkbox" data-config-key="animation view slides"
                    ${boolAttr(s['animation view slides'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>${th('config.animations.contentReveal')}</span>
                  <input type="checkbox" data-config-key="animation content reveal"
                    ${boolAttr(s['animation content reveal'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>${th('config.animations.flyoutFade')}</span>
                  <input type="checkbox" data-config-key="animation flyout fade"
                    ${boolAttr(s['animation flyout fade'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>${th('config.animations.elevatedButtons')}</span>
                  <input type="checkbox" data-config-key="animation elevated buttons"
                    ${boolAttr(s['animation elevated buttons'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>${th('config.animations.outlineButtons')}</span>
                  <input type="checkbox" data-config-key="animation outline buttons"
                    ${boolAttr(s['animation outline buttons'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>${th('config.animations.accordions')}</span>
                  <input type="checkbox" data-config-key="animation accordions"
                    ${boolAttr(s['animation accordions'] !== false)} />
                </label>
                <label class="field checkbox-field">
                  <span>${th('config.animations.smoothCardScroll')}</span>
                  <input type="checkbox" data-config-key="animation smooth card scroll"
                    ${boolAttr(s['animation smooth card scroll'] !== false)} />
                </label>
              </fieldset>
              </div>
              <div class="config-path-fields" data-section="path-overrides">
                <div class="field config-path-field">
                  <span class="config-path-label">${th('config.advanced.dataDirectory')}</span>
                  <div class="config-path-row">
                    <input
                      type="text"
                      class="config-path-input"
                      data-config-path="data directory"
                      spellcheck="false"
                      autocomplete="off"
                      aria-label="${th('config.advanced.dataDirectory')}"
                      value="${escapeHtml(s['data directory'] || paths.getDataDir())}"
                    />
                    <button
                      type="button"
                      class="secondary config-path-browse"
                      data-action="browse-data-directory"
                      title="${th('config.advanced.browseDirectory')}"
                      aria-label="${th('config.advanced.browseDirectory')}"
                    >${th('config.advanced.browse')}</button>
                  </div>
                </div>
                <div class="field config-path-field">
                  <span class="config-path-label">${th('config.advanced.storePath')}</span>
                  <div class="config-path-row">
                    <input
                      type="text"
                      class="config-path-input"
                      data-config-path="store path"
                      spellcheck="false"
                      autocomplete="off"
                      aria-label="${th('config.advanced.storePath')}"
                      value="${escapeHtml(s['store path'] || paths.storePath())}"
                    />
                    <button
                      type="button"
                      class="secondary config-path-browse"
                      data-action="browse-store-path"
                      title="${th('config.advanced.browseFile')}"
                      aria-label="${th('config.advanced.browseFile')}"
                    >${th('config.advanced.browse')}</button>
                  </div>
                </div>
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

  function pickDirectory(dialogOpts = {}) {
    if (typeof options.pickDirectory === 'function') {
      return Promise.resolve(options.pickDirectory(dialogOpts));
    }
    return fileDialog.pickDirectory({
      ...dialogOpts,
      document: dialogDoc(),
    });
  }

  function confirm(msg) {
    if (typeof options.confirm === 'function') return options.confirm(msg);
    if (typeof window !== 'undefined' && window.confirm) return window.confirm(msg);
    return true;
  }

  function samePath(a, b) {
    try {
      return path.resolve(String(a || '')) === path.resolve(String(b || ''));
    } catch (_) {
      return String(a || '') === String(b || '');
    }
  }

  /** After path overrides change, refresh caches that point at data/store. */
  function refreshAfterPathChange() {
    try {
      landingConfig.clearLandingConfigCache();
      landingConfig.load();
    } catch (_) {
      /* ignore */
    }
    try {
      ranks.clearRanksCache();
      ranks.loadRanks();
    } catch (_) {
      /* ignore */
    }
    try {
      catalog.reloadFromDisk();
    } catch (_) {
      /* ignore */
    }
    try {
      storage.ensureInitialized();
    } catch (_) {
      /* ignore */
    }
    notifyChanged();
  }

  /**
   * Commit data-directory on blur / browse. Empty or bootstrap path -> default.
   * Only validates the filesystem when focus leaves (or browse selects).
   */
  function commitDataDirectory(raw, inputEl) {
    const trimmed = String(raw || '').trim();
    const bootstrap = paths.getBootstrapDataDir();
    const effective = trimmed || bootstrap;
    const check = paths.validateDataDirectory(effective);
    if (!check.ok) {
      advancedNotice = {
        kind: 'alert',
        text: t('config.advanced.dataDirectoryInvalid'),
      };
      if (inputEl) inputEl.value = config.get()['data directory'] || paths.getDataDir();
      setAdvancedOpen(true);
      render();
      return false;
    }
    const toStore = samePath(check.path, bootstrap) ? '' : check.path;
    const prev = String(config.get()['data directory'] || '');
    if (prev === toStore) {
      if (inputEl) inputEl.value = toStore || paths.getDataDir();
      return true;
    }
    config.set('data directory', toStore);
    advancedNotice = { kind: 'status', text: t('config.advanced.pathsUpdated') };
    refreshAfterPathChange();
    setAdvancedOpen(true);
    render();
    return true;
  }

  /** Commit store path on blur / browse. Empty -> [data dir]/store.json. */
  function commitStorePath(raw, inputEl) {
    const trimmed = String(raw || '').trim();
    const fallback = path.join(paths.getDataDir(), 'store.json');
    const effective = trimmed || fallback;
    const check = paths.validateStorePath(effective);
    if (!check.ok) {
      advancedNotice = {
        kind: 'alert',
        text: t('config.advanced.storePathInvalid'),
      };
      if (inputEl) inputEl.value = config.get()['store path'] || paths.storePath();
      setAdvancedOpen(true);
      render();
      return false;
    }
    const defaultForData = path.join(paths.getDataDir(), 'store.json');
    const toStore = samePath(check.path, defaultForData) ? '' : check.path;
    const prev = String(config.get()['store path'] || '');
    if (prev === toStore) {
      if (inputEl) inputEl.value = toStore || paths.storePath();
      return true;
    }
    config.set('store path', toStore);
    advancedNotice = { kind: 'status', text: t('config.advanced.pathsUpdated') };
    refreshAfterPathChange();
    setAdvancedOpen(true);
    render();
    return true;
  }

  function setAdvancedOpen(open, opts = {}) {
    advancedOpen = Boolean(open);
    const section = root.querySelector('[data-section="advanced"]');
    const toggle = root.querySelector('[data-action="toggle-advanced"]');
    const panel = section ? section.querySelector('.config-accordion-panel') : null;
    // Tour needs a settled rect; skip the expand animation when requested.
    if (opts.instant && panel) {
      panel.style.transition = 'none';
    }
    if (section) section.setAttribute('data-open', advancedOpen ? 'true' : 'false');
    if (toggle) toggle.setAttribute('aria-expanded', advancedOpen ? 'true' : 'false');
    if (opts.instant && panel) {
      void panel.offsetHeight;
      panel.style.transition = '';
    }
  }

  /**
   * Open Advanced if needed and scroll a config section into the content-body card
   * (Feature 18 tour). Prefer scrolling `.config-view` directly — scrollIntoView can
   * move the wrong ancestor and leave the spotlight on the wrong section.
   * @param {string} sectionId - data-section / tour target id (appearance, backup, advanced, appearance-core, …)
   * @param {{ align?: 'start' | 'center' }} [opts]
   */
  function revealSection(sectionId, opts = {}) {
    const id = String(sectionId || '').trim();
    if (!id) return false;
    if (id === 'advanced' || id === 'advanced-core') setAdvancedOpen(true, { instant: true });
    let el = null;
    if (id === 'appearance-core' || id === 'appearance') {
      el = root.querySelector('[data-tour-appearance-core]') || root.querySelector('[data-section="appearance"]');
    } else if (id === 'accessibility') {
      el =
        root.querySelector('[data-tour-target="config-accessibility"]') ||
        root.querySelector('[data-section="accessibility"]');
    } else if (id === 'advanced-core' || id === 'advanced') {
      // Header through Animations (screenshot); open accordion first.
      el =
        root.querySelector('[data-tour-advanced-header]') ||
        root.querySelector('[data-tour-advanced-core]') ||
        root.querySelector('[data-section="advanced"]');
    } else {
      el = root.querySelector(`[data-section="${id}"]`);
    }
    if (!el) return false;
    const scroller = scrollParent();
    if (!scroller) return false;

    const align = opts.align === 'center' ? 'center' : 'start';
    const pad = 12;
    try {
      const sRect = scroller.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const delta = eRect.top - sRect.top + scroller.scrollTop;
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const desired =
        align === 'center'
          ? delta - Math.max(pad, (scroller.clientHeight - eRect.height) / 2)
          : delta - pad;
      // Instant jump — smooth scroll (motion-smooth-scroll-on) would still be
      // animating when the tour measures the target, leaving the spotlight behind.
      const prevBehavior = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = 'auto';
      scroller.scrollTop = Math.max(0, Math.min(maxScroll, desired));
      scroller.style.scrollBehavior = prevBehavior;
    } catch (_) {
      scroller.scrollTop = Math.max(0, el.offsetTop - pad);
    }
    return true;
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

    const resetUserDataBtn = root.querySelector('[data-action="reset-user-data"]');
    if (resetUserDataBtn) {
      resetUserDataBtn.addEventListener('click', () => {
        const result = backup.resetUserData({ confirm });
        if (result.cancelled) return;
        if (!result.ok) {
          advancedNotice = {
            kind: 'alert',
            text: result.message || t('config.advanced.resetUserDataFailed'),
          };
          render();
          return;
        }
        // Defaults are on disk (incl. onboarding completed: false); hard-reload to boot clean.
        backup.restartApp({
          reload: typeof options.onRestart === 'function' ? options.onRestart : undefined,
        });
      });
    }

    const dataDirInput = root.querySelector('[data-config-path="data directory"]');
    if (dataDirInput) {
      dataDirInput.addEventListener('blur', () => {
        commitDataDirectory(dataDirInput.value, dataDirInput);
      });
      dataDirInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          dataDirInput.blur();
        }
      });
    }

    const storePathInput = root.querySelector('[data-config-path="store path"]');
    if (storePathInput) {
      storePathInput.addEventListener('blur', () => {
        commitStorePath(storePathInput.value, storePathInput);
      });
      storePathInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          storePathInput.blur();
        }
      });
    }

    const browseDataDir = root.querySelector('[data-action="browse-data-directory"]');
    if (browseDataDir) {
      browseDataDir.addEventListener('click', async () => {
        const chosen = await pickDirectory();
        if (!chosen) return;
        if (dataDirInput) dataDirInput.value = chosen;
        commitDataDirectory(chosen, dataDirInput);
      });
    }

    const browseStore = root.querySelector('[data-action="browse-store-path"]');
    if (browseStore) {
      browseStore.addEventListener('click', async () => {
        // Save dialog lets the user point at a new or existing store.json.
        const chosen = await pickSavePath({
          defaultName: 'store.json',
          accept: '.json,application/json',
        });
        if (!chosen) return;
        if (storePathInput) storePathInput.value = chosen;
        commitStorePath(chosen, storePathInput);
      });
    }

    const languageSelect = root.querySelector('[data-config-language]');
    if (languageSelect) {
      languageSelect.addEventListener('change', () => {
        backupNotice = null;
        advancedNotice = null;
        config.set('language', languageSelect.value);
        i18n.setLanguage(config.get().language);
        const doc = dialogDoc();
        if (doc) i18n.applyToDocument(doc);
        notifyChanged();
        render();
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
              text: t('config.notifications.blocked'),
            };
            setAdvancedOpen(true);
            render();
            return;
          }
        }

        if (key === 'weight units') {
          const from = config.getWeightUnits();
          const to = config.normalizeWeightUnits(value);
          config.set(key, value);
          if (from !== to) {
            unitConversion.applyUnitChange({ weightFrom: from, weightTo: to });
          }
          notifyChanged();
          render();
          return;
        }

        if (key === 'distance units') {
          const from = config.getDistanceUnits();
          const to = config.normalizeDistanceUnits(value);
          config.set(key, to);
          if (from !== to) {
            unitConversion.applyUnitChange({
              distanceFrom: from,
              distanceTo: to,
            });
          }
          notifyChanged();
          render();
          return;
        }

        config.set(key, value);
        notifyChanged();
        if (key === 'fullscreen') {
          try {
            const nwApi =
              (typeof nw !== 'undefined' && nw) ||
              (typeof global !== 'undefined' && global.nw) ||
              null;
            const nwWin = nwApi && nwApi.Window ? nwApi.Window.get() : null;
            windowState.applyFullscreenPreference(nwWin, Boolean(value));
          } catch (_) {
            /* ignore when nw is unavailable (tests) */
          }
        }
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
      const onInput = () => {
        const key = el.getAttribute('data-color-key');
        if (!key) return;
        // Live preview + buffered disk write (dragging fires input very fast).
        persistColors({ [key]: String(el.value || '').trim() });
      };
      const onChange = () => {
        const key = el.getAttribute('data-color-key');
        if (!key) return;
        persistColors({ [key]: String(el.value || '').trim() }, { immediate: true });
      };
      el.addEventListener('input', onInput);
      el.addEventListener('change', onChange);
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
          ? { kind: 'status', text: t('config.backup.dataExported') }
          : { kind: 'alert', text: result.message || t('backup.invalidData') };
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
          ? { kind: 'status', text: t('config.backup.dataImported') }
          : { kind: 'alert', text: result.message || t('backup.invalidData') };
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
          ? { kind: 'status', text: t('config.backup.configExported') }
          : { kind: 'alert', text: result.message || t('backup.invalidConfig') };
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
          backupNotice = { kind: 'alert', text: result.message || t('backup.invalidConfig') };
        } else {
          i18n.setLanguage(config.get().language);
          const doc = dialogDoc();
          if (doc) i18n.applyToDocument(doc);
          backupNotice = {
            kind: 'status',
            text: result.resetToDefaults
              ? t('config.backup.configImportedReset')
              : t('config.backup.configImported'),
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
          ? { kind: 'status', text: t('config.backup.ranksExported') }
          : { kind: 'alert', text: result.message || t('backup.invalidRanks') };
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
          ? { kind: 'status', text: t('config.backup.ranksImported') }
          : { kind: 'alert', text: result.message || t('backup.invalidRanks') };
        if (result.ok) notifyChanged();
        render();
      });
    }

  }

  render();
  notifyChanged();

  return {
    refresh: render,
    destroy() {
      flushColorPersist();
      root.innerHTML = '';
    },
    getRoot: () => root,
    revealSection,
    setAdvancedOpen,
  };
}

module.exports = {
  mountConfigView,
};
