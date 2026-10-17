# Feature: Workout History Calendar

**Feature ID:** 9  
**Branch pattern:** `feature/9-Workout-History-Calendar`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** From landing, the user opens **Workout History**: a month calendar. Recorded days are blue cells with white day numbers; other days are white cells with blue numbers. Each week row shows a badge for that week’s average rank. Opening a day shows that day’s exercise details plus a badge for the rank that day’s exercises fell within, and allows editing mistaken entries. User can jump year/month (calendar) or day (day view), and back out one screen at a time to landing.  
**Depends on:** Feature 3 history CRUD services; Feature 4 week + day rank comparison; Feature 7 landing as root  
**Related:** `features/feature-3-Exercise-History.md`, `features/feature-4-Weekly-Ranking.md`

---

## User Stories

### US-9.1: View Month Calendar

**As a** local user  
**I want** a calendar of the current month with recorded days styled distinctly  
**So that** I can see when I worked out

**Priority:** P1  
**Independent test:** A month with workouts on the 3rd and 10th shows those days blue/white-number; other days white/blue-number.  
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

### US-9.4: Navigate Time And Back

**As a** local user  
**I want** year and month jumps on the calendar, day jumps on day-view, and back one screen at a time  
**So that** I can move through history and return to landing

**Priority:** P1  
**Independent test:** Prev/Next year and month change the grid; day view Prev/Next day changes detail; Back from day → calendar → landing.  
**Acceptance scenarios:** see ### US-9.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Route `/history` shows the **month calendar** for a `viewYear`/`viewMonth` (default: current local month).
- **FR-002**: A day is **recorded** if any `entries` exist for that `localDate` OR a Feature 8 `workouts` session exists for that date.
- **FR-003**: Recorded day cell: **blue background**, **white** day number. Non-recorded: **white background**, **blue** day number. (Exact hex may follow Feature 11 theme; contrast must remain clear.)
- **FR-004**: Beside each calendar week (Mon–Sun row): a **rank badge** from Feature 4 `compareToRanks(weekStartMonday)` (`overallTierName`).
- **FR-005**: Clicking a day opens **Day detail** (`/history/day/:localDate`) showing: date heading, **day-rank badge**, list of that day’s exercise entries with metrics.
- **FR-006**: **Day rank:** Feature 4 (or shared helper) compares that **single day’s** entries to ranks using the same meet-tier rules as weekly, but **without averaging across other days** (per-exercise metrics = that day’s values; if multiple entries same exercise same day, average those).
- **FR-007**: Day detail allows **edit** and **delete** of entries (Feature 3 services). After edit, day-rank badge refreshes.
- **FR-008**: Calendar controls: **Previous year**, **Next year**, **Previous month**, **Next month** (and display `Month YYYY`).
- **FR-009**: Day detail controls: **Previous day**, **Next day** (adjacent calendar dates).
- **FR-010**: **Back** on day detail → calendar (same month as that day). **Back** on calendar → Landing. No skipping levels.
- **FR-011**: Empty day detail (non-recorded): copy `No exercises recorded.` still allows Back / day nav; optional add entry via Feature 3 create is allowed (P2).
- **FR-012**: No network.

---

## Assumptions

- Feature 3 owns persistence APIs; this feature owns calendar/day chrome.
- Feature 4 exposes week compare; day compare may be `ranking.compareDay(localDate)`.

---

## Edge Cases

- Weeks spanning two months: badge uses ISO week of the row’s Monday; days outside current month may show muted in grid but remain clickable (preferred) or hidden—pick **show muted trailing/leading days**.
- Timezone: all dates local.
- Theme colors from Feature 11 override default blue/white but must keep “recorded vs not” distinguishable (including colorblind filter modes).

---

## Success Criteria

- **SC-001**: Gherkin scenarios mapped to tests.
- **SC-002**: Recorded vs non-recorded day styling correct.
- **SC-003**: Week badges match Feature 4 for those weeks.
- **SC-004**: Day detail shows entries, day badge, and supports edit.
- **SC-005**: Year/month/day navigation and stacked Back work.

---

## Data Ownership & Isolation

Feature 9 owns calendar + day-detail views. Reads entries/workouts/ranks; writes only through Feature 3 on edit.

---

## Key Entities

- **CalendarDayCell:** `{ localDate, recorded, dayNumber }`
- **WeekBadge:** `{ weekStart, tierName }`
- **DayDetailModel:** `{ localDate, tierName, entries[] }`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `historyCalendar` | `getMonth(year, month)` | Cells + week badges |
| `historyCalendar` | `getDay(localDate)` | Detail model |
| `ranking` | `compareDay(localDate)` | Day-rank result |

---

## Screen Requirements

### View: Workout History (month) — route name `workoutHistory`

- Path: `/history`
- Heading: **Workout History**
- Controls: ⟵ Year | ⟵ Month | **Month YYYY** | Month ⟶ | Year ⟶
- Grid: calendar; week-end badges aligned to each row
- Back: **Back** → Landing

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

### US-9.4 — Navigate Time And Back

#### Scenario: Jump month and year

- **Given** I am viewing October 2026
- **When** I press next month
- **Then** the heading shows November 2026
- **When** I press previous year
- **Then** the heading shows November 2025

#### Scenario: Back stack returns to landing

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
| US-9.2 | Week shows rank badge | `tests/HistoryCalendarView.test.js` | `Week shows rank badge` |
| US-9.3 | Day detail shows exercises and day rank | `tests/HistoryDayView.test.js` | `Day detail shows exercises and day rank` |
| US-9.3 | User edits a mistaken entry | `tests/HistoryDayView.test.js` | `User edits a mistaken entry` |
| US-9.4 | Jump month and year | `tests/HistoryCalendarView.test.js` | `Jump month and year` |
| US-9.4 | Back stack returns to landing | `tests/HistoryCalendarView.test.js` | `Back stack returns to landing` |

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

Month calendar styling, week rank badges, day detail with day rank + edit, year/month/day nav, Back stack to landing.
Use Feature 3 for writes and Feature 4 for compareWeek/compareDay.
Follow Test Traceability. Do not implement Ranks gallery (Feature 10) or Config (Feature 11).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Calendar + day detail (**FR-001** through **FR-012**)
- [ ] **SC-001** through **SC-005** met
- [ ] Mapped tests pass

---

## Out of Scope

- Generic filter list UI from early Feature 3 screen mock (superseded by this calendar as the user-facing History)
- Ranks gallery (Feature 10)
- Config (Feature 11)
