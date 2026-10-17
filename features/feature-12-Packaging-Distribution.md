# Feature: Packaging & Distribution

**Feature ID:** 12  
**Branch pattern:** `feature/12-Packaging-Distribution`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** The app MUST be shippable as a local desktop executable (Windows first): double-click launch, no separate Node/NW.js install for end users, bundled default data, and a writable user data directory for history/settings/edited definition files.  
**Depends on:** Feature 1 NW.js app shell and path helpers; Features 5–11 assume packaged paths still work  
**Related:** `features/feature-1-App-Foundation.md`, `features/feature-11-Config-Accessibility-Backup.md`, `features/README.md`

---

## User Stories

### US-12.1: Build A Windows Executable Package

**As a** developer  
**I want** a documented build that produces a Windows distributable with an `.exe` entry point  
**So that** Strank can be run without the NW.js SDK CLI

**Priority:** P1  
**Independent test:** Running the project’s package script outputs a folder containing a launchable `Strank.exe` (or equivalently named exe) plus app assets; launching it opens the Landing window.  
**Acceptance scenarios:** see ### US-12.1 under Acceptance Criteria

### US-12.2: Launch Without Dev Tooling

**As an** end user on Windows  
**I want** to double-click the packaged app  
**So that** I get a single desktop window without installing Node or opening a browser myself

**Priority:** P1  
**Independent test:** On a machine/path without global `nw`/`node` on PATH (or with PATH cleared for the test), starting the packaged exe still opens the app.  
**Acceptance scenarios:** see ### US-12.2 under Acceptance Criteria

### US-12.3: Bundle Defaults And Isolate User Data

**As a** local user  
**I want** default `format.txt`, `ranks.txt`, and `badges/` shipped with the app, while my edits and history live in a writable user folder  
**So that** installs can be read-only and Config → Edit files still works

**Priority:** P1  
**Independent test:** Fresh package launch copies missing defaults into the user data dir; subsequent edits to ranks/format happen there; reinstall does not wipe user history unless the user deletes the data dir.  
**Acceptance scenarios:** see ### US-12.3 under Acceptance Criteria

### US-12.4: Dev Mode Remains Available

**As a** developer  
**I want** to keep running the app via NW.js in development  
**So that** packaging is not required for day-to-day feature work

**Priority:** P2  
**Independent test:** `npm start` (or documented equivalent) still launches the unpackaged app against the repo; package build is a separate script.  
**Acceptance scenarios:** see ### US-12.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: The project MUST provide an npm (or equivalent) script, e.g. `npm run dist`, that builds a **Windows x64** distributable using NW.js packaging (e.g. `nw-builder` / official NW package workflow). Exact tool is an implementation choice; the artifact contract below is mandatory.
- **FR-002**: The distributable MUST include a double-clickable executable named **`Strank.exe`** (rename/wrapper of the NW runtime entry is fine).
- **FR-003**: End users MUST NOT need a preinstalled Node.js or NW.js SDK to run the packaged app.
- **FR-004**: The package MUST embed the app entry defined in `package.json` for NW.js (`main` HTML/JS, window title **Strank**, sensible default width/height). Dev and packaged builds share the same entry.
- **FR-005**: The package MUST bundle **default** assets:
  - `format.txt`
  - `ranks.txt`
  - default files under `badges/` (including family defaults; `badges/custom/` may be empty)
  - application JS/CSS/HTML and other runtime files required to start
