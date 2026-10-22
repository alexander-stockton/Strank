/**
 * Feature 19 — uninstall.exe build (Unranked icon + console uninstaller source).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 19 - uninstall.exe', () => {
  const root = path.resolve(__dirname, '..');

  it('ships Uninstall.cs and Unranked badge source', () => {
    expect(fs.existsSync(path.join(root, 'scripts', 'uninstall', 'Uninstall.cs'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'data', 'badges', 'unranked.svg'))).toBe(true);
    const cs = fs.readFileSync(path.join(root, 'scripts', 'uninstall', 'Uninstall.cs'), 'utf8');
    expect(cs).toMatch(/Press 1 and hit Enter to remove all traces of Strank/);
    expect(cs).toMatch(/Press 2 and hit Enter to remove the Strank data but keep your own user data/);
    expect(cs).toMatch(/Press 3 and hit Enter to cancel\/quit/);
  });

  it('builds uninstall.exe with Unranked icon on Windows', () => {
    if (process.platform !== 'win32') return;
    const { buildUninstallExe, findCsc } = require('../scripts/build-uninstall');
    if (!findCsc()) {
      console.warn('skip: csc.exe not available');
      return;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-uninstall-'));
    try {
      const out = path.join(dir, 'uninstall.exe');
      buildUninstallExe(out);
      expect(fs.existsSync(out)).toBe(true);
      expect(fs.statSync(out).size).toBeGreaterThan(1024);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
