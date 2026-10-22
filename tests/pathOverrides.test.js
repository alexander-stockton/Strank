/**
 * Custom data directory + store path overrides.
 * Feature 19: config lives in canonical user data; overrides redirect live data/store.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('path overrides', () => {
  let tempRoot;
  let bootstrapData;
  let userData;
  let paths;
  let config;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-paths-'));
    bootstrapData = path.join(tempRoot, 'data');
    userData = path.join(tempRoot, '.strank-user-data');
    fs.mkdirSync(path.join(bootstrapData, 'defaults'), { recursive: true });
    fs.mkdirSync(path.join(bootstrapData, 'localization', 'en'), { recursive: true });
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(
      path.join(userData, 'config.txt'),
      'language: en\nfullscreen: false\ndata directory: \nstore path: \n'
    );
    fs.writeFileSync(
      path.join(userData, 'store.json'),
      JSON.stringify({ schemaVersion: 1, entries: [], workouts: [] })
    );

    jest.doMock('../src/paths', () => {
      const actualPath = jest.requireActual('path');
      const actualFs = jest.requireActual('fs');
      let overrideDataDir = null;
      let overrideStorePath = null;
      const getProjectRoot = () => tempRoot;
      const getInstallDataDir = () => actualPath.join(getProjectRoot(), 'data');
      const getBootstrapDataDir = () => getInstallDataDir();
      const getCanonicalUserDataDir = () => actualPath.join(getProjectRoot(), '.strank-user-data');
      const getDataDir = () =>
        overrideDataDir ? actualPath.resolve(overrideDataDir) : getCanonicalUserDataDir();
      const applyPathOverridesFromSettings = (settings) => {
        const s = settings || {};
        const dataRaw = String(s['data directory'] != null ? s['data directory'] : '').trim();
        const storeRaw = String(s['store path'] != null ? s['store path'] : '').trim();
        overrideDataDir = dataRaw ? actualPath.resolve(dataRaw) : null;
        overrideStorePath = storeRaw ? actualPath.resolve(storeRaw) : null;
      };
      return {
        getProjectRoot,
        getInstallDir: getProjectRoot,
        getInstallDataDir,
        getBootstrapDataDir,
        getCanonicalUserDataDir,
        isPackaged: () => false,
        getDefaultStorePath: () => actualPath.join(getCanonicalUserDataDir(), 'store.json'),
        getDataDir,
        getUserDataDir: () =>
          overrideStorePath
            ? actualPath.dirname(actualPath.resolve(overrideStorePath))
            : getDataDir(),
        getDefinitionPaths: () => ({
          installDir: getProjectRoot(),
          userDataDir: getDataDir(),
          formatTxt: actualPath.join(getDataDir(), 'format.txt'),
          ranksTxt: actualPath.join(getDataDir(), 'ranks.txt'),
          store: overrideStorePath
            ? actualPath.resolve(overrideStorePath)
            : actualPath.join(getDataDir(), 'store.json'),
          badgesDir: actualPath.join(getDataDir(), 'badges'),
          configTxt: actualPath.join(getCanonicalUserDataDir(), 'config.txt'),
        }),
        ensureUserDataSeeded: () => ({ ok: true, userDataDir: getCanonicalUserDataDir(), copied: {} }),
        applyPathOverridesFromSettings,
        getPathOverrides: () => ({ dataDirectory: overrideDataDir, storePath: overrideStorePath }),
        formatTxtPath: () => actualPath.join(getDataDir(), 'format.txt'),
        ranksTxtPath: () => actualPath.join(getDataDir(), 'ranks.txt'),
        defaultsDir: () => actualPath.join(getBootstrapDataDir(), 'defaults'),
        defaultRanksTxtPath: () => actualPath.join(getBootstrapDataDir(), 'defaults', 'ranks.txt'),
        badgesDir: () => actualPath.join(getDataDir(), 'badges'),
        badgesCustomDir: () => actualPath.join(getDataDir(), 'badges', 'custom'),
        storePath: () =>
          overrideStorePath
            ? actualPath.resolve(overrideStorePath)
            : actualPath.join(getDataDir(), 'store.json'),
        windowStatePath: () => actualPath.join(getCanonicalUserDataDir(), 'window-state.json'),
        configTxtPath: () => actualPath.join(getCanonicalUserDataDir(), 'config.txt'),
        landingConfigTxtPath: () => actualPath.join(getDataDir(), 'landing-config.txt'),
        localizationDir: () => actualPath.join(getBootstrapDataDir(), 'localization'),
        validateDataDirectory: (raw) => {
          const trimmed = String(raw || '').trim();
          const resolved = trimmed ? actualPath.resolve(trimmed) : getCanonicalUserDataDir();
          if (!actualFs.existsSync(resolved)) actualFs.mkdirSync(resolved, { recursive: true });
          if (!actualFs.statSync(resolved).isDirectory()) {
            return { ok: false, message: 'data-directory-not-dir', path: resolved };
          }
          return { ok: true, path: resolved };
        },
        validateStorePath: (raw) => {
          const trimmed = String(raw || '').trim();
          const resolved = trimmed
            ? actualPath.resolve(trimmed)
            : actualPath.join(getDataDir(), 'store.json');
          const parent = actualPath.dirname(resolved);
          if (!actualFs.existsSync(parent)) actualFs.mkdirSync(parent, { recursive: true });
          return { ok: true, path: resolved };
        },
        localizedDataFile: (_f, fallback) => fallback,
      };
    });

    paths = require('../src/paths');
    config = require('../src/config');
    config.clearConfigCache();
    config.load();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('config.txt stays in canonical user data dir', () => {
    expect(paths.configTxtPath()).toBe(path.join(userData, 'config.txt'));
  });

  it('data directory override redirects getDataDir and ranks path', () => {
    const custom = path.join(tempRoot, 'custom-data');
    fs.mkdirSync(custom, { recursive: true });
    config.set('data directory', custom);
    expect(paths.getDataDir()).toBe(path.resolve(custom));
    expect(paths.ranksTxtPath()).toBe(path.join(path.resolve(custom), 'ranks.txt'));
    expect(paths.configTxtPath()).toBe(path.join(userData, 'config.txt'));
  });

  it('store path override redirects storePath only', () => {
    const customStore = path.join(tempRoot, 'elsewhere', 'my-store.json');
    fs.mkdirSync(path.dirname(customStore), { recursive: true });
    config.set('store path', customStore);
    expect(paths.storePath()).toBe(path.resolve(customStore));
    expect(paths.getDataDir()).toBe(userData);
  });
});
