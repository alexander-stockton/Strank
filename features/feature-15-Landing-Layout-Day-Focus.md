# Feature: Landing Layout & Day Focus

**Feature ID:** 15  
**Branch pattern:** `feature/15-Landing-Layout-Day-Focus`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** Extends the landing shell with two **openable context-menu dropdowns**. Placement depends on navbar alignment (Feature 11): on the **bottom of the left navbar** when alignment is `left`, or **just to the left of the overall rank badge** when alignment is `top`. One menu enables a **drag/drop reorganize mode** for landing component cards; the other customizes **which weekdays focus on which muscle group(s)** (Arms, Core, Lungs, Legs — each with checkboxes for M, T, W, TH, F, Sa, Su). Day focus determines Feature 7 **today’s expected exercises**. Landing visibility, component order, and day-focus schedules persist in **`landing-config.txt`** (not global `config.txt`).  
**Depends on:** Feature 7 landing shell + navbar/badge placement; Feature 11 `navbar alignment` in `config.txt`; Feature 14 skill-progress card (as a draggable component when present)  
**Related:** `data/landing-config.txt`, `features/feature-7-Landing-Page.md`, `features/feature-11-Config-Accessibility-Backup.md`, `features/feature-14-Skill-Progress-Landing.md`

---

## User Stories

### US-15.1: Reorganize Landing Components

**As a** local user  
**I want** a menu that turns on drag/drop for landing component cards  
**So that** I can rearrange what sits where on the landing page

**Priority:** P1  
**Independent test:** Opening the layout menu and enabling reorganize mode lets me drag a component card to a new slot; order/positions persist in `landing-config.txt` and survive relaunch.  
**Acceptance scenarios:** see ### US-15.1 under Acceptance Criteria

### US-15.2: Customize Weekday Muscle Focus

**As a** local user  
**I want** to choose which days emphasize Arms / Core / Lungs / Legs  
**So that** today’s expectations match my weekly split

**Priority:** P1  
**Independent test:** Defaults match Arms (M,TH), Core (T,F), Lungs (M,W,F), Legs (W,Sa); changing checkboxes updates today’s Feature 7 list for the corresponding weekday.  
**Acceptance scenarios:** see ### US-15.2 under Acceptance Criteria

### US-15.3: Find Menus Relative To Navbar Alignment

**As a** local user  
**I want** the two menus always near navigation / overall badge  
**So that** customization is discoverable without digging into Config

**Priority:** P1  
**Independent test:** With `navbar alignment: left`, menus sit at the bottom of the left rail; with `top`, menus sit immediately left of the overall rank badge.  
**Acceptance scenarios:** see ### US-15.3 under Acceptance Criteria

---

## Requirements

### Functional Requirements

#### Menu chrome

- **FR-001**: Landing exposes **two** controls that open **context-menu dropdowns** (or equivalent popovers):
  1. **Layout** — reorganize on-screen components
  2. **Day focus** — weekday × muscle-group schedule
- **FR-002**: Placement:
  - When `navbar alignment: left` → both controls sit at the **bottom of the left navbar** (stacked or side-by-side within the rail footer).
  - When `navbar alignment: top` → both controls sit **immediately to the left of the overall rank badge** (top-right cluster: `[Layout] [Day focus] [Overall badge]`).
- **FR-003**: Menus are keyboard-accessible (open on Enter/Space, Escape closes, focus trap or restore on close). Screen-reader mode (Feature 11) MUST expose clear names (e.g. `Reorganize layout`, `Customize day focus`).

#### Layout reorganize

- **FR-004**: The Layout menu includes an action / toggle **Enable drag & drop** (wording MAY be `Reorganize components`). When on, each landing **component card** becomes draggable.
- **FR-005**: Draggable component cards include at least:
  - Today’s expected exercises (Feature 7 center-left)
  - Next rank’s expectations (Feature 7 center-right)
  - Skill progress grid (Feature 14), when visible
  - Optionally Get Started / status strip if treated as its own card
