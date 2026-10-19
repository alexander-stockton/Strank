# Feature: Active Workout

**Feature ID:** 8  
**Branch pattern:** `feature/8-Active-Workout`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** After **Get Started**, the user works through a scrollable checklist of every exercise expected today (grouped by headers). **Complete** saves the workout and returns to landing. **Cancel** returns to landing without saving the in-progress workout.  
**Depends on:** Feature 7 expectations; Feature 2 entry create services; Feature 1 storage  
**Related:** `features/feature-7-Landing-Page.md`, `features/feature-2-Daily-Exercise-Log.md`, `features/feature-16-Workout-Start-Transition.md` (entry transition from Get Started — Draft)

---

## User Stories

### US-8.1: Work Through Checklist

**As a** local user  
**I want** a scrollable checklist of today’s expected exercises by header  
**So that** I can perform and mark each one during the session

**Priority:** P1  
**Independent test:** Active Workout shows all landing expectations in header groups with checkable rows and metric inputs.  
**Acceptance scenarios:** see ### US-8.1 under Acceptance Criteria

### US-8.2: Complete And Save

**As a** local user  
**I want** to press **Complete** when finished  
**So that** the workout is saved and I return to landing with updated completed state

**Priority:** P1  
**Independent test:** Completing writes today’s entries for checked items with entered metrics and navigates to landing.  
**Acceptance scenarios:** see ### US-8.2 under Acceptance Criteria

### US-8.3: Cancel Without Saving

**As a** local user  
**I want** to press **Cancel**  
**So that** I return to landing without saving this session’s workout

**Priority:** P1  
**Independent test:** Cancel leaves store unchanged for session drafts and returns to landing.  
**Acceptance scenarios:** see ### US-8.3 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Route `/workout` (or `/workout/:localDate` defaulting to today) shows Active Workout.
- **FR-002**: Checklist items = Feature 7 expectations for that date, **segregated by headers**, scrollable.
- **FR-003**: Each row: checkbox (or equivalent), exercise name, dynamic metric inputs prefilled with expected increments (user may change values before complete). When the exercise has `notes`/description, show the Feature 1 **circled `?`** beside the name (hover reveals the description); the control MUST NOT toggle the checkbox.
- **FR-004**: Session state is **in memory** (or an explicit `draftWorkout` not committed) until **Complete**.
- **FR-005**: **Complete** MUST: for each checked row, create/update today’s Feature 2 entries with the entered metrics; mark a `workouts` session record `{ localDate, completedAt, exerciseIds[] }` in the store; navigate to Landing; landing then shows completed state.
- **FR-006**: **Complete** with zero checked items → `"Select at least one exercise."` and stay on workout.
- **FR-007**: **Cancel** MUST discard draft session state, write nothing new for this session, navigate to Landing.
- **FR-008**: Confirm on Cancel if any checkbox or metric was changed: `Discard this workout?` → Confirm / Keep editing.
- **FR-009**: Metric validation reuses Feature 2 rules on Complete.
- **FR-010**: Already-completed expectation rows MAY start checked with prior metrics when resuming an incomplete day.
- **FR-011**: No network.

---

## Assumptions

- Primary create path for “today’s workout” is this checklist; Feature 2 remains the persistence API.
- Day-view edits of past mistakes are Feature 9 (not this screen).

---

## Edge Cases

- App crash mid-workout → draft discarded (no auto-save) unless optional draft persistence is added later (out of scope).
- User unchecks a previously saved exercise and Completes → do not delete prior entries automatically; only upsert checked rows (document this). Deleting mistaken rows is Feature 9 day edit.
- Midnight during workout → Complete stamps `localDate` as the date when the session started (store `sessionLocalDate` on enter).

---

## Success Criteria

- **SC-001**: Gherkin scenarios mapped to tests.
- **SC-002**: Checklist shows all expected exercises by header.
- **SC-003**: Complete persists entries + workout session and returns to landing.
- **SC-004**: Cancel does not persist the draft and returns to landing.

---

## Data Ownership & Isolation

Feature 8 owns Active Workout UI and draft session. Writes entries via Feature 2 and optional `workouts[]` session metadata in the store.

### Store addition

| Field | Type | Rules |
| ----- | ---- | ----- |
| `workouts` | ARRAY | Optional; `{ workoutId, localDate, completedAt, exerciseIds[] }` |

---

## Key Entities

- **WorkoutDraft:** In-progress checklist state.
- **WorkoutSession:** Persisted completion record for a localDate.

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `workout` | `start(localDate)` | Build draft from expectations |
| `workout` | `complete(draft)` | Persist entries + session |
| `workout` | `cancel()` | Drop draft |

---

## Screen Requirements

### View: Active Workout — route name `activeWorkout`

- Path: `/workout`
- Heading: **Workout** + date
- Body: scrollable sections by header; checklist rows with dynamic metric fields
- Actions: **Complete** (primary), **Cancel** (secondary)
- Back affordance: same as Cancel (confirm if dirty)

---

## Acceptance Criteria (Gherkin)

### US-8.1 — Work Through Checklist

#### Scenario: Checklist shows expected exercises by header

- **Given** today’s expectations include ARMS / STRENGTH / PUSH / `pike-push-ups`
- **When** I start a workout from **Get Started**
- **Then** I see a scrollable checklist including `pike-push-ups` under those headers

### US-8.2 — Complete And Save

#### Scenario: Complete saves and returns to landing

- **Given** I am in an active workout with `pike-push-ups` checked and valid metrics
- **When** I press **Complete**
- **Then** today’s store contains the `pike-push-ups` entry
- **And** a workout session exists for today
- **And** I am returned to landing
- **And** landing shows that exercise as completed

### US-8.3 — Cancel Without Saving

#### Scenario: Cancel discards draft

- **Given** I am in an active workout and have checked an exercise that was not previously saved today
- **When** I press **Cancel** and confirm discard
- **Then** no new entry for that exercise is stored
- **And** I am on landing

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-8.1 | Checklist shows expected exercises by header | `tests/ActiveWorkoutView.test.js` | `Checklist shows expected exercises by header` |
| US-8.2 | Complete saves and returns to landing | `tests/workout.test.js` | `Complete saves and returns to landing` |
| US-8.2 | Complete saves and returns to landing | `tests/ActiveWorkoutView.test.js` | `Complete saves and returns to landing` |
| US-8.3 | Cancel discards draft | `tests/workout.test.js` | `Cancel discards draft` |

---

## Test traceability

```text
feature-8-Active-Workout.md
  └── US-8.2 — Complete And Save
        └── Scenario: Complete saves and returns to landing
              └── tests/workout.test.js → it("Complete saves and returns to landing")
```

### File header

```javascript
/**
 * Feature 8 — Active Workout
 * Spec: features/feature-8-Active-Workout.md
 */
```

---

## Agent implementation request

```text
Implement Feature 8 from @features/feature-8-Active-Workout.md on branch `feature/8-Active-Workout`.

Scrollable header-grouped checklist; Complete saves via Feature 2; Cancel discards; return to landing.
Follow Test Traceability. Do not implement calendar history (Feature 9).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Active Workout UI + `workout` service (**FR-001** through **FR-011**)
- [ ] **SC-001** through **SC-004** met
- [ ] Mapped tests pass

---

## Out of Scope

- Landing expectations computation ownership (Feature 7)
- Calendar / day edit (Feature 9)
- Config (Feature 11)
