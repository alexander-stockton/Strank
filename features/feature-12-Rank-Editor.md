# Feature: Rank Editor

**Feature ID:** 12  
**Branch pattern:** `feature/12-Rank-Editor`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** From Config -> Advanced -> **Edit ranks.txt**, the user opens an in-app **Rank Editor**: left plaintext editor loaded with `ranks.txt`, right live preview of rank cards as they appear in the Ranks Gallery (Feature 10). Edits update the preview in realtime. Footer actions: Save, Beautify, Restore to defaults, Fix syntax errors. Drag-and-drop images into the editor copies them into `badges/`. A **?** header control shows STRANK FORMATTING RULES plus the example rank template from `format.txt`.  
**Depends on:** Feature 1 ranks/catalog parse; Feature 5 `reloadFromDisk()` after save; Feature 6 custom ladder + badge paths; Feature 10 rank card presentation; Feature 11 Advanced entry point; Feature 17 user-data paths when packaged  
**Related:** `data/format.txt`, `data/ranks.txt`, `data/badges/`, `features/feature-6-Custom-Ranks.md`, `features/feature-10-Ranks-Gallery.md`, `features/feature-11-Config-Accessibility-Backup.md`

---

## User Stories

### US-12.1: Open Rank Editor From Config

**As a** local user  
**I want** **Edit ranks.txt** in Advanced Config to open the Rank Editor  
**So that** I can customize ranks with a live preview instead of a blind text file

**Priority:** P1  
**Independent test:** From Config -> Advanced, pressing **Edit ranks.txt** navigates to `/rank-editor` with `ranks.txt` loaded in the left editor.  
**Acceptance scenarios:** see ### US-12.1 under Acceptance Criteria

### US-12.2: Live Preview Of Rank Cards

**As a** local user  
**I want** the right panel to show Ranks Gallery–style rank cards that update as I type  
**So that** I can see how custom ranks and exercises will look before saving

**Priority:** P1  
**Independent test:** Editing a tier name or exercise line in the left editor updates the matching card on the right within a short debounce without writing `ranks.txt` yet.  
**Acceptance scenarios:** see ### US-12.2 under Acceptance Criteria

### US-12.3: Save Beautify Fix And Restore

**As a** local user  
**I want** footer actions to save, beautify, fix syntax, or restore defaults  
**So that** I can persist good `ranks.txt` content or recover when edits go wrong

**Priority:** P1  
**Independent test:** Save writes editor text to `ranks.txt` and reloads ranks; Beautify / Fix syntax errors rewrite the editor buffer to match `format.txt` rules without necessarily saving until Save; Restore to defaults reloads the bundled default ranks text (confirm first).  
**Acceptance scenarios:** see ### US-12.3 under Acceptance Criteria

### US-12.4: Drop Images Into Badges

**As a** local user  
**I want** to drag and drop an image onto the Rank Editor  
**So that** it is copied into `data/badges/` for use as a badge path

**Priority:** P1  
**Independent test:** Dropping a `.png` onto the editor copies it under `badges/` (unique safe filename) and shows a short confirmation with the relative path to paste into a rank block.  
**Acceptance scenarios:** see ### US-12.4 under Acceptance Criteria

### US-12.5: Formatting Rules Help

**As a** local user  
**I want** a **?** control that shows STRANK FORMATTING RULES and the example rank template  
**So that** I can author valid `ranks.txt` without leaving the editor

**Priority:** P1  
**Independent test:** Clicking **?** opens a help overlay/panel listing rules 1–N from `format.txt` and, separately, the example rank template block from the same file.  
**Acceptance scenarios:** see ### US-12.5 under Acceptance Criteria

---

## Requirements

### Functional Requirements

#### Navigation & shell

