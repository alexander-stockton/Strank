# Feature: Daily Exercise Log

**Feature ID:** 2  
**Branch pattern:** `feature/2-Daily-Exercise-Log`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** Persistence services so the app can create, read, update, and delete exercise entries for a calendar day (especially today). The primary *user* path to log today is Active Workout (Feature 8); day-detail edits use Feature 9. This feature owns the entry API and validation those screens call.  
**Depends on:** Feature 1 App Foundation (parsers, storage, shell); Feature 5 for live merge once implemented  
**Related:** `features/feature-5-Dynamic-Exercise-Catalog.md`, `features/feature-8-Active-Workout.md`, `features/feature-9-Workout-History-Calendar.md`

---

## User Stories

### US-2.1: Log Today’s Exercise

**As a** local user  
**I want to** add weight, duration, reps, and/or sets for an allowed exercise today  
**So that** my most recent work is recorded for this day

**Priority:** P1  
**Independent test:** From Today, add a valid catalog exercise with required metrics; it appears in today’s list.  
**Acceptance scenarios:** see ### US-2.1 under Acceptance Criteria

### US-2.2: View Today’s Exercises

**As a** local user  
**I want to** see every exercise I logged today  
**So that** I know what I have already recorded

**Priority:** P1  
**Independent test:** With two entries dated today in the store, Today lists both and none from yesterday.  
**Acceptance scenarios:** see ### US-2.2 under Acceptance Criteria

### US-2.3: Edit Today’s Exercise

**As a** local user  
**I want to** change metrics on a today’s entry  
**So that** I can correct mistakes

**Priority:** P1  
**Independent test:** Edit an entry’s reps; the list shows the new value.  
**Acceptance scenarios:** see ### US-2.3 under Acceptance Criteria

### US-2.4: Delete Today’s Exercise

**As a** local user  
**I want to** remove a today’s entry  
**So that** incorrect logs do not remain

**Priority:** P1  
**Independent test:** Delete an entry; it disappears from Today and from the store.  
**Acceptance scenarios:** see ### US-2.4 under Acceptance Criteria

### US-2.5: Day Rolls at Midnight

**As a** local user  
**I want** a new empty Today view after local midnight  
**So that** each calendar day has its own log

**Priority:** P1  
**Independent test:** Entries stamped for yesterday do not appear under Today after the date changes.  
**Acceptance scenarios:** see ### US-2.5 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: The user can create an entry for **today** (local date) with `exerciseId` from the **active catalog** and metric values required by that exercise’s current `metrics` schema. Fields are rendered dynamically (Feature 5).
- **FR-002**: Only exercises present in the active catalog MAY be logged. Unknown `exerciseId` → error `"Exercise is not allowed."`
- **FR-003**: Metric fields not in the exercise’s **current** schema MUST be rejected; missing required metric fields → `"{field} is required."`
- **FR-004**: Numeric rules: `weight` ≥ 0; `reps` ≥ 1; `sets` ≥ 1; all duration fields ≥ 1 (seconds or steps as applicable). Violations → `"{field} is invalid."`
- **FR-005**: The user can list all entries whose `localDate` equals today’s `YYYY-MM-DD`.
- **FR-006**: The user can update any field of a today’s entry except `entryId` and `localDate` (date changes belong to Feature 3 if moving across days; Feature 2 updates stay on today).
- **FR-007**: The user can delete a today’s entry by `entryId`.
- **FR-008**: Update or delete of an `entryId` that does not exist → `"Entry does not exist."`
- **FR-009**: Update or delete of an entry whose `localDate` is not today → `"Entry is not from today."` (use History / Feature 3 instead).
- **FR-010**: A new day begins at **local midnight**. The Today view MUST use the machine’s current local date; when the date changes, Yesterday’s entries no longer appear on Today.
- **FR-011**: Multiple entries for the same `exerciseId` on the same day ARE allowed (separate sets of work).
- **FR-012**: All operations MUST use Feature 1 `storage` only; no network.

---

## Assumptions

- Feature 1 storage is available; active catalog comes from Feature 1 initially and Feature 5 after merge lands.
- Feature 8 checklist **Complete** calls `createToday` / upserts for checked rows.
- Feature 9 day detail may call update/delete for any day’s entries via Feature 3 (which shares this schema).
- A standalone “Today” CRUD page is **not** required once Features 7–8 exist; keep service tests and optional thin debug UI only if useful.

---

## Edge Cases

