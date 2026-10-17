# Feature: Skill Progress Landing

**Feature ID:** 14  
**Branch pattern:** `feature/14-Skill-Progress-Landing`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** Extends the Feature 7 landing page. Beneath today’s expected exercises (center-left) and next-rank expectations (center-right), show **all existing exercises** from `ranks.txt` in a **four-column** list (**Arms**, **Core**, **Lungs**, **Legs**). For each skill, use Feature 4 weekly averages to show that skill’s **most recent weekly average** and a **progress bar** toward the **next rank’s** expectation for that skill. Each skill also has a **local rank**. The **overall exercise rank** displayed on landing is the **average of all local ranks** at any given moment.  
**Depends on:** Feature 7 landing shell; Feature 4 weekly compile/average/compare helpers; Feature 5 live catalog + ranks; Feature 6 custom ladders; Feature 11 landing visibility (`landing skill progress visible`)  
**Related:** `features/feature-7-Landing-Page.md`, `features/feature-4-Weekly-Ranking.md`, `features/feature-15-Landing-Layout-Day-Focus.md`

---

## User Stories

### US-14.1: See All Skills In Four Columns

**As a** local user  
**I want** every exercise from `ranks.txt` listed under Arms / Core / Lungs / Legs beneath the two center panels  
**So that** I can scan progress across my whole ladder, not only today’s focus

**Priority:** P1  
**Independent test:** With fixture ranks containing exercises under those four headers, landing shows four columns with those skills (no duplicates across columns for the same leaf).  
**Acceptance scenarios:** see ### US-14.1 under Acceptance Criteria

### US-14.2: See Per-Skill Weekly Average And Progress Bar

**As a** local user  
**I want** each skill’s latest weekly average and a bar toward the next local-rank threshold  
**So that** I know how close I am to leveling that skill

**Priority:** P1  
**Independent test:** If Bronze III push-ups require 15 and Silver I require 20, and the weekly average is 18, the bar sits halfway between those thresholds (0.5).  
**Acceptance scenarios:** see ### US-14.2 under Acceptance Criteria

### US-14.3: Overall Rank Is Average Of Local Ranks

**As a** local user  
**I want** my overall rank badge to reflect the average of every skill’s local rank  
**So that** overall standing tracks balanced progress, not only “all logged exercises meet a tier”

**Priority:** P1  
**Independent test:** With known local ranks mapped to ladder indices, overall equals the averaged (rounded) tier; landing badge updates accordingly.  
**Acceptance scenarios:** see ### US-14.3 under Acceptance Criteria

---

## Requirements

### Functional Requirements

#### Layout

- **FR-001**: On Landing, **beneath** the Feature 7 center-left (today) and center-right (next rank) panels, render a **skill progress** region.
- **FR-002**: Skill progress is a **four-column** layout with headers **Arms**, **Core**, **Lungs**, **Legs** (case display may match `ranks.txt` header casing; column identity is case-insensitive).
- **FR-003**: Populate columns from the **union of leaf exercises** across all non-`UNRANKED` tiers in `ranks.txt`, grouped by the nearest ancestor header that matches one of the four muscle groups. If an exercise appears under nested headers (e.g. Arms → Strength → push-ups), it still belongs to **Arms**.
- **FR-004**: An exercise that cannot be mapped to one of the four headers is omitted from this grid (MAY appear elsewhere); do not invent a fifth column in v1.
- **FR-005**: Respect Feature 11 `landing skill progress visible: true|false`. When false, hide the entire skill-progress region.

#### Weekly averages & local rank

- **FR-006**: For each skill, compute the **most recent weekly average** using Feature 4’s weekly compile rules (`ranking.compileWeek` / equivalent) for the **current week in progress** (same week policy as Feature 4 FR-011). If the skill has no entries this week, use the **most recent prior week** that has ≥1 entry for that skill; if never logged, average is empty / `—`.
- **FR-007**: **Local rank** for a skill is the highest tier (by ladder order) whose threshold for that exercise the skill’s weekly average **meets**, using Feature 4 meet rules (higher-is-better / lower-is-better rest). If no non-`UNRANKED` tier is met (or no average), local rank is `UNRANKED`.
- **FR-008**: **Next local threshold** is the next higher tier that defines a threshold for that exercise. If the skill is already at the max tier that defines it, progress bar is full (100%) and next label is `Max` / hide next.

