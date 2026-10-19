# Feature: Landing Page

**Feature ID:** 7  
**Branch pattern:** `feature/7-Landing-Page`  
**Status:** Ready  
**Created:** 2026-10-17  
**Updated:** 2026-10-17  
**Input:** On open, the user sees a landing shell with a configurable **navbar** (left or top icon tabs), an **overall rank badge**, **today’s expected exercises** (center-left), and the **next rank’s expectations** (center-right). Finished today-items show completed. If today’s workout is not finished, **Get Started** begins the workout (Feature 8). Features 14–15 extend the landing with skill progress and layout/day-focus customization.  
**Depends on:** Feature 1 shell; Feature 4 target-tier / comparison helpers; Feature 5 live catalog; Feature 2 for “already logged today” detection; Feature 11 for navbar alignment + landing visibility  
**Related:** `features/feature-8-Active-Workout.md`, `features/feature-10-Ranks-Gallery.md`, `features/feature-11-Config-Accessibility-Backup.md`, `features/feature-14-Skill-Progress-Landing.md`, `features/feature-15-Landing-Layout-Day-Focus.md`, `features/feature-16-Workout-Start-Transition.md` (Get Started interstitial — Draft)

---

## User Stories

### US-7.1: See Today’s Expected Exercises

**As a** local user  
**I want** the landing page to show what I am expected to do today (center-left)  
**So that** I know today’s workout targets at a glance

**Priority:** P1  
**Independent test:** With a known target tier (and default day-focus when Feature 15 is present), landing lists each expected exercise with increment metrics, grouped by headers, in the center-left panel.  
**Acceptance scenarios:** see ### US-7.1 under Acceptance Criteria

### US-7.2: See Next Rank Expectations

**As a** local user  
**I want** the next higher rank’s expectations shown center-right  
**So that** I can see what I am aiming for

**Priority:** P1  
**Independent test:** With current standing `BRONZE III` and next tier `SILVER I`, center-right lists `SILVER I` thresholds grouped by headers.  
**Acceptance scenarios:** see ### US-7.2 under Acceptance Criteria

### US-7.3: See Overall Rank Badge And Navbar

**As a** local user  
**I want** my overall rank badge and icon-tab navigation always available  
**So that** I know my standing and can reach other screens

**Priority:** P1  
**Independent test:** Overall badge appears top-left beside a left navbar (default) or top-right when navbar is top-aligned; icon tabs open Landing, History, Ranks, Config.  
**Acceptance scenarios:** see ### US-7.3 under Acceptance Criteria

### US-7.4: See Completed State And Start Workout

**As a** local user  
**I want** finished expected exercises marked complete and a **Get Started** CTA when incomplete  
**So that** I can finish today’s workout

**Priority:** P1  
**Independent test:** Completed rows styled; **Get Started** opens Feature 8 when the day is incomplete.  
**Acceptance scenarios:** see ### US-7.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

#### Shell & navigation

- **FR-001**: App launch opens **Landing** as the default route (`/`).
- **FR-002**: Landing (and other primary screens) share an app **navbar** of **icon tabs** for: Landing, Workout History, Ranks, Config. Active route is visually indicated.
- **FR-003**: Navbar **alignment** comes from Config (`navbar alignment: left|top`, Feature 11). Default **`left`**.
  - **`left`**: vertical icon rail on the left. Overall rank badge sits in the **top-left** of the content area (adjacent to / above the rail as designed—badge remains visible next to the sidebar).
  - **`top`**: horizontal icon rail along the top. Overall rank badge sits in the **top-right** corner instead.
- **FR-004**: Overall rank badge shows the user’s **current overall rank** image + accessible name (from Feature 4 ranking for the current week; Feature 14 may redefine how overall rank is computed—Landing always displays whatever overall the ranking service returns).

#### Center content

- **FR-005**: **Center-left** panel: **Today’s expected exercises** — every exercise required for **today** from the user’s **target tier**, with increment values, segregated by headers. Each expectation row includes optional catalog/`ranks.txt` `notes`; when present, show the Feature 1 **circled `?`** beside the name (hover reveals the description).
- **FR-006**: **Center-right** panel: **Next rank’s expectations** — thresholds for the **next higher tier** above the user’s current overall standing (if none, show `You are at the top of the ladder.` or the max tier’s expectations labeled as current max). List style matches today’s list (headers + increments) but is clearly labeled with the next tier name.
- **FR-007**: **Target tier** (for today’s expectations / Get Started):
  1. If Feature 4 reports a current overall week-in-progress rank other than `UNRANKED`, target = **next higher tier** if one exists, else the current (max) tier.
  2. If `UNRANKED` or no logs this week, target = the **first non-UNRANKED tier** in file order.
- **FR-008**: When Feature 15 day-focus is available, today’s list is **filtered** to exercises under muscle-group headers scheduled for today’s weekday. Until Feature 15 ships, show the full target-tier tree for today.
- **FR-009**: An expected row is **completed** when today already has a saved workout (Feature 8) or entry set that includes that `exerciseId` with metrics meeting or exceeding the expected increments (Feature 4 compare rules, including lower-is-better rest).
- **FR-010**: If **all** today’s expected rows are completed, show completed styling and status `Today’s workout complete` (hide or de-emphasize **Get Started**).
- **FR-011**: If not complete, show primary **Get Started** under the today’s list; opens Feature 8 with today’s expected set.
- **FR-012**: Respect Feature 11 landing visibility settings (hide panels the user disabled).
- **FR-013**: No network; no auth.
- **FR-014**: Features 14–15 MAY add regions beneath the two center columns; this feature must leave a clear content slot / layout hooks for those extensions without requiring a Feature 7 rewrite.

