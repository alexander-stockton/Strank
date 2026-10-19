# Feature: Weekly Ranking

**Feature ID:** 4  
**Branch pattern:** `feature/4-Weekly-Ranking`  
**Status:** Ready  
**Created:** 2026-10-17  
**Updated:** 2026-10-17  
**Input:** Compile entries for a week (or a single day), average as needed, compare to `ranks.txt`, and return structured rank results for badges/UI. Weekly averages for History use **only days that have already passed** in an in-progress week, with a **min sample of up to 3 recorded days** padded by **all-zeroes** when fewer recordings exist (`padTarget = min(3, daysElapsed)`—so Monday’s single workout stands alone). Owns the comparison engine **and** the ranking-display contract for **Workout History** zoom levels (month default → day detail → year overview). Feature 9 implements the calendar chrome; this feature supplies the rank math and the visual ranking rules those screens must follow. Feature 14 adds Feature 15 focus-day filtering on top of these rules for local skill averages.  
**Depends on:** Feature 1 (ranks parse, catalog); Features 2–3 (entries); Feature 5 live catalog; Feature 6 custom ladders  
**Related:** `features/feature-9-Workout-History-Calendar.md`, `features/feature-10-Ranks-Gallery.md`, `features/feature-7-Landing-Page.md`, `features/feature-3-Exercise-History.md`, `features/feature-14-Skill-Progress-Landing.md` (landing overall = average of local skill ranks; reuses this feature’s weekly means / meet rules)

---

## User Stories

### US-4.1: Compile Weekly Averages

**As a** local user  
**I want** my logged exercises for a week averaged per exercise  
**So that** I have a single weekly performance snapshot

**Priority:** P1  
**Independent test:** Given multiple same-exercise entries in one week, averages match the expected arithmetic means per metric.  
**Acceptance scenarios:** see ### US-4.1 under Acceptance Criteria

### US-4.2: Compare Against Rank Thresholds

**As a** local user  
**I want** those averages compared to `ranks.txt`  
**So that** I know which rank I currently stand at

**Priority:** P1  
**Independent test:** With fixture averages that exactly match BRONZE I thresholds for logged exercises, overall rank is BRONZE I (or UNRANKED when nothing qualifies).  
**Acceptance scenarios:** see ### US-4.2 under Acceptance Criteria

### US-4.3: See Rank With Good UI

**As a** local user  
**I want** a visual rank presentation (tier emphasis, progress, per-exercise breakdown)  
**So that** I understand my standing at a glance—not only as a wall of text

**Priority:** P1  
**Independent test:** Rank view shows tier badge/name, next-tier gap summary, and a structured per-exercise comparison—not a single unstyled text dump.  
**Acceptance scenarios:** see ### US-4.3 under Acceptance Criteria

### US-4.4: Review a Selected Week

**As a** local user  
**I want to** pick the current or a past week  
**So that** I can revisit how I ranked after that week ended

**Priority:** P2  
**Independent test:** Switching the week selector recomputes averages and rank for that week’s date range.  
**Acceptance scenarios:** see ### US-4.4 under Acceptance Criteria

### US-4.5: See Weekly / Monthly / Yearly Rankings On History Calendar

**As a** local user  
**I want** Workout History to show ranks zoomed from **month** (default) down to a **day** or out to **every year I’ve used the app**, with start→finish badge arrows  
**So that** I can see progress across weeks, months, and years—not only one diagnostic week

**Priority:** P1  
**Independent test:** Month view styles recorded vs empty days, shows each week’s average rank at row end, and shows month-start badge → arrow → latest-finished-week (or month-finish) badge beside the month/year; clicking the year opens a year list with the same start→finish scheme; clicking a day opens day detail.  
**Acceptance scenarios:** see ### US-4.5 under Acceptance Criteria

---

## Requirements

### Functional Requirements

#### Week compile & compare

