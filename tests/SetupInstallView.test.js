/**
 * @jest-environment jsdom
 *
 * Feature 19 - Packaging & Distribution (installer UI)
 */

describe('setupInstallView user-data note', () => {
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

  it('shows the canonical user-data path, not the install parent folder', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    mountSetupInstallView(root, { document });

    const pathInput = root.querySelector('[data-setup-path]');
    const label = root.querySelector('[data-setup-user-data-label]');
    expect(pathInput).toBeTruthy();
    expect(label).toBeTruthy();

    expect(label.textContent).toBe(setupInstall.userDataLabel());
    expect(label.textContent).not.toBe('Downloads');

    pathInput.value = 'C:\\Users\\test\\Downloads\\Strank';
    pathInput.dispatchEvent(new Event('input', { bubbles: true }));
    // Install path changes must not rewrite the user-data note to the parent folder.
    expect(label.textContent).toBe(setupInstall.userDataLabel());
  });
});