---

## Assumptions

- Expected lists are derived from `ranks.txt` via Features 4–6, not a separate plan file.
- Navbar is a shared shell component reused across primary routes (Landing hosts the canonical layout contract).
- Completing via Feature 8 is the primary path; Feature 2 services back saved entries.

---

## Edge Cases

- Empty ranks / no non-UNRANKED tier → empty state `No rank expectations configured.` + path to Rank Editor (Feature 13 via Config).
- No next tier → center-right empty/top-ladder message.
- Partial completion → completed rows marked; **Get Started** still available.
- Navbar top on narrow windows → wrap or scroll icon tabs horizontally; badge remains top-right.

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: Landing shows today’s expectations (center-left) and next-rank expectations (center-right).
- **SC-003**: Navbar left/top + overall badge placement follow Config alignment.
- **SC-004**: Completed rows reflect today’s saved work; **Get Started** opens Active Workout when incomplete.
- **SC-005**: Icon tabs navigate to History, Ranks, Config, Landing.

---

## Data Ownership & Isolation

Feature 7 owns the Landing view shell (navbar placement contract, badge placement, two center columns, Get Started). Ranking math remains Feature 4 (extended by 14). Day-focus filtering is Feature 15.

---

## Key Entities

- **DayExpectation:** `{ exerciseId, name, headers[], targets{}, notes?: string|null, completed: boolean }`
- **LandingModel:** `{ overallRankName, overallBadgePath, targetTierName, nextTierName, todayExpectations[], nextRankExpectations[], workoutComplete: boolean, navbarAlignment: 'left'|'top' }`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `landing` | `getLandingModel(localDate?)` | Build full landing model for a day (default today) |
| `landing` | `getTodayExpectations(localDate?)` | Today’s filtered expectations |
| `landing` | `getNextRankExpectations()` | Next tier threshold list |
| `landing` | `isWorkoutComplete(localDate?)` | Boolean for CTA state |

---

## Screen Requirements

### View: Landing — route name `landing`

- Path: `/`
- **Navbar:** icon tabs (Landing | History | Ranks | Config) — left rail or top bar per Config
- **Overall rank badge:** top-left (navbar left) or top-right (navbar top)
- **Center-left:** Today’s expected exercises (+ **Get Started** / complete status)
- **Center-right:** Next rank’s expectations
- **Below (reserved):** Feature 14 skill progress; Feature 15 chrome (menus) attaches to navbar / badge area

---

## Acceptance Criteria (Gherkin)

### US-7.1 — See Today’s Expected Exercises

#### Scenario: Landing lists today’s increments center-left

- **Given** the target tier is `BRONZE I`
- **And** `BRONZE I` includes `pike-push-ups` at `x4 x3`
- **When** I open the app landing page
- **Then** the center-left panel shows `pike-push-ups` with increments reps `4` and sets `3`
- **And** the row appears under its header group

### US-7.2 — See Next Rank Expectations

#### Scenario: Next tier listed center-right

- **Given** my current overall rank is `BRONZE III`
- **And** the next tier is `SILVER I`
- **When** I open landing
- **Then** the center-right panel is labeled for `SILVER I`
- **And** it lists `SILVER I` exercise thresholds

### US-7.3 — See Overall Rank Badge And Navbar

#### Scenario: Left navbar places badge top-left

- **Given** `navbar alignment: left`
- **When** I open landing
- **Then** icon tabs appear in a left sidebar
- **And** the overall rank badge appears in the top-left

#### Scenario: Top navbar places badge top-right

- **Given** `navbar alignment: top`
- **When** I open landing
- **Then** icon tabs appear along the top
- **And** the overall rank badge appears in the top-right

### US-7.4 — See Completed State And Start Workout

#### Scenario: Get Started opens workout

- **Given** today’s workout is not complete
- **When** I press **Get Started**
- **Then** I am on the Active Workout screen for today

#### Scenario: Finished exercises show completed

- **Given** today’s saved entries meet all of today’s expectations
- **When** I open landing
- **Then** each expected row shows as completed
- **And** I see `Today’s workout complete`

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-7.1 | Landing lists today’s increments center-left | `tests/landing.test.js` | `Landing lists today’s increments center-left` |
| US-7.2 | Next tier listed center-right | `tests/LandingView.test.js` | `Next tier listed center-right` |
| US-7.3 | Left navbar places badge top-left | `tests/LandingView.test.js` | `Left navbar places badge top-left` |
| US-7.3 | Top navbar places badge top-right | `tests/LandingView.test.js` | `Top navbar places badge top-right` |
| US-7.4 | Get Started opens workout | `tests/LandingView.test.js` | `Get Started opens workout` |
| US-7.4 | Finished exercises show completed | `tests/LandingView.test.js` | `Finished exercises show completed` |

---

## Test traceability

```text
feature-7-Landing-Page.md
  └── US-7.4 — See Completed State And Start Workout
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

Landing shell: navbar left/top from config, overall rank badge placement, center-left today’s expectations, center-right next rank expectations, Get Started → Feature 8.
Follow Test Traceability. Leave layout hooks for Features 14–15. Do not implement skill progress or day-focus menus here.
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Landing shell + services (**FR-001** through **FR-014**)
- [ ] **SC-001** through **SC-005** met
- [ ] Mapped tests pass

---

## Out of Scope

- Skill progress columns / local-rank bars (Feature 14)
- Layout drag-drop and weekday muscle-focus menus (Feature 15)
- Checklist workout UI (Feature 8)
- Calendar history (Feature 9)
- Ranks gallery layout (Feature 10)
- Config settings UI (Feature 11)
