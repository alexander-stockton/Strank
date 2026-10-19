const path = require('path');

/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 *
 * Resolves bundled data paths. Feature 12 will add install vs user-data split.
 */

function getProjectRoot() {
  return path.resolve(__dirname, '..');
}

function getDataDir() {
  return path.join(getProjectRoot(), 'data');
}

function formatTxtPath() {
  return path.join(getDataDir(), 'format.txt');
}

/** Binary catalog/rules file (UTF-8 bytes of format.txt). App reads this, not format.txt. */
function formatDatPath() {
  return path.join(getDataDir(), 'format.dat');
}

function ranksTxtPath() {
  return path.join(getDataDir(), 'ranks.txt');
}

function storePath() {
  return path.join(getDataDir(), 'store.json');
}

function windowStatePath() {
  return path.join(getDataDir(), 'window-state.json');
}

function configTxtPath() {
  return path.join(getDataDir(), 'config.txt');
}

/** Landing layout / day-focus settings (Feature 15). */
function landingConfigTxtPath() {
  return path.join(getDataDir(), 'landing-config.txt');
}

module.exports = {
  getProjectRoot,
  getDataDir,
  formatTxtPath,
  formatDatPath,
  ranksTxtPath,
  storePath,
  windowStatePath,
  configTxtPath,
  landingConfigTxtPath,
};
