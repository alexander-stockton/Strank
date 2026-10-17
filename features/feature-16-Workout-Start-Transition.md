# Feature: Workout Start Transition

**Feature ID:** 16  
**Branch pattern:** `feature/16-Workout-Start-Transition`  
**Status:** Draft  
**Created:** 2026-10-17  
**Input:** When the user presses **Get Started** on Landing (Feature 7), instead of jumping straight to Active Workout (Feature 8), the app plays a short **transition**: a click warble on the screen, landing components fade out, then a centered **notice** appears with a rotating circled exclamation mark and a tip (or a “Welcome back!” line if the user has been away > two weeks). After **5 seconds**, the notice fades into the Active Workout checklist.  
**Depends on:** Feature 7 Landing (**Get Started**); Feature 8 Active Workout; Feature 2 / store for last-recorded-exercise date  
**Related:** `features/feature-7-Landing-Page.md`, `features/feature-8-Active-Workout.md`, `features/feature-2-Daily-Exercise-Log.md`

> **Draft note:** Sequence, copy, timing, and “welcome back” rule are locked enough to implement, but motion specifics (warble amplitude, easing) and reduced-motion behavior may be refined before **Ready**.

---

## User Stories

### US-16.1: Transition From Get Started Into Workout

**As a** local user  
**I want** a brief animated handoff after **Get Started**  
**So that** entering a workout feels intentional and I see a short health tip before the checklist

**Priority:** P1  
**Independent test:** Pressing **Get Started** runs warble → fade-out → 5s notice → Active Workout; no checklist until the notice completes (unless skipped when defined).  
**Acceptance scenarios:** see ### US-16.1 under Acceptance Criteria

### US-16.2: See A Rotating Tip Notice

**As a** local user  
**I want** a centered notice with a rotating circled exclamation mark and tip text  
**So that** I get a quick reminder before training

**Priority:** P1  
**Independent test:** Notice shows one of the tip strings (or Welcome back when eligible); icon rotates; after 5s the workout appears.  
**Acceptance scenarios:** see ### US-16.2 under Acceptance Criteria

### US-16.3: Welcome Back After A Long Gap

**As a** returning user who has not logged in over two weeks  
**I want** to see “Welcome back! (me)” instead of a random tip  
**So that** the app acknowledges the gap

**Priority:** P1  
**Independent test:** With last entry > 14 days ago (or never logged), notice text is exactly `Welcome back! (me)`.  
**Acceptance scenarios:** see ### US-16.3 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Intercept Feature 7 **Get Started** so navigation to Feature 8 goes through this transition (do not show the workout checklist until the transition finishes).
- **FR-002**: On **Get Started** click:
  1. Play a **screen warble** effect originating from / reacting to the click (subtle full-viewport distortion / shake—implementation detail; keep short, ~200–400ms).
  2. Fade out landing **components** (panels, cards, chrome that belongs to the landing composition—navbar MAY fade or stay dimmed; prefer fading content cards so the notice can own the center).
  3. Show a **centered notice** overlay.
- **FR-003**: Notice content:
  - A **circled exclamation mark** (`!` inside a circle) that **continuously rotates** while the notice is visible.
  - Tip / welcome **copy** per **FR-005** / **FR-006**, readable and centered.
- **FR-004**: Notice remains visible for **5 seconds** (wall clock from notice show), then **fades out** into the Active Workout route/view (`/workout`). Total transition MAY slightly exceed 5s once fade-in/out durations are included; the **hold** on readable tip text is 5s.
- **FR-005**: When the user is **not** in the welcome-back case (**FR-006**), pick **one** tip uniformly at random from:

  | Id | Text |
  | -- | ---- |
  | `breaks` | Take breaks; around 30% of muscle training injuries come from tiny, painless injuries built up from overwork (Kawa O, Zywiec W, Czyzewski B, et al. Most Common Injuries in Resistance Training; 2025 Oct 7). |
  | `hydration` | You're responsible for your own hydration. Water heals, nurtures, and lubricates everything in your body (some guy online). |
  | `sleep` | Sleep is the Swiss Army Knife of health. (Dr. Matthew Walker) |
  | `food` | Food is more than just taste, it is fuel. Crappy fuel makes a crappy day. (Dr. Fang Li) |

- **FR-006**: **Welcome back** overrides the random tip when the user has **not recorded any exercise entry** with `localDate` (or `createdAt`, if that is easier and documented) within the last **14 full days** relative to today (local calendar). That includes never having logged. Notice text MUST be exactly: `Welcome back! (me)`.
- **FR-007**: Prefer `prefers-reduced-motion: reduce`: skip warble and rotation; still show the notice for 5s (or shorter draft default ~1s—**TBD before Ready**), then proceed to workout.
- **FR-008**: No network; tips are bundled strings (no remote quote fetch).
- **FR-009**: User cannot interact with faded landing controls during the transition. Optional draft: tap/click skips remaining wait (**TBD**—default **no skip** for v1 draft).
- **FR-010**: Canceling mid-transition is out of scope; once **Get Started** is pressed, complete through to Active Workout (Feature 8 Cancel still available on the checklist).

---

## Assumptions

