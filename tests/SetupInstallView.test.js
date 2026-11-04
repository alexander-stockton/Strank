/**
 * @jest-environment jsdom
 *
 * Feature 19 - Packaging & Distribution (installer UI)
 */

const path = require('path');

describe('setupInstallView parent label', () => {
  let mountSetupInstallView;
  let setupInstall;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../src/fileDialog', () => ({
      pickDirectory: async () => null,
    }));
    setupInstall = require('../src/setupInstall');
    ({ mountSetupInstallView } = require('../src/setupInstallView'));
  });

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../src/fileDialog');
  });

  it('updates the note parent folder when the install path changes', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountSetupInstallView(root, { document });

    const pathInput = root.querySelector('[data-setup-path]');
    const label = root.querySelector('[data-setup-parent-label]');
    expect(pathInput).toBeTruthy();
    expect(label).toBeTruthy();

    expect(label.textContent).toBe(
      setupInstall.parentFolderLabel(setupInstall.defaultInstallDir()),
    );

    pathInput.value = path.join(
      'C:',
      'Users',
      'test',
      'Downloads',
      'Strank',
    );
    pathInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(label.textContent).toBe('Downloads');
  });
});
