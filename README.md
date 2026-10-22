# Strank

Local NW.js desktop app for ranked exercise tracking. Feature specs live under `features/` when present in your working tree.

## Table of contents

1. [Contributing](#contributing)
2. [Architecture and file structure](#architecture-and-file-structure)
3. [File reference](#file-reference)
4. [Derivative licensing](#derivative-licensing)
5. [Cloning and building](#cloning-and-building)
6. [Plugins and forking](#plugins-and-forking)

## Contributing

Want to help? Open an issue on [GitHub](https://github.com/alexander-stockton/Strank), email the designer at `colo.anon.net@keemail.me`, or fork the repo to share plugins with others. The shipping app stays offline, so copy contacts out of the in-app Contributing screen into your own browser or mail client. Translations are AI-generated; if one is wrong, an issue with a corrected string is welcome. See also the root `AI use` file and the Discord link at the bottom of that notice.

## Architecture and file structure

Strank is an **NW.js** app: Chromium for UI, Node for filesystem and packaging helpers.

```text
boot:  package.json (main -> index.html, node-main -> src/node-main.js)
         -> networkGuard + windowState
         -> index.html loads src/ui.js -> app shell, routing, views

data:  install templates in data/ (+ data/defaults, data/badges, data/localization)
       writable user data in .strank-user-data/ (dev) or %APPDATA%\Strank\ (packaged)
       path resolution and first-run seed: src/paths.js

pack:  npm run dist -> scripts/dist-win.js -> dist/Strank-win-x64/ (NW runtime + package.nw)
```

High-level layout:

| Path             | Role                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| `index.html`     | Window document; CSP; boots `ui.js`                                          |
| `src/`           | Application modules (views, domain logic, offline/packaging)                 |
| `src/parse/`     | Small parsers for indent, metrics, duration tokens                           |
| `data/`          | Bundled templates and localization; not the live user store in packaged mode |
| `assets/`        | App icon (PNG source; ICO generated for Windows exe/shortcut)                |
| `scripts/`       | Windows packaging and locale maintenance helpers                             |
| `tests/`         | Jest suites (jsdom or node) aligned to feature behavior                      |
| `docs/`          | Maintainer docs (e.g. packaging)                                             |
| `features/`      | Feature specification markdown (may be absent in some checkouts)             |
| `README.user.md` | End-user readme; copied into the Windows dist as `README.md`                 |
| `AI use`         | Human/AI credit notice (English source; also localized for the UI)           |
| `LICENSE`        | GNU GPL v3                                                                   |

Routing and chrome live mainly in `src/ui.js` and `src/appShell.js`. Domain files (`catalog`, `dailyLog`, `ranks`, `ranking`, `workout`, ...) stay UI-agnostic where practical; `*View.js` modules render and bind DOM.

## File reference

One-line notes. Localization packs under `data/localization/[tag]/` follow the same filename patterns in every language; tests under `tests/` mirror features rather than listing every `*.test.js` here.

### Repository root

| File                | Summary                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| `README.md`         | This developer-oriented document (not shipped inside the Windows package).            |
| `README.user.md`    | End-user welcome/customize/offline guide; becomes `README.md` in `dist/`.             |
| `AI use`            | English credit notice for AI vs human authorship; packaged and shown in Contributing. |
| `LICENSE`           | Full GNU General Public License version 3 text.                                       |
| `index.html`        | NW window entry HTML, offline CSP, and UI bootstrap script tag.                       |
| `package.json`      | NW manifest, scripts (`start`, `dist`, `test`), and Chromium offline args.            |
| `package-lock.json` | Locked npm dependency tree for reproducible installs.                                 |
| `.gitignore`        | Ignores `node_modules/`, `dist/`, user data, and similar local artifacts.             |

### `assets/`

| File       | Summary                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `icon.png` | Source app badge (window/taskbar and ICO generation input).             |
| `icon.ico` | Windows Explorer/shortcut icon regenerated from `icon.png` during dist. |

### `docs/`

| File           | Summary                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| `packaging.md` | How develop vs `npm run dist`, user-data paths, and offline enforcement layers work. |

### `scripts/`

| File                     | Summary                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `dist-win.js`            | Stages a slim app tree, runs nw-builder, stamps offline args/icon, emits `Strank.exe`. |
| `build-uninstall.js`     | Compiles `uninstall/Uninstall.cs` into `uninstall.exe` with the Unranked badge icon. |
| `uninstall/Uninstall.cs` | Console uninstaller source (options: all traces / keep user data / cancel). |
| `sync-ai-use-locales.js` | Writes translated `contributing.aiUseBody` strings into non-English UI locale files.   |

### `data/` (bundled templates)

| Path                                | Summary                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `format.txt`                        | Default exercise/metric catalog template seeded into user data when missing.          |
| `ranks.txt`                         | Default rank definitions template seeded into user data when missing.                 |
| `config.txt` / `landing-config.txt` | Example or leftover config samples in-repo; live config is under user data after run. |
| `defaults/`                         | Canonical seed copies (format, ranks, config-shaped defaults) for first-run copy.     |
| `badges/`                           | Default rank badge artwork (plus room for custom badges under user data).             |
| `localization/[tag]/`               | Per-language `language.txt`, `ui-*.txt`, and optional localized format/ranks.         |

### `src/`

| File                                                                                                | Summary                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `node-main.js`                                                                                      | NW Node entry: installs the network guard and attaches window-state lifecycle early. |
| `chromiumOfflineArgs.js`                                                                            | Canonical Chromium/NW offline command-line switches stamped into packaged manifests. |
| `networkGuard.js`                                                                                   | Blocks Node/browser outbound APIs used by app code.                                  |
| `paths.js`                                                                                          | Install vs user-data roots, localization paths, and copy-on-first-run seeding.       |
| `app.js`                                                                                            | Core app wiring, storage/catalog bootstrap, and shared exports for the shell.        |
| `ui.js`                                                                                             | Hash routing, view mounts, language refresh, tour hooks, and chrome coordination.    |
| `appShell.js`                                                                                       | Shared icon-tab navbar markup for left/top layouts.                                  |
| `styles.css`                                                                                        | Global application stylesheet and theme variables consumption.                       |
| `storage.js`                                                                                        | Read/write helpers around `store.json` and related persistence.                      |
| `config.js`                                                                                         | Parse/update `config.txt`, theme application, and accessibility-related flags.       |
| `configView.js`                                                                                     | Config screen UI and path pickers.                                                   |
| `landingConfig.js`                                                                                  | Landing/day-focus settings file separate from global config.                         |
| `landing.js` / `landingView.js`                                                                     | Landing page model and UI.                                                           |
| `dayFocus.js`                                                                                       | Weekday focus schedule logic for landing.                                            |
| `skillProgress.js`                                                                                  | Skill-progress presentation used on landing.                                         |
| `catalog.js`                                                                                        | Loads and exposes the exercise catalog from format definitions.                      |
| `ranks.js`                                                                                          | Loads/parses rank definition files.                                                  |
| `rankTokens.js`                                                                                     | Maps localized header labels back to English parser tokens.                          |
| `ranking.js` / `rankView.js`                                                                        | Weekly ranking computation and rank results UI.                                      |
| `ranksGallery.js` / `ranksGalleryView.js`                                                           | Ranks gallery browsing UI and helpers.                                               |
| `rankBadge.js`                                                                                      | Shared badge image rendering for ranks.                                              |
| `rankDifficulty.js`                                                                                 | Difficulty scoring and auto-sort support for custom ranks.                           |
| `rankManager.js` / `rankManagerView.js`                                                             | Rank list CRUD, serialization, and manager UI.                                       |
| `rankEditor.js` / `rankEditorView.js` / `rankFormView.js`                                           | Rank editor surface and structured create/edit form.                                 |
| `dailyLog.js` / `todayView.js`                                                                      | Daily log model and today’s exercise UI.                                             |
| `appDate.js`                                                                                        | Local-date helpers for logs and workouts.                                            |
| `history.js` / `historyView.js`                                                                     | Exercise history queries and list UI.                                                |
| `historyCalendar.js` / `historyCalendarView.js` / `historyDayView.js`                               | Calendar history navigation and day detail.                                          |
| `workout.js` / `activeWorkoutView.js`                                                               | Active workout session state and UI.                                                 |
| `workoutTimer.js`                                                                                   | Elapsed workout timer (including persisted completed totals).                        |
| `workoutStartTips.js` / `workoutStartTransition.js`                                                 | Pre-workout tips and Get Started handoff animation.                                  |
| `travelPace.js`                                                                                     | Walking/travel judgment when distance and duration are both present.                 |
| `unitConversion.js`                                                                                 | Distance/weight conversion and convert-on-change behavior.                           |
| `i18n.js`                                                                                           | Language discovery, `ui-*.txt` loading, and `t()` / plural helpers.                  |
| `backup.js`                                                                                         | Backup/export helpers tied to config and defaults.                                   |
| `fileDialog.js`                                                                                     | Native NW/Chromium file pickers for config paths and imports.                        |
| `windowState.js`                                                                                    | Persist and restore window position/size across launches.                            |
| `onboarding.js` / `onboardingView.js`                                                               | First-run onboarding and Privacy Notice UI.                                          |
| `contributingView.js`                                                                               | Contributing + AI use notice screen.                                                 |
| `githubFab.js`                                                                                      | Persistent bottom-right control that opens Contributing.                             |
| `navbarUtilities.js`                                                                                | Navbar utilities (Day Focus, Edit Ranks, Privacy, and related).                      |
| `setupInstall.js` / `setupInstallView.js`                                                           | Offline first-run install copy, shortcut, and setup UI.                              |
| `tourCatalog.js` / `tourProgress.js` / `tourRuntime.js`                                             | Guided tour steps, persistence, and runtime.                                         |
| `animationFlags.js`                                                                                 | Gates animations from config and reduced-motion preferences.                         |
| `clickRipple.js` / `contentReveal.js` / `controlMotion.js` / `flyoutFade.js` / `viewTransitions.js` | Feature 15 motion helpers (ripple, reveal, controls, flyouts, view slides).          |
| `fontScaleHotkeys.js`                                                                               | Ctrl+= / Ctrl+- font-size adjustments while the window is focused.                   |
| `exerciseHelp.js`                                                                                   | Shared exercise notes/help control from format/ranks `{...}` notes.                  |

### `src/parse/`

| File          | Summary                                                           |
| ------------- | ----------------------------------------------------------------- |
| `indent.js`   | Indentation-aware parsing for hierarchical plaintext definitions. |
| `metrics.js`  | Metric token parsing for catalog/rank lines.                      |
| `duration.js` | Duration token parsing/formatting helpers.                        |

### Other trees

| Path                       | Summary                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `tests/*.test.js`          | Automated checks for parsers, views, packaging, offline setup, and i18n.  |
| `tests/packaging.smoke.md` | Manual smoke checklist notes for packaged builds.                         |
| `features/feature-*.md`    | Per-feature requirements and acceptance notes used during implementation. |
| `node_modules/`            | npm dependencies (including `nw` / `nw-builder` for develop and dist).    |
| `dist/`                    | Build output (`Strank-win-x64/`); gitignored.                             |
| `.strank-user-data/`       | Dev-mode writable user data; gitignored.                                  |

## Derivative licensing

Strank is released under the **GNU General Public License v3** (`LICENSE`). If you distribute a modified version (including a packaged fork or a plugin distributed as a derivative work of this codebase), you must keep the work under GPLv3 terms: provide corresponding source, preserve license and copyright notices, and do not impose extra restrictions that conflict with the GPL. Third-party runtimes bundled at build time (NW.js/Chromium and their credits) remain under their own licenses-see `credits.html` beside `Strank.exe` in a built tree. Your own ranks, badges, and plaintext content that you author remain yours to license separately unless they embed substantial GPL-covered code.

## Cloning and building

```bash
git clone https://github.com/alexander-stockton/Strank.git
cd Strank
npm install
npm start          # develop against the repo (NW SDK); no setup UI
npm test           # Jest
npm run dist       # Windows x64 folder -> dist/Strank-win-x64/Strank.exe
```

- **Dev user data:** `.strank-user-data/` at the project root (seeded from `data/` defaults on first run).
- **Packaged user data:** `%APPDATA%\Strank\`.
- **Dist readme:** `README.user.md` is copied into the package as `README.md`; this developer `README.md` is not included.
- Quit any running `Strank.exe` before rebuilding so Windows can overwrite `package.nw`.

Details: [docs/packaging.md](docs/packaging.md).

## Plugins and forking

There is no remote plugin marketplace-the app never phones home. Practical extension paths:

1. **Plaintext / asset packs** - Ship alternate `ranks.txt`, `format.txt`, badge SVGs, or `data/localization/[tag]/` folders for users to drop into their data directory (or merge into a fork’s `data/defaults`).
2. **Fork the repo** - Change views, ranking rules, or packaging; keep GPLv3 obligations if you redistribute binaries or modified source.
3. **Share via the community** - Point people at your fork or pack from GitHub/Discord; users copy files locally because Strank will not download them.

When in doubt, prefer additive data files over patching minified runtime output, and test with `npm start` before `npm run dist`.