- **FR-001**: A **week** is Monday 00:00:00.000 local through Sunday 23:59:59.999 local. The week label is the Monday date `YYYY-MM-DD` (ISO week starting Monday).
- **FR-002**: `ranking.compileWeek(weekStartMonday)` MUST collect store entries whose `localDate` falls in that week **and** in the **eligible day window** (**FR-002a**). Future days of an in-progress week are never included.
- **FR-002a**: **Eligible days (passed-only for current week):**
  - If the week is **fully in the past** (its Sunday `<` today): eligible days = Monday…Sunday.
  - If the week is **in progress** (contains today): eligible days = Monday…**today** inclusive. Example: if today is Thursday, **do not** factor Friday, Saturday, or Sunday into that week’s averages yet.
  - If the week is **entirely in the future**: no eligible days (treat as empty / UNRANKED).
- **FR-002b**: **Recorded day** = an eligible `localDate` with ≥1 store entry (or Feature 8 workout session) that day.
- **FR-002c**: **Minimum sample / all-zero padding** for weekly average rank calculations (Workout History week badges, `compileWeek` / `compareToRanks`):
  1. Let `daysElapsed` = count of eligible days in the window (Mon…today for in-progress; 7 for a completed week).
  2. Let `padTarget` = `min(3, daysElapsed)`. So on **Monday**, `padTarget` is `1` — if the user records that day, **that one day is the weekly average** (no extra zeroes). From Wednesday onward in an in-progress week (and for completed weeks), `padTarget` is `3`.
  3. Let `n` = number of **recorded days** in the eligible window.
  4. Let `padCount` = `max(0, padTarget - n)`.
  5. Build the week’s averaging multiset from:
     - all real entries on those recorded days (see **FR-003**), plus
     - `padCount` synthetic **all-zeroes** day contributions (every metric key treated as `0` for averaging).
  6. Examples (in-progress week, today = Thursday, `padTarget = 3`):
     - No recordings → three all-zeroes.
     - One recorded day → that day’s values + two all-zeroes.
     - Two recorded days (e.g. Mon + Tue; Wed empty) → those two + **one** all-zeroes (empty Wed is **not** itself a zero slot; zeroes only pad up to `padTarget`).
     - Three or more recorded days → use **all** recorded days’ entries; **no** zero padding.
- **FR-003**: For each `exerciseId` with ≥1 real entry in the eligible window (or when zero-padding still requires means for compare—see below), compute **arithmetic mean** of each metric key over the multiset of real entry values **plus** `padCount` zeroes for that key (**FR-002c**). Means for integer-ish display MAY round to 1 decimal for durations and 1 decimal for weight; reps/sets means round to 1 decimal for comparison, and comparison to thresholds uses these means (not truncated integers).
  - When `n = 0` (only zeroes): every considered exercise mean is `0` → overall will not meet any positive thresholds → `UNRANKED` (**FR-006**).
  - Empty calendar days inside the eligible window that simply have no recording do **not** add zeroes unless needed for `padCount`.
- **FR-004**: Comparison rule — an exercise **meets** a tier if every threshold metric for that exercise in the tier is ≤ the user’s weekly mean for that metric.  
  - Higher-is-better metrics: `weight`, `reps`, `sets`, `durationSeconds`, `durationGoSeconds`, `durationSteps`.  
  - Lower-is-better metric: `durationRestSeconds` (user mean MUST be ≤ threshold rest). Zero-padded rest means of `0` **meet** any positive rest threshold (document this; product MAY later treat missing rest differently).
