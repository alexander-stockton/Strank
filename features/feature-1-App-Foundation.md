# Feature: App Foundation

**Feature ID:** 1  
**Branch pattern:** `feature/1-App-Foundation`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** A single local user launches a standalone NW.js window with offline catalog and rank data loaded from bundled files. No auth and no network.  
**Depends on:** Nothing (first feature)  
**Related:** `format.txt`, `ranks.txt`, `features/README.md`, `features/feature-17-Packaging-Distribution.md` (exe package + user data paths)

---

## User Stories

### US-1.1: Launch Offline App

**As a** local user  
**I want to** open a standalone desktop window without signing in  
**So that** I can use the app entirely on my machine

**Priority:** P1  
**Independent test:** Launch the NW.js app; the main window opens and no network request is made.  
**Acceptance scenarios:** see ### US-1.1 under Acceptance Criteria

### US-1.2: Load Exercise Catalog

**As a** local user  
**I want** the app to know every allowed exercise from the text files  
**So that** I can only log exercises from that list

**Priority:** P1  
**Independent test:** After launch, the catalog service returns every exercise name and metric schema discovered via indentation-aware parse of `format.txt` (Feature 5 later merges with `ranks.txt`).  
**Acceptance scenarios:** see ### US-1.2 under Acceptance Criteria

### US-1.3: Load Rank Thresholds

**As a** local user  
**I want** the app to parse every rank tier from `ranks.txt`  
**So that** later features can compare my averages to those thresholds

**Priority:** P1  
**Independent test:** After launch, the ranks service returns ordered tiers in file order (including `UNRANKED` when present) with per-exercise thresholds under each tier.  
**Acceptance scenarios:** see ### US-1.3 under Acceptance Criteria

### US-1.4: Persist Locally With No Network

**As a** local user  
**I want** all app data written only to local disk  
**So that** nothing leaves my machine and nothing is fetched remotely

**Priority:** P1  
**Independent test:** Writing a smoke record succeeds on disk; an instrumented network guard reports zero outbound requests during launch and that write.  
**Acceptance scenarios:** see ### US-1.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: The application MUST run as an NW.js (Node + WebKit) standalone window on the local machine. Development may use the NW SDK (`nw .` / `npm start`). End-user distribution as `Strank.exe` is Feature 17.
- **FR-002**: The application MUST NOT require authentication, accounts, or sessions.
- **FR-003**: The application MUST NOT make any web / HTTP / HTTPS / fetch / XHR requests at runtime.
- **FR-004**: On startup the app MUST parse bundled `format.txt` into an exercise catalog using the **indentation grammar** (see below). Feature 2 may treat this as the initial allowed set; Feature 5 replaces “format-only” with the merged live catalog.
- **FR-005**: Each catalog entry MUST expose: `exerciseId` (stable slug from the exercise name), `name`, ancestor header path (e.g. region / quality / motion as whatever header strings appear at those indent levels--not a fixed enum), `metrics` schema, and optional `notes` (description text) from `{…}` on the source line.
- **FR-005b**: Wherever an exercise **name** is shown in the UI and that exercise has non-empty `notes`, the UI MUST show a **circled `?`** control beside the name. On **hover** (and keyboard focus), the control MUST reveal the notes text. Exercises without notes MUST NOT show the control.
- **FR-006**: Metric schema MUST reflect placeholders on the exercise line:
  - `#` / `#N` -> `weight` (number, non-negative)
  - `x[reps]` / `xN` style reps -> `reps` (positive integer)
  - trailing / paired `x[sets]` / `xN` sets -> `sets` (positive integer)
  - `[duration]`, `([duration])`, go/rest durations -> `durationSeconds`, and when present `durationGoSeconds` / `durationRestSeconds`; step-based -> `durationSteps`
