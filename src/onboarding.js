/**
 * Feature 15 - App Animations (first-launch onboarding)
 * Spec: features/feature-15-App-Animations.md
 */

const fs = require('fs');
const config = require('./config');
const paths = require('./paths');
const dayFocus = require('./dayFocus');
const landingConfig = require('./landingConfig');

const ONBOARDING_KEY = 'onboarding completed';

function configFileHasOnboardingKey() {
  try {
    const filePath =
      typeof paths.configTxtPath === 'function' ? paths.configTxtPath() : null;
    if (!filePath || !fs.existsSync(filePath)) return false;
    const text = fs.readFileSync(filePath, 'utf8');
    return /(?:^|\n)\s*onboarding completed\s*:/i.test(text);
  } catch (_) {
    return false;
  }
}

function shouldShow() {
  config.load();
  const s = config.get();
  if (s[ONBOARDING_KEY] === true || s[ONBOARDING_KEY] === 'true') return false;

  // Upgrade path: older configs never had this key - do not force onboarding.
  if (!configFileHasOnboardingKey()) {
    try {
      config.update({ [ONBOARDING_KEY]: true });
    } catch (_) {
      /* ignore */
    }
    return false;
  }

  return true;
}

/**
 * Live paths for the Privacy Notice copy.
 * - user data: writable history/settings/edited definition files (dev `.strank-user-data`,
 *   packaged `%APPDATA%\Strank`, or a Config data-directory override)
 * - app / other data: install/package root (repo in dev, Strank install folder when packaged)
 */
function privacyPaths() {
  try {
    config.load();
  } catch (_) {
    /* defaults / overrides still applied when possible */
  }
  const userDataDir =
    typeof paths.getDataDir === 'function'
      ? paths.getDataDir()
      : typeof paths.getUserDataDir === 'function'
        ? paths.getUserDataDir()
        : '';
  const applicationDataDir =
    typeof paths.getInstallDir === 'function'
      ? paths.getInstallDir()
      : typeof paths.getProjectRoot === 'function'
        ? paths.getProjectRoot()
        : userDataDir;
  return {
    userDataDir,
    applicationDataDir,
  };
}

/**
 * @param {{ language?: string, markComplete?: boolean }} options
 */
function complete(options = {}) {
  config.load();
  landingConfig.load();
  const patch = {};
  if (options.language) {
    patch.language = options.language;
  }
  if (options.markComplete !== false) {
    patch[ONBOARDING_KEY] = true;
  }
  if (Object.keys(patch).length) config.update(patch);
  return { ok: true, data: { completed: true } };
}

function getDayFocusSchedule() {
  return dayFocus.getSchedule();
}

function setDayFocusSchedule(patch) {
  return dayFocus.setSchedule(patch);
}

module.exports = {
  ONBOARDING_KEY,
  shouldShow,
  complete,
  privacyPaths,
  getDayFocusSchedule,
  setDayFocusSchedule,
};
