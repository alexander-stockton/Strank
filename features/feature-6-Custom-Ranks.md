# Feature: Custom Ranks

**Feature ID:** 6  
**Branch pattern:** `feature/6-Custom-Ranks`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** The user can define what the rank ladder is--tier names and per-exercise requirements--inside `ranks.txt`. The application’s measurements, comparison logic, Landing expectations, Ranks gallery, and calendar badges accommodate whatever tiers and exercise lines appear there. Primary authoring path is the in-app Rank Editor (Feature 12), opened from Config -> Advanced -> **Edit ranks.txt**.  
**Depends on:** Feature 1 indentation parse; Feature 4 ranking engine; Feature 5 live catalog; Feature 11 for **Edit ranks.txt** entry; Feature 12 Rank Editor  
**Related:** `ranks.txt`, `features/feature-4-Weekly-Ranking.md`, `features/feature-5-Dynamic-Exercise-Catalog.md`, `features/feature-10-Ranks-Gallery.md`, `features/feature-11-Config-Accessibility-Backup.md`, `features/feature-12-Rank-Editor.md`

---

## User Stories

### US-6.1: Define A Custom Ladder In ranks.txt

**As a** local user  
**I want** to put my own rank names and requirements in `ranks.txt`  
**So that** the tracker follows my progression system

**Priority:** P1  
**Independent test:** After editing `ranks.txt` to add `COPPER I` with requirements and reloading, `listTierNames()` includes `COPPER I` and Feature 10 shows its badge.  
**Acceptance scenarios:** see ### US-6.1 under Acceptance Criteria

### US-6.2: Change Requirements

**As a** local user  
**I want** threshold edits in `ranks.txt` to change what counts as meeting a rank  
**So that** weekly/day badges and landing expectations stay accurate

**Priority:** P1  
**Independent test:** Raising `BRONZE I` pike push-ups from x4 to x5 causes averages of 4.5 to fail that tier after reload.  
**Acceptance scenarios:** see ### US-6.2 under Acceptance Criteria

### US-6.3: UI Accommodates Custom Ladder

**As a** local user  
**I want** every rank-consuming screen to use the file-defined ladder  
**So that** nothing assumes a fixed Bronze->Pro list

**Priority:** P1  
**Independent test:** With only `COPPER I` and `COPPER II`, gallery, calendar badges, and `getTargetTier()` only reference those tiers.  
**Acceptance scenarios:** see ### US-6.3 under Acceptance Criteria

### US-6.4: Edit Via Rank Editor

**As a** local user  
**I want** Config -> Advanced -> **Edit ranks.txt** to open the Rank Editor  
**So that** I can customize ranks with full control over indentation and a live gallery preview

**Priority:** P1  
**Independent test:** Choosing **Edit ranks.txt** opens Feature 12 Rank Editor on the app’s ranks file (implemented under Features 11/12; verified here as the supported authoring path).  
**Acceptance scenarios:** see ### US-6.4 under Acceptance Criteria

### US-6.5: Custom Badge Image For A Custom Rank

**As a** local user  
**I want** to attach my own image to a custom rank I create  
**So that** the Ranks gallery and calendar badges show my artwork instead of only a generated/default look

**Priority:** P1  
**Independent test:** A custom tier `COPPER I` with badge path `badges/custom/copper-i.png` (file present) displays that image in the Ranks gallery; missing file falls back gracefully.  
**Acceptance scenarios:** see ### US-6.5 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: Tier set is **entirely file-defined** by `ranks.txt`. Ranking, Landing expectations, Ranks gallery, and calendar badges MUST NOT hardcode `BRONZE`...`PRO` families as required tiers.
- **FR-002**: Tier **order** is file order (low -> high). Indentation grammar (Feature 1) defines headers vs exercise leaves; child counts are indeterminate.
- **FR-003**: `UNRANKED` is optional in the file. Computed fallback when nothing matches remains the string `UNRANKED`.
- **FR-004**: After `ranks.txt` changes on disk, Feature 5 `reloadFromDisk()` MUST refresh ranks + merged catalog (`ranks.txt` still wins exercise conflicts).
- **FR-005**: All measurement/threshold fields implied by ranks leaves are dynamic (Feature 1 placeholders).
- **FR-006**: Feature 4 `compareToRanks` / `compareDay` / `getTargetTier` consume whatever `loadRanks()` returns--no code change per new tier name.
- **FR-007**: **Authoring path:** Feature 11 **Edit ranks.txt** opens the Feature 12 **Rank Editor** (plaintext + live Ranks Gallery–style preview). A separate structured form builder is not required.
- **FR-008**: Each rank header in `ranks.txt` MAY include a **badge path line** immediately after the rank name and before the `--------------` separator. Format:
  ```text
  COPPER I:
  badges/custom/copper-i.png
  --------------
  ```
  The path is **relative to the app data / project root** (same root as `ranks.txt`). Default ranks ship with paths under `badges/` (e.g. `badges/bronze-i.svg`).
