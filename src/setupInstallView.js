/**
 * Feature 19 - Packaging & Distribution
 * Spec: features/feature-19-Packaging-Distribution.md
 *
 * Offline installer-like first-run UI (no network).
 */

const setupInstall = require('./setupInstall');
const fileDialog = require('./fileDialog');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setupHtml(destDir) {
  return `<section class="panel setup-install-view" data-view="setup-install">
    <header class="setup-install-header">
      <p class="setup-install-brand">Strank</p>
      <h1>Install Strank</h1>
      <p class="muted setup-install-lead">
        Everything needed to install is already in this package. No internet connection is required.
      </p>
    </header>

    <div class="setup-install-step" data-setup-step="choose">
      <label class="field">
        <span>Install location</span>
        <div class="setup-install-path-row">
          <input type="text" class="setup-install-path" data-setup-path spellcheck="false"
            value="${escapeHtml(destDir)}" aria-label="Install location" />
          <button type="button" class="secondary setup-install-browse" data-action="setup-browse">Browse...</button>
        </div>
      </label>
      <label class="setup-install-shortcut">
        <span>Create a desktop shortcut</span>
        <input type="checkbox" data-setup-shortcut checked />
      </label>
      <p class="muted setup-install-note">
        Files are copied from this package to the folder above. Your workout history and settings
        are stored separately under AppData and are never uploaded.
      </p>
      <p class="inline-alert is-error setup-install-error" data-setup-error hidden></p>
      <div class="setup-install-actions">
        <button type="button" class="primary" data-action="setup-install">Install</button>
      </div>
    </div>

    <div class="setup-install-step" data-setup-step="progress" hidden>
      <p data-setup-status>Preparing...</p>
      <div class="setup-install-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="setup-install-progress-bar" data-setup-bar style="width:0%"></div>
      </div>
      <p class="muted setup-install-current" data-setup-current></p>
    </div>

    <div class="setup-install-step" data-setup-step="done" hidden>
      <p data-setup-done-msg>Strank is ready. Installation used only files from this package.</p>
      <div class="setup-install-actions">
        <button type="button" class="primary" data-action="setup-launch">Launch Strank</button>
      </div>
    </div>
  </section>`;
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   onFinished?: (result: object) => void,
 *   document?: Document,
 * }} [options]
 */
function mountSetupInstallView(root, options = {}) {
  const doc =
    options.document || (typeof document !== 'undefined' ? document : null);
  let installResult = null;

  const dest0 = setupInstall.defaultInstallDir();
  root.innerHTML = setupHtml(dest0);

  const stepChoose = root.querySelector('[data-setup-step="choose"]');
  const stepProgress = root.querySelector('[data-setup-step="progress"]');
  const stepDone = root.querySelector('[data-setup-step="done"]');
  const pathInput = root.querySelector('[data-setup-path]');
  const shortcutInput = root.querySelector('[data-setup-shortcut]');
  const errorEl = root.querySelector('[data-setup-error]');
  const statusEl = root.querySelector('[data-setup-status]');
  const currentEl = root.querySelector('[data-setup-current]');
  const barEl = root.querySelector('[data-setup-bar]');
  const progressWrap = root.querySelector('.setup-install-progress');

  function showError(msg) {
    if (!errorEl) return;
    if (!msg) {
      errorEl.hidden = true;
      errorEl.textContent = '';
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = msg;
  }

  function setPhase(phase) {
    stepChoose.hidden = phase !== 'choose';
    stepProgress.hidden = phase !== 'progress';
    stepDone.hidden = phase !== 'done';
  }

  function setProgress(pct, status, current) {
    const n = Math.max(0, Math.min(100, Math.round(pct)));
    if (barEl) barEl.style.width = `${n}%`;
    if (progressWrap) progressWrap.setAttribute('aria-valuenow', String(n));
    if (statusEl && status) statusEl.textContent = status;
    if (currentEl) currentEl.textContent = current || '';
  }

  const browseBtn = root.querySelector('[data-action="setup-browse"]');
  if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
      const picked = await fileDialog.pickDirectory({ document: doc });
      if (picked && pathInput) pathInput.value = picked;
    });
  }

  const installBtn = root.querySelector('[data-action="setup-install"]');
  if (installBtn) {
    installBtn.addEventListener('click', () => {
      showError('');
      const destDir = String(
        pathInput && pathInput.value ? pathInput.value : '',
      ).trim();
      if (!destDir) {
        showError('Choose an install location.');
        return;
      }
      setPhase('progress');
      setProgress(5, 'Copying package files (offline)...', '');

      // Yield so the progress step paints before the sync copy.
      setTimeout(() => {
        let lastPct = 5;
        try {
          installResult = setupInstall.runInstall({
            destDir,
            createShortcut: Boolean(shortcutInput && shortcutInput.checked),
            onProgress: (info) => {
              if (info.phase === 'prepare') setProgress(8, 'Preparing...', '');
              else if (info.phase === 'copy') {
                lastPct = Math.min(85, 10 + (info.copied || 0) * 0.15);
                setProgress(
                  lastPct,
                  'Copying package files (offline)...',
                  info.current || '',
                );
              } else if (info.phase === 'seed') {
                setProgress(90, 'Preparing your data folder...', '');
              } else if (info.phase === 'shortcut') {
                setProgress(95, 'Creating desktop shortcut...', '');
              } else if (info.phase === 'done') {
                setProgress(100, 'Finished', '');
              }
            },
          });
        } catch (err) {
          setPhase('choose');
          showError(err && err.message ? err.message : String(err));
          return;
        }

        if (!installResult || !installResult.ok) {
          setPhase('choose');
          const code = installResult && installResult.message;
          showError(
            code === 'dest-inside-source'
              ? 'Choose a folder outside this package.'
              : 'Install failed. Try another folder.',
          );
          return;
        }

        setPhase('done');
      }, 40);
    });
  }

  const launchBtn = root.querySelector('[data-action="setup-launch"]');
  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      const result = installResult || {
        ok: true,
        relaunchNeeded: false,
        launchExe: null,
      };
      if (typeof options.onFinished === 'function') {
        options.onFinished(result);
      }
    });
  }

  return {
    destroy() {
      root.innerHTML = '';
    },
    getRoot: () => root,
  };
}

module.exports = {
  mountSetupInstallView,
};
