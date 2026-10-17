/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const networkGuard = require('./networkGuard');
const storage = require('./storage');
const catalog = require('./catalog');
const ranks = require('./ranks');
const dailyLog = require('./dailyLog');
const history = require('./history');
const ranking = require('./ranking');
const { formatLocalDate } = require('./appDate');

/**
 * Bootstrap application services. Used by the shell UI and by tests.
 * @returns {{
 *   ok: boolean,
 *   view: 'shell' | 'dataError' | 'storeCorrupt',
 *   message?: string,
 *   catalog?: object[],
 *   ranks?: object[],
 *   store?: object,
 *   hasLoginForm: false
 * }}
 */
function bootstrap() {
  networkGuard.install();
  networkGuard.resetCount();

  const catalogResult = catalog.loadCatalog();
  if (!catalogResult.ok) {
    return {
      ok: false,
      view: 'dataError',
      message: 'Failed to load exercise data.',
      hasLoginForm: false,
    };
  }

  const ranksResult = ranks.loadRanks();
  if (!ranksResult.ok) {
    return {
      ok: false,
      view: 'dataError',
      message: 'Failed to load rank data.',
      hasLoginForm: false,
    };
  }

  const init = storage.ensureInitialized();
  if (!init.ok) {
    return {
      ok: false,
      view: 'storeCorrupt',
      message: 'Local data could not be read.',
      hasLoginForm: false,
    };
  }

  const storeRead = storage.readStore();
  if (!storeRead.ok) {
    return {
      ok: false,
      view: 'storeCorrupt',
      message: 'Local data could not be read.',
      hasLoginForm: false,
    };
  }

  try {
    networkGuard.assertOffline();
  } catch (err) {
    return {
      ok: false,
      view: 'dataError',
      message: err.message,
      hasLoginForm: false,
    };
  }

  return {
    ok: true,
    view: 'shell',
    catalog: catalogResult.data,
    ranks: ranksResult.data,
    store: storeRead.data,
    hasLoginForm: false,
    localDate: formatLocalDate(new Date()),
  };
}

function resetLocalData() {
  return storage.resetStore();
}

module.exports = {
  bootstrap,
  resetLocalData,
  formatLocalDate,
  catalog,
  ranks,
  storage,
  dailyLog,
  history,
  ranking,
  networkGuard,
};