- **FR-007**: On startup the app MUST parse bundled `ranks.txt` into ordered rank tiers using the same indentation grammar. **Tier order (low -> high) is file order** of tier headers (do not hardcode Bronze…Pro). `UNRANKED` if present is `order: 0` / first. Feature 6 allows arbitrary custom tier names.
- **FR-007b**: Immediately after a rank name line (e.g. `BRONZE I:`) and before its `--------------` separator, an optional **badge path** line MAY appear (e.g. `badges/bronze-i.svg`). Parsers MUST store it as `badgePath` on the tier. Blank lines between name and separator are ignored except the badge path line itself. See Feature 6 for custom badge images.
- **FR-008**: Each non-UNRANKED tier MUST list zero or more exercises with numeric threshold values inferred from that exercise line’s filled placeholders. Child count under any header is indeterminate.
- **FR-009**: Local persistence MUST use a single app data directory on disk (JSON file or equivalent). Feature 1 provides a storage module with `read` / `write` / `ensureInitialized`. When Feature 17 lands, that directory MUST be the **user data** directory (not a read-only install folder).
- **FR-010**: If `format.txt` or `ranks.txt` fails to parse, the app MUST show a blocking error screen with message `"Failed to load exercise data."` or `"Failed to load rank data."` and MUST NOT allow logging screens to operate.
- **FR-011**: Both file parsers MUST implement the indentation grammar in **Indentation Grammar** below. Parsers MUST NOT assume fixed lists of regions, qualities, motions, or a fixed number of bullets under any heading.

### Indentation Grammar

Applies to **`format.txt`** and **`ranks.txt`**.

1. Leading **tabs** define depth. Depth `d` = number of leading tab characters (spaces-only indent is non-conforming; treat as depth 0 with a parse warning, or reject the line--pick one and test it consistently; preferred: count tabs only).
2. For a non-empty line at index `T` with depth `d`, any following line `T+k` with depth `d+1` whose intervening lines are deeper than `d` belongs to the **subtree** headed by line `T`. Equivalently: a line one tab deeper than `T` is a **direct child** of `T` when it is the next line at depth `d+1` after returning from deeper nesting.
3. Line `T` is the **header** for information on its direct children. Headers include rank names (`BRONZE I`), regions (`ARMS`), qualities (`STRENGTH`), motions (`PUSH` / `PULL`), etc.
4. **Leaf exercise lines** typically start with `-` after their tabs. The number of leaves under a header is **not fixed**.
5. Blank lines do not change the current header stack.
6. A separator line of dashes under a rank title (e.g. `--------------`) is ignored as structure, not a header.

---

## Assumptions

- `format.txt` and `ranks.txt` ship with the app (bundled next to the package or under a known writable `data/` path so Features 5–6 can update them).
- The OS user of the machine is the only user; no multi-profile support.
- Clock and timezone are the machine’s local settings.
- Later features own entry CRUD, dynamic merge (Feature 5), custom ranks editing (Feature 6), and ranking UI; this feature supplies shell, indentation-aware parsers, and storage primitives.
- Shipped sample files use names like `ARMS` / `STRENGTH` / `PUSH`; the parser treats those as ordinary header strings.

---

## Edge Cases

- Malformed leaf line -> skip with a console/local log warning; if zero exercises parse from `format.txt` and ranks contribute none yet, Feature 1 may still load ranks; Feature 5 defines when the merged catalog is fatally empty.
- Header with zero children -> allowed (empty section).
- Deeper jump than `d+1` (e.g. depth increases by 2) -> parse warning; attach to nearest logical parent or fail the file--implementation MUST document choice in tests; preferred: **fail that file** with **FR-010**.
- Missing data directory on first launch -> create it and write an empty store `{ "entries": [], "schemaVersion": 1 }`.
- Corrupted store file -> show message `"Local data could not be read."` and offer **Reset local data** which recreates an empty store (destructive; confirm dialog required).
- Duration strings like `20s`, `1m`, `1m5s`, `15m` MUST parse to total seconds (`20`, `60`, `65`, `900`).

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: App launches as NW.js without login UI.
- **SC-003**: Catalog contains every exercise from a known fixture copy of `format.txt`, with parent headers taken from indent ancestors.
- **SC-004**: Ranks service returns all tiers in **file order** with thresholds for fixture `ranks.txt`, including variable-length sections under the same header type.
- **SC-005**: Storage round-trip works with no network calls.
- **SC-006**: Fatal parse errors block the app with the specified messages.
- **SC-007**: Indentation grammar tests prove a header owns only its `depth+1` children, not siblings.

