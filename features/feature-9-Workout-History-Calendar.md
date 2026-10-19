# Feature: Workout History Calendar

**Feature ID:** 9  
**Branch pattern:** `feature/9-Workout-History-Calendar`  
**Status:** Ready  
**Created:** 2026-10-17  
**Updated:** 2026-10-17  
**Input:** From landing, the user opens **Workout History**, which **defaults to a month calendar**. Recorded days are blue cells with white day numbers; other days are white cells with blue numbers. Each week row shows that week’s average rank badge (Feature 4). Beside the month/year heading: **month-start badge → arrow → latest-finished-week badge** (or **month-finish badge** if the month is complete)—see Feature 4 **FR-016**. Click a **day** to zoom into day detail (entries + day-rank badge + edit). Click the **year** in the heading to zoom out to a **Years** overview (every year with app use), each row using the same **start → finish** badge scheme. Back stacks through zoom levels to landing.  
**Depends on:** Feature 3 history CRUD services; Feature 4 week/day compare + month/year progression helpers; Feature 7 landing as root  
**Related:** `features/feature-3-Exercise-History.md`, `features/feature-4-Weekly-Ranking.md`

---

## User Stories

### US-9.1: View Month Calendar

**As a** local user  
**I want** a calendar of the current month with recorded days styled distinctly and week/month rank cues  
**So that** I can see when I worked out and how ranks moved

**Priority:** P1  
**Independent test:** A month with workouts on the 3rd and 10th shows those days blue/white-number; other days white/blue-number; week-end badges and month progression strip match Feature 4.  
**Acceptance scenarios:** see ### US-9.1 under Acceptance Criteria

### US-9.2: See Weekly Rank Badges

**As a** local user  
**I want** each week on the calendar to show a rank badge  
**So that** I know where that week’s averages stood

**Priority:** P1  
**Independent test:** Beside each week row, a badge shows Feature 4’s overall tier name for that Mon–Sun range (or UNRANKED).  
**Acceptance scenarios:** see ### US-9.2 under Acceptance Criteria

### US-9.3: Open Day Details And Edit

**As a** local user  
**I want** to click a day to see exact exercises and that day’s rank badge, and edit mistakes  
**So that** I can fix bad entries without losing history context

**Priority:** P1  
**Independent test:** Clicking a recorded day shows entries + day-rank badge; editing an entry persists via Feature 3.  
**Acceptance scenarios:** see ### US-9.3 under Acceptance Criteria

### US-9.4: Navigate Time, Zoom Levels, And Back

**As a** local user  
**I want** month as the default zoom, day zoom-in, year zoom-out, plus month/year jumps, and back one level at a time  
**So that** I can move through history and return to landing

**Priority:** P1  
**Independent test:** History opens on month; click day → day detail; click year → years overview; Back from day → month → (from years) month or landing per stack; Prev/Next month/year still work on month view.  
**Acceptance scenarios:** see ### US-9.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Route `/history` shows the **month calendar** by default for `viewYear`/`viewMonth` (default: current local month). This is the default Workout History zoom (Feature 4 **FR-013**).
- **FR-002**: A day is **recorded** if any `entries` exist for that `localDate` OR a Feature 8 `workouts` session exists for that date.
- **FR-003**: Recorded day cell: **blue background**, **white** day number. Non-recorded: **white background**, **blue** day number. (Exact hex may follow Feature 11 theme; contrast must remain clear.) Matches Feature 4 **FR-014**.
- **FR-004**: Beside each calendar week (Mon–Sun row): a **rank badge** from Feature 4 `compareToRanks(weekStartMonday)` (`overallTierName`), using Feature 4’s **passed-days-only** window and **min-3 / all-zero padding** rules (**FR-002a**–**FR-002c**).
- **FR-005**: Clicking a day opens **Day detail** (`/history/day/:localDate`) showing: date heading, **day-rank badge**, list of that day’s exercise entries with metrics. When an entry’s exercise has catalog `notes`, show the Feature 1 **circled `?`** beside the name (hover reveals the description).
- **FR-006**: **Day rank:** Feature 4 `ranking.compareDay(localDate)` — same meet-tier rules as weekly, but **without averaging across other days** (per-exercise metrics = that day’s values; if multiple entries same exercise same day, average those).
- **FR-007**: Day detail allows **edit** and **delete** of entries (Feature 3 services). After edit, day-rank badge refreshes.
- **FR-008**: Month view controls: **Previous year**, **Next year**, **Previous month**, **Next month**, and display **Month** + clickable **YYYY**.
- **FR-008a**: Beside the month/year heading, render Feature 4 `getMonthProgression(year, month)` as **`[start badge] → [trailing badge]`** (month-start standing → latest finished week in/intersecting month, or month-finish if the month is complete). See Feature 4 **FR-016**.
- **FR-008b**: Clicking the **year** opens **Years overview** (`/history/years` or in-view zoom). Lists Feature 4 `listActiveYears()`; each row shows `getYearProgression(year)` as **`[start badge] → [finish/latest badge]`**. Clicking a year navigates to month view per Feature 4 **FR-019**.
- **FR-009**: Day detail controls: **Previous day**, **Next day** (adjacent calendar dates).
- **FR-010**: **Back** stack (one level at a time):
  - Day detail → month calendar (same month as that day)
  - Years overview → month calendar (the month that was showing when the year was clicked, or current month)
  - Month calendar → Landing
