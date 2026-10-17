# Feature: Landing Page

**Feature ID:** 7  
**Branch pattern:** `feature/7-Landing-Page`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** On open, the user sees a landing page listing the expected exercise increments for today. Finished items show as completed. If the day’s workout is not finished, **Get Started** begins the workout (Feature 8).  
**Depends on:** Feature 1 shell; Feature 4 target-tier / comparison helpers; Feature 5 live catalog; Feature 2 for “already logged today” detection  
**Related:** `features/feature-8-Active-Workout.md`, `features/feature-11-Config-Accessibility-Backup.md` (landing visibility)

---

## User Stories

### US-7.1: See Today’s Expected Increments

**As a** local user  
**I want** the landing page to show what I am expected to do today  
**So that** I know today’s workout targets at a glance

**Priority:** P1  
**Independent test:** With a known target tier, landing lists each expected exercise with its increment metrics, grouped by headers.  
**Acceptance scenarios:** see ### US-7.1 under Acceptance Criteria

### US-7.2: See Completed State

**As a** local user  
**I want** finished expected exercises to show as completed  
**So that** I can tell what is already done today

**Priority:** P1  
**Independent test:** After a completed workout that saved all expected exercises, each row shows completed; **Get Started** is hidden or disabled with copy that today is done.  
**Acceptance scenarios:** see ### US-7.2 under Acceptance Criteria

### US-7.3: Start Workout

**As a** local user  
**I want** a **Get Started** button under the expected list  
**So that** I can begin today’s checklist workout

**Priority:** P1  
**Independent test:** Pressing **Get Started** navigates to Active Workout (Feature 8) with today’s expected set.  
**Acceptance scenarios:** see ### US-7.3 under Acceptance Criteria

### US-7.4: Reach Other Areas

**As a** local user  
**I want** navigation to Workout History, Ranks, and Config  
**So that** I can leave landing and return later

**Priority:** P1  
**Independent test:** Each nav control opens the correct screen; Back from those screens can return to landing.  
**Acceptance scenarios:** see ### US-7.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: App launch opens **Landing** as the default route (`/`).
- **FR-002**: Landing MUST show **today’s expected exercises**: every exercise requirement from the user’s **target tier**, with the increment values (thresholds) for that tier.
- **FR-003**: **Target tier** selection:
  1. If Feature 4 reports a current overall week-in-progress rank other than `UNRANKED`, target = **next higher tier** if one exists, else the current (max) tier.
  2. If `UNRANKED` or no logs this week, target = the **first non-UNRANKED tier** in file order.
  3. Config Advanced (Feature 11) MAY override which landing blocks are visible; it does not change this rule unless a future setting explicitly pins a tier (out of scope unless added in Feature 11).
- **FR-004**: List is **segregated by headers** from the target tier’s indentation tree (e.g. ARMS → STRENGTH → PUSH).
- **FR-005**: An expected row is **completed** when today already has a saved workout (Feature 8) or entry set that includes that `exerciseId` with metrics meeting or exceeding the expected increments (same compare rules as Feature 4 metrics, including lower-is-better rest).
- **FR-006**: If **all** expected rows are completed (or a completed workout session exists for today), show completed styling on those rows and do not emphasize **Get Started** as the primary CTA—show status `Today’s workout complete` (button may be hidden).
- **FR-007**: If not complete, show primary button **Get Started** beneath the expected list; it opens Feature 8.
- **FR-008**: Landing MUST expose navigation to **Workout History**, **Ranks**, and **Config**.
- **FR-009**: Respect Feature 11 landing visibility settings (hide sections the user disabled).
- **FR-010**: No network; no auth.

---

## Assumptions

- Expected list is derived from `ranks.txt` via Features 4–6, not a separate plan file.
- Completing via Feature 8 is the primary path; Feature 2 services still back the saved entries.

---

## Edge Cases

