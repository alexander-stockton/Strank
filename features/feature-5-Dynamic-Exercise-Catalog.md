# Feature: Dynamic Exercise Catalog

**Feature ID:** 5  
**Branch pattern:** `feature/5-Dynamic-Exercise-Catalog`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** The tracker builds its exercise list and metric fields from the live contents of `format.txt` and `ranks.txt`. When those files change, pickers and entry forms update. History may still show entries for exercises later removed or whose metrics changed. On conflict, `ranks.txt` wins. Editing the files is how a user creates custom exercises.  
**Depends on:** Feature 1 indentation-aware parsers and storage; Features 2–4 consume the merged catalog  
**Related:** `format.txt`, `ranks.txt`, `features/feature-1-App-Foundation.md`, `features/feature-11-Config-Accessibility-Backup.md` (reload after import / external edit), `features/README.md`

---

## User Stories

### US-5.1: Merge Catalog With Ranks Priority

**As a** local user  
**I want** exercises defined in `format.txt` and `ranks.txt` combined into one catalog  
**So that** anything required by ranks is available to log, and conflicts resolve predictably

**Priority:** P1  
**Independent test:** When the same exercise name appears in both files with different metric schemas, the merged catalog uses the `ranks.txt` schema.  
**Acceptance scenarios:** see ### US-5.1 under Acceptance Criteria

### US-5.2: Forms Follow Live Definitions

**As a** local user  
**I want** Add/Edit fields to match the current exercise definition  
**So that** after I customize the text files, the tracker asks for the right measurements

**Priority:** P1  
**Independent test:** Change an exercise’s placeholders in the source files, reload catalog, open Add exercise—fields match the new schema only.  
**Acceptance scenarios:** see ### US-5.2 under Acceptance Criteria

### US-5.3: Keep Historical Orphans

**As a** local user  
**I want** old log entries to remain readable even if that exercise was later deleted from the files  
**So that** my history is not destroyed by catalog edits

**Priority:** P1  
**Independent test:** Remove an exercise from both files; an existing store entry for it still lists in History with its saved metrics; it no longer appears in the Add picker.  
**Acceptance scenarios:** see ### US-5.3 under Acceptance Criteria

### US-5.4: Customize Via File Changes

**As a** local user  
**I want** adding or editing exercises in `format.txt` / `ranks.txt` to show up in the tracker  
**So that** I can create a custom exercise set without code changes

**Priority:** P1  
**Independent test:** Append a new leaf exercise under an indented header; after reload, it appears in the picker with inferred metric fields.  
**Acceptance scenarios:** see ### US-5.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: `catalog.loadLiveCatalog()` MUST build the **active catalog** by union of exercises parsed from `format.txt` and from all tiers in `ranks.txt` (unique by normalized `exerciseId` / name).
- **FR-002**: **Conflict rule:** If the same exercise (same normalized name / `exerciseId`) appears in both files, the definition from **`ranks.txt` takes priority** for: display name normalization, header path when present on the ranks leaf, **metric schema**, and threshold-derived metric keys. `format.txt` data for that id is ignored in the active catalog (may be retained only as a debug `sources.format` note).
- **FR-003**: If an exercise appears only in `format.txt`, it is active with that file’s schema. If only in `ranks.txt`, it is active with schema inferred from the ranks leaf’s filled placeholders (and notes `{…}` if present). Merged active entries MUST carry `notes` (ranks wins on conflict when both supply notes).
- **FR-004**: Features 2 and 3 **create** paths MUST offer only **active catalog** exercises and MUST validate metrics against the **current** active schema.
- **FR-005**: Add/Edit dialogs MUST generate input fields **dynamically** from `metrics[]` (and labels derived from metric keys). No hardcoded per-exercise field lists in UI code.
- **FR-006**: Today / History / Rank grouping and filters that show “available exercises” MUST use the active catalog. Rank breakdown for a week still shows whatever was **logged**, including orphans.
- **FR-007**: **Historical entries** whose `exerciseId` is no longer in the active catalog are **orphans**. They MUST remain in the store, appear in History (and in weekly averages if dated in that week), and display saved `metrics` as read-only chips. Label: `Removed from catalog` (or equivalent).
- **FR-008**: Updating an **orphan** entry: user MAY delete it or edit metric **values** that already exist on the entry; they MUST NOT be forced onto a new schema. Changing `exerciseId` to an active exercise re-validates against the active schema (Feature 3 rules).
- **FR-009**: If an active exercise’s schema **changes** (e.g. gained `weight`), new creates use the new fields. Existing entries keep old metric keys; Edit for an still-active exercise SHOULD present **current** schema fields (prefill intersection; require new required fields before save).
- **FR-010**: The app MUST reload the live catalog when: app launch, user presses **Reload exercise data**, or the process detects `format.txt` / `ranks.txt` mtime change on window focus (at least one of reload button or focus-watch is required; both preferred).
- **FR-011**: Parsers continue to use Feature 1 **indentation grammar**. Dynamic behavior MUST tolerate indeterminate children under any header.
- **FR-012**: Empty active catalog after merge → blocking message `"Failed to load exercise data."` (same as Feature 1 fatal catalog).
- **FR-013**: No network. Customization is local file content only.
- **FR-014**: Active-catalog `notes` drive the Feature 1 **circled `?`** description control on every screen that displays that exercise’s name.