- **FR-001**: Route `/rank-editor` shows the Rank Editor. Entry: Config -> Advanced -> **Edit ranks.txt** (Feature 11). **Back** -> Config (`/config`). Optional secondary entry from Ranks Gallery is out of scope unless added later.
- **FR-002**: On enter, load the current user-data `ranks.txt` into the left plaintext editor (full file text, preserving tabs).
- **FR-003**: Header bar includes: title **Rank Editor**, **?** help control, **Back**.

#### Layout

- **FR-004**: Two-pane body:
  - **Left:** plaintext ranks editor (monospace). Independently **vertically scrollable**.
  - **Right:** live list of **rank cards** using the **same card presentation** as the Ranks Gallery (Feature 10)--badge image, tier name, expectation lists under headers. Independently **vertically scrollable** (not tied to the left pane’s scroll).
- **FR-005**: Footer bar (full width under both panes) with actions:
  1. **Save**
  2. **Beautify**
  3. **Fix syntax errors**
  4. **Restore to defaults**
- **FR-006**: On narrow windows, panes MAY stack (editor on top, preview below) but each pane keeps its own vertical scroll; footer remains reachable.

#### Live preview

- **FR-007**: As the user edits the left buffer, parse it with the same ranks grammar as Feature 1 (`splitTierBlocks` / leaf parse). Debounce <= 300ms.
- **FR-008**: Right panel renders one card per successfully parsed tier (prefer omit `UNRANKED` when thresholds are empty--same policy as Feature 10). Order = file order.
- **FR-009**: Preview is **in-memory only** until Save. Failed partial parses: still show cards for tiers that parsed; surface a non-blocking status (e.g. `Preview incomplete -- syntax issues remain`) without wiping the editor.
- **FR-010**: Rank cards MUST visually match Feature 10 gallery cards closely enough that users recognize them as the same UI (shared component or shared render helper required).

#### Save

- **FR-011**: **Save** writes the editor buffer to user-data `ranks.txt`, then calls Feature 5 `reloadFromDisk()` (or equivalent ranks+catalog refresh) so gallery, landing, and ranking use the new ladder.
- **FR-012**: After a successful save, right-panel cards refresh from the reloaded ranks (not only the draft parse).
- **FR-013**: If write fails -> `"Could not save ranks.txt."` Keep editor contents; do not claim success.
- **FR-014**: If the buffer cannot be parsed into any valid tier block, Save MUST confirm: `ranks.txt has syntax problems. Save anyway?` Cancel leaves the file unchanged. (Optional stricter mode: block save--prefer confirm so users are not locked out.)

#### Beautify & fix syntax

- **FR-015**: **Beautify** rewrites the editor buffer to a consistent, readable form that still obeys `format.txt` / ranks grammar: normalized tab indentation, stable blank lines between tiers, trimmed trailing spaces, consistent badge-path / separator layout. Does **not** write disk until Save unless the product later adds “Beautify & Save”--default is **buffer only**.
- **FR-016**: **Fix syntax errors** attempts automatic repair so the buffer matches the format rules and template expectations (e.g. restore missing `--------------` separators, repair broken optional/required field shapes where unambiguous, ensure weight/unit tokens match current grammar, fix tab depth jumps where a single obvious repair exists). Ambiguous repairs MUST NOT invent exercise content; leave a marked comment or status listing unresolved lines.
- **FR-017**: After Beautify or Fix syntax errors, re-run live preview on the updated buffer.
- **FR-018**: Neither Beautify nor Fix syntax errors may silently overwrite disk; only **Save** persists (except Restore--see FR-019).

#### Restore to defaults

- **FR-019**: **Restore to defaults** confirms: `Replace editor contents with the default ranks.txt? Unsaved changes will be lost.` On confirm, load the **bundled default** ranks text (shipped with the app / Feature 17 package defaults--not the user’s last save) into the editor and refresh preview. Does not write disk until Save (so the user can cancel by leaving without saving)--**or**, if product prefers immediate disk restore, confirm text MUST say the file will be overwritten and then write + reload. Prefer **buffer-only restore + explicit Save** for consistency with Beautify.

#### Drag-and-drop badges