- **FR-005**: **Overall rank** is the highest tier (by parsed `order` / file order) such that **every logged exercise that has a threshold on that tier** meets it. Exercises not logged that week are ignored **except** when `n = 0` and only zeroes apply (**FR-006**). Logged **orphans** with no threshold on the tier are ignored for pass/fail (Feature 5) but may still appear in the breakdown. **Note:** Feature 14 redefines the **Landing** overall badge as the average of per-skill local ranks; this FR-005 formula remains the default for week/day/month/year calendar badges and the Rank diagnostic view unless those screens adopt Feature 14’s API. Feature 14 skill averages additionally filter by Feature 15 focus days (see Feature 14)—that filter does **not** change History week-badge math unless later unified.
- **FR-006**: If there are **zero recorded days** in the eligible window (`n = 0`), overall rank is `UNRANKED` with reason `"No exercises logged this week."` (even though compile uses three all-zeroes for numeric means).
- **FR-007**: If the user logged exercises but none of the non-UNRANKED tiers are fully met, overall rank is `UNRANKED`.
- **FR-008**: The optional Rank diagnostic view MUST present at least:
  1. **Hero tier** — large visual treatment of current tier **name from `ranks.txt`** (optional color hints for known prefixes; unknown custom names use neutral styling—Feature 6)
  2. **Week range** — human-readable Mon–Sun dates
  3. **Next tier** — name of the next higher tier **in the loaded ladder** (if any) and a short summary of how many logged exercises already meet it vs total considered
  4. **Per-exercise breakdown** — cards or rows (not monospace dump) showing exercise name, user averages, tier target, pass/fail affordance; if the exercise has catalog `notes`, include the Feature 1 **circled `?`** description control beside the name
  5. **Empty / unranked guidance** — actionable copy when UNRANKED
- **FR-009**: Parsing and thresholds MUST come from `loadRanks()`; do **not** hardcode tier names, counts, or Bronze→Pro sequences in the UI (Feature 6).
- **FR-010**: No network. Ranking is computed locally from the store + bundled ranks.
- **FR-011**: Default week on the Rank diagnostic screen is the **most recently completed week** if today is Monday before any logs, otherwise the **current week in progress** (still compute live averages—week does not need to be finished to preview standing). Label in-progress weeks with badge `In progress`.
- **FR-012**: Ranking MUST tolerate indeterminate exercise lists per tier section (indentation grammar); never assume a fixed number of leaves under `PULL`, `STRENGTH`, etc.

#### History calendar ranking contract (US-4.5)

These rules are **owned by Feature 4** as the ranking presentation contract. Feature 9 builds the calendar chrome and navigation; it MUST follow this contract.

- **FR-013**: **Workout History defaults to the monthly calendar** for the current local month (zoom level: **month**).
- **FR-014**: **Recorded days** (any store entry or Feature 8 workout session for that `localDate`): cell **blue background**, day number **white**. **Non-recorded days**: cell **white background**, day number **blue**. (Theme colors from Feature 11 MAY remap the blue/white pair but MUST keep the recorded vs not contrast.)
- **FR-015**: At the **end of each calendar week row** (Mon–Sun), show that week’s **average overall rank badge** from `compareToRanks(weekStartMonday)` using **FR-002a**–**FR-002c** / **FR-003** (passed days only; min sample / zero-pad). In-progress current week still shows a live badge (MAY mark `In progress`).
- **FR-016**: Beside the **month/year** heading, show a **progression strip**:
  1. **Month-start badge** — overall rank for the **last fully completed week that ended before this month began** (i.e. standing entering the month). If none exists → `UNRANKED` (or empty placeholder badge).
  2. An arrow pointing **right** (`→` or equivalent).
  3. **Trailing badge** —
     - If the viewed month is **not yet complete** (today is still inside the month, or month is current): badge for the **most recently finished week** that overlaps or falls in that month (last Mon–Sun week whose Sunday is ≤ today and whose days intersect the month). Prefer the latest completed week **in** the month; if none finished yet this month, use month-start again or show `In progress` for the open week per product choice—**default:** show the latest **completed** week’s badge that intersects the month, else `UNRANKED` / in-progress current week if it is the only week.
     - If the viewed month is **complete** (today is after the last day of that month): badge for the **month finish** — overall rank of the **last calendar week that intersects the month** (the week containing the month’s last day), using that week’s completed compare result.
- **FR-017**: **Zoom in:** clicking a **day** opens day detail (Feature 9) with that day’s entries and Feature 4 `compareDay` badge.
- **FR-018**: **Zoom out:** clicking the **displayed year** (in the month heading) opens a **Years** overview listing **every calendar year** in which the user has ≥1 entry (plus the current year even if empty). Each year row uses the **same start → finish badge scheme** as the month:
  - **Year-start badge** — standing entering Jan 1 (last completed week ending before Jan 1 of that year), or `UNRANKED`.
  - Arrow right.
  - **Year-finish badge** — if the year is complete, rank of the last week intersecting Dec 31; if the year is current/incomplete, badge for the most recently finished week in that year (same rule as month trailing badge).