- Feature 7 still owns the **Get Started** button; this feature owns the interstitial animation + tip selection.
- “Recorded an exercise” means at least one store `entries[]` item in the last 14 local days (Feature 2 schema).
- Tips are fixed product copy for now; Config customization is out of scope.

---

## Edge Cases

- Empty store / never logged → always `Welcome back! (me)`.
- Last entry exactly 14 days ago → welcome back (strictly older than 14 days? **Draft rule:** welcome if `today - lastEntryDate >= 14` days).
- App backgrounded mid-notice → timer SHOULD pause or resume fairly; simplest draft: wall-clock continues.
- Screen reader: announce tip text once when notice appears; do not rely on rotation alone.

---

## Success Criteria

- **SC-001**: Gherkin scenarios mapped to tests before merge (when promoted from Draft).
- **SC-002**: **Get Started** always shows the notice sequence before Active Workout.
- **SC-003**: Random tip pool matches the four strings; welcome-back rule matches **FR-006**.
- **SC-004**: Notice hold is 5 seconds (± small animation tolerance).

---

## Data Ownership & Isolation

Feature 16 owns the transition UI module and tip-selection helper. It **reads** entry dates from the store; it does not write entries. It does not replace Feature 8 checklist behavior after the fade-in.

---

## Key Entities

- **StartTip:** `{ id: 'breaks'|'hydration'|'sleep'|'food'|'welcome', text: string }`
- **TransitionPhase:** `'warble' | 'fadeOut' | 'notice' | 'fadeToWorkout'`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `workoutStartTips` | `selectTip({ today, lastEntryLocalDate })` | Welcome-back or random tip |
| `workoutStartTips` | `daysSinceLastEntry(today, lastEntryLocalDate)` | Day gap helper |
| `workoutStartTransition` | `run({ onComplete })` | Drive phases; call `onComplete` → navigate workout |

---

## Screen Requirements

### Overlay: Workout start notice — route may stay on landing until complete, then `/workout`

- Full-viewport overlay after warble / fade
- Center: rotating circled `!` + tip paragraph
- No primary actions required (v1)
- Then Feature 8 Active Workout

---

## Acceptance Criteria (Gherkin)

### US-16.1 — Transition From Get Started Into Workout

#### Scenario: Get Started plays transition then opens workout

- **Given** I am on Landing with today’s workout incomplete
- **When** I press **Get Started**
- **Then** the screen warbles and landing components fade out
- **And** a centered notice is shown
- **And** after 5 seconds I am on the Active Workout checklist

### US-16.2 — See A Rotating Tip Notice

#### Scenario: Notice shows a tip from the pool

- **Given** I have logged an exercise within the last 13 days
- **When** the start notice appears
- **Then** the notice includes a rotating circled exclamation mark
- **And** the text is one of the four tip strings (`breaks`, `hydration`, `sleep`, `food`)

### US-16.3 — Welcome Back After A Long Gap

#### Scenario: Welcome back after two weeks without logs

- **Given** my most recent exercise entry is dated more than 14 days before today
- **When** I press **Get Started** and the notice appears
- **Then** the notice text is `Welcome back! (me)`
- **And** a random tip is not shown

#### Scenario: Never logged shows welcome back

- **Given** the store has no exercise entries
- **When** the start notice appears
- **Then** the notice text is `Welcome back! (me)`

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-16.1 | Get Started plays transition then opens workout | `tests/WorkoutStartTransition.test.js` | `Get Started plays transition then opens workout` |
| US-16.2 | Notice shows a tip from the pool | `tests/workoutStartTips.test.js` | `Notice shows a tip from the pool` |
| US-16.3 | Welcome back after two weeks without logs | `tests/workoutStartTips.test.js` | `Welcome back after two weeks without logs` |
| US-16.3 | Never logged shows welcome back | `tests/workoutStartTips.test.js` | `Never logged shows welcome back` |

---

## Test traceability

```text
feature-16-Workout-Start-Transition.md
  └── US-16.3 — Welcome Back After A Long Gap
        └── Scenario: Welcome back after two weeks without logs
              └── tests/workoutStartTips.test.js → it("Welcome back after two weeks without logs")
```

### File header

```javascript
/**
 * Feature 16 — Workout Start Transition
 * Spec: features/feature-16-Workout-Start-Transition.md
 */
```

---

## Agent implementation request

```text
Implement Feature 16 from @features/feature-16-Workout-Start-Transition.md on branch `feature/16-Workout-Start-Transition`.

Intercept Get Started: warble → fade landing → centered rotating circled-! notice (random tip or Welcome back if no entries in >14 days) → after 5s fade into Active Workout.
Follow Test Traceability. Respect prefers-reduced-motion when implemented.
Do not change Active Workout Complete/Cancel behavior (Feature 8).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Transition + tip selection (**FR-001** through **FR-010**) — subject to draft TBDs resolved
- [ ] **SC-001** through **SC-004** met
- [ ] Mapped tests pass
- [ ] Status promoted from **Draft** → **Ready** when TBDs (skip, reduced-motion duration) are decided

---

## Out of Scope

- Editing tip copy in Config
- Network-fetched quotes
- Changing Feature 8 checklist / Complete / Cancel
- Landing layout menus (Feature 15)
- Skippable notice (unless TBD is accepted before Ready)