---

## Data Ownership & Isolation

Feature 1 owns parsers, the empty store bootstrap, and the app shell. It does not own exercise entry CRUD UI.

| Rule            | Requirement                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Who may use** | The local machine user only (implicit; no auth)                                                                                              |
| **Read scope**  | Catalog and ranks are read-only from bundled text files                                                                                      |
| **Write scope** | Storage module may create/initialize the local store file                                                                                    |
| **Network**     | Forbidden                                                                                                                                    |
| **UI scope**    | Shell frame + error/blocking states; default route becomes Landing (Feature 7). Nav targets: Workout History, Ranks, Config (Features 9–11). |

---

## Key Entities

- **ExerciseCatalogEntry:** One allowed exercise leaf from an indentation-parsed file.
- **RankTier:** One named tier header from `ranks.txt` with per-exercise thresholds (tier set is file-defined; Feature 6 makes it user-editable).
- **LocalStore:** On-disk document holding `schemaVersion` and `entries` (entries filled by Features 2–3).
- **AppShell:** NW.js window hosting views.

---

## Local Service Requirements

No HTTP API. Services are in-process Node modules callable from the UI.

| Module         | Method                | Purpose                                                  |
| -------------- | --------------------- | -------------------------------------------------------- |
| `catalog`      | `loadCatalog()`       | Parse `format.txt` -> array of catalog entries           |
| `catalog`      | `getExerciseById(id)` | Lookup one entry or `null`                               |
| `ranks`        | `loadRanks()`         | Parse `ranks.txt` -> ordered tiers                       |
| `ranks`        | `listTierNames()`     | Ordered tier name strings                                |
| `storage`      | `ensureInitialized()` | Create data dir + empty store if needed                  |
| `storage`      | `readStore()`         | Return full local store object                           |
| `storage`      | `writeStore(store)`   | Atomically replace store on disk                         |
| `networkGuard` | `assertOffline()`     | Dev/test helper: throw if any outbound request attempted |

**Catalog entry shape:**

```json
{
  "exerciseId": "pike-push-ups",
  "name": "pike push-ups",
  "headers": ["ARMS", "STRENGTH", "PUSH"],
  "metrics": ["reps", "sets"],
  "notes": null
}
```

(`headers` is the ancestor header path from shallow -> deep. Convenience getters may expose `region` / `quality` / `motion` as `headers[0]` / `[1]` / `[2]` when present.)

**Examples of `metrics` arrays:**

| Exercise (name)         | metrics                                                |
| ----------------------- | ------------------------------------------------------ |
| pike push-ups           | `["reps", "sets"]`                                     |
| heavy bookbag           | `["weight", "reps"]`                                   |
| plank-hold              | `["durationSeconds", "sets"]`                          |
| burpee intervals        | `["durationGoSeconds", "durationRestSeconds", "sets"]` |
| walking lunges in-place | `["durationSteps", "sets"]`                            |
| continuous brisk-walk   | `["durationSeconds", "sets"]`                          |

**Rank tier shape:**

```json
{
  "tierId": "BRONZE_I",
  "name": "BRONZE I",
  "order": 1,
  "badgePath": "badges/bronze-i.svg",
  "thresholds": {
    "pike-push-ups": { "reps": 4, "sets": 3 }
  }
}
```

`UNRANKED` has `order: 0`, `badgePath` when present (e.g. `badges/unranked.svg`), and empty `thresholds`.