- **FR-019**: From Years overview, clicking a year opens that year’s **latest relevant month** (current month if year is current; else December of that year—or the last month with entries; prefer **December** for completed years, **current month** for current year).
- **FR-020**: Expose helpers so Feature 9 does not reimplement rank math: `getMonthProgression(year, month)`, `getYearProgression(year)`, `listActiveYears()`.

---

## Assumptions

- Rank order and threshold shapes come from the current `ranks.txt` (customizable in Feature 6).
- Users may not train every catalog exercise each week; overall rank uses logged exercises that have thresholds (FR-005).
- Exercise identity uses the same `exerciseId` normalization as the live catalog (Features 1 / 5).
- Feature 9 owns routes, day edit CRUD wiring, and Back stack; Feature 4 owns what rank badges mean on those screens.

---

## Edge Cases

- One entry for an exercise → average equals that entry’s metrics.
- Mixed metric keys across buggy entries → average only keys present; if a required threshold key is missing from all means, that exercise **fails** the tier.
- User exceeds a high tier on some exercises but fails one logged exercise → overall rank limited by the weakest logged exercise (FR-005).
- Highest defined tier achieved → hide “next tier” or show `Max rank reached.`
- Store empty → UNRANKED empty state with CTA to **Today**; History month still shows empty calendar with UNRANKED progression placeholders.
- Custom ladder with two tiers only → next-tier logic still works (Feature 6).
- Month with no finished weeks yet → trailing badge may equal in-progress week or UNRANKED.
- Year with activity only in one month → still appears in Years overview; start/finish badges follow week rules.
- In-progress week on Thursday with Mon+Tue recorded only → averages use those two days’ entries + one all-zero contribution (`padTarget` 3).
- In-progress week on Monday with one recorded workout → weekly average is that day alone (`padTarget` 1).

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: Weekly means match expected averages for fixture entries.
- **SC-003**: Overall rank matches FR-004/FR-005 for fixture data vs fixture ranks.
- **SC-004**: Rank UI shows hero tier, week range, next-tier summary, and per-exercise breakdown components.
- **SC-005**: Week selector changes the compiled result.
- **SC-006**: Zero entries → UNRANKED with specified reason.
- **SC-007**: Month progression + week-row badges + recorded-day color contract are defined and testable via ranking helpers / History calendar tests.
- **SC-008**: Year overview start→finish progression matches the month scheme.

---

## Data Ownership & Isolation

Feature 4 owns ranking computation, progression helpers, the optional Rank diagnostic screen, and the **ranking display contract** for History zoom levels. It **reads** entries and ranks; it does not write entries. Feature 9 renders the calendar UI.

| Rule | Requirement |
| ---- | ----------- |
| **Who may call** | Local machine user |
| **Read scope** | All entries in selected week/day/month/year windows; full rank ladder |
| **Write scope** | None |
| **UI scope** | Rank diagnostic route (optional); History calendar ranking contract (Feature 9 chrome) |

---

## Key Entities

- **WeekAverage:** Per-exercise means for one week.
- **ExerciseRankResult:** Pass/fail vs a tier’s thresholds plus deltas.
- **WeekRankResult:** Overall tier, list of exercise results, next tier info.
- **PeriodProgression:** `{ startTierName, startBadgePath?, endTierName, endBadgePath?, endKind: 'latestFinishedWeek' | 'periodComplete' | 'inProgress' }`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `ranking` | `weekRange(weekStartMonday)` | `{ start, end }` local date strings |
| `ranking` | `compileWeek(weekStartMonday)` | Averages per exercise |
| `ranking` | `compareToRanks(weekStartMonday)` | Full `WeekRankResult` (week badges on Feature 9) |
| `ranking` | `compareDay(localDate)` | Same meet-tier rules for one day (average only if multiple same-exercise entries that day) |
| `ranking` | `listAvailableWeeks()` | Mondays that have ≥1 entry, plus current week |
| `ranking` | `getTargetTier()` | Tier used for Landing / workout expectations (Feature 7) |
| `ranking` | `getMonthProgression(year, month)` | Month-start → trailing badge model (**FR-016**) |
| `ranking` | `getYearProgression(year)` | Year-start → trailing badge model (**FR-018**) |
| `ranking` | `listActiveYears()` | Years with ≥1 entry (+ current year) |

