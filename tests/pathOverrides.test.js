/**
 * Custom data directory relocates the entire user-data home.
 * Install-dir pointer keeps AppData optional after the move.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('path overrides / user-data home relocate', () => {
  let tempRoot;
  let installDir;
  let appData;
  let paths;
  let config;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-home-'));
    installDir = path.join(tempRoot, 'install');
    appData = path.join(tempRoot, 'AppData');
    fs.mkdirSync(path.join(installDir, 'data', 'defaults'), { recursive: true });
    fs.mkdirSync(path.join(installDir, 'data', 'badges'), { recursive: true });
    fs.writeFileSync(path.join(installDir, 'data', 'defaults', 'format.txt'), 'FORMAT\n');
    fs.writeFileSync(path.join(installDir, 'data', 'defaults', 'ranks.txt'), 'RANKS\n');
    fs.writeFileSync(path.join(installDir, 'package.json'), '{"name":"strank"}');

    process.env.STRANK_PACKAGED = '1';
    process.env.STRANK_APPDATA = appData;
    process.env.STRANK_INSTALL_DIR = installDir;

    paths = require('../src/paths');
    config = require('../src/config');
    config.clearConfigCache();
  });

  afterEach(() => {
    delete process.env.STRANK_PACKAGED;
    delete process.env.STRANK_APPDATA;
    delete process.env.STRANK_INSTALL_DIR;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  it('defaults to AppData when no install pointer exists', () => {
    const home = paths.getCanonicalUserDataDir();
    expect(home).toBe(path.join(appData, 'Strank'));
    expect(paths.configTxtPath()).toBe(path.join(home, 'config.txt'));
  });

  it('relocating data directory moves config home and writes install pointer', () => {
    const defaultHome = paths.getDefaultUserDataDir();
    fs.mkdirSync(defaultHome, { recursive: true });
    fs.writeFileSync(
      path.join(defaultHome, 'config.txt'),
      'language: en\nonboarding completed: true\ndata directory: \nstore path: \n',
      'utf8',
    );
    fs.writeFileSync(path.join(defaultHome, 'ranks.txt'), 'CUSTOM_RANKS\n', 'utf8');
    fs.writeFileSync(
      path.join(defaultHome, 'store.json'),
      '{"schemaVersion":1,"entries":[1]}',
      'utf8',
    );

    config.clearConfigCache();
    config.load();

    const custom = path.join(tempRoot, 'MyStrankData');
    const result = paths.relocateUserDataRoot(custom, { migrateFrom: defaultHome });
    expect(result.ok).toBe(true);
    expect(paths.readInstallUserDataRoot()).toBe(path.resolve(custom));
    expect(paths.getCanonicalUserDataDir()).toBe(path.resolve(custom));
    expect(paths.configTxtPath()).toBe(path.join(path.resolve(custom), 'config.txt'));
    expect(paths.ranksTxtPath()).toBe(path.join(path.resolve(custom), 'ranks.txt'));
    expect(fs.readFileSync(path.join(custom, 'ranks.txt'), 'utf8')).toBe('CUSTOM_RANKS\n');
    expect(fs.readFileSync(path.join(custom, 'store.json'), 'utf8')).toContain('"entries":[1]');
    expect(fs.existsSync(path.join(installDir, 'strank-user-data-root.txt'))).toBe(true);
  });

  it('survives deleting AppData after relocate (factory reset must not happen)', () => {
    const defaultHome = paths.getDefaultUserDataDir();
    fs.mkdirSync(defaultHome, { recursive: true });
    fs.writeFileSync(
      path.join(defaultHome, 'config.txt'),
      'language: en\nonboarding completed: true\ndata directory: \n',
      'utf8',
    );
    fs.writeFileSync(path.join(defaultHome, 'ranks.txt'), 'KEEP_ME\n', 'utf8');

    const custom = path.join(tempRoot, 'portable-data');
    paths.relocateUserDataRoot(custom, { migrateFrom: defaultHome });
    expect(fs.readFileSync(path.join(custom, 'ranks.txt'), 'utf8')).toBe('KEEP_ME\n');

    // User deletes AppData entirely.
    fs.rmSync(appData, { recursive: true, force: true });
    expect(fs.existsSync(defaultHome)).toBe(false);

    jest.resetModules();
    process.env.STRANK_PACKAGED = '1';
    process.env.STRANK_APPDATA = appData;
    process.env.STRANK_INSTALL_DIR = installDir;

    const paths2 = require('../src/paths');
    const config2 = require('../src/config');
    config2.clearConfigCache();
    config2.load();
    paths2.ensureUserDataSeeded({ language: 'en' });

    expect(paths2.getCanonicalUserDataDir()).toBe(path.resolve(custom));
    expect(paths2.ranksTxtPath()).toBe(path.join(path.resolve(custom), 'ranks.txt'));
    expect(fs.readFileSync(paths2.ranksTxtPath(), 'utf8')).toBe('KEEP_ME\n');
    expect(config2.get()['onboarding completed']).toBe(true);
    expect(fs.existsSync(path.join(custom, 'ranks.txt'))).toBe(true);
  });

  it('config data directory setting promotes legacy AppData override into a relocate', () => {
    const defaultHome = paths.getDefaultUserDataDir();
    const custom = path.join(tempRoot, 'legacy-custom');
    fs.mkdirSync(custom, { recursive: true });
    fs.writeFileSync(path.join(custom, 'ranks.txt'), 'LEGACY\n', 'utf8');
    fs.mkdirSync(defaultHome, { recursive: true });
    fs.writeFileSync(
      path.join(defaultHome, 'config.txt'),
      `language: en\nonboarding completed: true\ndata directory: ${custom}\nstore path: \n`,
      'utf8',
    );

    config.clearConfigCache();
    config.load();

    expect(paths.readInstallUserDataRoot()).toBe(path.resolve(custom));
    expect(paths.getCanonicalUserDataDir()).toBe(path.resolve(custom));
    expect(paths.configTxtPath()).toBe(path.join(path.resolve(custom), 'config.txt'));
    expect(config.get()['data directory']).toBe('');
    expect(fs.readFileSync(path.join(custom, 'ranks.txt'), 'utf8')).toBe('LEGACY\n');
  });

  it('store path override redirects storePath only', () => {
    const defaultHome = paths.getDefaultUserDataDir();
    fs.mkdirSync(defaultHome, { recursive: true });
    fs.writeFileSync(
      path.join(defaultHome, 'config.txt'),
      'language: en\ndata directory: \nstore path: \n',
      'utf8',
    );
    config.clearConfigCache();
    config.load();

    const customStore = path.join(tempRoot, 'elsewhere', 'my-store.json');
    fs.mkdirSync(path.dirname(customStore), { recursive: true });
    config.set('store path', customStore);
    expect(paths.storePath()).toBe(path.resolve(customStore));
    expect(paths.getDataDir()).toBe(defaultHome);
  });
});
