# Feature: Weekly Ranking

**Feature ID:** 4  
**Branch pattern:** `feature/4-Weekly-Ranking`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** Compile entries for a week (or a single day), average as needed, compare to `ranks.txt`, and return structured rank results for badges/UI. User-facing presentation is primarily **Ranks gallery** (Feature 10) and **calendar week/day badges** (Feature 9); this feature owns the comparison engine and may keep a diagnostic breakdown view.  
**Depends on:** Feature 1 (ranks parse, catalog); Features 2–3 (entries); Feature 5 live catalog; Feature 6 custom ladders  
**Related:** `features/feature-9-Workout-History-Calendar.md`, `features/feature-10-Ranks-Gallery.md`, `features/feature-7-Landing-Page.md`, `features/feature-14-Skill-Progress-Landing.md` (landing overall = average of local skill ranks; reuses this feature’s weekly means / meet rules)

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

---

## Requirements

### Functional Requirements

- **FR-001**: A **week** is Monday 00:00:00.000 local through Sunday 23:59:59.999 local. The week label is the Monday date `YYYY-MM-DD` (ISO week starting Monday).
- **FR-002**: `ranking.compileWeek(weekStartMonday)` MUST collect all store entries whose `localDate` falls in that week.
- **FR-003**: For each `exerciseId` with ≥1 entry that week, compute **arithmetic mean** of each metric key present on those entries. Means for integer-ish display MAY round to 1 decimal for durations and 1 decimal for weight; reps/sets means round to 1 decimal for comparison, and comparison to thresholds uses these means (not truncated integers).
- **FR-004**: Comparison rule — an exercise **meets** a tier if every threshold metric for that exercise in the tier is ≤ the user’s weekly mean for that metric.  
  - Higher-is-better metrics: `weight`, `reps`, `sets`, `durationSeconds`, `durationGoSeconds`, `durationSteps`.  
  - Lower-is-better metric: `durationRestSeconds` (user mean MUST be ≤ threshold rest).
- **FR-005**: **Overall rank** is the highest tier (by parsed `order` / file order) such that **every logged exercise that has a threshold on that tier** meets it. Exercises not logged that week are ignored. Logged **orphans** with no threshold on the tier are ignored for pass/fail (Feature 5) but may still appear in the breakdown. **Note:** Feature 14 redefines the **Landing** overall badge as the average of per-skill local ranks; this FR-005 formula remains the default for the Rank diagnostic view / week badges unless those screens adopt Feature 14’s API.
- **FR-006**: If the user logged zero entries that week, overall rank is `UNRANKED` with reason `"No exercises logged this week."`
- **FR-007**: If the user logged exercises but none of the non-UNRANKED tiers are fully met, overall rank is `UNRANKED`.
- **FR-008**: The rank view MUST present at least:
  1. **Hero tier** — large visual treatment of current tier **name from `ranks.txt`** (optional color hints for known prefixes; unknown custom names use neutral styling—Feature 6)
  2. **Week range** — human-readable Mon–Sun dates
  3. **Next tier** — name of the next higher tier **in the loaded ladder** (if any) and a short summary of how many logged exercises already meet it vs total considered
  4. **Per-exercise breakdown** — cards or rows (not monospace dump) showing exercise name, user averages, tier target, pass/fail affordance
  5. **Empty / unranked guidance** — actionable copy when UNRANKED
- **FR-009**: Parsing and thresholds MUST come from `loadRanks()`; do **not** hardcode tier names, counts, or Bronze→Pro sequences in the UI (Feature 6).
- **FR-010**: No network. Ranking is computed locally from the store + bundled ranks.
- **FR-011**: Default week on the Rank screen is the **most recently completed week** if today is Monday before any logs, otherwise the **current week in progress** (still compute live averages—week does not need to be finished to preview standing). Label in-progress weeks with badge `In progress`.
- **FR-012**: Ranking MUST tolerate indeterminate exercise lists per tier section (indentation grammar); never assume a fixed number of leaves under `PULL`, `STRENGTH`, etc.

---

## Assumptions

- Rank order and threshold shapes come from the current `ranks.txt` (customizable in Feature 6).
- Users may not train every catalog exercise each week; overall rank uses logged exercises that have thresholds (FR-005).
- Exercise identity uses the same `exerciseId` normalization as the live catalog (Features 1 / 5).