- **FR-020**: Dragging and dropping one or more image files anywhere on the Rank Editor view copies each supported image into the user-data `badges/` directory (create dir if needed).
- **FR-021**: Supported types match `format.txt`: `.svg`, `.png`, `.jpg`/`.jpeg`, `.webp`, `.gif`. Unsupported drops -> `"Unsupported image type."` for that file; other files in the drop may still succeed.
- **FR-022**: Filenames are sanitized; collisions get a numeric suffix. Relative path for ranks use is `badges/[filename]` (or `badges/custom/[filename]` if the app already uses a custom subfolder--stay consistent with Feature 6).
- **FR-023**: After a successful drop, show a brief toast/status with the path(s) to paste under a rank header. Optionally insert the path at the caret if the caret is on/near a badge-path line--nice-to-have, not required.
- **FR-024**: Drop must not navigate the window or open the file in the OS.

#### Help (?)

- **FR-025**: Header **?** opens a help dialog/drawer with two distinct regions:
  1. **STRANK FORMATTING RULES** -- organized list of the numbered rules from the top of `data/format.txt` (rules section only, not the whole file dump as one blob).
  2. **Example rank** -- the template/example rank block from `format.txt` (from `RANK NAME #:` through the LUNGS section / template body) in a separate monospace box.
- **FR-026**: Help content is read from the bundled/user `format.txt` at open time so rule text stays in sync with the file.
- **FR-027**: Closing help returns focus to the editor.

#### Accessibility & local-only

- **FR-028**: No network. Screen-reader: panes labeled `Ranks text editor` and `Rank cards preview`; footer actions have accessible names; help dialog is modal with focus trap when open (Feature 11 a11y baseline).
- **FR-029**: Unsaved changes: navigating **Back** with a dirty buffer confirms `Discard unsaved ranks edits?`.

---

## Assumptions

- Feature 10 already defines the visual “rank card” used in the gallery; Rank Editor reuses that presentation for the right pane (vertical list of cards rather than the gallery’s horizontal strip is acceptable for editor density).
- Feature 11 **Edit ranks.txt** is the primary entry; opening the OS default editor for `ranks.txt` is no longer required once this feature ships (Feature 11 updated accordingly). There is no Config Advanced **Edit format.txt** control; `format.txt` changes go through filesystem or backup import.
- “Default ranks.txt” means the packaged starter ladder shipped with the app (same source used on first install / Feature 17), not an empty file.
- Beautify / Fix syntax operate on text; they do not call external formatters over the network.

---

## Edge Cases

- Empty editor -> preview empty; Save confirms before writing empty/invalid file.
- Huge `ranks.txt` -> preview debounce and virtualize card list if needed for performance; correctness first.
- Parse error mid-tier -> prior complete tiers still preview; status indicates error location when detectable (line number).
- Drop of non-image -> rejected; drop of image while Save in progress -> queue or reject with message.
- Restore defaults then Back without Save -> discard confirm; disk unchanged.
- Badge path in text points to missing file -> card uses Feature 6/10 fallback styling in preview.
- Help `format.txt` unreadable -> show `"Could not load formatting rules."`

---

## Success Criteria

- **SC-001**: Gherkin scenarios mapped to tests.
- **SC-002**: Advanced **Edit ranks.txt** opens Rank Editor with file contents loaded.
- **SC-003**: Right-pane cards mirror Feature 10 presentation and update live from the editor buffer.
- **SC-004**: Save persists to `ranks.txt` and refreshes app ranks/catalog.
- **SC-005**: Beautify and Fix syntax errors rewrite the buffer toward `format.txt` compliance without surprising disk writes.
- **SC-006**: Image drop installs files under `badges/` with a usable relative path.
- **SC-007**: **?** shows formatting rules and the example rank template in separate regions.

---

## Data Ownership & Isolation

Feature 12 owns the Rank Editor UI and draft buffer. It writes `ranks.txt` only on Save (and optionally Restore-if-immediate). It may add files under `badges/` on drop. It reads `format.txt` for help and for beautify/fix heuristics. It does not own `config.txt` or workout history.

