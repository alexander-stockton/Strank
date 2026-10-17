/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const networkGuard = require('../src/networkGuard');

describe('Feature 1 — App Foundation', () => {
  describe('US-1.4 — Persist Locally With No Network', () => {
    let tempRoot;
    let storage;
    let paths;

    beforeEach(() => {
      jest.resetModules();
      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-store-'));
      jest.doMock('../src/paths', () => {
        const dataDir = path.join(tempRoot, 'data');
        return {
          getProjectRoot: () => tempRoot,
          getDataDir: () => dataDir,
          formatTxtPath: () => path.join(dataDir, 'format.txt'),
          ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
          storePath: () => path.join(dataDir, 'store.json'),
        };
      });
      paths = require('../src/paths');
      storage = require('../src/storage');
      networkGuard.install();
      networkGuard.resetCount();
    });

    afterEach(() => {
      networkGuard.uninstall();
      fs.rmSync(tempRoot, { recursive: true, force: true });
      jest.resetModules();
      jest.dontMock('../src/paths');
    });

    it('First launch creates empty store', () => {
      const storeFile = paths.storePath();
      expect(fs.existsSync(storeFile)).toBe(false);

      const result = storage.ensureInitialized();
      expect(result.ok).toBe(true);
      expect(fs.existsSync(storeFile)).toBe(true);

      const read = storage.readStore();
      expect(read.ok).toBe(true);
      expect(read.data.schemaVersion).toBe(1);
      expect(read.data.entries).toEqual([]);

      networkGuard.assertOffline();
      expect(networkGuard.getOutboundAttempts()).toBe(0);
    });
  });
});