**Error result shape (services):** `{ "ok": false, "message": "..." }`  
**Success:** `{ "ok": true, "data": ... }`

---

## Screen Requirements

### View: App Shell -- route name `shell`

- Default child route: **Landing** (Feature 7).
- Hosts nav / entry points used from landing: **Workout History**, **Ranks**, **Config** (Features 9–11). Active Workout is reached via **Get Started** (Feature 8), not a permanent top-level tab.
- No login, logout, or account controls.
- Applies Feature 11 settings (font size, colors, filters) when present.
- Shows current local date where relevant (updates after midnight on next focus/tick).

### View: Data Error -- route name `dataError`

- Shown when catalog or ranks fail to load.
- Message text exactly: `Failed to load exercise data.` or `Failed to load rank data.`
- No navigation to Today / History / Rank while this view is active.

### View: Store Corrupt -- route name `storeCorrupt`

- Message: `Local data could not be read.`
- Primary action: **Reset local data** (confirm: `This deletes all saved exercises. Continue?`)

---

## Data Model Requirements

### Local store file (`store.json`)

| Field           | Type    | Rules                                        |
| --------------- | ------- | -------------------------------------------- |
| `schemaVersion` | INTEGER | Required; start at `1`                       |
| `entries`       | ARRAY   | Required; empty array until Feature 2 writes |

Feature 1 does not define entry object fields beyond ensuring the array exists; Feature 2 owns the entry schema.

### Associations

- Catalog and ranks are derived from text files, not stored in `store.json`.
- `entries` will reference `exerciseId` values that MUST exist in the catalog (enforced in Feature 2).

---

## Acceptance Criteria (Gherkin)

### US-1.1 -- Launch Offline App

#### Scenario: App opens without authentication

- **Given** the NW.js package is installed locally
- **When** I launch the application
- **Then** the main window opens
- **And** no login form is shown
- **And** no outbound network request is made

### US-1.2 -- Load Exercise Catalog

#### Scenario: Catalog includes format.txt exercises

- **Given** bundled `format.txt` contains `pike push-ups` and `burpee intervals`
- **When** `loadCatalog()` runs
- **Then** the result is `ok`
- **And** an entry named `pike push-ups` has metrics `reps` and `sets`
- **And** an entry named `burpee intervals` has metrics `durationGoSeconds`, `durationRestSeconds`, and `sets`

#### Scenario: Unknown exercise id is not in catalog

- **Given** the catalog has loaded
- **When** I call `getExerciseById("bench-press")`
- **Then** the result is `null`

### US-1.3 -- Load Rank Thresholds

#### Scenario: Ranks parse in order

- **Given** bundled `ranks.txt` includes `BRONZE I` and `PRO X`
- **When** `loadRanks()` runs
- **Then** the result is `ok`
- **And** `listTierNames()` follows file order starting with `UNRANKED` then `BRONZE I`
- **And** `listTierNames()` includes `PRO X` where it appears in the file
- **And** `BRONZE I` threshold for `pike-push-ups` has `reps` `4` and `sets` `3`

#### Scenario: Indentation makes a line the header of the next deeper line

- **Given** a fixture where `ARMS` is at depth 0 and `STRENGTH` is the next line at depth 1
- **When** the file is parsed
- **Then** `STRENGTH` is a child of `ARMS`
- **And** a later depth-0 sibling of `ARMS` is not a child of `ARMS`

#### Scenario: Variable children under the same header type

- **Given** one `PULL` section with 3 exercise leaves and another `PULL` section with 2 exercise leaves
- **When** the file is parsed
- **Then** both sections parse successfully with 3 and 2 leaves respectively

### US-1.4 -- Persist Locally With No Network

#### Scenario: First launch creates empty store

- **Given** no store file exists
- **When** `ensureInitialized()` runs
- **Then** a store file exists with `schemaVersion` `1` and `entries` `[]`
- **And** no outbound network request is made