**WeekRankResult shape:**

```json
{
  "weekStart": "2026-10-13",
  "weekEnd": "2026-10-19",
  "inProgress": true,
  "overallTierId": "BRONZE_I",
  "overallTierName": "BRONZE I",
  "reason": null,
  "nextTierName": "BRONZE II",
  "nextTierMetCount": 4,
  "nextTierTotalLogged": 6,
  "exercises": [
    {
      "exerciseId": "pike-push-ups",
      "name": "pike push-ups",
      "averages": { "reps": 4.5, "sets": 3 },
      "targetTierName": "BRONZE I",
      "targets": { "reps": 4, "sets": 3 },
      "meetsOverallTier": true,
      "meetsNextTier": false
    }
  ]
}
```

When UNRANKED with no logs: `"reason": "No exercises logged this week."`

**PeriodProgression shape:**

```json
{
  "startTierName": "BRONZE I",
  "endTierName": "SILVER I",
  "endKind": "latestFinishedWeek"
}
```

---

## Screen Requirements

### Presentation consumers

- **Feature 9 Workout History** — **primary** place users see weekly/monthly/yearly ranking visuals per **FR-013**–**FR-019** (month default, day click, year click zoom-out, badges + arrows).
- **Feature 10** — full ladder gallery with expectations under each badge.
- **Feature 7** — uses `getTargetTier()` for daily expected increments.

### History ranking visuals (contract for Feature 9)

#### Zoom: Month (default)

- Heading: **Month YYYY** with clickable **YYYY**
- Beside heading: `[start badge] → [trailing badge]` (**FR-016**)
- Grid: recorded blue/white vs white/blue (**FR-014**)
- Each week row ends with that week’s average rank badge (**FR-015**)

#### Zoom: Day

- Via day cell click → Feature 9 day detail + `compareDay` badge

#### Zoom: Years

- Via click on year in month heading
- List of active years; each row `[year-start badge] → [year-finish/latest badge]`
- Click year → month view for that year (**FR-019**)

### Optional diagnostic view: Rank breakdown — route name `rankDebug` (P2)

- Not required in main nav once Features 9–10 exist.
- If implemented: week selector, hero tier, next-tier progress, per-exercise cards (same content rules as before—no monospace dump of the rank file).

---

## Data Model Requirements

No new persisted entities. Derived read models only (`WeekRankResult`, `PeriodProgression`).

### Associations

- Uses catalog for display names/regions
- Uses ranks tiers for thresholds
- Uses store entries for inputs

---

## Acceptance Criteria (Gherkin)

### US-4.1 — Compile Weekly Averages

#### Scenario: Averages multiple entries for one exercise

- **Given** week starting `2026-10-13` is fully in the past (or today is after that Sunday)
- **And** `pike-push-ups` entries that week with reps `4` and `6` (sets `3` and `3`) on two different recorded days
- **And** there are at least three recorded days that week (no zero-padding)
- **When** I compile the week
- **Then** average reps is `5`
- **And** average sets is `3`

#### Scenario: In-progress week ignores future days

- **Given** today is Thursday `2026-10-16`
- **And** week starting `2026-10-13` has entries only on Monday and an entry dated Saturday that must not count yet
- **When** I compile that week
- **Then** only Monday…Thursday eligible days are used
- **And** the Saturday entry is excluded

#### Scenario: Two recorded days pad with one all-zero