---

## Assumptions

- Users (or Feature 6’s editor) may edit `format.txt` and `ranks.txt` on disk under the app data / bundled data path.
- Feature 1 provides raw parse of each file; Feature 5 owns merge + “active vs orphan” policy.
- “Create a custom” means defining custom exercises by changing those files so the tracker picks them up—no separate proprietary exercise database.

---

## Edge Cases

- Same name different punctuation → normalize the same way as `exerciseId` slug rules from Feature 1 before conflict detection.
- Exercise in ranks under one header path and in format under another → ranks header path wins for active catalog.
- Orphan appears in week compile → included in averages; comparison to current ranks: if tier has no threshold for that id, that exercise is **ignored for pass/fail** of tiers (does not block overall rank); still shown in Rank breakdown as `No threshold in ranks`.
- Schema shrink (metric removed) → Edit form drops removed field; save writes metrics without that key.
- Partial parse warning on one leaf → other exercises still load.

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: Conflict fixtures prove `ranks.txt` schema wins.
- **SC-003**: Add dialog fields match live `metrics` after a file change + reload.
- **SC-004**: Orphan history entries remain visible with saved metrics and are absent from the Add picker.
- **SC-005**: New leaf in either file appears in the picker after reload.
- **SC-006**: No hardcoded exercise name lists remain in Today/History Add pickers.

---

## Data Ownership & Isolation

Feature 5 owns `loadLiveCatalog()`, orphan classification helpers, and reload wiring. It does not own entry CRUD (2–3) or rank authorship UI (6).

| Rule | Requirement |
| ---- | ----------- |
| **Active set** | Merged catalog; ranks win conflicts |
| **Create scope** | Active exercises only |
| **History scope** | All store entries, including orphans |
| **UI scope** | Dynamic fields everywhere exercises are chosen or entered |

---

## Key Entities

- **ActiveCatalogEntry:** Merged exercise available for new logs.
- **OrphanEntry:** Store `ExerciseEntry` whose `exerciseId` ∉ active catalog.
- **CatalogSource:** `format` | `ranks` | `both` (with ranks preferred on both).

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `catalog` | `loadLiveCatalog()` | Merge format + ranks; apply priority |
| `catalog` | `getActiveExercise(id)` | Active entry or `null` |
| `catalog` | `isOrphan(entry)` | Boolean |
| `catalog` | `reloadFromDisk()` | Re-read files and replace in-memory catalog |

**Active entry shape:**

```json
{
  "exerciseId": "pike-push-ups",
  "name": "pike push-ups",
  "headers": ["ARMS", "STRENGTH", "PUSH"],
  "metrics": ["reps", "sets"],
  "notes": null,
  "source": "both",
  "prioritySource": "ranks"
}
```

---

## Screen Requirements

### Shared: Add / Edit exercise dialogs (Today + History)

- Exercise picker options = active catalog only (grouped by `headers` optional).
- Fields rendered from `metrics` dynamically.
- On catalog reload while dialog open: refresh field set; warn `Exercise definitions updated.` if schema changed.

### History list

- Orphan rows show badge **Removed from catalog**.
- Metric display uses stored keys, not active schema.

### Shell

- Optional nav/settings action: **Reload exercise data**

---

## Data Model Requirements

No change to `entries[]` shape. Optional non-indexed field `metricsSnapshotSchema` is **out of scope** (saved metrics alone are enough).

---

## Acceptance Criteria (Gherkin)

### US-5.1 — Merge Catalog With Ranks Priority