- **FR-011**: Empty day detail (non-recorded): copy `No exercises recorded.` still allows Back / day nav; optional add entry via Feature 3 create is allowed (P2).
- **FR-012**: No network.
- **FR-013**: Early Feature 3 list/filter History UI is superseded as the **primary** user-facing History once this feature ships (Feature 3 services remain).

---

## Assumptions

- Feature 3 owns persistence APIs; this feature owns calendar / day / years chrome.
- Feature 4 owns rank math and the progression contract (**FR-013**–**FR-020** there).

---

## Edge Cases

- Weeks spanning two months: badge uses ISO week of the row’s Monday; days outside current month may show muted in grid but remain clickable (preferred) or hidden—pick **show muted trailing/leading days**.
- Timezone: all dates local.
- Theme colors from Feature 11 override default blue/white but must keep “recorded vs not” distinguishable (including colorblind filter modes).
- No years with entries yet → Years overview still lists current year with UNRANKED → UNRANKED (or empty) progression.

---

## Success Criteria

- **SC-001**: Gherkin scenarios mapped to tests.
- **SC-002**: Recorded vs non-recorded day styling correct.
- **SC-003**: Week badges match Feature 4 for those weeks.
- **SC-004**: Day detail shows entries, day badge, and supports edit.
- **SC-005**: Month/year/day navigation, year zoom-out, and stacked Back work.
- **SC-006**: Month and year progression strips match Feature 4 helpers.

---

## Data Ownership & Isolation

Feature 9 owns calendar + day-detail + years overview views. Reads entries/workouts/ranks via Feature 3/4; writes only through Feature 3 on edit.

---

## Key Entities

- **CalendarDayCell:** `{ localDate, recorded, dayNumber }`
- **WeekBadge:** `{ weekStart, tierName }`
- **DayDetailModel:** `{ localDate, tierName, entries[] }`
- **YearRowModel:** `{ year, progression }` (from Feature 4)

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `historyCalendar` | `getMonth(year, month)` | Cells + week badges + month progression |
| `historyCalendar` | `getDay(localDate)` | Detail model |
| `historyCalendar` | `getYearsOverview()` | Active years + progressions |
| `ranking` | `compareDay(localDate)` | Day-rank result |
| `ranking` | `getMonthProgression` / `getYearProgression` / `listActiveYears` | Feature 4 |

---

## Screen Requirements

### View: Workout History (month) — route name `workoutHistory`

- Path: `/history`
- Heading: **Month name** + clickable **year**; progression `[start] → [trailing]` beside heading
- Controls: ⟵ Year | ⟵ Month | heading | Month ⟶ | Year ⟶
- Grid: calendar; week-end badges aligned to each row
- Back: **Back** → Landing

### View: Years overview — route name `historyYears`

- Path: `/history/years` (or equivalent)
- Heading: **Years**
- List: year rows with start → finish/latest badges
- Click year → month view
- Back: **Back** → prior month view

### View: Day detail — route name `historyDay`

- Path: `/history/day/:localDate`
- Heading: formatted date
- Badge: day rank
- List: exercises + **Edit** / **Delete**
- Controls: ⟵ Day | Day ⟶
- Back: **Back** → month calendar

---

## Acceptance Criteria (Gherkin)

### US-9.1 — View Month Calendar

