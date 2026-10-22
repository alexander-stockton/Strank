# Feature: Landing Day Focus

**Feature ID:** 14  
**Branch pattern:** `feature/14-Landing-Layout-Day-Focus`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** Extends the landing shell with an **openable Day focus context-menu dropdown**. Placement depends on navbar alignment (Feature 11): on the **bottom of the left navbar** when alignment is `left`, or **on the trailing end of the top navbar** when alignment is `top`. Day focus customizes **which weekdays focus on which muscle group(s)** (Arms, Core, Lungs, Legs — each with checkboxes for M, T, W, TH, F, Sa, Su) and determines Feature 7 **today’s expected exercises**. Landing visibility and day-focus schedules persist in **`landing-config.txt`** (not global `config.txt`). Component order keys may remain for compatibility but there is **no** runtime rearrange / drag-and-drop UI.  
**Depends on:** Feature 7 landing shell + navbar/badge placement; Feature 11 `navbar alignment` in `config.txt`; Feature 13 skill-progress card  
**Related:** `data/landing-config.txt`, `features/feature-7-Landing-Page.md`, `features/feature-11-Config-Accessibility-Backup.md`, `features/feature-13-Skill-Progress-Landing.md`

---

## User Stories

### US-14.2: Customize Weekday Muscle Focus

**As a** local user  
**I want** to choose which days emphasize Arms / Core / Lungs / Legs  
**So that** today’s expectations match my weekly split

**Priority:** P1  
**Independent test:** Defaults match Arms (M,TH), Core (T,F), Lungs (M,W,F), Legs (W,Sa); changing checkboxes updates today’s Feature 7 list for the corresponding weekday.  
**Acceptance scenarios:** see ### US-14.2 under Acceptance Criteria

### US-14.3: Find Menu Relative To Navbar Alignment

**As a** local user  
**I want** the Day focus menu always near navigation  
**So that** customization is discoverable without digging into Config

**Priority:** P1  
**Independent test:** With `navbar alignment: left`, the control sits at the bottom of the left rail; with `top`, it sits on the trailing end of the top navbar.  
**Acceptance scenarios:** see ### US-14.3 under Acceptance Criteria

---

## Requirements

### Functional Requirements

#### Menu chrome

- **FR-001**: Landing exposes **one** control that opens a **context-menu dropdown** (or equivalent popover): **Day focus** — weekday × muscle-group schedule.
- **FR-002**: Placement:
  - When `navbar alignment: left` → the control sits at the **bottom of the left navbar**.
  - When `navbar alignment: top` → the control sits on the **trailing end of the top navbar** (near the overall rank badge cluster).
- **FR-003**: Menu is keyboard-accessible (open on Enter/Space, Escape closes, focus trap or restore on close). Screen-reader mode (Feature 11) MUST expose a clear name (e.g. `Customize day focus`).

#### Day focus

- **FR-010**: The Day focus menu shows four sections/headers: **Arms**, **Core**, **Lungs**, **Legs**. Under each, checkboxes for weekdays: **M**, **T**, **W**, **TH**, **F**, **Sa**, **Su** (Monday…Sunday).
- **FR-011**: **Defaults** (ship in `landing-config.txt` defaults / Feature 14 `landingConfig.defaults()`):
  | Muscle group | Days |
  | ------------ | ---- |
  | Arms | M, TH |
  | Core | T, F |
  | Lungs | M, W, F |
  | Legs | W, Sa |
- **FR-012**: Persist as flat `landing-config.txt` options (comma-separated day tokens `mon,tue,wed,thu,fri,sat,sun`):
  ```text
  focus arms days: mon,thu
  focus core days: tue,fri
  focus lungs days: mon,wed,fri
  focus legs days: wed,sat
  ```
- **FR-013**: Feature 7 **today’s expected exercises** MUST filter the target-tier tree to exercises whose muscle-group header is scheduled for **today’s weekday**. If multiple groups are checked for today, include all of them. If **no** group is checked for today, show an empty-state message `No muscle groups scheduled for today.` (still allow navigating elsewhere / opening Day focus).
- **FR-014**: Changing checkboxes updates `landing-config.txt` immediately (or on menu close—pick one and test it; prefer **immediate** save) and refreshes today’s list without requiring app restart.
- **FR-015**: Day focus does **not** hide Feature 13 skill columns. It drives (1) Feature 7 **today’s** expectations / Get Started target set, and (2) which weekdays are eligible for Feature 13 **local skill weekly averages** (days with no groups checked are excluded; a skill under group G only averages on days where G is checked—see Feature 13 **FR-006a**).
- **FR-016**: No network.

---

## Assumptions

- Navbar alignment remains owned by Feature 11 Appearance; this feature only consumes it for menu placement.
- Muscle-group identity matches Feature 13 (Arms / Core / Lungs / Legs).
- Week starts Monday for ranking (Feature 4); day-focus checkboxes still cover all seven local calendar days.
- Landing board arrangement is fixed (Feature 7 / 13 default layouts). There is no user-facing rearrange UI.