- **FR-006**: At first launch (packaged or otherwise), the app MUST ensure a **user data directory** exists and is writable. Preferred location on Windows: under the OS app-data area, e.g. `%APPDATA%\Strank\` (or NW.js `dataPath` / equivalent). Implementation MUST expose helpers: `getInstallDir()`, `getUserDataDir()`, `getDefinitionPaths()`.
- **FR-007**: **Copy-on-first-run:** If the user data dir is missing `format.txt`, `ranks.txt`, or default badge files needed to run, copy them from the bundled install defaults into the user data dir. Do **not** overwrite existing user copies on later launches.
- **FR-008**: Features 2–11 file I/O for history, settings, edited `format.txt` / `ranks.txt`, custom badges, and backups MUST target the **user data directory**, not the install directory (install may be read-only).
- **FR-009**: Feature 11 **Edit format.txt** / **Edit ranks.txt** MUST open the **user data** copies. Export ZIP MUST read from user data (and include `badges/` as already specified).
- **FR-010**: Packaged app remains **offline** (Feature 1): no network required to launch or use core features. Packaging tooling may download NW runtimes **at build time only** on the developer machine.
- **FR-011**: Document in repo README (or `docs/packaging.md`): how to `npm start` (dev) and `npm run dist` (package), where the exe lands, and where user data lives.
- **FR-012**: Optional P2: zip the dist folder as `Strank-win-x64.zip` for GitHub Releases. Full installers (NSIS/Squirrel), code signing, Mac/Linux builds are **out of scope** for this feature unless added later.
- **FR-013**: The packaged process is a **single primary desktop window** for the user session (NW may spawn helper processes internally; that is allowed). It is not a Windows Service and not a tray-only agent unless Config notifications need a background helper (notifications still run in-process when possible).

---

## Assumptions

- Product name for the executable and window: **Strank** (matches the GitHub repo).
- Primary target OS for v1 packaging: **Windows 10/11 x64**.
- Feature 1 already defines NW.js as the runtime; this feature only makes distribution explicit.
- “Compilable” here means **packaged runnable executable**, not ahead-of-time compile of JS to machine code.

---

## Edge Cases

- User deletes user-data `ranks.txt` but leaves history → on next launch, re-copy default `ranks.txt` only if missing; do not wipe `store.json`.
- Running from a read-only Program Files install → user data still writable under `%APPDATA%`.
- Dev mode uses repo `data/` or user data consistently — pick one rule and document it: **preferred:** even in dev, use a project-local `.strank-user-data/` or `data/user/` so tests stay hermetic; packaged builds use `%APPDATA%\Strank\`.
- Antivirus false positives on unsigned NW exes → document that code signing is out of scope for Feature 12.

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated or documented manual verification before merge (package smoke may be manual CI-optional).
- **SC-002**: `npm run dist` produces `Strank.exe` in a known output directory.
- **SC-003**: Launching that exe opens Landing without Node/NW on PATH.
- **SC-004**: First launch populates user data with defaults; second launch does not overwrite edited definition files.
- **SC-005**: Config edit paths and storage resolve under the user data dir in packaged mode.
- **SC-006**: README/docs describe dist + user data locations.

---

## Data Ownership & Isolation

| Rule | Requirement |
| ---- | ----------- |
| **Install dir** | Read-mostly bundled app + default templates |
| **User data dir** | Writable: `store.json`, `config.txt` (Feature 11 `option name: value`), working `format.txt` / `ranks.txt`, `badges/custom/`, backups output chosen by user |
| **Who packages** | Developer machine at build time |
| **Who runs** | End user via `Strank.exe` |

Feature 12 owns packaging scripts, path resolution for install vs user data, and first-run seeding. It does not own product screens.

---

## Key Entities

- **InstallLayout:** Packaged folder containing `Strank.exe` + bundled resources.
- **UserDataLayout:** Writable directory with store + definition copies + custom badges.
- **PathResolver:** Module returning absolute paths for catalog/ranks/store/badges based on packaged vs dev.

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `paths` | `isPackaged()` | Detect packaged vs `nw .` / repo run |
| `paths` | `getInstallDir()` | Bundled resources root |
| `paths` | `getUserDataDir()` | Writable root |
| `paths` | `ensureUserDataSeeded()` | Copy-on-first-run defaults |
| `paths` | `formatTxtPath()` / `ranksTxtPath()` / `storePath()` / `badgesDir()` | Canonical paths for Features 1–11 |

**Dist artifact (minimum):**

```text
dist/Strank-win-x64/
  Strank.exe
  (NW runtime files as required by the packager)
  package.json / app files / …
  defaults/   # or equivalent embedded paths for format.txt, ranks.txt, badges/
