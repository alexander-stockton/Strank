const path = require('path');

/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 *
 * Resolves bundled data paths. Feature 17 will add install vs user-data split.
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

/** Bundled starter ladder for Rank Editor “Restore to defaults” (Feature 12). */
function defaultRanksTxtPath() {
  return path.join(getDataDir(), 'defaults', 'ranks.txt');
}

function badgesDir() {
  return path.join(getDataDir(), 'badges');
}

/** User-imported custom badges (Create Rank / form picker). */
function badgesCustomDir() {
  return path.join(badgesDir(), 'custom');
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

/** Landing layout / day-focus settings (Feature 14). */
function landingConfigTxtPath() {
  return path.join(getDataDir(), 'landing-config.txt');
}

module.exports = {
  getProjectRoot,
  getDataDir,
  formatTxtPath,
  formatDatPath,
  ranksTxtPath,
  defaultRanksTxtPath,
  badgesDir,
  badgesCustomDir,
  storePath,
  windowStatePath,
  configTxtPath,
  landingConfigTxtPath,
};