---

## Edge Cases

- All checkboxes cleared for every group → every day shows the empty-state for today’s list; Feature 13 skill averages have no eligible focus days (empty / walk prior weeks / `—`).
- Same day checked under all four groups → today’s list is the full target tier (all four headers); all four skill columns may use that day in averages.
- A weekday with zero groups (e.g. Sunday unchecked everywhere) → never contributes to Feature 13 weekly skill averages.
- Invalid day tokens in `landing-config.txt` → coerce to defaults for that focus key without full Feature 11 FR-014 reset when the rest of the file is valid.

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-003**: Day-focus defaults match the Arms/Core/Lungs/Legs table; edits filter Feature 7 today’s list.
- **SC-004**: Menu placement follows left vs top navbar alignment.

---

## Data Ownership & Isolation

Feature 14 owns the Day focus menu, day-focus schedule keys in `landing-config.txt`, and the filtering contract Feature 7 uses for “today.” It does not own ranking math, skill-progress bars, or a runtime layout rearrange UI.

---

## Key Entities

- **DayFocusSchedule:** `{ arms: Weekday[], core: Weekday[], lungs: Weekday[], legs: Weekday[] }` where `Weekday = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `dayFocus` | `getSchedule()` | Current focus map from config |
| `dayFocus` | `setSchedule(patch)` | Update + persist |
| `dayFocus` | `groupsForDate(localDate)` | Muscle groups active that day |
| `dayFocus` | `defaults()` | Built-in default schedule |

---

## Screen Requirements

### Controls on Landing (extends Feature 7)

- **Day focus** dropdown: four headers × seven weekday checkboxes
- Placement per **FR-002**

---

## Acceptance Criteria (Gherkin)

### US-14.2 — Customize Weekday Muscle Focus

#### Scenario: Defaults match the specified split

- **Given** a fresh default config
- **When** I open the Day focus menu
- **Then** Arms is checked for M and TH
- **And** Core is checked for T and F
- **And** Lungs is checked for M, W, and F
- **And** Legs is checked for W and Sa

#### Scenario: Today’s expectations follow day focus

- **Given** today is Monday
- **And** Arms and Lungs are scheduled for Monday
- **And** Core and Legs are not
- **When** Feature 7 builds today’s expectations
- **Then** only exercises under Arms and Lungs headers from the target tier are listed

### US-14.3 — Find Menu Relative To Navbar Alignment

#### Scenario: Left navbar puts Day focus at rail bottom

- **Given** `navbar alignment: left`
- **When** I open landing
- **Then** the Day focus control appears at the bottom of the left navbar
- **And** there is no Layout rearrange menu

#### Scenario: Top navbar puts Day focus on the nav trailing end

- **Given** `navbar alignment: top`
- **When** I open landing
- **Then** the Day focus control appears on the trailing end of the top navbar
- **And** there is no Layout rearrange menu

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-14.2 | Defaults match the specified split | `tests/dayFocus.test.js` | `Defaults match the specified split` |
| US-14.2 | Today’s expectations follow day focus | `tests/landing.test.js` | `Today’s expectations follow day focus` |
| US-14.3 | Left navbar puts Day focus at rail bottom | `tests/LandingView.test.js` | `Left navbar puts menus at rail bottom` |
| US-14.3 | Top navbar puts Day focus on the nav trailing end | `tests/LandingView.test.js` | `Top navbar puts menus on the trailing end of the nav bar` |
| — | Day focus only (no Layout rearrange) | `tests/LandingLayout.test.js` | `exposes Day focus only (no Layout rearrange menu)` |

---

## Test traceability

```text
feature-14-Landing-Layout-Day-Focus.md
  └── US-14.2 — Customize Weekday Muscle Focus
        └── Scenario: Today’s expectations follow day focus
              └── tests/landing.test.js → it("Today’s expectations follow day focus")
```

### File header

```javascript
/**
 * Feature 14 — Landing Day Focus
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */
```

---

## Agent implementation request

```text
Implement Feature 14 from @features/feature-14-Landing-Layout-Day-Focus.md on branch `feature/14-Landing-Layout-Day-Focus`.

Add Day focus dropdown (placement from navbar alignment) and weekday muscle-group focus defaults that filter Feature 7 today’s expectations. Do not add layout rearrange / drag-and-drop UI.
Follow Test Traceability. Coordinate with Features 7, 11, and 13.
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Day focus menu (**FR-001**–**FR-003**, **FR-010**–**FR-016**)
- [ ] **SC-001**, **SC-003**, **SC-004** met
- [ ] Mapped tests pass

---

## Out of Scope

- Runtime landing component rearrange / drag-and-drop / freeform layout customize
- Config Appearance UI for day focus (landing menu is the primary editor; Config MAY later mirror keys)
- Skill progress bar math (Feature 13)
- Rank Editor / format editing