- Creating with `exerciseId` not in catalog → `"Exercise is not allowed."`
- Missing `reps` when required → `"reps is required."`
- `reps` `0` → `"reps is invalid."`
- Updating a yesterday entry via Today service → `"Entry is not from today."`
- Empty today → UI empty state `No exercises logged today.`
- App left open across midnight → on next focus or 60s tick, Today refreshes to the new date.

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: User can create a valid today’s entry for each metric schema type (reps/sets, weight/reps, duration/sets, go/rest, steps).
- **SC-003**: User can list, update, and delete today’s entries.
- **SC-004**: Non-catalog exercises are rejected.
- **SC-005**: After local date change, Today only shows the new day’s entries.

---

## Data Ownership & Isolation

Feature 2 owns create/read/update/delete of entries **for the current local date** via the `dailyLog` service and Today screen. It reads the catalog. It does not modify `format.txt` / `ranks.txt`.

| Rule | Requirement |
| ---- | ----------- |
| **Who may call** | Local machine user (no auth) |
| **Read scope** | Entries where `localDate === today` |
| **Write scope** | Create today; update/delete only today’s entries |
| **UI scope** | Today route enabled in shell nav |

---

## Key Entities

- **ExerciseEntry:** One logged performance of a catalog exercise on a local date.
- **ExerciseCatalogEntry:** Read-only from Feature 1; supplies allowed ids and metric schema.

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `dailyLog` | `listToday()` | Entries for current local date |
| `dailyLog` | `createToday(input)` | Create entry stamped with today |
| `dailyLog` | `updateToday(entryId, patch)` | Update today’s entry |
| `dailyLog` | `deleteToday(entryId)` | Delete today’s entry |

**Create input:**

```json
{
  "exerciseId": "pike-push-ups",
  "reps": 4,
  "sets": 3
}
```

**Entry shape (stored):**

```json
{
  "entryId": "e_01J0000000000000000000",
  "exerciseId": "pike-push-ups",
  "localDate": "2026-10-17",
  "createdAt": "2026-10-17T14:22:00.000-05:00",
  "updatedAt": "2026-10-17T14:22:00.000-05:00",
  "metrics": {
    "reps": 4,
    "sets": 3
  }
}
```

`entryId` is a unique string generated on create.  
`metrics` only contains keys from the catalog schema for that exercise.

**Success:** `{ "ok": true, "data": entry }` or `{ "ok": true, "data": [entry, ...] }`  
**Error:** `{ "ok": false, "message": "..." }`

| When | Message |
| ---- | ------- |
| Unknown exercise | `Exercise is not allowed.` |
| Missing metric field | `{field} is required.` |
| Invalid numeric metric | `{field} is invalid.` |
| Missing entry | `Entry does not exist.` |
| Entry not today | `Entry is not from today.` |

---

## Screen Requirements

### View: Today — route name `today`

- Path: `/today`
- Heading: **Today**
- Subheading: local date displayed as `YYYY-MM-DD` (or locale-friendly equivalent that still makes the calendar day obvious)
- Primary action: **Add exercise**

**Add / Edit dialog**

- Exercise picker: searchable list of **active catalog** names only (grouped by `headers` optional)
- Dynamic metric fields based on selected exercise schema only—no per-exercise hardcoded field sets (labels derived from keys: Weight, Reps, Sets, Duration, Go, Rest, Steps)
- Duration inputs may accept `20s` / `1m5s` style strings and convert via Feature 1 duration parse, or numeric seconds; stored value is always the typed metric number in the schema unit
- Save label: **Save**
- Error: inline alert with service `message`
- Loading: disable Save while writing

**List**

- Each row: exercise name, metric summary, **Edit**, **Delete**
- Confirm delete: `Delete this exercise entry?`
- **Empty state:** `No exercises logged today.`

---

## Data Model Requirements

### `entries[]` item (Feature 2 owns schema)

| Field | Type | Rules |
| ----- | ---- | ----- |
| `entryId` | STRING PK | Required; unique; immutable |
| `exerciseId` | STRING | Required; must exist in catalog |
| `localDate` | STRING | Required; `YYYY-MM-DD` local |
| `createdAt` | STRING | ISO-8601 timestamp |
| `updatedAt` | STRING | ISO-8601 timestamp |
| `metrics` | OBJECT | Required; keys ⊆ catalog metrics; values numbers |

### Associations

- Entry belongs to catalog exercise by `exerciseId`
- Today view filters `localDate === currentLocalDate()`

---

## Acceptance Criteria (Gherkin)

### US-2.1 — Log Today’s Exercise

#### Scenario: User logs a valid exercise for today

- **Given** catalog exercise `pike-push-ups` requires `reps` and `sets`
- **And** today is `2026-10-17`
- **And** I am on the Today page
- **When** I add `pike-push-ups` with reps `4` and sets `3` and press **Save**
- **Then** create returns `ok`
- **And** the entry appears in today’s list with reps `4` and sets `3`
- **And** the entry `localDate` is `2026-10-17`

