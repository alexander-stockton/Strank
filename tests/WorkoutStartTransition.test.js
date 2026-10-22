/**
 * @jest-environment jsdom
 *
 * Feature 15 ? App Animations
 * Spec: features/feature-15-App-Animations.md
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Feature 15 ? workout start transition', () => {
  let tempRoot;
  let dataDir;
  let run;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strank-f15-wst-'));
    dataDir = path.join(tempRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'store.json'),
      JSON.stringify({
        schemaVersion: 1,
        entries: [
          {
            entryId: 'e1',
            exerciseId: 'push-ups',
            localDate: '2026-10-15',
            createdAt: '2026-10-15T12:00:00',
            updatedAt: '2026-10-15T12:00:00',
            metrics: { reps: 10 },
          },
        ],
      }),
      'utf8'
    );
    fs.writeFileSync(path.join(dataDir, 'config.txt'), 'logging: false\n', 'utf8');

    jest.doMock('../src/paths', () => ({
      getProjectRoot: () => tempRoot,
      getDataDir: () => dataDir,
      getUserDataDir: () => dataDir,
      storePath: () => path.join(dataDir, 'store.json'),
      configTxtPath: () => path.join(dataDir, 'config.txt'),
      landingConfigTxtPath: () => path.join(dataDir, 'landing-config.txt'),
      formatTxtPath: () => path.join(dataDir, 'format.txt'),
      ranksTxtPath: () => path.join(dataDir, 'ranks.txt'),
      windowStatePath: () => path.join(dataDir, 'window-state.json'),
    }));

    jest.spyOn(require('../src/animationFlags'), 'isEnabled').mockReturnValue(false);
    jest.spyOn(require('../src/animationFlags'), 'prefersReducedMotion').mockReturnValue(true);

    ({ run } = require('../src/workoutStartTransition'));
    document.body.innerHTML = '<div class="landing-view" data-view="landing">Landing</div>';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.dontMock('../src/paths');
  });

  it('Get Started plays transition then opens workout', (done) => {
    const handle = run({
      doc: document,
      root: document.body,
      today: '2026-10-20',
      noticeHoldMs: 30,
      onComplete: () => {
        expect(document.querySelector('[data-workout-start-overlay]')).toBeNull();
        done();
      },
    });
    expect(handle.tip).toBeTruthy();
    expect(document.querySelector('[data-workout-start-overlay]')).toBeTruthy();
    expect(document.querySelector('[data-workout-start-tip]')).toBeTruthy();
    expect(document.querySelector('[data-workout-start-band]')).toBeTruthy();
  });

  it('enabled path still calls onComplete after notice fade-out', () => {
    jest.useFakeTimers();
    jest.restoreAllMocks();
    jest.spyOn(require('../src/animationFlags'), 'isEnabled').mockReturnValue(true);
    jest.spyOn(require('../src/animationFlags'), 'prefersReducedMotion').mockReturnValue(false);
    jest.resetModules();
    ({ run } = require('../src/workoutStartTransition'));
    document.body.innerHTML = '<div class="landing-view" data-view="landing">Landing</div>';

    let completed = false;
    run({
      doc: document,
      root: document.body,
      today: '2026-10-20',
      noticeHoldMs: 100,
      onComplete: () => {
        completed = true;
      },
    });

    // warble -> fade landing -> show notice -> hold -> fade overlay -> onComplete
    jest.advanceTimersByTime(300 + 350 + 100 + 350);
    expect(completed).toBe(true);
    expect(document.querySelector('[data-workout-start-overlay]')).toBeNull();
    jest.useRealTimers();
  });

  it('splits quote attribution from trailing parentheses', () => {
    const { splitQuote, NOTICE_HOLD_MS } = require('../src/workoutStartTransition');
    expect(NOTICE_HOLD_MS).toBe(5000);
    expect(splitQuote('Sleep is rest. (Dr. Matthew Walker)')).toEqual({
      quote: 'Sleep is rest.',
      attribution: 'Dr. Matthew Walker',
    });
    expect(splitQuote('Welcome back! (me)')).toEqual({
      quote: 'Welcome back!',
      attribution: 'me',
    });
  });
});
