/**
 * Feature 11 — native file pickers (NW.js / Chromium)
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */

/**
 * Resolve absolute path from a File object (NW.js exposes `.path`).
 */
function pathFromFile(file) {
  if (!file) return null;
  if (typeof file.path === 'string' && file.path) return file.path;
  return null;
}

function resolveDocument(doc) {
  if (doc) return doc;
  if (typeof document !== 'undefined') return document;
  return null;
}

/**
 * Open a save-file dialog (NW.js `nwsaveas`). Resolves to absolute path or null if cancelled.
 * @param {{ defaultName?: string, accept?: string, document?: Document }} [opts]
 */
function pickSavePath(opts = {}) {
  if (typeof opts.pickSavePath === 'function') {
    return Promise.resolve(opts.pickSavePath());
  }
  const doc = resolveDocument(opts.document);
  if (!doc || !doc.body) return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.setAttribute('nwsaveas', opts.defaultName || 'backup.dat');
    if (opts.accept) input.setAttribute('accept', opts.accept);
    input.style.display = 'none';
    doc.body.appendChild(input);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        input.remove();
      } catch (_) {
        /* ignore */
      }
      resolve(value);
    };

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      finish(pathFromFile(file));
    });

    // Cancel often fires no change; detect return of focus.
    const onFocus = () => {
      setTimeout(() => {
        if (!settled) finish(null);
      }, 400);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus, { once: true });
    }

    input.click();
  });
}

/**
 * Open an open-file dialog. Resolves to absolute path or null if cancelled.
 * @param {{ accept?: string, document?: Document }} [opts]
 */
function pickOpenPath(opts = {}) {
  if (typeof opts.pickOpenPath === 'function') {
    return Promise.resolve(opts.pickOpenPath());
  }
  const doc = resolveDocument(opts.document);
  if (!doc || !doc.body) return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    if (opts.accept) input.setAttribute('accept', opts.accept);
    input.style.display = 'none';
    doc.body.appendChild(input);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        input.remove();
      } catch (_) {
        /* ignore */
      }
      resolve(value);
    };

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      finish(pathFromFile(file));
    });

    const onFocus = () => {
      setTimeout(() => {
        if (!settled) finish(null);
      }, 400);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus, { once: true });
    }

    input.click();
  });
}

/**
 * Open a directory picker (NW.js `nwdirectory`). Resolves to absolute path or null.
 * @param {{ document?: Document, pickDirectory?: Function }} [opts]
 */
function pickDirectory(opts = {}) {
  if (typeof opts.pickDirectory === 'function') {
    return Promise.resolve(opts.pickDirectory());
  }
  const doc = resolveDocument(opts.document);
  if (!doc || !doc.body) return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.setAttribute('nwdirectory', '');
    input.style.display = 'none';
    doc.body.appendChild(input);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        input.remove();
      } catch (_) {
        /* ignore */
      }
      resolve(value);
    };

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      finish(pathFromFile(file));
    });

    const onFocus = () => {
      setTimeout(() => {
        if (!settled) finish(null);
      }, 400);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus, { once: true });
    }

    input.click();
  });
}

module.exports = {
  pickSavePath,
  pickOpenPath,
  pickDirectory,
  pathFromFile,
};
