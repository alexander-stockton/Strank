/**
 * Feature 19 -- Packaging & Distribution
 * Spec: features/feature-19-Packaging-Distribution.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 19 - offline setup install', () => {
  let tempRoot;
  let pkgRoot;
  let userData;
  let setupInstall;
  let paths;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-setup-'));
    pkgRoot = path.join(tempRoot, 'package');
    userData = path.join(tempRoot, 'AppData', 'Strank');
    fs.mkdirSync(path.join(pkgRoot, 'data', 'defaults'), { recursive: true });
    fs.mkdirSync(path.join(pkgRoot, 'data', 'badges'), { recursive: true });
    fs.writeFileSync(path.join(pkgRoot, 'Strank.exe'), 'fake-exe');
    fs.writeFileSync(path.join(pkgRoot, 'package.json'), '{"name":"strank"}');
    fs.writeFileSync(
      path.join(pkgRoot, 'data', 'defaults', 'format.txt'),
      'F\n',
    );
    fs.writeFileSync(
      path.join(pkgRoot, 'data', 'defaults', 'ranks.txt'),
      'R\n',
    );
    fs.writeFileSync(
      path.join(pkgRoot, 'data', 'badges', 'bronze.svg'),
      '<svg/>',
    );

    process.env.STRANK_PACKAGED = '1';
    process.env.STRANK_APPDATA = path.join(tempRoot, 'AppData');
    process.env.STRANK_LOCALAPPDATA = path.join(tempRoot, 'Local');

    jest.doMock('../src/paths', () => {
      const actual = jest.requireActual('../src/paths');
      return {
        ...actual,
        isPackaged: () => true,
        getInstallDir: () => pkgRoot,
        getInstallDataDir: () => path.join(pkgRoot, 'data'),
        getBootstrapDataDir: () => path.join(pkgRoot, 'data'),
        getCanonicalUserDataDir: () => userData,
        getDataDir: () => userData,
        getUserDataDir: () => userData,
        ensureUserDataSeeded: (opts) =>
          actual.ensureUserDataSeeded({
            userDataDir: userData,
            installDataDir: path.join(pkgRoot, 'data'),
            defaultsDir: path.join(pkgRoot, 'data', 'defaults'),
            ...opts,
          }),
      };
    });

    paths = require('../src/paths');
    setupInstall = require('../src/setupInstall');
  });

  afterEach(() => {
    delete process.env.STRANK_PACKAGED;
    delete process.env.STRANK_APPDATA;
    delete process.env.STRANK_LOCALAPPDATA;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('shows setup only until completed (packaged)', () => {
    expect(setupInstall.shouldShow()).toBe(true);
    setupInstall.markComplete({ installDir: pkgRoot });
    expect(setupInstall.shouldShow()).toBe(false);
  });

  it('copies package offline into install dir and seeds user data', () => {
    const dest = path.join(tempRoot, 'Local', 'Programs', 'Strank');
    const phases = [];
    const result = setupInstall.runInstall({
      destDir: dest,
      createShortcut: false,
      onProgress: (info) => phases.push(info.phase),
    });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(dest, 'Strank.exe'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(userData, 'format.txt'))).toBe(true);
    expect(fs.existsSync(path.join(userData, 'ranks.txt'))).toBe(true);
    expect(setupInstall.isSetupComplete()).toBe(true);
    expect(phases).toContain('copy');
    expect(phases).toContain('seed');
    expect(phases).toContain('done');
    // No network APIs used - install is filesystem-only.
    expect(result.offline !== false).toBe(true);
  });

  it('skips setup in unpackaged / dev mode', () => {
    jest.resetModules();
    process.env.STRANK_PACKAGED = '0';
    jest.doMock('../src/paths', () => {
      const actual = jest.requireActual('../src/paths');
      return { ...actual, isPackaged: () => false };
    });
    const setup = require('../src/setupInstall');
    expect(setup.shouldShow()).toBe(false);
  });

  it('shortcut icon prefers assets/icon.ico from the badge PNG', () => {
    const assets = path.join(pkgRoot, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    const ico = path.join(assets, 'icon.ico');
    fs.writeFileSync(ico, 'fake-ico');
    expect(
      setupInstall.resolveShortcutIcon(
        pkgRoot,
        path.join(pkgRoot, 'Strank.exe'),
      ),
    ).toBe(ico);
  });

  it('parentFolderLabel is the install path parent folder name', () => {
    expect(
      setupInstall.parentFolderLabel('C:/Users/test/Downloads/Strank'),
    ).toBe('Downloads');
    expect(
      setupInstall.parentFolderLabel(
        path.join('C:', 'Users', 'test', 'AppData', 'Local', 'Programs', 'Strank'),
      ),
    ).toBe('Programs');
    expect(setupInstall.parentFolderLabel('')).toBe('AppData');
  });

  it('userDataLabel is the AppData user-data path, not the install parent', () => {
    expect(setupInstall.userDataLabel()).toBe(userData);
    expect(setupInstall.userDataLabel()).not.toBe('Downloads');
  });

  it('runInstall records install + user data paths for uninstall', () => {
    const dest = path.join(tempRoot, 'CustomInstall', 'Strank');
    const result = setupInstall.runInstall({
      destDir: dest,
      createShortcut: false,
    });
    expect(result.ok).toBe(true);
    expect(result.userDataDir).toBe(userData);
    const state = setupInstall.readState();
    expect(state.installDir).toBe(path.resolve(dest));
    expect(state.userDataDir).toBe(userData);
    const locationsPath = path.join(userData, 'data-locations.json');
    expect(fs.existsSync(locationsPath)).toBe(true);
    const locations = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
    expect(locations.installDir).toBe(path.resolve(dest));
    expect(locations.canonicalUserDataDir).toBe(userData);
  });
});
