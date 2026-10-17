# Feature: Config, Accessibility & Backup

**Feature ID:** 11  
**Branch pattern:** `feature/11-Config-Accessibility-Backup`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** From landing, the user opens **Config** to change appearance (font size, colors via color-picker, colorblind filters), enable screen-reader-friendly layout practices, export/import ZIP backups (exercise history + `ranks.txt` + `format.txt`), and use **Advanced** (landing visibility, desktop notifications / completion sounds, **Edit format.txt** / **Edit ranks.txt** opening in the system-default text editor).  
**Depends on:** Feature 1 paths to data files + store; Feature 5 reload after file edits / import; Feature 12 user-data paths when packaged  
**Related:** `features/feature-6-Custom-Ranks.md`, `features/feature-7-Landing-Page.md`, `features/feature-12-Packaging-Distribution.md`

---

## User Stories

### US-11.1: Change Appearance

**As a** local user  
**I want** to adjust font size and colors  
**So that** the app is comfortable to read

**Priority:** P1  
**Independent test:** Changing font size updates UI text scale; color picker sets a theme color and persists after relaunch.  
**Acceptance scenarios:** see ### US-11.1 under Acceptance Criteria

### US-11.2: Accessibility Options

**As a** local user  
**I want** colorblind filters and screen-reader-oriented layout  
**So that** I can use the app with my accessibility needs

**Priority:** P1  
**Independent test:** Enabling a colorblind filter changes palette; with screen-reader mode on, interactive controls expose accessible names/roles and focus order is logical.  
**Acceptance scenarios:** see ### US-11.2 under Acceptance Criteria

### US-11.3: Export And Import Backup

**As a** local user  
**I want** to export a ZIP of history + `ranks.txt` + `format.txt` and import one back  
**So that** I can back up and restore my data locally

**Priority:** P1  
**Independent test:** Export opens a file-picker save dialog and writes a ZIP with those three payloads; import restores them and reloads catalog/ranks.  
**Acceptance scenarios:** see ### US-11.3 under Acceptance Criteria

### US-11.4: Advanced Settings

**As a** local user  
**I want** Advanced controls for landing visibility, notifications, and editing the text files in my system editor  
**So that** I can customize behavior and definitions without leaving the OS workflow

**Priority:** P1  
**Independent test:** Toggles persist; **Edit ranks.txt** launches the OS default editor for that file; after save+focus, Feature 5 reload picks up changes.  
**Acceptance scenarios:** see ### US-11.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Route `/config` shows Config. **Back** → Landing.
- **FR-002**: Persist all Config options in **`config.txt`** under the user data directory (Feature 12 path when packaged). Do **not** store these preferences inside `store.json`. Format is one option per line:
  ```text
  option name: value
  ```
  Example: `font size: medium`. Option names are human-readable lowercase (spaces allowed). Values are single-line strings (`true`/`false` for booleans; hex colors as `#RRGGBB`). Nested ideas (e.g. colors, landing visibility) use **flat option names** (`accent color: #1565C0`, `landing expectations visible: true`) so the parser stays a simple line split on the first `: `.

#### Appearance

- **FR-003**: User can set **font size** (at least: Small / Medium / Large, or a numeric scale). Applies app-wide via CSS variables / root class. Saved as `font size: …`.
- **FR-004**: User can set theme colors via a **color-picker dialog** (at least primary accent; optional background/text). Values persist in `config.txt` (`accent color:`, `background color:`, `text color:`) and apply app-wide.
- **FR-005**: User can choose a **colorblind filter** preset: `None` | `Protanopia` | `Deuteranopia` | `Tritanopia` (simulation/safe palette). Saved as `colorblind filter: …`. Filter applies across screens including calendar recorded-day colors (Feature 9 must remain distinguishable).

#### Screen reader

- **FR-006**: **Screen reader** toggle (or “Optimize for screen readers”). Saved as `screen reader mode: true|false`. When on, layouts MUST follow screen-reader best practices: semantic headings, labeled controls (`aria-label` / associated `<label>`), focusable interactive elements, no information only-by-color, skip/back targets named. Presence of this mode implies Features 7–10 controls meet these practices when the toggle is on (baseline a11y SHOULD always be good; this mode may increase verbosity of labels).

#### Backup

- **FR-007**: **Export data backup** opens a native **file-picker save dialog** and writes a `.zip` containing:
  - exercise history (`store.json` entries + workouts, or equivalent history export)
  - `ranks.txt`
  - `format.txt`
  - `config.txt` when present
  - `badges/` directory when present (default + custom rank images, Feature 6)
- **FR-008**: **Import data backup** opens a native **file-picker open dialog** for a `.zip`, validates required members, confirms `Import replaces local history and definition files. Continue?`, then writes files + store and calls Feature 5 `reloadFromDisk()`. If the archive includes `config.txt`, replace the local config (then parse; on parse failure apply **FR-014**).
- **FR-009**: Invalid ZIP → `"Backup file is invalid."` No partial overwrite.