```

Exact inner layout may follow the packager; tests assert exe launch + seeded user data, not a frozen folder tree beyond `Strank.exe` existing.

---

## Screen Requirements

No new user-facing screen. Optional About/Config line (P2): `Data folder: …` with **Open data folder** using the OS file manager.

---

## Data Model Requirements

No change to `store.json` schema. May add `settings.dataPathVersion` or similar only if needed for migrations (optional).

---

## Acceptance Criteria (Gherkin)

### US-12.1 — Build A Windows Executable Package

#### Scenario: Dist script produces Strank.exe

- **Given** the project dependencies are installed on a Windows x64 machine
- **When** I run `npm run dist`
- **Then** the output directory contains `Strank.exe`
- **And** the build exits successfully

### US-12.2 — Launch Without Dev Tooling

#### Scenario: Packaged exe opens the app

- **Given** a freshly built `Strank.exe`
- **And** `nw` is not required on PATH for the end user
- **When** I launch `Strank.exe`
- **Then** the Strank main window opens on the Landing screen

### US-12.3 — Bundle Defaults And Isolate User Data

#### Scenario: First launch seeds user data

- **Given** the user data directory does not exist
- **When** I launch the packaged app
- **Then** the user data directory is created
- **And** it contains `format.txt` and `ranks.txt` copied from defaults
- **And** default badge files needed by shipped ranks are available under the user badges path

#### Scenario: Second launch keeps user edits

- **Given** the user has edited user-data `ranks.txt`
- **When** I quit and relaunch the packaged app
- **Then** the edited `ranks.txt` content is unchanged by seeding

#### Scenario: Store lives in user data

- **Given** the packaged app is running
- **When** a workout is completed
- **Then** history is written under the user data directory
- **And** not under a read-only install-only path

### US-12.4 — Dev Mode Remains Available

#### Scenario: Dev start still works

- **Given** I am in the repo with dependencies installed
- **When** I run the documented dev start command
- **Then** the app opens without requiring `npm run dist` first

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-12.1 | Dist script produces Strank.exe | `tests/packaging.test.js` or manual checklist | `Dist script produces Strank.exe` |
| US-12.2 | Packaged exe opens the app | manual smoke / `tests/packaging.smoke.md` | `Packaged exe opens the app` |
| US-12.3 | First launch seeds user data | `tests/paths.test.js` | `First launch seeds user data` |
| US-12.3 | Second launch keeps user edits | `tests/paths.test.js` | `Second launch keeps user edits` |
| US-12.3 | Store lives in user data | `tests/paths.test.js` | `Store lives in user data` |
| US-12.4 | Dev start still works | `tests/packaging.test.js` or docs smoke | `Dev start still works` |

Packaged exe GUI smoke MAY be manual until CI has Windows packaging runners; path seeding tests MUST be automated.

---

## Test traceability

```text
feature-12-Packaging-Distribution.md
  └── US-12.3 — Bundle Defaults And Isolate User Data
        └── Scenario: First launch seeds user data
              └── tests/paths.test.js → it("First launch seeds user data")
  └── US-12.1 — Build A Windows Executable Package
        └── Scenario: Dist script produces Strank.exe
              └── tests/packaging.test.js → it("Dist script produces Strank.exe")
```

### File header

```javascript
/**
 * Feature 12 — Packaging & Distribution
 * Spec: features/feature-12-Packaging-Distribution.md
 */
```

---

## Agent implementation request

```text
Implement Feature 12 from @features/feature-12-Packaging-Distribution.md on branch `feature/12-Packaging-Distribution`.

Add Windows NW.js packaging (`npm run dist` → Strank.exe), path resolver (install vs user data), and copy-on-first-run seeding for format.txt / ranks.txt / default badges.
Point Features 1–11 file access at user data in packaged mode. Keep `npm start` (or equivalent) for dev.
Document dist output and user data location in README or docs/packaging.md.
Follow Test Traceability. Do not implement Mac/Linux packages, installers, or code signing unless already in this spec.
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Packaging script + path seeding (**FR-001** through **FR-013**)
- [ ] **Success Criteria (SC-001** through **SC-006)** met
- [ ] Automated path tests pass; dist exe smoke verified (automated or checklist)
- [ ] README/docs updated for dist + user data
- [ ] Test traceability satisfied

---

## Out of Scope

- Mac / Linux distributables
- NSIS/MSI/Squirrel installers and auto-update
- Code signing / SmartScreen reputation
- Microsoft Store / other store listings
- Rewriting the app in a non-NW.js stack
- Cloud distribution of builds (GitHub Releases zip is optional P2 only)