#### Scenario: Non-catalog exercise is rejected

- **Given** `bench-press` is not in the catalog
- **When** I try to create an entry with exerciseId `bench-press`
- **Then** the service returns message `Exercise is not allowed.`
- **And** no entry is stored

#### Scenario: Missing required metric

- **Given** catalog exercise `pike-push-ups` requires `reps` and `sets`
- **When** I create an entry with only `sets` `3`
- **Then** the service returns message `reps is required.`

### US-2.2 — View Today’s Exercises

#### Scenario: Today lists only today’s entries

- **Given** one entry dated today for `pull-ups`
- **And** one entry dated yesterday for `pull-ups`
- **When** I open Today
- **Then** I see exactly one row for `pull-ups`
- **And** I do not see yesterday’s entry

### US-2.3 — Edit Today’s Exercise

#### Scenario: User updates today’s entry

- **Given** a today’s entry for `pike-push-ups` with reps `4`
- **When** I change reps to `6` and press **Save**
- **Then** update returns `ok`
- **And** the list shows reps `6`

### US-2.4 — Delete Today’s Exercise

#### Scenario: User deletes today’s entry

- **Given** a today’s entry `e_1` is in the list
- **When** I press **Delete** and confirm
- **Then** delete returns `ok`
- **And** `e_1` no longer appears in the list

### US-2.5 — Day Rolls at Midnight

#### Scenario: After midnight Today is a new day

- **Given** an entry exists with `localDate` `2026-10-16`
- **And** the machine local date is now `2026-10-17`
- **When** I open Today
- **Then** the list is empty or only contains `2026-10-17` entries
- **And** the `2026-10-16` entry is not shown

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-2.1 | User logs a valid exercise for today | `tests/dailyLog.test.js` | `User logs a valid exercise for today` |
| US-2.1 | User logs a valid exercise for today | `tests/TodayView.test.js` | `User logs a valid exercise for today` |
| US-2.1 | Non-catalog exercise is rejected | `tests/dailyLog.test.js` | `Non-catalog exercise is rejected` |
| US-2.1 | Missing required metric | `tests/dailyLog.test.js` | `Missing required metric` |
| US-2.2 | Today lists only today’s entries | `tests/dailyLog.test.js` | `Today lists only today’s entries` |
| US-2.2 | Today lists only today’s entries | `tests/TodayView.test.js` | `Today lists only today’s entries` |
| US-2.3 | User updates today’s entry | `tests/dailyLog.test.js` | `User updates today’s entry` |
| US-2.3 | User updates today’s entry | `tests/TodayView.test.js` | `User updates today’s entry` |
| US-2.4 | User deletes today’s entry | `tests/dailyLog.test.js` | `User deletes today’s entry` |
| US-2.4 | User deletes today’s entry | `tests/TodayView.test.js` | `User deletes today’s entry` |
| US-2.5 | After midnight Today is a new day | `tests/dailyLog.test.js` | `After midnight Today is a new day` |

---

## Test traceability

```text
feature-2-Daily-Exercise-Log.md
  └── US-2.1 — Log Today’s Exercise
        └── Scenario: User logs a valid exercise for today
              └── tests/dailyLog.test.js → it("User logs a valid exercise for today")
  └── US-2.5 — Day Rolls at Midnight
        └── Scenario: After midnight Today is a new day
              └── tests/dailyLog.test.js → it("After midnight Today is a new day")
```

### File header

```javascript
/**
 * Feature 2 — Daily Exercise Log
 * Spec: features/feature-2-Daily-Exercise-Log.md
 */
```

---

## Agent implementation request

```text
Implement Feature 2 from @features/feature-2-Daily-Exercise-Log.md on branch `feature/2-Daily-Exercise-Log`.

Requires Feature 1 catalog + storage. Implement dailyLog service and Today UI only.
Follow Test Traceability. Map every Gherkin scenario in the Test Coverage Map.
Do not implement full history browser (Feature 3) or weekly ranking (Feature 4).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Daily log service and Today UI implemented (**FR-001** through **FR-012**)
- [ ] **Success Criteria (SC-001** through **SC-005)** met
- [ ] All mapped tests pass
- [ ] Test Coverage Map complete
- [ ] Test traceability satisfied

---

## Out of Scope

- Landing + Get Started UX (Feature 7)
- Active workout checklist Complete/Cancel (Feature 8) — except being called for persistence
- Workout History calendar UI (Feature 9)
- Weekly averages and ranks gallery (Features 4 / 10)
- Catalog merge / orphan policy (Feature 5)
- Config / system editors (Feature 11)
- Auth, network
