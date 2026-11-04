/**
 * Feature 19 -- Packaging & Distribution
 * Spec: features/feature-19-Packaging-Distribution.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 19 - paths (user data seeding)', () => {
  let tempRoot;
  let installData;
  let userData;
  let paths;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f19-'));
    installData = path.join(tempRoot, 'install-data');
    userData = path.join(tempRoot, 'user-data');
    fs.mkdirSync(path.join(installData, 'defaults'), { recursive: true });
    fs.mkdirSync(path.join(installData, 'badges'), { recursive: true });
    fs.writeFileSync(path.join(installData, 'defaults', 'format.txt'), 'FORMAT_DEFAULT\n');
    fs.writeFileSync(path.join(installData, 'defaults', 'ranks.txt'), 'RANKS_DEFAULT\n');
    fs.writeFileSync(path.join(installData, 'badges', 'bronze.svg'), '<svg id="bronze"/>');
    fs.writeFileSync(path.join(installData, 'badges', 'silver.svg'), '<svg id="silver"/>');
    fs.mkdirSync(path.join(installData, 'badges', 'custom'), { recursive: true });
    fs.writeFileSync(path.join(installData, 'badges', 'custom', 'ignore-me.svg'), '<svg/>');

    process.env.STRANK_PACKAGED = '0';
    paths = require('../src/paths');
  });

  afterEach(() => {
    delete process.env.STRANK_PACKAGED;
    delete process.env.STRANK_APPDATA;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  function seedOpts(extra = {}) {
    return {
      userDataDir: userData,
      installDataDir: installData,
      defaultsDir: path.join(installData, 'defaults'),
      skipCanonicalEnsure: true,
      skipRecordLocations: true,
      ...extra,
    };
  }

  it('First launch seeds user data', () => {
    expect(fs.existsSync(userData)).toBe(false);
    const result = paths.ensureUserDataSeeded(seedOpts());
    expect(result.ok).toBe(true);
    expect(fs.existsSync(userData)).toBe(true);
    expect(fs.readFileSync(path.join(userData, 'format.txt'), 'utf8')).toBe('FORMAT_DEFAULT\n');
    expect(fs.readFileSync(path.join(userData, 'ranks.txt'), 'utf8')).toBe('RANKS_DEFAULT\n');
    expect(fs.existsSync(path.join(userData, 'badges', 'bronze.svg'))).toBe(true);
    expect(fs.existsSync(path.join(userData, 'badges', 'silver.svg'))).toBe(true);
    expect(fs.existsSync(path.join(userData, 'badges', 'custom'))).toBe(true);
    // Install custom/ fixtures are not copied into user custom/.
    expect(fs.existsSync(path.join(userData, 'badges', 'custom', 'ignore-me.svg'))).toBe(false);
    expect(result.copied.format).toBe(true);
    expect(result.copied.ranks).toBe(true);
    expect(result.copied.badges).toBeGreaterThanOrEqual(2);
  });

  it('Second launch keeps user edits', () => {
    paths.ensureUserDataSeeded(seedOpts());
    fs.writeFileSync(path.join(userData, 'ranks.txt'), 'USER_EDITED_RANKS\n', 'utf8');
    fs.writeFileSync(path.join(userData, 'format.txt'), 'USER_EDITED_FORMAT\n', 'utf8');
    fs.writeFileSync(path.join(userData, 'badges', 'bronze.svg'), '<svg id="user-bronze"/>', 'utf8');

    const result = paths.ensureUserDataSeeded(seedOpts());
    expect(result.ok).toBe(true);
    expect(result.copied.format).toBe(false);
    expect(result.copied.ranks).toBe(false);
    expect(fs.readFileSync(path.join(userData, 'ranks.txt'), 'utf8')).toBe('USER_EDITED_RANKS\n');
    expect(fs.readFileSync(path.join(userData, 'format.txt'), 'utf8')).toBe('USER_EDITED_FORMAT\n');
    expect(fs.readFileSync(path.join(userData, 'badges', 'bronze.svg'), 'utf8')).toBe(
      '<svg id="user-bronze"/>'
    );
  });

  it('Store lives in user data', () => {
    process.env.STRANK_PACKAGED = '1';
    process.env.STRANK_APPDATA = path.join(tempRoot, 'AppData');
    jest.resetModules();
    paths = require('../src/paths');

    expect(paths.isPackaged()).toBe(true);
    const ud = paths.getUserDataDir();
    expect(ud).toBe(path.join(tempRoot, 'AppData', 'Strank'));
    expect(paths.storePath()).toBe(path.join(ud, 'store.json'));
    expect(paths.getDataDir()).toBe(ud);
    expect(paths.configTxtPath()).toBe(path.join(ud, 'config.txt'));

    const defs = paths.getDefinitionPaths();
    expect(defs.store).toBe(paths.storePath());
    expect(defs.userDataDir).toBe(ud);
    // Install templates are not the store location.
    expect(paths.storePath().startsWith(paths.getInstallDataDir())).toBe(false);
  });

  it('re-copies missing ranks.txt without wiping other user files', () => {
    paths.ensureUserDataSeeded(seedOpts());
    fs.writeFileSync(path.join(userData, 'store.json'), '{"schemaVersion":1,"entries":[1]}', 'utf8');
    fs.unlinkSync(path.join(userData, 'ranks.txt'));

    paths.ensureUserDataSeeded(seedOpts());
    expect(fs.readFileSync(path.join(userData, 'ranks.txt'), 'utf8')).toBe('RANKS_DEFAULT\n');
    expect(fs.readFileSync(path.join(userData, 'store.json'), 'utf8')).toContain('"entries":[1]');
  });

  it('custom data directory relocates the user home off AppData', () => {
    process.env.STRANK_PACKAGED = '1';
    process.env.STRANK_APPDATA = path.join(tempRoot, 'AppData');
    process.env.STRANK_INSTALL_DIR = tempRoot;
    jest.resetModules();
    paths = require('../src/paths');

    const defaultHome = paths.getDefaultUserDataDir();
    const custom = path.join(tempRoot, 'custom-userdata');
    fs.mkdirSync(defaultHome, { recursive: true });
    fs.writeFileSync(
      path.join(defaultHome, 'config.txt'),
      'language: en\ndata directory: \nstore path: \n',
      'utf8',
    );

    const relocated = paths.relocateUserDataRoot(custom, {
      migrateFrom: defaultHome,
    });
    expect(relocated.ok).toBe(true);
    expect(paths.getCanonicalUserDataDir()).toBe(path.resolve(custom));
    expect(paths.getDataDir()).toBe(path.resolve(custom));
    expect(paths.configTxtPath()).toBe(path.join(path.resolve(custom), 'config.txt'));
    expect(paths.ranksTxtPath()).toBe(path.join(path.resolve(custom), 'ranks.txt'));
    expect(paths.ranksTxtPath().includes(`${path.sep}localization${path.sep}`)).toBe(
      false,
    );

    const seeded = paths.ensureUserDataSeeded({
      installDataDir: installData,
      defaultsDir: path.join(installData, 'defaults'),
    });
    expect(seeded.ok).toBe(true);
    expect(fs.existsSync(path.join(custom, 'ranks.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(custom, 'ranks.txt'), 'utf8')).toBe(
      'RANKS_DEFAULT\n',
    );

    const locations = paths.readDataLocations();
    expect(locations).toBeTruthy();
    expect(locations.dataDirectory).toBe(path.resolve(custom));
    expect(locations.canonicalUserDataDir).toBe(path.resolve(custom));
    expect(paths.readInstallUserDataRoot()).toBe(path.resolve(custom));
    delete process.env.STRANK_INSTALL_DIR;
  });
});