- **FR-009**: `loadRanks()` MUST parse that line into `badgePath` on each `RankTier`. Feature 10 gallery and Feature 9 calendar badges MUST render the image at `badgePath` when the file exists.
- **FR-010**: For a **custom rank**, the user MAY set `badgePath` to any local image (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`). Recommended: place files under `badges/custom/` and reference them from `ranks.txt`. Config MAY offer **Choose badge image...** that copies the picked file into `badges/custom/` and writes/updates the path line in `ranks.txt` (P2 convenience; editing the path line manually is sufficient for P1).
- **FR-011**: If `badgePath` is missing, empty, or the file cannot be read -> fall back to a neutral generated badge (or tier-name text chip). Do not block ranking.
- **FR-012**: Visual styling MAY special-case known prefixes only when no usable `badgePath` image loads; prefer the file image when present.
- **FR-013**: No network (badge images are local files only).

---

## Assumptions

- Writable `ranks.txt` under app data (Feature 1 / 11).
- Default badge assets live in `/badges` and are referenced from `ranks.txt`.
- Users understand tab indentation when editing; parse errors surface Feature 1 messages after reload.

---

## Edge Cases

- Delete a tier that badges previously showed -> after reload, badges use remaining tiers only.
- Malformed edit -> `"Failed to load rank data."` until fixed; last good in-memory ranks may be kept until successful reload (document choice in implementation; prefer keep last good and show error toast).
- Badge path points outside the app directory -> reject or ignore with fallback (`"Badge path is not allowed."` if set via Config picker).
- Unsupported image type -> fallback badge.

---

## Success Criteria

- **SC-001**: Gherkin scenarios mapped to tests.
- **SC-002**: Custom tier appears in `loadRanks()` and Feature 10 after reload.
- **SC-003**: Threshold edits change compare outcomes.
- **SC-004**: Minimal custom ladder works across gallery/calendar/landing target.
- **SC-005**: Supported edit path is Rank Editor via Config Advanced (Features 11/12).
- **SC-006**: Custom rank with a valid local `badgePath` shows that image in the gallery; missing file falls back without crashing.

---

## Data Ownership & Isolation

Feature 6 owns the product rules for accommodating arbitrary ladders. Authoring UI is Feature 12 (entered via Feature 11); parsing is Feature 1; merge reload is Feature 5.

---

## Key Entities

- **RankTier:** As Feature 1 -- any `name` / `order` / `badgePath` / thresholds from file.

---

## Local Service Requirements

| Module  | Method                                     | Purpose                                                     |
| ------- | ------------------------------------------ | ----------------------------------------------------------- |
| `ranks` | `loadRanks()`                              | Includes `badgePath` per tier                               |
| `ranks` | `resolveBadgeUrl(tier)`                    | Absolute/file URL for UI, or `null` if missing              |
| `ranks` | `setBadgeImage(tierName, sourcePath)` (P2) | Copy into `badges/custom/` and update `ranks.txt` path line |

Feature 11 owns `openInDefaultEditor('ranks.txt')`.

---

## Screen Requirements

- No dedicated ranks editor screen in this feature.
- Consumers: Feature 10 gallery, Feature 9 badges, Feature 7 expectations, Feature 11 Advanced link.

---

## Acceptance Criteria (Gherkin)

### US-6.1 -- Define A Custom Ladder In ranks.txt

#### Scenario: Custom tier loads after reload

- **Given** `ranks.txt` includes a new tier `COPPER I` with `pike-push-ups x3 x3`
- **When** live ranks reload
- **Then** `listTierNames()` includes `COPPER I`
- **And** Ranks gallery shows a `COPPER I` badge

### US-6.2 -- Change Requirements

#### Scenario: Raised threshold fails prior average

- **Given** `BRONZE I` `pike-push-ups` required reps `4`
- **And** the user’s weekly average reps is `4.5`
- **When** `ranks.txt` is changed so required reps is `5` and ranks reload
- **And** the week is compared again
- **Then** that exercise does not meet `BRONZE I` on reps

### US-6.3 -- UI Accommodates Custom Ladder

#### Scenario: Only defined tiers appear

- **Given** `ranks.txt` defines only `COPPER I` and `COPPER II`
- **When** Ranks gallery and ranking services load
- **Then** only those tiers are used for badges and next-tier logic
- **And** `PRO X` is not required to exist

### US-6.4 -- Edit Via Rank Editor

#### Scenario: Config opens Rank Editor

- **Given** I am in Config -> Advanced
- **When** I press **Edit ranks.txt**
- **Then** the Rank Editor opens with the app `ranks.txt` loaded (Feature 12)

### US-6.5 -- Custom Badge Image For A Custom Rank

#### Scenario: Custom rank uses a custom badge image

- **Given** `ranks.txt` contains
  ```text
  COPPER I:
  badges/custom/copper-i.png
  --------------
  ```
- **And** the file `badges/custom/copper-i.png` exists
- **When** ranks reload and I open the Ranks gallery
- **Then** the `COPPER I` column displays the image from `badges/custom/copper-i.png`

#### Scenario: Missing badge file falls back

- **Given** a tier lists `badges/custom/missing.png` but the file does not exist
- **When** the gallery renders that tier
- **Then** a fallback badge is shown
- **And** ranking still works for that tier

#### Scenario: Default ranks reference shipped badges

- **Given** the shipped `ranks.txt`
- **When** `BRONZE I` is loaded
- **Then** its `badgePath` is `badges/bronze-i.svg`
- **And** that file exists under `/badges`

---

## Test Coverage Map

| Story  | Scenario                               | Test file                        | Test name                                |
| ------ | -------------------------------------- | -------------------------------- | ---------------------------------------- |
| US-6.1 | Custom tier loads after reload         | `tests/ranks.test.js`            | `Custom tier loads after reload`         |
| US-6.2 | Raised threshold fails prior average   | `tests/ranking.test.js`          | `Raised threshold fails prior average`   |
| US-6.3 | Only defined tiers appear              | `tests/RanksGalleryView.test.js` | `Only defined tiers appear`              |
| US-6.4 | Config opens Rank Editor               | `tests/ConfigView.test.js`       | `Config opens Rank Editor`               |
| US-6.5 | Custom rank uses a custom badge image  | `tests/ranks.test.js`            | `Custom rank uses a custom badge image`  |
| US-6.5 | Custom rank uses a custom badge image  | `tests/RanksGalleryView.test.js` | `Custom rank uses a custom badge image`  |
| US-6.5 | Missing badge file falls back          | `tests/RanksGalleryView.test.js` | `Missing badge file falls back`          |
| US-6.5 | Default ranks reference shipped badges | `tests/ranks.test.js`            | `Default ranks reference shipped badges` |

---

## Test traceability

```text
feature-6-Custom-Ranks.md
  L___ US-6.1 -- Define A Custom Ladder In ranks.txt
        L___ Scenario: Custom tier loads after reload
              L___ tests/ranks.test.js -> it("Custom tier loads after reload")
```

### File header

```javascript
/**
 * Feature 6 -- Custom Ranks
 * Spec: features/feature-6-Custom-Ranks.md
 */
```

---

## Agent implementation request

```text
Implement Feature 6 from @features/feature-6-Custom-Ranks.md on branch `feature/6-Custom-Ranks`.

Ensure ranking, landing expectations, gallery, and badges work with arbitrary ranks.txt ladders.
Parse badgePath lines; support custom local badge images for custom ranks; fall back if missing.
Editing is via Feature 12 Rank Editor (opened from Feature 11) + Feature 5 reload--do not build a separate structured ranks form.
Follow Test Traceability. Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] Custom ladder accommodation (**FR-001** through **FR-013**)
- [ ] **SC-001** through **SC-006** met
- [ ] No hardcoded Bronze->Pro requirement in consumers
- [ ] Default `/badges` assets referenced from shipped `ranks.txt`
- [ ] Mapped tests pass

---

## Out of Scope

- In-app structured ranks form builder (plaintext Rank Editor in Feature 12 is the authoring UI)
- ZIP backup (Feature 11) -- backups SHOULD include `badges/` when present
- Ranks gallery layout details beyond consuming `badgePath` (Feature 10)