- **FR-006**: While reorganize mode is on, the user can **drag and drop** cards to reorder them (and/or into defined layout slots). Drop targets MUST be visible (outline / placeholder).
- **FR-007**: Persist layout in **`landing-config.txt`** as flat options, e.g.:
  ```text
  landing layout mode: default
  landing component order: today-expectations,next-rank,skill-progress
  ```
  If absolute positions are used, store a single-line serialized value after the first `: ` (e.g. `landing layout: today-expectations@0,0;next-rank@1,0;skill-progress@0,1`). Prefer **order + slot grid** over free-pixel coords for v1. File SHOULD include a leading `#` comment block documenting possible values.
- **FR-008**: Turning reorganize mode **off** (menu toggle or Done) leaves cards in their new arrangement and clears drag affordances.
- **FR-009**: A **Reset layout** action in the Layout menu restores the Feature 7/14 default arrangement and rewrites the layout config keys to defaults.

#### Day focus

- **FR-010**: The Day focus menu shows four sections/headers: **Arms**, **Core**, **Lungs**, **Legs**. Under each, checkboxes for weekdays: **M**, **T**, **W**, **TH**, **F**, **Sa**, **Su** (Monday…Sunday).
- **FR-011**: **Defaults** (ship in `landing-config.txt` defaults / Feature 15 `landingConfig.defaults()`):
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
- **FR-015**: Day focus does **not** hide Feature 14 skill columns. It drives (1) Feature 7 **today’s** expectations / Get Started target set, and (2) which weekdays are eligible for Feature 14 **local skill weekly averages** (days with no groups checked are excluded; a skill under group G only averages on days where G is checked—see Feature 14 **FR-006a**).
- **FR-016**: No network.

---

## Assumptions

- Navbar alignment remains owned by Feature 11 Appearance; this feature only consumes it for menu placement.
- Muscle-group identity matches Feature 14 (Arms / Core / Lungs / Legs).
- Week starts Monday for ranking (Feature 4); day-focus checkboxes still cover all seven local calendar days.

---

## Edge Cases

- All checkboxes cleared for every group → every day shows the empty-state for today’s list; Feature 14 skill averages have no eligible focus days (empty / walk prior weeks / `—`).
- Same day checked under all four groups → today’s list is the full target tier (all four headers); all four skill columns may use that day in averages.
- A weekday with zero groups (e.g. Sunday unchecked everywhere) → never contributes to Feature 14 weekly skill averages.
- Reorganize mode left on across navigation → leaving Landing turns mode off but **keeps** saved order; returning to Landing does not auto-enable drag.
- Invalid day tokens in `landing-config.txt` → coerce to defaults for that focus key without full Feature 11 FR-014 reset when the rest of the file is valid.
- Skill progress hidden via Config → it is not a drag target until visible again; order key may still list it for when it returns.

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: Layout menu enables drag/drop; new order persists in `landing-config.txt`.
- **SC-003**: Day-focus defaults match the Arms/Core/Lungs/Legs table; edits filter Feature 7 today’s list.
- **SC-004**: Menu placement follows left vs top navbar alignment.
- **SC-005**: Reset layout restores defaults.

---

## Data Ownership & Isolation

Feature 15 owns the two landing menus, reorganize mode, day-focus schedule keys in `landing-config.txt`, and the filtering contract Feature 7 uses for “today.” It does not own ranking math or skill-progress bars.

---

## Key Entities

- **DayFocusSchedule:** `{ arms: Weekday[], core: Weekday[], lungs: Weekday[], legs: Weekday[] }` where `Weekday = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'`
- **LandingLayout:** `{ order: ComponentId[], mode?: 'default'|'custom' }`
- **ComponentId:** `'today-expectations' | 'next-rank' | 'skill-progress' | …`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `dayFocus` | `getSchedule()` | Current focus map from config |
| `dayFocus` | `setSchedule(patch)` | Update + persist |
| `dayFocus` | `groupsForDate(localDate)` | Muscle groups active that day |
| `dayFocus` | `defaults()` | Built-in default schedule |
| `landingLayout` | `get()` | Current component order/slots |
| `landingLayout` | `set(order)` | Persist order |
| `landingLayout` | `reset()` | Restore defaults |
| `landingLayout` | `setReorganizeMode(on)` | UI mode flag (session; not required in config) |