#### Scenario: Ranks schema wins on conflict

- **Given** `format.txt` defines `heavy bookbag` with metrics needing `weight` and `reps`
- **And** `ranks.txt` defines `heavy bookbag` with thresholds implying `weight`, `reps`, and `sets`
- **When** `loadLiveCatalog()` runs
- **Then** active `heavy bookbag` metrics include those required by the ranks definition
- **And** `prioritySource` is `ranks`

#### Scenario: Format-only exercise remains active

- **Given** `format.txt` contains `chest-raises` and no tier in `ranks.txt` mentions it
- **When** `loadLiveCatalog()` runs
- **Then** `chest-raises` is in the active catalog

### US-5.2 — Forms Follow Live Definitions

#### Scenario: Entry fields update after schema change

- **Given** active `plank-hold` metrics are `durationSeconds` and `sets`
- **And** the user reloads after the definition adds a `weight` placeholder
- **When** I open **Add exercise** and select `plank-hold`
- **Then** I see fields for the updated metrics including weight
- **And** I do not see hardcoded fields unrelated to that schema

### US-5.3 — Keep Historical Orphans

#### Scenario: Deleted exercise remains in history

- **Given** a store entry for `bed-lifts` with reps `5` and sets `3`
- **And** `bed-lifts` is removed from `format.txt` and `ranks.txt`
- **When** the live catalog reloads
- **And** I open History
- **Then** the `bed-lifts` entry is still visible with reps `5` and sets `3`
- **And** `bed-lifts` is not in the Add exercise picker

### US-5.4 — Customize Via File Changes

#### Scenario: New custom exercise appears after reload

- **Given** I add a new indented leaf `- wall-sits ([duration]) x[sets]` under an existing header in `format.txt`
- **When** I reload exercise data
- **Then** `wall-sits` is in the active catalog
- **And** Add exercise shows Duration and Sets fields for it

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-5.1 | Ranks schema wins on conflict | `tests/liveCatalog.test.js` | `Ranks schema wins on conflict` |
| US-5.1 | Format-only exercise remains active | `tests/liveCatalog.test.js` | `Format-only exercise remains active` |
| US-5.2 | Entry fields update after schema change | `tests/TodayView.test.js` | `Entry fields update after schema change` |
| US-5.3 | Deleted exercise remains in history | `tests/liveCatalog.test.js` | `Deleted exercise remains in history` |
| US-5.3 | Deleted exercise remains in history | `tests/HistoryView.test.js` | `Deleted exercise remains in history` |
| US-5.4 | New custom exercise appears after reload | `tests/liveCatalog.test.js` | `New custom exercise appears after reload` |

---

## Test traceability

```text
feature-5-Dynamic-Exercise-Catalog.md
  └── US-5.1 — Merge Catalog With Ranks Priority
        └── Scenario: Ranks schema wins on conflict
              └── tests/liveCatalog.test.js → it("Ranks schema wins on conflict")
  └── US-5.3 — Keep Historical Orphans
        └── Scenario: Deleted exercise remains in history
              └── tests/HistoryView.test.js → it("Deleted exercise remains in history")
```

### File header

```javascript
/**
 * Feature 5 — Dynamic Exercise Catalog
 * Spec: features/feature-5-Dynamic-Exercise-Catalog.md
 */
```

---

## Agent implementation request

```text
Implement Feature 5 from @features/feature-5-Dynamic-Exercise-Catalog.md on branch `feature/5-Dynamic-Exercise-Catalog`.

Merge format.txt + ranks.txt into a live catalog with ranks priority. Dynamic Add/Edit fields. Preserve orphan history entries.
Use Feature 1 indentation grammar. Wire Features 2–4 pickers/forms to loadLiveCatalog().
Follow Test Traceability. Map every Gherkin scenario in the Test Coverage Map.
Do not implement in-app rank tier authoring (Feature 6).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Live catalog merge + reload (**FR-001** through **FR-013**)
- [ ] **Success Criteria (SC-001** through **SC-006)** met
- [ ] All mapped tests pass
- [ ] Today/History forms use dynamic metrics only
- [ ] Test traceability satisfied

---

## Out of Scope

- Opening `format.txt` / `ranks.txt` in the system editor (Feature 11)
- Custom ladder product rules beyond merge priority (Feature 6)
- Cloud sync of custom files
- Migrating orphan metrics into a new schema automatically
- Landing / workout / calendar screens (Features 7–9)