#### Advanced menu

- **FR-010**: **Advanced** section/menu includes:
  1. **Landing page visibility** — toggles for which landing blocks show (e.g. expectations list, nav shortcuts). Hidden blocks are not shown on Feature 7. Saved as flat options such as `landing expectations visible: true`.
  2. **Desktop notifications** — enable/disable exercise reminders and related OS notifications (NW.js / OS APIs local only). Saved as `notifications enabled: true|false`.
  3. **Completion sounds** — enable/disable sounds on workout complete (Feature 8 may call into this setting). Saved as `completion sounds enabled: true|false`.
  4. **Edit format.txt** — opens `format.txt` in the **system-default text editor** (not an in-app editor).
  5. **Edit ranks.txt** — opens `ranks.txt` in the **system-default text editor**.
- **FR-011**: After the user returns focus to the app following an external edit, reload catalog/ranks (Feature 5) automatically or via prompted **Reload exercise data**.
- **FR-012**: Feature 6’s requirement that custom ranks be accommodated is satisfied by editing `ranks.txt` this way; **no separate in-app structured ranks editor is required** by this feature set (Feature 6 updated accordingly).
- **FR-013**: No network uploads; export/import are local filesystem only.
- **FR-014**: **Config parse failure → reset to defaults.** If `config.txt` is missing, empty, unreadable, or the parser fails for any reason (malformed lines, unknown critical structure, I/O error, invalid value types that prevent a consistent settings object), the app MUST:
  1. Replace in-memory settings with the **built-in default** option set.
  2. Rewrite `config.txt` with those defaults in `option name: value` form (so the file is healthy again).
  3. Continue launching/using the app (do not block on Config). Optionally log or briefly toast that config was reset; do not require user confirmation for the reset itself.

---

## Assumptions

- Writable copies of `format.txt` / `ranks.txt` / `config.txt` live under the user data directory (Feature 12 when packaged).
- File-picker and “open in default editor” use NW.js / Node APIs available on the desktop OS.
- A simple line-oriented `config.txt` parser is intentional so future implementers do not need JSON settings in `store.json`.

---

## Edge Cases

- Import ZIP missing `ranks.txt` → invalid.
- Color picker cancelled → no change.
- Notifications denied by OS → show `"Notifications are blocked by the system."` and leave toggle off.
- Screen reader mode on + colorblind filter both on → both apply.
- Corrupt / half-written `config.txt` → **FR-014** reset to defaults and rewrite the file.
- Line with no `: ` separator, or duplicate option names → treat as parse failure for that load (**FR-014**), or: last duplicate wins only if the rest of the file is valid—prefer **full reset on any malformed line** for a simpler parser.
- Value containing `: ` (e.g. rare) → only the **first** `: ` on the line separates name from value; remainder is the value.

---

## Success Criteria

- **SC-001**: Gherkin scenarios mapped to tests.
- **SC-002**: Font size and colors persist in `config.txt` and apply after relaunch.
- **SC-003**: Colorblind filter and screen-reader mode behave as specified.
- **SC-004**: Export ZIP contains history + definition files (+ `config.txt` when present); import restores them.
- **SC-005**: Advanced edit actions open system editor; landing visibility and notification toggles persist in `config.txt`.
- **SC-006**: Corrupt or unreadable `config.txt` causes reset to defaults and a rewritten default file.

---

## Data Ownership & Isolation

Feature 11 owns **`config.txt`** and backup import/export. Exercise history remains in `store.json`. Definition file writes happen via OS editor or import.

### `config.txt` format

Each non-empty, non-`#`-comment line:

```text
option name: value
```

**Default file (illustrative):**

```text
font size: medium
accent color: #1565C0
background color: #FFFFFF
text color: #102A43
colorblind filter: none
screen reader mode: false
landing expectations visible: true
landing get started visible: true
notifications enabled: false
completion sounds enabled: true
```

Unknown option names MAY be ignored on read (forward compatible) **only if** every line still matches `name: value`; otherwise apply **FR-014**.

---

## Key Entities

- **AppSettings:** In-memory map built from `config.txt` lines.
- **ConfigFile:** User-data `config.txt` in `option name: value` form.
- **BackupArchive:** ZIP with `store.json` (or `history.json`), `ranks.txt`, `format.txt`, `config.txt`, and optional `badges/`.

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `config` | `load()` | Parse `config.txt`; on failure reset to defaults and rewrite (**FR-014**) |
| `config` | `get()` | Current in-memory settings |
| `config` | `set(optionName, value)` / `update(patch)` | Update memory and rewrite `config.txt` |
| `config` | `defaults()` | Built-in default `option name: value` map |
| `backup` | `exportZip(targetPath)` | Build ZIP via file picker path |
| `backup` | `importZip(sourcePath)` | Restore + reload |
| `shell` | `openInDefaultEditor(filePath)` | OS default editor |

---

