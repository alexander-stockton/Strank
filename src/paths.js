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

function ranksTxtPath() {
  return path.join(getDataDir(), 'ranks.txt');
}

function storePath() {
  return path.join(getDataDir(), 'store.json');
}

function windowStatePath() {
  return path.join(getDataDir(), 'window-state.json');
}

module.exports = {
  getProjectRoot,
  getDataDir,
  formatTxtPath,
  ranksTxtPath,
  storePath,
  windowStatePath,
};