- **Given** today is Thursday
- **And** only Monday and Tuesday have recorded workouts this week (Wednesday empty)
- **When** I compile the week for an exercise logged those two days with reps `6` and `6`
- **Then** the averaging multiset includes those values plus one `0` (pad to 3)
- **And** average reps is `4`

#### Scenario: Monday single recording is the weekly average

- **Given** today is Monday
- **And** the user recorded one workout today with `pike-push-ups` reps `8` sets `3`
- **When** I compile the week
- **Then** average reps is `8` and average sets is `3`
- **And** no all-zero padding is applied (`padTarget` is 1)

### US-4.2 — Compare Against Rank Thresholds

#### Scenario: User reaches BRONZE I on logged exercises

- **Given** ranks are loaded from `ranks.txt`
- **And** the user’s weekly averages for every logged exercise meet `BRONZE I` thresholds
- **And** at least one logged exercise fails `BRONZE II`
- **When** I compare the week to ranks
- **Then** `overallTierName` is `BRONZE I`

#### Scenario: No entries means UNRANKED

- **Given** week starting `2026-10-13` has no entries
- **When** I compare the week to ranks
- **Then** `overallTierName` is `UNRANKED`
- **And** `reason` is `No exercises logged this week.`

#### Scenario: Rest duration is lower-is-better

- **Given** `burpee intervals` threshold rest at a tier is `50` seconds
- **And** the user’s average `durationRestSeconds` is `60`
- **When** that tier is tested for this exercise
- **Then** the exercise does not meet the tier

### US-4.3 — See Rank With Good UI

#### Scenario: Rank view shows visual standing

- **Given** a compiled result with overall tier `SILVER I`
- **When** I open the Rank page for that week
- **Then** I see a hero treatment displaying `SILVER I`
- **And** I see a next-tier progress summary
- **And** I see a per-exercise breakdown with averages and targets
- **And** the page is not only an unstyled text block of rank file contents

### US-4.4 — Review a Selected Week

#### Scenario: User selects a past week

- **Given** entries exist in week `2026-10-06` and week `2026-10-13`
- **When** I select week starting `2026-10-06`
- **Then** the Rank view shows averages computed only from `2026-10-06`–`2026-10-12` entries

### US-4.5 — See Weekly / Monthly / Yearly Rankings On History Calendar

#### Scenario: Month view shows recorded styling and week ranks

- **Given** entries exist on `2026-10-03` and none on `2026-10-04`
- **And** week starting `2026-09-28` (intersecting October) compares to overall tier `BRONZE II`
- **When** I open Workout History (defaults to October 2026 month view)
- **Then** day `3` is blue with white text and day `4` is white with blue text
- **And** that week’s row shows a `BRONZE II` rank badge at the end of the week

#### Scenario: Month heading shows start badge arrow trailing badge

- **Given** the standing entering October 2026 is `BRONZE I`
- **And** the most recently finished week in/intersecting October compares to `SILVER I`
- **And** October 2026 is not yet complete
- **When** I view the October 2026 calendar
- **Then** beside the month/year I see badge `BRONZE I`, then an arrow right, then badge `SILVER I`

#### Scenario: Completed month uses month-finish badge

- **Given** I am viewing a fully past month
- **And** the last week intersecting that month compares to `GOLD I`
- **When** the month progression is computed
- **Then** the trailing badge is `GOLD I` with `endKind` `periodComplete`

#### Scenario: Click year zooms out to years overview

- **Given** I have entries in `2025` and `2026`
- **When** I click the year `2026` on the month heading
- **Then** I see a years overview listing at least `2025` and `2026`
- **And** each listed year shows start badge → arrow → finish/latest badge

#### Scenario: Click day zooms into day detail

