/**
 * Feature 14 - Landing Layout & Day Focus
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 14 - Day Focus', () => {
  let tempRoot;
  let dataDir;
  let dayFocus;
  let landingConfig;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f14-day-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    landingConfig = require('../src/landingConfig');
    dayFocus = require('../src/dayFocus');
    landingConfig.clearLandingConfigCache();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  describe('US-14.2 - Customize Weekday Muscle Focus', () => {
    it('Defaults match the specified split', () => {
      // Fresh default config (file missing -> writeDefaultsFile)
      const loaded = landingConfig.load();
      expect(loaded.ok).toBe(true);

      const schedule = dayFocus.getSchedule();
      expect(schedule.arms).toEqual(['mon', 'thu']);
      expect(schedule.core).toEqual(['tue', 'fri']);
      expect(schedule.lungs).toEqual(['mon', 'wed', 'fri']);
      expect(schedule.legs).toEqual(['wed', 'sat']);

      // Monday -> Arms + Lungs
      expect(dayFocus.groupsForDate('2026-10-12').sort()).toEqual(['arms', 'lungs']);
      // Tuesday -> Core
      expect(dayFocus.groupsForDate('2026-10-13')).toEqual(['core']);
      // Sunday -> none
      expect(dayFocus.groupsForDate('2026-10-18')).toEqual([]);
    });
  });
});
