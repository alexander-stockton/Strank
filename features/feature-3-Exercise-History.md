# Feature: Exercise History

**Feature ID:** 3  
**Branch pattern:** `feature/3-Exercise-History`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** Services to create, read, update, and delete exercise entries across any local date. New creates use the active catalog; orphans allowed (Feature 5). The user-facing **Workout History** calendar/day UI is Feature 9 and must call these services for edits.  
**Depends on:** Feature 1 App Foundation; Feature 2 entry schema (`entries[]`); Feature 5 orphan rules once implemented  
**Related:** `features/feature-2-Daily-Exercise-Log.md`, `features/feature-5-Dynamic-Exercise-Catalog.md`, `features/feature-9-Workout-History-Calendar.md`

---

## User Stories

### US-3.1: Browse History

**As a** local user  
**I want to** view all past and present exercise entries  
**So that** I can review my full journey

**Priority:** P1  
**Independent test:** With entries on three different dates, History lists all three dates’ entries (filterable).  
**Acceptance scenarios:** see ### US-3.1 under Acceptance Criteria

### US-3.2: Add Entry on Any Date

**As a** local user  
**I want to** create an exercise entry for a chosen past or current date  
**So that** I can backfill missed logs

**Priority:** P1  
**Independent test:** Create a catalog exercise for a past `localDate`; it appears under History for that date.  
**Acceptance scenarios:** see ### US-3.2 under Acceptance Criteria

### US-3.3: Edit Any History Entry

**As a** local user  
**I want to** update any saved entry’s metrics or date  
**So that** my history stays accurate

**Priority:** P1  
**Independent test:** Change an old entry’s sets and optionally its date; the change persists.  
**Acceptance scenarios:** see ### US-3.3 under Acceptance Criteria

### US-3.4: Delete Any History Entry

**As a** local user  
**I want to** delete any entry from history  
**So that** bad data can be removed permanently

**Priority:** P1  
**Independent test:** Delete a past entry; it is gone from History and from the store.  
**Acceptance scenarios:** see ### US-3.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: The user can list the entire `entries` array, newest `localDate` first, then newest `createdAt` within a date.
- **FR-002**: The user can filter history by `localDate` (exact day), optional `exerciseId`, optional `region` (via catalog join).
- **FR-003**: The user can create an entry for any `localDate` <= today (local). Future dates -> `"Date cannot be in the future."`
- **FR-004**: Create rules reuse Feature 2 validation: **active-catalog-only** exercises, required metrics from the live schema, numeric validity messages. History list still shows orphan entries (Feature 5).
- **FR-005**: The user can update `metrics`, `exerciseId`, and/or `localDate` on any entry. `entryId` is immutable.
- **FR-006**: Changing `exerciseId` re-validates `metrics` against the new exercise schema; incompatible leftover keys are stripped only after successful validation of required fields for the new exercise (client must send a full valid metrics object for the new exercise).
- **FR-007**: The user can delete any entry by `entryId`.
- **FR-008**: Missing `entryId` on update/delete -> `"Entry does not exist."`
- **FR-009**: History UI MUST remain offline-only via Feature 1 storage.
- **FR-010**: Creating/editing history for **today** MUST remain consistent with Feature 2: the same store; Today and History reflect the same underlying entries.
- **FR-011**: When History UI lists an exercise that has catalog `notes`, show the Feature 1 **circled `?`** description control beside the name (hover reveals notes).

---

## Assumptions

- Entry schema from Feature 2 is unchanged.
- Feature 2 Today remains the fast path for the current day; History is the full CRUD surface.
- Soft-delete is out of scope; delete is permanent.

---

## Edge Cases

- Filter with no matches -> empty state `No exercises match these filters.`
- Entire store empty -> `No exercise history yet.`
- Future `localDate` on create/update -> `"Date cannot be in the future."`
- Invalid date string -> `"localDate is invalid."`
- Delete last entry on a day -> day group disappears from grouped view

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: User can list and filter all entries.
- **SC-003**: User can create entries for past dates and today.
- **SC-004**: User can update and delete any entry.
- **SC-005**: Future dates are rejected.
- **SC-006**: Today view still shows today’s entries after History edits the same records.

---

## Data Ownership & Isolation

Feature 3 owns the `history` service and History screen for **all** entries. It shares the Feature 2 entry schema and Feature 1 store.

| Rule             | Requirement                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Who may call** | Local machine user                                                                                                                       |
| **Read scope**   | All entries                                                                                                                              |
| **Write scope**  | Create / update / delete any entry (with date <= today)                                                                                  |
| **UI scope**     | Service layer required. Prefer Feature 9 calendar as the only user-facing History UI; any early list/filter screen is optional/internal. |

---

## Key Entities

- **ExerciseEntry:** Same as Feature 2.
- **HistoryFilter:** Optional `localDate`, `exerciseId`, `region`.

---

## Local Service Requirements

| Module    | Method                   | Purpose                       |
| --------- | ------------------------ | ----------------------------- |
| `history` | `list(filters?)`         | All entries, optional filters |
| `history` | `create(input)`          | Create for any allowed date   |
| `history` | `update(entryId, patch)` | Update any entry              |
| `history` | `delete(entryId)`        | Delete any entry              |

**Create input:**

```json
{
  "exerciseId": "pull-ups",
  "localDate": "2026-10-10",
  "reps": 2,
  "sets": 3
}
```

(Metrics may be nested under `metrics` instead of flattened; implementation must accept one consistent shape and document it in code to match tests.)

**Filter query object:**