#### Progress bar

- **FR-009**: Progress toward the next local rank for a skill uses the skill’s **current local-rank threshold** and **next-tier threshold** for the primary comparable metric(s):
  - Let `T_cur` = threshold value(s) at the current local rank (if `UNRANKED`, treat `T_cur` as the first non-`UNRANKED` tier’s threshold, and progress from “below first tier”).
  - Let `T_next` = threshold value(s) at the next tier.
  - Let `A` = weekly average value(s).
  - For a single higher-is-better metric:  
    `progress = clamp((A - T_cur) / (T_next - T_cur), 0, 1)`  
    Example: `T_cur = 15`, `T_next = 20`, `A = 18` → `progress = 0.5` (halfway).
  - For lower-is-better rest: invert appropriately so improving (lower) rest moves the bar forward:  
    `progress = clamp((T_cur - A) / (T_cur - T_next), 0, 1)` when `T_next < T_cur`.
  - For multi-metric thresholds: compute per-metric progress and take the **minimum** (weakest metric gates the bar).
- **FR-010**: Each skill row shows at least: name, local rank name (text), weekly average summary (key metrics), and the progress bar (accessible: `aria-valuenow` / text equivalent).

#### Overall rank (landing)

- **FR-011**: **Overall exercise rank** for Landing (badge + Feature 7 display) is the **average of all local ranks** among skills shown in the four-column grid:
  1. Map each local rank to a numeric **ladder index**: `UNRANKED` → `0`; first non-`UNRANKED` tier → `1`; …; last tier → `N`.
  2. Compute arithmetic mean of those indices (include `UNRANKED` skills as `0` so missing work pulls overall down).
  3. Round to the **nearest** integer index (`.5` rounds up).
  4. Map that index back to the tier name / badge (`0` → `UNRANKED`).
- **FR-012**: This overall formula **supersedes Feature 4 FR-005 for Landing badge / overall display** once Feature 14 ships. Feature 4’s “all logged exercises meet tier” overall MAY remain available for diagnostic Rank view / calendar week badges unless those screens are later updated to call the same average-of-locals API—implementers SHOULD expose `skillProgress.getOverallFromLocals()` so other features can adopt it without duplicating math.
- **FR-013**: No network. Read-only over store + ranks.

---

## Assumptions

- Muscle-group headers in `ranks.txt` are named Arms / Core / Lungs / Legs (or case variants). Custom ladders that rename headers must still use recognizable equivalents or skills will be omitted (**FR-004**).
- “Most recent weekly average” prefers the in-progress week, then walks backward week-by-week until a week with data for that skill exists.
- Feature 15 day-focus does **not** hide skills from this grid; it only filters **today’s** expectations (Feature 7).

---

## Edge Cases

- Skill logged but no next tier → bar at 100%; local rank = max defined for that skill.
- `T_next == T_cur` → treat as full (or 0 progress delta); avoid divide-by-zero.
- Average above `T_next` before local rank updates → clamp to 1.
- Empty ranks / no four headers → empty state `No skills to show.` under the center panels.
- One skill only → overall equals that skill’s local rank.
- Visibility off → region hidden; overall average still computed for the badge unless a future toggle says otherwise (default: always compute overall from locals when Feature 14 is active).

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: Four columns list all mappable `ranks.txt` exercises.
- **SC-003**: Progress bar math matches the halfway example (15 → 20 with average 18 → 50%).
- **SC-004**: Overall landing rank equals the rounded average of local ladder indices.
- **SC-005**: Hiding skill progress via Config removes the region from landing.

---

## Data Ownership & Isolation

Feature 14 owns skill-progress UI on landing and the local-rank / progress / average-of-locals computation services. It reuses Feature 4 weekly means and meet rules. It does not write history or ranks files.

---

## Key Entities