- Empty ranks / no non-UNRANKED tier → empty state `No rank expectations configured.` + link to Config Advanced to edit `ranks.txt`.
- Orphan expectations after catalog change → still show from ranks definition (Feature 5 ranks priority).
- Partial completion → completed rows marked; **Get Started** still available to finish remaining (Feature 8 may pre-check completed items).

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: Landing shows target-tier increments grouped by headers.
- **SC-003**: Completed rows reflect today’s saved work.
- **SC-004**: **Get Started** opens Active Workout when the day is incomplete.
- **SC-005**: Nav to History, Ranks, Config works.

---

## Data Ownership & Isolation

Feature 7 owns the Landing view and `landing.getTodayExpectations()` orchestration. It reads ranking/catalog/entries; it does not write workouts (Feature 8 does).

---

## Key Entities

- **DayExpectation:** `{ exerciseId, name, headers[], targets{}, completed: boolean }`
- **LandingModel:** `{ targetTierName, expectations[], workoutComplete: boolean }`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `landing` | `getTodayExpectations(localDate?)` | Build landing model for a day (default today) |
| `landing` | `isWorkoutComplete(localDate?)` | Boolean for CTA state |

---

## Screen Requirements

### View: Landing — route name `landing`

- Path: `/`
- Heading: app/product title (brand-level) plus today’s date
- Section: **Today’s expectations** — scrollable list by headers; each row shows name + increment chips; completed rows use distinct completed affordance (check / strikethrough / badge `Done`)
- Primary CTA: **Get Started** (when incomplete)
- Status when complete: `Today’s workout complete`
- Nav: **Workout History**, **Ranks**, **Config**

---

## Acceptance Criteria (Gherkin)

### US-7.1 — See Today’s Expected Increments

#### Scenario: Landing lists target tier increments

- **Given** the target tier is `BRONZE I`
- **And** `BRONZE I` includes `pike-push-ups` at `x4 x3`
- **When** I open the app landing page
- **Then** I see `pike-push-ups` with increments reps `4` and sets `3`
- **And** the row appears under its header group

### US-7.2 — See Completed State

#### Scenario: Finished exercises show completed

- **Given** today’s saved entries meet all `BRONZE I` expectations for the listed exercises
- **When** I open landing
- **Then** each expected row shows as completed
- **And** I see `Today’s workout complete`

### US-7.3 — Start Workout

#### Scenario: Get Started opens workout

- **Given** today’s workout is not complete
- **When** I press **Get Started**
- **Then** I am on the Active Workout screen for today

### US-7.4 — Reach Other Areas

#### Scenario: Open Workout History from landing

- **Given** I am on landing
- **When** I choose **Workout History**
- **Then** I am on the Workout History calendar screen

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-7.1 | Landing lists target tier increments | `tests/landing.test.js` | `Landing lists target tier increments` |
| US-7.1 | Landing lists target tier increments | `tests/LandingView.test.js` | `Landing lists target tier increments` |
| US-7.2 | Finished exercises show completed | `tests/LandingView.test.js` | `Finished exercises show completed` |
| US-7.3 | Get Started opens workout | `tests/LandingView.test.js` | `Get Started opens workout` |
| US-7.4 | Open Workout History from landing | `tests/LandingView.test.js` | `Open Workout History from landing` |

---

## Test traceability

```text
feature-7-Landing-Page.md
  └── US-7.3 — Start Workout
        └── Scenario: Get Started opens workout
              └── tests/LandingView.test.js → it("Get Started opens workout")
```

### File header

```javascript
/**
 * Feature 7 — Landing Page
 * Spec: features/feature-7-Landing-Page.md
 */
```

---

## Agent implementation request

```text
Implement Feature 7 from @features/feature-7-Landing-Page.md on branch `feature/7-Landing-Page`.

Landing shows target-tier daily increments, completed state, Get Started → Feature 8, and nav to History/Ranks/Config.
Follow Test Traceability. Do not implement the workout checklist itself (Feature 8).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Landing view + `landing` service (**FR-001** through **FR-010**)
- [ ] **SC-001** through **SC-005** met
- [ ] Mapped tests pass

---

## Out of Scope

- Checklist workout UI (Feature 8)
- Calendar history (Feature 9)
- Ranks gallery layout (Feature 10)
- Config settings (Feature 11)