## Screen Requirements

### View: Config — route name `config`

- Path: `/config`
- Heading: **Config**
- Sections: Appearance | Accessibility | Backup | Advanced
- Appearance: font size control; button **Choose colors** → color-picker dialog
- Accessibility: colorblind select; screen reader toggle
- Backup: **Export data backup**, **Import data backup**
- Advanced: landing visibility checkboxes; notifications toggle; completion sounds toggle; **Edit format.txt**; **Edit ranks.txt**
- Back: **Back** → Landing

---

## Acceptance Criteria (Gherkin)

### US-11.1 — Change Appearance

#### Scenario: Font size persists

- **Given** I am on Config
- **When** I set font size to `Large` and return to landing
- **Then** landing text uses the large scale
- **And** `config.txt` contains `font size: large`
- **And** after relaunch the scale is still large

#### Scenario: Color picker sets accent

- **Given** I open the color-picker dialog
- **When** I choose accent `#FF0000` and confirm
- **Then** the accent color in the UI updates to that value
- **And** `config.txt` contains `accent color: #FF0000`

#### Scenario: Corrupt config resets to defaults

- **Given** `config.txt` contains malformed text that cannot be parsed
- **When** the app loads config
- **Then** settings equal the built-in defaults
- **And** `config.txt` is rewritten with default `option name: value` lines

### US-11.2 — Accessibility Options

#### Scenario: Colorblind filter applies

- **Given** I select colorblind filter `Deuteranopia`
- **When** I view Workout History
- **Then** recorded vs non-recorded days remain distinguishable under that filter

#### Scenario: Screen reader mode exposes names

- **Given** screen reader mode is on
- **When** I inspect the **Get Started** control on landing
- **Then** it has an accessible name `Get Started`

### US-11.3 — Export And Import Backup

#### Scenario: Export creates ZIP with required files

- **Given** I have history entries and definition files
- **When** I export a backup and choose a save path
- **Then** the ZIP contains exercise history data, `ranks.txt`, and `format.txt`

#### Scenario: Import restores backup

- **Given** a valid backup ZIP
- **When** I import it and confirm
- **Then** local history and definition files match the archive
- **And** the live catalog reloads

### US-11.4 — Advanced Settings

#### Scenario: Edit ranks.txt opens system editor

- **Given** I am in Advanced
- **When** I press **Edit ranks.txt**
- **Then** the system-default text editor opens for the app’s `ranks.txt` path

#### Scenario: Landing visibility hides expectations

- **Given** I disable expectations visibility in Advanced
- **When** I open landing
- **Then** the today’s expectations list is not shown

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-11.1 | Font size persists | `tests/config.test.js` | `Font size persists` |
| US-11.1 | Color picker sets accent | `tests/ConfigView.test.js` | `Color picker sets accent` |
| US-11.1 | Corrupt config resets to defaults | `tests/config.test.js` | `Corrupt config resets to defaults` |
| US-11.2 | Colorblind filter applies | `tests/ConfigView.test.js` | `Colorblind filter applies` |
| US-11.2 | Screen reader mode exposes names | `tests/LandingView.test.js` | `Screen reader mode exposes names` |
| US-11.3 | Export creates ZIP with required files | `tests/backup.test.js` | `Export creates ZIP with required files` |
| US-11.3 | Import restores backup | `tests/backup.test.js` | `Import restores backup` |
| US-11.4 | Edit ranks.txt opens system editor | `tests/ConfigView.test.js` | `Edit ranks.txt opens system editor` |
| US-11.4 | Landing visibility hides expectations | `tests/LandingView.test.js` | `Landing visibility hides expectations` |

---

## Test traceability

```text
feature-11-Config-Accessibility-Backup.md
  └── US-11.3 — Export And Import Backup
        └── Scenario: Export creates ZIP with required files
              └── tests/backup.test.js → it("Export creates ZIP with required files")
```

### File header

```javascript
/**
 * Feature 11 — Config, Accessibility & Backup
 * Spec: features/feature-11-Config-Accessibility-Backup.md
 */
```

---

## Agent implementation request

```text
Implement Feature 11 from @features/feature-11-Config-Accessibility-Backup.md on branch `feature/11-Config-Accessibility-Backup`.

Config: font size, color picker, colorblind filters, screen-reader mode, ZIP export/import, Advanced (landing visibility, notifications, sounds, open format.txt/ranks.txt in system editor).
Persist settings only in config.txt as `option name: value`. On any parse/read failure, reset to defaults and rewrite the file.
Follow Test Traceability. Reload catalog after import/external edits (Feature 5).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Config + `config.txt` + backup (**FR-001** through **FR-014**)
- [ ] **SC-001** through **SC-006** met
- [ ] Mapped tests pass

---

## Out of Scope

- Cloud backup / accounts
- In-app WYSIWYG ranks structured editor (external editor is the edit path)
- Implementing every OS notification schedule beyond enable/disable + hook points for reminders