- **SkillProgress:** `{ exerciseId, name, muscleGroup: 'arms'|'core'|'lungs'|'legs', weeklyAverage: metrics|null, localRankName, localRankIndex, nextRankName|null, progress: number /* 0..1 */ }`
- **SkillProgressModel:** `{ columns: { arms: SkillProgress[], core: …, lungs: …, legs: … }, overallRankName, overallRankIndex }`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `skillProgress` | `getSkillProgressModel(weekStartMonday?)` | Build four-column model + overall |
| `skillProgress` | `localRankForExercise(exerciseId, averages)` | Highest met tier for one skill |
| `skillProgress` | `progressTowardNext(exerciseId, averages)` | 0..1 bar fraction |
| `skillProgress` | `getOverallFromLocals(localRanks[])` | Average-of-locals overall |

---

## Screen Requirements

### Region: Landing — Skill progress (extends Feature 7)

- Placement: full width beneath center-left + center-right panels
- Four columns: Arms | Core | Lungs | Legs
- Per skill: name, local rank, average summary, progress bar
- Overall badge (Feature 7) uses **FR-011** result

---

## Acceptance Criteria (Gherkin)

### US-14.1 — See All Skills In Four Columns

#### Scenario: Skills appear under muscle-group columns

- **Given** `ranks.txt` lists `push-ups` under Arms and `sit-ups` under Core
- **When** I open landing with skill progress visible
- **Then** the Arms column includes `push-ups`
- **And** the Core column includes `sit-ups`

### US-14.2 — See Per-Skill Weekly Average And Progress Bar

#### Scenario: Progress bar sits halfway between local ranks

- **Given** my local rank for `push-ups` is `BRONZE III` with threshold reps `15`
- **And** the next tier `SILVER I` expects reps `20` for `push-ups`
- **And** my most recent weekly average for `push-ups` reps is `18`
- **When** skill progress is rendered
- **Then** the progress bar for `push-ups` is at `50%` (halfway between 15 and 20)
- **And** the row shows the weekly average

### US-14.3 — Overall Rank Is Average Of Local Ranks

#### Scenario: Overall equals rounded mean of local indices

- **Given** the ladder indices are `UNRANKED=0`, `BRONZE I=1`, `BRONZE II=2`, `BRONZE III=3`
- **And** three skills have local ranks with indices `1`, `3`, and `3`
- **When** overall is computed from locals
- **Then** the mean index is `2.333…` rounded to `2`
- **And** the overall rank is `BRONZE II`
- **And** the landing overall badge shows `BRONZE II`

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-14.1 | Skills appear under muscle-group columns | `tests/LandingView.test.js` | `Skills appear under muscle-group columns` |
| US-14.2 | Progress bar sits halfway between local ranks | `tests/skillProgress.test.js` | `Progress bar sits halfway between local ranks` |
| US-14.3 | Overall equals rounded mean of local indices | `tests/skillProgress.test.js` | `Overall equals rounded mean of local indices` |

---

## Test traceability

```text
feature-14-Skill-Progress-Landing.md
  └── US-14.2 — See Per-Skill Weekly Average And Progress Bar
        └── Scenario: Progress bar sits halfway between local ranks
              └── tests/skillProgress.test.js → it("Progress bar sits halfway between local ranks")
```

### File header

```javascript
/**
 * Feature 14 — Skill Progress Landing
 * Spec: features/feature-14-Skill-Progress-Landing.md
 */
```

---

## Agent implementation request

```text
Implement Feature 14 from @features/feature-14-Skill-Progress-Landing.md on branch `feature/14-Skill-Progress-Landing`.

Extend Landing beneath today/next-rank panels with Arms/Core/Lungs/Legs skill columns, weekly averages, local ranks, progress bars toward next tier, and overall rank = average of local ranks (for landing badge).
Reuse Feature 4 weekly averages and meet rules. Follow Test Traceability.
Do not implement day-focus or layout drag menus (Feature 15).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Skill progress region + services (**FR-001** through **FR-013**)
- [ ] **SC-001** through **SC-005** met
- [ ] Mapped tests pass

---

## Out of Scope

- Filtering the skill grid by weekday focus (Feature 15 affects today’s list only)
- Drag/drop repositioning of the skill-progress card (Feature 15)
- Rewriting calendar week badges (optional later consumer of `getOverallFromLocals`)
- Editing ranks or format files