#### Scenario: Recorded days use blue cell white number

- **Given** entries exist on `2026-10-03` and none on `2026-10-04`
- **When** I open Workout History for October 2026
- **Then** day `3` is a blue cell with a white number
- **And** day `4` is a white cell with a blue number

#### Scenario: Month heading shows progression badges

- **Given** Feature 4 month progression for October 2026 is start `BRONZE I` and trailing `SILVER I`
- **When** I view that month
- **Then** beside the heading I see `BRONZE I`, an arrow, and `SILVER I`

### US-9.2 — See Weekly Rank Badges

#### Scenario: Week shows rank badge

- **Given** week starting `2026-10-13` compares to overall tier `SILVER I`
- **When** I view the October 2026 calendar
- **Then** that week’s badge shows `SILVER I`

### US-9.3 — Open Day Details And Edit

#### Scenario: Day detail shows exercises and day rank

- **Given** `2026-10-03` has a `pull-ups` entry and day rank `BRONZE I`
- **When** I click day `3`
- **Then** I see `pull-ups` details
- **And** I see a badge `BRONZE I`

#### Scenario: User edits a mistaken entry

- **Given** I am on day detail for `2026-10-03` with `pull-ups` reps `2`
- **When** I edit reps to `3` and save
- **Then** the detail shows reps `3`
- **And** the store entry is updated

### US-9.4 — Navigate Time, Zoom Levels, And Back

#### Scenario: Jump month and year

- **Given** I am viewing October 2026
- **When** I press next month
- **Then** the heading shows November 2026
- **When** I press previous year
- **Then** the heading shows November 2025

#### Scenario: Click year opens years overview

- **Given** I am on the October 2026 month view
- **When** I click the year `2026`
- **Then** I see the years overview with progression badges per year

#### Scenario: Back stack returns through zoom levels

- **Given** I am on a day detail opened from the calendar
- **When** I press **Back**
- **Then** I am on the month calendar
- **When** I press **Back**
- **Then** I am on landing

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-9.1 | Recorded days use blue cell white number | `tests/HistoryCalendarView.test.js` | `Recorded days use blue cell white number` |
| US-9.1 | Month heading shows progression badges | `tests/HistoryCalendarView.test.js` | `Month heading shows progression badges` |
| US-9.2 | Week shows rank badge | `tests/HistoryCalendarView.test.js` | `Week shows rank badge` |
| US-9.3 | Day detail shows exercises and day rank | `tests/HistoryDayView.test.js` | `Day detail shows exercises and day rank` |
| US-9.3 | User edits a mistaken entry | `tests/HistoryDayView.test.js` | `User edits a mistaken entry` |
| US-9.4 | Jump month and year | `tests/HistoryCalendarView.test.js` | `Jump month and year` |
| US-9.4 | Click year opens years overview | `tests/HistoryCalendarView.test.js` | `Click year opens years overview` |
| US-9.4 | Back stack returns through zoom levels | `tests/HistoryCalendarView.test.js` | `Back stack returns through zoom levels` |

---

## Test traceability

```text
feature-9-Workout-History-Calendar.md
  └── US-9.1 — View Month Calendar
        └── Scenario: Recorded days use blue cell white number
              └── tests/HistoryCalendarView.test.js → it("Recorded days use blue cell white number")
```

### File header

```javascript
/**
 * Feature 9 — Workout History Calendar
 * Spec: features/feature-9-Workout-History-Calendar.md
 */
```

---

## Agent implementation request

```text
Implement Feature 9 from @features/feature-9-Workout-History-Calendar.md on branch `feature/9-Workout-History-Calendar`.

Month calendar (default) with recorded styling, week rank badges, month progression strip, day detail with day rank + edit, years overview on year click, Back stack.
Use Feature 3 for writes and Feature 4 for compareWeek/compareDay/getMonthProgression/getYearProgression/listActiveYears.
Follow Test Traceability. Do not implement Ranks gallery (Feature 10) or Config (Feature 11).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Calendar + day detail + years overview (**FR-001** through **FR-013**)
- [ ] **SC-001** through **SC-006** met
- [ ] Mapped tests pass

---

## Out of Scope

- Generic filter list UI from early Feature 3 screen mock (superseded by this calendar as the user-facing History)
- Rank math ownership (Feature 4)
- Ranks gallery (Feature 10)
- Config (Feature 11)