---

## Edge Cases

- One entry for an exercise → average equals that entry’s metrics.
- Mixed metric keys across buggy entries → average only keys present; if a required threshold key is missing from all means, that exercise **fails** the tier.
- User exceeds a high tier on some exercises but fails one logged exercise → overall rank limited by the weakest logged exercise (FR-005).
- Highest defined tier achieved → hide “next tier” or show `Max rank reached.`
- Store empty → UNRANKED empty state with CTA to **Today**.
- Custom ladder with two tiers only → next-tier logic still works (Feature 6).

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: Weekly means match expected averages for fixture entries.
- **SC-003**: Overall rank matches FR-004/FR-005 for fixture data vs fixture ranks.
- **SC-004**: Rank UI shows hero tier, week range, next-tier summary, and per-exercise breakdown components.
- **SC-005**: Week selector changes the compiled result.
- **SC-006**: Zero entries → UNRANKED with specified reason.

---

## Data Ownership & Isolation

Feature 4 owns ranking computation and the Rank screen. It **reads** entries and ranks; it does not write entries.

| Rule | Requirement |
| ---- | ----------- |
| **Who may call** | Local machine user |
| **Read scope** | All entries in selected week; full rank ladder |
| **Write scope** | None |
| **UI scope** | Rank route in shell nav |

---

## Key Entities

- **WeekAverage:** Per-exercise means for one week.
- **ExerciseRankResult:** Pass/fail vs a tier’s thresholds plus deltas.
- **WeekRankResult:** Overall tier, list of exercise results, next tier info.

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

---

## Screen Requirements

### Presentation consumers

- **Feature 9** — week badge + day badge (must not be plain `ranks.txt` text).
- **Feature 10** — full ladder gallery with expectations under each badge.
- **Feature 7** — uses `getTargetTier()` for daily expected increments.

### Optional diagnostic view: Rank breakdown — route name `rankDebug` (P2)

- Not required in main nav once Features 9–10 exist.
- If implemented: week selector, hero tier, next-tier progress, per-exercise cards (same content rules as before—no monospace dump of the rank file).

---

## Data Model Requirements

No new persisted entities. Derived read models only (`WeekRankResult`).

### Associations

- Uses catalog for display names/regions
- Uses ranks tiers for thresholds
- Uses store entries for inputs

---

## Acceptance Criteria (Gherkin)

### US-4.1 — Compile Weekly Averages

#### Scenario: Averages multiple entries for one exercise

- **Given** week starting `2026-10-13`
- **And** `pike-push-ups` entries that week with reps `4` and `6` (sets `3` and `3`)
- **When** I compile the week
- **Then** average reps is `5`
- **And** average sets is `3`

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

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-4.1 | Averages multiple entries for one exercise | `tests/ranking.test.js` | `Averages multiple entries for one exercise` |
| US-4.2 | User reaches BRONZE I on logged exercises | `tests/ranking.test.js` | `User reaches BRONZE I on logged exercises` |
| US-4.2 | No entries means UNRANKED | `tests/ranking.test.js` | `No entries means UNRANKED` |
| US-4.2 | Rest duration is lower-is-better | `tests/ranking.test.js` | `Rest duration is lower-is-better` |
| US-4.3 | Rank view shows visual standing | `tests/RankView.test.js` | `Rank view shows visual standing` |
| US-4.4 | User selects a past week | `tests/RankView.test.js` | `User selects a past week` |
| US-4.4 | User selects a past week | `tests/ranking.test.js` | `User selects a past week` |

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
Implement ranking service and Rank UI with hero tier, next-tier progress, and per-exercise breakdown.
Follow Test Traceability. Map every Gherkin scenario in the Test Coverage Map.
Do not add network calls or auth.
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Ranking service and Rank UI implemented (**FR-001** through **FR-012**)
- [ ] **Success Criteria (SC-001** through **SC-006)** met
- [ ] All mapped tests pass
- [ ] Test Coverage Map complete
- [ ] Test traceability satisfied
- [ ] UI review: standing is understandable without reading raw `ranks.txt`

---

## Out of Scope

- Ranks gallery layout (Feature 10)
- Calendar chrome (Feature 9)
- Editing `ranks.txt` (Feature 11 system editor; Feature 6 accommodation)
- Live catalog merge ownership (Feature 5)
- Social leaderboards / auth / sync