---

## Key Entities

- **RanksDraft:** `{ text, dirty, parseResult, parseErrors[] }`
- **RankCardPreview:** same shape as Feature 10 `RankColumn` (or shared type)
- **BadgeDropResult:** `{ relativePath, absolutePath, fileName }`
- **FormatHelp:** `{ rules: string[], exampleRankText: string }`

---

## Local Service Requirements

| Module              | Method                                         | Purpose                                           |
| ------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `rankEditor`        | `loadDraft()`                                  | Read `ranks.txt` into draft text                  |
| `rankEditor`        | `parseDraft(text)`                             | Feature 1 parse -> tiers + errors                 |
| `rankEditor`        | `saveDraft(text)`                              | Write `ranks.txt` + reload                        |
| `rankEditor`        | `beautify(text)`                               | Return beautified text                            |
| `rankEditor`        | `fixSyntax(text)`                              | Return repaired text + unresolved issues          |
| `rankEditor`        | `defaultRanksText()`                           | Bundled default ladder text                       |
| `rankEditor`        | `importDroppedBadge(filePath \| Buffer, name)` | Copy into `badges/`, return relative path         |
| `rankEditor`        | `loadFormatHelp()`                             | Split rules vs example template from `format.txt` |
| `ranks` / `catalog` | `reloadFromDisk()`                             | Feature 5 refresh after save                      |

---

## Screen Requirements

### View: Rank Editor -- route name `rank-editor`

- Path: `/rank-editor`
- Header: **Rank Editor** | **?** | **Back**
- Body:
  - Left: plaintext editor (`ranks.txt`), vertical scroll
  - Right: vertical scroll list of Feature 10–style rank cards (live preview)
- Footer: **Save** | **Beautify** | **Fix syntax errors** | **Restore to defaults**
- Overlay: Formatting help (rules list + example rank box)
- Status line (optional): dirty flag, parse warning, last drop path

---

## Acceptance Criteria (Gherkin)

### US-12.1 -- Open Rank Editor From Config

#### Scenario: Edit ranks.txt opens Rank Editor

- **Given** I am on Config -> Advanced
- **When** I press **Edit ranks.txt**
- **Then** I am on the Rank Editor screen
- **And** the left editor contains the current `ranks.txt` text

#### Scenario: Back returns to Config

- **Given** I am on Rank Editor with no unsaved changes
- **When** I press **Back**
- **Then** I am on Config

### US-12.2 -- Live Preview Of Rank Cards

#### Scenario: Tier edit updates preview card

- **Given** the editor shows a tier named `BRONZE I`
- **When** I change that header to `COPPER I` in the left editor
- **Then** within 300ms the right panel shows a card titled `COPPER I`
- **And** `ranks.txt` on disk is unchanged until Save

#### Scenario: Preview uses gallery-style cards

- **Given** parsed tiers exist in the draft
- **When** I view the right panel
- **Then** each card shows a badge image area and expectation list consistent with the Ranks Gallery card UI

### US-12.3 -- Save Beautify Fix And Restore

#### Scenario: Save writes ranks.txt and reloads

- **Given** I have valid unsaved edits in the Rank Editor
- **When** I press **Save**
- **Then** user-data `ranks.txt` matches the editor text
- **And** Feature 5 reload runs
- **And** the dirty state clears

#### Scenario: Beautify reformats buffer only

- **Given** messy but valid ranks text in the editor
- **When** I press **Beautify**
- **Then** the editor text is normalized to format-compatible layout
- **And** disk `ranks.txt` is unchanged until Save

#### Scenario: Fix syntax errors repairs buffer

- **Given** ranks text with fixable syntax issues (e.g. missing separators)
- **When** I press **Fix syntax errors**
- **Then** the editor text is repaired toward `format.txt` compliance
- **And** the live preview refreshes