```json
{
  "localDate": "2026-10-10",
  "exerciseId": "pull-ups",
  "region": "ARMS"
}
```

All filter fields optional. All provided filters AND together.

---

## Screen Requirements

### View: History -- route name `history`

- Path: `/history`
- Heading: **History**
- Primary action: **Add exercise**

**Filters**

- Date, Exercise, Region
- Action: **Apply filters**
- Clear: **Clear filters**

**List**

- Grouped by `localDate` (descending)
- Row: exercise name, metrics summary, **Edit**, **Delete**
- Confirm delete: `Delete this exercise entry?`
- Empty (no data): `No exercise history yet.`
- Empty (filters): `No exercises match these filters.`

**Add / Edit dialog**

- Same metric UX as Today, plus **Date** field (`localDate`)
- Date defaults to today on create
- Error alert uses service `message`

---

## Data Model Requirements

No new tables. Uses Feature 2 `entries[]` schema.

### Associations

- History list joins catalog for name/region display
- Filters may use catalog `region`

---

## Acceptance Criteria (Gherkin)

### US-3.1 -- Browse History

#### Scenario: User sees entries across dates

- **Given** entries exist on `2026-10-10`, `2026-10-12`, and `2026-10-17`
- **When** I open History with no filters
- **Then** I see entries for all three dates
- **And** dates appear in descending order

#### Scenario: User filters by date

- **Given** entries exist on `2026-10-10` and `2026-10-12`
- **When** I filter by date `2026-10-10` and apply filters
- **Then** only `2026-10-10` entries are shown

### US-3.2 -- Add Entry on Any Date

#### Scenario: User backfills a past exercise

- **Given** today is `2026-10-17`
- **And** `bed-lifts` is in the catalog
- **When** I create `bed-lifts` on `2026-10-10` with reps `5` and sets `3`
- **Then** create returns `ok`
- **And** History shows the entry under `2026-10-10`

#### Scenario: Future date is rejected

- **Given** today is `2026-10-17`
- **When** I create an entry with `localDate` `2026-10-18`
- **Then** the service returns message `Date cannot be in the future.`

### US-3.3 -- Edit Any History Entry

#### Scenario: User updates a past entry

- **Given** entry `e_1` on `2026-10-10` has sets `3`
- **When** I change sets to `4` and save
- **Then** update returns `ok`
- **And** History shows sets `4` for `e_1`

#### Scenario: User moves an entry to another past date

- **Given** entry `e_1` has `localDate` `2026-10-10`
- **When** I change `localDate` to `2026-10-11` and save
- **Then** update returns `ok`
- **And** `e_1` appears under `2026-10-11`

### US-3.4 -- Delete Any History Entry

#### Scenario: User deletes a history entry

- **Given** entry `e_1` exists in History
- **When** I delete `e_1` and confirm
- **Then** delete returns `ok`
- **And** `e_1` no longer appears in History

---

## Test Coverage Map

| Story  | Scenario                                 | Test file                   | Test name                                  |
| ------ | ---------------------------------------- | --------------------------- | ------------------------------------------ |
| US-3.1 | User sees entries across dates           | `tests/history.test.js`     | `User sees entries across dates`           |
| US-3.1 | User sees entries across dates           | `tests/HistoryView.test.js` | `User sees entries across dates`           |
| US-3.1 | User filters by date                     | `tests/history.test.js`     | `User filters by date`                     |
| US-3.1 | User filters by date                     | `tests/HistoryView.test.js` | `User filters by date`                     |
| US-3.2 | User backfills a past exercise           | `tests/history.test.js`     | `User backfills a past exercise`           |
| US-3.2 | Future date is rejected                  | `tests/history.test.js`     | `Future date is rejected`                  |
| US-3.3 | User updates a past entry                | `tests/history.test.js`     | `User updates a past entry`                |
| US-3.3 | User moves an entry to another past date | `tests/history.test.js`     | `User moves an entry to another past date` |
| US-3.4 | User deletes a history entry             | `tests/history.test.js`     | `User deletes a history entry`             |
| US-3.4 | User deletes a history entry             | `tests/HistoryView.test.js` | `User deletes a history entry`             |

---

## Test traceability

```text
feature-3-Exercise-History.md
  L___ US-3.1 -- Browse History
        L___ Scenario: User sees entries across dates
              L___ tests/history.test.js -> it("User sees entries across dates")
  L___ US-3.2 -- Add Entry on Any Date
        L___ Scenario: Future date is rejected
              L___ tests/history.test.js -> it("Future date is rejected")
```

### File header

```javascript
/**
 * Feature 3 -- Exercise History
 * Spec: features/feature-3-Exercise-History.md
 */
```

---

## Agent implementation request

```text
Implement Feature 3 from @features/feature-3-Exercise-History.md on branch `feature/3-Exercise-History`.

Requires Feature 1 storage/catalog and Feature 2 entry schema. Implement history service and History UI.
Follow Test Traceability. Map every Gherkin scenario in the Test Coverage Map.
Do not implement weekly ranking UI (Feature 4).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] History service and UI implemented (**FR-001** through **FR-010**)
- [ ] **Success Criteria (SC-001** through **SC-006)** met
- [ ] All mapped tests pass
- [ ] Test Coverage Map complete
- [ ] Test traceability satisfied

---

## Out of Scope

- Month calendar / day-rank chrome (Feature 9) -- this feature supplies CRUD only
- Weekly compile / ranks gallery (Features 4 / 10)
- Live catalog merge ownership (Feature 5)
- Config export ZIP (Feature 11)
- Auth, network