- **Given** I am on the month calendar
- **When** I click day `3`
- **Then** I open that day’s detail with its day-rank badge (Feature 9 + `compareDay`)

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-4.1 | Averages multiple entries for one exercise | `tests/ranking.test.js` | `Averages multiple entries for one exercise` |
| US-4.1 | In-progress week ignores future days | `tests/ranking.test.js` | `In-progress week ignores future days` |
| US-4.1 | Two recorded days pad with one all-zero | `tests/ranking.test.js` | `Two recorded days pad with one all-zero` |
| US-4.1 | Monday single recording is the weekly average | `tests/ranking.test.js` | `Monday single recording is the weekly average` |
| US-4.2 | User reaches BRONZE I on logged exercises | `tests/ranking.test.js` | `User reaches BRONZE I on logged exercises` |
| US-4.2 | No entries means UNRANKED | `tests/ranking.test.js` | `No entries means UNRANKED` |
| US-4.2 | Rest duration is lower-is-better | `tests/ranking.test.js` | `Rest duration is lower-is-better` |
| US-4.3 | Rank view shows visual standing | `tests/RankView.test.js` | `Rank view shows visual standing` |
| US-4.4 | User selects a past week | `tests/RankView.test.js` | `User selects a past week` |
| US-4.4 | User selects a past week | `tests/ranking.test.js` | `User selects a past week` |
| US-4.5 | Month view shows recorded styling and week ranks | `tests/HistoryCalendarView.test.js` | `Month view shows recorded styling and week ranks` |
| US-4.5 | Month heading shows start badge arrow trailing badge | `tests/ranking.test.js` | `Month heading shows start badge arrow trailing badge` |
| US-4.5 | Completed month uses month-finish badge | `tests/ranking.test.js` | `Completed month uses month-finish badge` |
| US-4.5 | Click year zooms out to years overview | `tests/HistoryCalendarView.test.js` | `Click year zooms out to years overview` |
| US-4.5 | Click day zooms into day detail | `tests/HistoryCalendarView.test.js` | `Click day zooms into day detail` |

---

## Test traceability

```text
feature-4-Weekly-Ranking.md
  └── US-4.1 — Compile Weekly Averages
        └── Scenario: Averages multiple entries for one exercise
              └── tests/ranking.test.js → it("Averages multiple entries for one exercise")
  └── US-4.2 — Compare Against Rank Thresholds
        └── Scenario: User reaches BRONZE I on logged exercises
              └── tests/ranking.test.js → it("User reaches BRONZE I on logged exercises")
  └── US-4.3 — See Rank With Good UI
        └── Scenario: Rank view shows visual standing
              └── tests/RankView.test.js → it("Rank view shows visual standing")
  └── US-4.5 — See Weekly / Monthly / Yearly Rankings On History Calendar
        └── Scenario: Month heading shows start badge arrow trailing badge
              └── tests/ranking.test.js → it("Month heading shows start badge arrow trailing badge")
```

### File header

```javascript
/**
 * Feature 4 — Weekly Ranking
 * Spec: features/feature-4-Weekly-Ranking.md
 */
```

---

## Agent implementation request

```text
Implement Feature 4 from @features/feature-4-Weekly-Ranking.md on branch `feature/4-Weekly-Ranking`.

Requires Feature 1 ranks/catalog and entries from Features 2–3.
Implement ranking service (week/day compare, month/year progression helpers) and optional Rank diagnostic UI with hero tier, next-tier progress, and per-exercise breakdown.
History calendar chrome follows Feature 9 but MUST honor FR-013–FR-020 ranking contract (coordinate with Feature 9).
Follow Test Traceability. Map every Gherkin scenario in the Test Coverage Map.
Do not add network calls or auth.
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Ranking service + progression helpers + Rank UI / History contract (**FR-001** through **FR-020**)
- [ ] **Success Criteria (SC-001** through **SC-008)** met
- [ ] All mapped tests pass
- [ ] Test Coverage Map complete
- [ ] Test traceability satisfied
- [ ] UI review: standing is understandable without reading raw `ranks.txt`

---

## Out of Scope

- Full calendar chrome / day-edit wiring (Feature 9) — except the ranking contract above
- Ranks gallery layout (Feature 10)
- Editing `ranks.txt` (Feature 13 Rank Editor; Feature 6 accommodation)
- Live catalog merge ownership (Feature 5)
- Social leaderboards / auth / sync