#### Scenario: Fatal catalog parse blocks app

- **Given** `format.txt` is empty or unparseable
- **When** I launch the application
- **Then** I see `Failed to load exercise data.`
- **And** Today / History / Rank are not usable

---

## Test Coverage Map

| Story  | Scenario                                                    | Test file                   | Test name                                                     |
| ------ | ----------------------------------------------------------- | --------------------------- | ------------------------------------------------------------- |
| US-1.1 | App opens without authentication                            | `tests/shell.test.js`       | `App opens without authentication`                            |
| US-1.2 | Catalog includes format.txt exercises                       | `tests/catalog.test.js`     | `Catalog includes format.txt exercises`                       |
| US-1.2 | Unknown exercise id is not in catalog                       | `tests/catalog.test.js`     | `Unknown exercise id is not in catalog`                       |
| US-1.3 | Ranks parse in order                                        | `tests/ranks.test.js`       | `Ranks parse in order`                                        |
| US-1.3 | Indentation makes a line the header of the next deeper line | `tests/parseIndent.test.js` | `Indentation makes a line the header of the next deeper line` |
| US-1.3 | Variable children under the same header type                | `tests/parseIndent.test.js` | `Variable children under the same header type`                |
| US-1.4 | First launch creates empty store                            | `tests/storage.test.js`     | `First launch creates empty store`                            |
| US-1.4 | Fatal catalog parse blocks app                              | `tests/shell.test.js`       | `Fatal catalog parse blocks app`                              |

---

## Test traceability

```text
feature-1-App-Foundation.md
  L___ US-1.1 -- Launch Offline App
        L___ Scenario: App opens without authentication
              L___ tests/shell.test.js -> it("App opens without authentication")
  L___ US-1.2 -- Load Exercise Catalog
        L___ Scenario: Catalog includes format.txt exercises
              L___ tests/catalog.test.js -> it("Catalog includes format.txt exercises")
  L___ US-1.3 -- Load Rank Thresholds
        L___ Scenario: Ranks parse in order
              L___ tests/ranks.test.js -> it("Ranks parse in order")
  L___ US-1.4 -- Persist Locally With No Network
        L___ Scenario: First launch creates empty store
              L___ tests/storage.test.js -> it("First launch creates empty store")
```

### File header

```javascript
/**
 * Feature 1 -- App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */
```

### Nested `describe` blocks

```javascript
describe('Feature 1 -- App Foundation', () => {
  describe('US-1.2 -- Load Exercise Catalog', () => {
    it('Catalog includes format.txt exercises', async () => {
      /* … */
    });
  });
});
```

---

## Agent implementation request

```text
Implement Feature 1 from @features/feature-1-App-Foundation.md on branch `feature/1-App-Foundation`.

Build an NW.js shell with local catalog/ranks parsers and storage. No auth. No network.
Follow Test Traceability in this spec. Map every Gherkin scenario in the Test Coverage Map.
Do not implement daily logging, history CRUD, or weekly ranking UI (Features 2–4).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] NW.js shell, parsers, and storage implemented (**FR-001** through **FR-011**)
- [ ] **Success Criteria (SC-001** through **SC-007)** met
- [ ] All mapped tests pass
- [ ] Test Coverage Map complete
- [ ] Test traceability headers and nested `describe` / `it` names match scenarios

---

## Out of Scope

- Daily exercise create / read / update / delete services (Feature 2)
- History entry CRUD services (Feature 3) and calendar UI (Feature 9)
- Weekly/day compile and compare (Feature 4); ranks gallery (Feature 10)
- Merged catalog with `ranks.txt` priority and live reload (Feature 5)
- Accommodating custom ladders (Feature 6); editing files via Config (Feature 11)
- Landing / active workout UX (Features 7–8)
- Windows `Strank.exe` packaging, install-vs-user-data path resolver, copy-on-first-run (Feature 17)
- Cloud sync