#### Scenario: Restore to defaults loads bundled ladder

- **Given** I confirm Restore to defaults
- **When** the action completes
- **Then** the editor shows the bundled default ranks text
- **And** the preview matches that default ladder

### US-12.4 -- Drop Images Into Badges

#### Scenario: Drop PNG copies into badges

- **Given** I am on Rank Editor
- **When** I drop `my-badge.png` onto the editor view
- **Then** a file exists under user-data `badges/` (or `badges/custom/`)
- **And** I see a status message including a `badges/...` path I can paste into a rank block

### US-12.5 -- Formatting Rules Help

#### Scenario: Help shows rules and example separately

- **Given** I am on Rank Editor
- **When** I press **?**
- **Then** I see an organized list of STRANK FORMATTING RULES from `format.txt`
- **And** I see the example rank template in a separate box

---

## Test Coverage Map

| Story   | Scenario                                 | Test file                      | Test name                                  |
| ------- | ---------------------------------------- | ------------------------------ | ------------------------------------------ |
| US-12.1 | Edit ranks.txt opens Rank Editor         | `tests/RankEditorView.test.js` | `Edit ranks.txt opens Rank Editor`         |
| US-12.1 | Back returns to Config                   | `tests/RankEditorView.test.js` | `Back returns to Config`                   |
| US-12.2 | Tier edit updates preview card           | `tests/RankEditorView.test.js` | `Tier edit updates preview card`           |
| US-12.2 | Preview uses gallery-style cards         | `tests/RankEditorView.test.js` | `Preview uses gallery-style cards`         |
| US-12.3 | Save writes ranks.txt and reloads        | `tests/rankEditor.test.js`     | `Save writes ranks.txt and reloads`        |
| US-12.3 | Beautify reformats buffer only           | `tests/rankEditor.test.js`     | `Beautify reformats buffer only`           |
| US-12.3 | Fix syntax errors repairs buffer         | `tests/rankEditor.test.js`     | `Fix syntax errors repairs buffer`         |
| US-12.3 | Restore to defaults loads bundled ladder | `tests/rankEditor.test.js`     | `Restore to defaults loads bundled ladder` |
| US-12.4 | Drop PNG copies into badges              | `tests/rankEditor.test.js`     | `Drop PNG copies into badges`              |
| US-12.5 | Help shows rules and example separately  | `tests/RankEditorView.test.js` | `Help shows rules and example separately`  |

---

## Test traceability

```text
feature-12-Rank-Editor.md
  L___ US-12.2 -- Live Preview Of Rank Cards
        L___ Scenario: Tier edit updates preview card
              L___ tests/RankEditorView.test.js -> it("Tier edit updates preview card")
```

### File header

```javascript
/**
 * Feature 12 -- Rank Editor
 * Spec: features/feature-12-Rank-Editor.md
 */
```

---

## Agent implementation request

```text
Implement Feature 12 from @features/feature-12-Rank-Editor.md on branch `feature/12-Rank-Editor`.

Rank Editor at /rank-editor: left plaintext ranks.txt editor, right live Feature 10–style rank cards (independent scroll), footer Save / Beautify / Fix syntax errors / Restore to defaults, drag-drop images into badges/, ? help with format.txt rules + example template.
Wire Config Advanced "Edit ranks.txt" to this screen. Save writes ranks.txt and reloads. Beautify/Fix only change the buffer until Save.
Follow Test Traceability. Reuse gallery card UI. Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Rank Editor UI + services (**FR-001** through **FR-029**)
- [ ] Feature 11 entry point updated to open Rank Editor
- [ ] **SC-001** through **SC-007** met
- [ ] Mapped tests pass

---

## Out of Scope

- In-app structured form builder (this is plaintext + preview)
- Editing `format.txt` inside this screen
- Collaborative/multi-user editing
- Automatic AI rewriting beyond deterministic Beautify / Fix syntax heuristics
- Changing Feature 10’s horizontal gallery layout (preview may list cards vertically)
