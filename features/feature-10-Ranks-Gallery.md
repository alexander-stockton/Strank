# Feature: Ranks Gallery

**Feature ID:** 10  
**Branch pattern:** `feature/10-Ranks-Gallery`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** From landing, the user opens **Ranks**: a horizontally scrollable row of badges for every rank in `ranks.txt`. Under each badge, a list of what that rank expects on average in a week. User can return to landing.  
**Depends on:** Feature 1/6 loaded ranks; Feature 5 for exercise display names  
**Related:** `ranks.txt`, `features/feature-4-Weekly-Ranking.md`, `features/feature-6-Custom-Ranks.md`, `features/feature-7-Landing-Page.md`

---

## User Stories

### US-10.1: Browse Rank Badges

**As a** local user  
**I want** to scroll left-to-right through all rank badges  
**So that** I can see the full ladder visually

**Priority:** P1  
**Independent test:** Ranks screen shows one badge per non-documentation tier from `ranks.txt` in file order; horizontal scroll when they overflow.  
**Acceptance scenarios:** see ### US-10.1 under Acceptance Criteria

### US-10.2: See Weekly Expectations Per Rank

**As a** local user  
**I want** the expected weekly averages listed under each badge  
**So that** I know what that rank requires

**Priority:** P1  
**Independent test:** Under `BRONZE I`, expectations include parsed thresholds (e.g. pike push-ups x4 x3) grouped by headers.  
**Acceptance scenarios:** see ### US-10.2 under Acceptance Criteria

### US-10.3: Return To Landing

**As a** local user  
**I want** to go back to the landing page  
**So that** I can continue my day

**Priority:** P1  
**Independent test:** **Back** from Ranks returns to Landing.  
**Acceptance scenarios:** see ### US-10.3 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Route `/ranks` shows the Ranks gallery.
- **FR-002**: Include every parsed tier from `ranks.txt` except that `UNRANKED` MAY be omitted from badges or shown as a simple first card without requirements -- prefer **omit UNRANKED** from the badge strip if it has empty thresholds.
- **FR-003**: Layout: **horizontal scroll** of columns (left -> right = low -> high file order). Each column: **badge image** on top (from tier `badgePath`, Feature 6); beneath it a **scrollable vertical list** of expected weekly exercises/metrics for that tier, segregated by headers. Show the tier name as accessible text / caption with the image.
- **FR-004**: Expectation lines MUST come from parsed thresholds (Feature 1/6) -- no hardcoded Bronze->Pro copy.
- **FR-005**: Prefer `badgePath` image when the file exists; otherwise fall back to neutral/generated styling (Feature 6).
- **FR-006**: **Back** -> Landing (`/`).
- **FR-007**: After Feature 5/6 reload of `ranks.txt`, revisiting this screen shows updated badges/lists.
- **FR-008**: No network. Screen-reader: each column is a labeled region `Rank: {name}`; lists use proper list semantics (Feature 11 a11y baseline).

---

## Assumptions

- This is the user-facing “visit Ranks” experience; Feature 4’s computational compare powers badges elsewhere (calendar) but is not required to be a separate competing “rank hero” home.
- Editing ranks is Config -> Edit ranks.txt -> Rank Editor (Features 11/12), not this screen. Gallery cards are reused as the Rank Editor live preview.

---

## Edge Cases

- Single tier only -> no horizontal overflow; still one column.
- Very long requirement lists -> vertical scroll inside the column, not only page scroll.
- Empty tier (header with no leaves) -> badge with empty state `No requirements listed.`

---

## Success Criteria

- **SC-001**: Gherkin scenarios mapped to tests.
- **SC-002**: All (non-UNRANKED) tiers appear as badges in order.
- **SC-003**: Under-badge lists match `ranks.txt` thresholds.
- **SC-004**: Back returns to landing.
- **SC-005**: Custom tier names from Feature 6 appear without code changes.

---

## Data Ownership & Isolation

Feature 10 owns the gallery view only. Read-only on ranks/catalog.

---

## Key Entities

- **RankColumn:** `{ tierName, badge, sections: [{ headerPath, items: [{ name, targets }] }] }`

---

## Local Service Requirements

| Module         | Method         | Purpose                             |
| -------------- | -------------- | ----------------------------------- |
| `ranksGallery` | `getColumns()` | Map `loadRanks()` -> columns for UI |

---

## Screen Requirements

### View: Ranks--route name `ranksGallery`

- Path: `/ranks`
- Heading: **Ranks**
- Body: horizontal scroller of rank columns (badge + expectations)
- Back: **Back** -> Landing

---

## Acceptance Criteria (Gherkin)

### US-10.1--Browse Rank Badges

#### Scenario: Badges follow ranks.txt order

- **Given** `ranks.txt` defines `BRONZE I` then `BRONZE II`
- **When** I open Ranks
- **Then** I see a badge `BRONZE I` left of `BRONZE II`
- **And** I can scroll horizontally if needed to see later tiers

### US-10.2--See Weekly Expectations Per Rank

#### Scenario: Expectations listed under badge

- **Given** `BRONZE I` requires `pike-push-ups` reps `4` sets `3`
- **When** I open Ranks
- **Then** under the `BRONZE I` badge I see `pike-push-ups` with those targets

### US-10.3--Return To Landing

#### Scenario: Back goes to landing

- **Given** I am on Ranks
- **When** I press **Back**
- **Then** I am on landing

---

## Test Coverage Map

| Story   | Scenario                        | Test file                        | Test name                         |
| ------- | ------------------------------- | -------------------------------- | --------------------------------- |
| US-10.1 | Badges follow ranks.txt order   | `tests/RanksGalleryView.test.js` | `Badges follow ranks.txt order`   |
| US-10.2 | Expectations listed under badge | `tests/RanksGalleryView.test.js` | `Expectations listed under badge` |
| US-10.3 | Back goes to landing            | `tests/RanksGalleryView.test.js` | `Back goes to landing`            |

---

## Test traceability

```text
feature-10-Ranks-Gallery.md
  L___ US-10.1--Browse Rank Badges
        L___ Scenario: Badges follow ranks.txt order
              L___ tests/RanksGalleryView.test.js -> it("Badges follow ranks.txt order")
```

### File header

```javascript
/**
 * Feature 10--Ranks Gallery
 * Spec: features/feature-10-Ranks-Gallery.md
 */
```

---

## Agent implementation request

```text
Implement Feature 10 from @features/feature-10-Ranks-Gallery.md on branch `feature/10-Ranks-Gallery`.

Horizontal rank badge gallery with per-tier weekly expectation lists; Back to landing.
Follow Test Traceability. Do not implement Config (Feature 11).
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Ranks gallery (**FR-001** through **FR-008**)
- [ ] **SC-001** through **SC-005** met
- [ ] Mapped tests pass

---

## Out of Scope

- Editing `ranks.txt` (Feature 11)
- Calendar week badges (Feature 9)
- Active workout (Feature 8)