---

## Screen Requirements

### Controls on Landing (extends Feature 7)

- **Layout** dropdown: Enable drag & drop; Reset layout; (optional short help)
- **Day focus** dropdown: four headers × seven weekday checkboxes
- Placement per **FR-002**

---

## Acceptance Criteria (Gherkin)

### US-15.1 — Reorganize Landing Components

#### Scenario: Drag mode reorders component cards

- **Given** I open the Layout menu on landing
- **When** I enable drag & drop
- **And** I drag `skill-progress` above `today-expectations`
- **And** I disable drag & drop
- **Then** `landing-config.txt` reflects the new `landing component order`
- **And** after relaunch the cards keep that order

#### Scenario: Reset layout restores defaults

- **Given** I have a custom landing component order
- **When** I choose **Reset layout** from the Layout menu
- **Then** component order returns to the default arrangement
- **And** `landing-config.txt` layout keys match defaults

### US-15.2 — Customize Weekday Muscle Focus

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

### US-15.3 — Find Menus Relative To Navbar Alignment

#### Scenario: Left navbar puts menus at rail bottom

- **Given** `navbar alignment: left`
- **When** I open landing
- **Then** the Layout and Day focus controls appear at the bottom of the left navbar

#### Scenario: Top navbar puts menus left of overall badge

- **Given** `navbar alignment: top`
- **When** I open landing
- **Then** the Layout and Day focus controls appear immediately to the left of the overall rank badge

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-15.1 | Drag mode reorders component cards | `tests/LandingLayout.test.js` | `Drag mode reorders component cards` |
| US-15.1 | Reset layout restores defaults | `tests/LandingLayout.test.js` | `Reset layout restores defaults` |
| US-15.2 | Defaults match the specified split | `tests/dayFocus.test.js` | `Defaults match the specified split` |
| US-15.2 | Today’s expectations follow day focus | `tests/landing.test.js` | `Today’s expectations follow day focus` |
| US-15.3 | Left navbar puts menus at rail bottom | `tests/LandingView.test.js` | `Left navbar puts menus at rail bottom` |
| US-15.3 | Top navbar puts menus left of overall badge | `tests/LandingView.test.js` | `Top navbar puts menus left of overall badge` |

---

## Test traceability

```text
feature-15-Landing-Layout-Day-Focus.md
  └── US-15.2 — Customize Weekday Muscle Focus
        └── Scenario: Today’s expectations follow day focus
              └── tests/landing.test.js → it("Today’s expectations follow day focus")
```

### File header

```javascript
/**
 * Feature 15 — Landing Layout & Day Focus
 * Spec: features/feature-15-Landing-Layout-Day-Focus.md
 */
```

---

## Agent implementation request

```text
Implement Feature 15 from @features/feature-15-Landing-Layout-Day-Focus.md on branch `feature/15-Landing-Layout-Day-Focus`.

Add Layout and Day focus dropdowns (placement from navbar alignment), drag/drop reorganize for landing cards with config persistence, and weekday muscle-group focus defaults that filter Feature 7 today’s expectations.
Follow Test Traceability. Coordinate with Features 7, 11, and 14.
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Menus + layout + day focus (**FR-001** through **FR-016**)
- [ ] **SC-001** through **SC-005** met
- [ ] Mapped tests pass

---

## Out of Scope

- Config Appearance UI for day focus (landing menu is the primary editor; Config MAY later mirror keys)
- Skill progress bar math (Feature 14)
- Rank Editor / format editing
