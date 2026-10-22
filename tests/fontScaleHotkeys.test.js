/**
 * @jest-environment jsdom
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

describe('fontScaleHotkeys', () => {
  let tempRoot;
  let dataDir;
  let config;
  let installFontScaleHotkeys;
  let fontScaleDelta;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-font-hotkey-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'font size: 16\nlanguage: en\n');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      storePath: () => path.join(dataDir, 'store.json'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
    }));

    config = require('../src/config');
    config.clearConfigCache();
    config.load();
    ({ installFontScaleHotkeys, fontScaleDelta } = require('../src/fontScaleHotkeys'));
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('maps Ctrl+= / Ctrl+- chords', () => {
    expect(fontScaleDelta({ ctrlKey: true, key: '=', code: 'Equal' })).toBe(1);
    expect(fontScaleDelta({ ctrlKey: true, key: '+', code: 'equal' })).toBe(1);
    expect(fontScaleDelta({ ctrlKey: true, key: '-', code: 'Minus' })).toBe(-1);
    expect(fontScaleDelta({ key: '=', code: 'Equal' })).toBe(0);
    expect(fontScaleDelta({ ctrlKey: true, altKey: true, key: '=', code: 'Equal' })).toBe(0);
  });

  it('nudges font size only while window is active', () => {
    const onNudge = jest.fn((delta) => {
      config.nudgeFontSize(delta);
    });
    let active = true;
    const handle = installFontScaleHotkeys(document, {
      isWindowActive: () => active,
      onNudge,
    });

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '=', code: 'Equal', ctrlKey: true, bubbles: true })
    );
    expect(onNudge).toHaveBeenCalledWith(1);
    expect(config.get()['font size']).toBe('17');

    active = false;
    onNudge.mockClear();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '=', code: 'Equal', ctrlKey: true, bubbles: true })
    );
    expect(onNudge).not.toHaveBeenCalled();
    expect(config.get()['font size']).toBe('17');

    active = true;
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '-', code: 'Minus', ctrlKey: true, bubbles: true })
    );
    expect(onNudge).toHaveBeenCalledWith(-1);
    expect(config.get()['font size']).toBe('16');

    handle.destroy();
  });
});
