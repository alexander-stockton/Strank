# Feature: Localization & Language Support

**Feature ID:** 16  
**Branch pattern:** `feature/16-Localization`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** The app supports **ten UI languages**. The user picks a language in Config; the choice persists in `config.txt` and applies app-wide to chrome, buttons, labels, empty states, errors, notices (including Feature 15 tips), and date/number formatting. User-authored content in `format.txt` / `ranks.txt` / logged exercise names stays as written (not machine-translated). Arabic uses **RTL** layout. No network translation APIs. **Also:** expand Config **distance** and **weight** unit lists (meters, yards, feet, steps; stones), Steps-specific biological sex + height fields with tooltips and stride equations, weight conversion equations (1 stone = 14 lb), and **convert-on-change** so existing stored metric values are rewritten when the user switches units.  
**Depends on:** Feature 11 Config (`config.txt`); Feature 1 shell; Feature 2 store entries / metrics; all user-facing screens that ship before or with this feature (at minimum Features 2, 7-15 when present)  
**Related:** `features/feature-11-Config-Accessibility-Backup.md`, `features/feature-17-Packaging-Distribution.md`, `features/feature-15-App-Animations.md`, `features/feature-2-Daily-Exercise-Log.md`

---

## User Stories

### US-16.1: Choose App Language

**As a** local user  
**I want** to select my preferred language in Config  
**So that** the UI is readable in a language I know

**Priority:** P1  
**Independent test:** Selecting Spanish updates chrome strings to Spanish and writes `language: es` (or agreed code) to `config.txt`; relaunch keeps Spanish.  
**Acceptance scenarios:** see ### US-16.1 under Acceptance Criteria

### US-16.2: Use Supported Locales

**As a** local user  
**I want** English, Mandarin Chinese, Hindi, Spanish, Standard Arabic, French, German, Portuguese, Russian, and Japanese  
**So that** the major world languages I need are covered offline

**Priority:** P1  
**Independent test:** Each of the ten locales has a complete message catalog; switching to each applies without crash; missing keys fall back to English.  
**Acceptance scenarios:** see ### US-16.2 under Acceptance Criteria

### US-16.3: Arabic Right-To-Left Layout

**As a** user of Standard Arabic  
**I want** the UI to lay out right-to-left  
**So that** reading order and chrome match Arabic conventions

**Priority:** P1  
**Independent test:** With Arabic selected, root `dir="rtl"` (or equivalent); navbar / primary flows mirror; LTR snippets (numbers, exercise ids from files) remain sensible.  
**Acceptance scenarios:** see ### US-16.3 under Acceptance Criteria

### US-16.4: Choose Expanded Distance And Weight Units

**As a** local user  
**I want** more distance units (meters, yards, feet, steps) and stones for weight  
**So that** I can log and view metrics in the units I actually use

**Priority:** P1  
**Independent test:** Config distance list includes mi, km, m, yd, ft, steps; weight list includes lbs, kgs, stones; selections persist in `config.txt`.  
**Acceptance scenarios:** see ### US-16.4 under Acceptance Criteria

### US-16.5: Configure Steps Using Biological Sex And Height

**As a** local user who tracks distance in steps  
**I want** to enter biological sex and height (with explanatory tooltips)  
**So that** Strank can estimate my stride and convert between steps and other distance units

**Priority:** P1  
**Independent test:** Selecting Steps reveals sex + height fields; sex tooltip matches **FR-021** and height tooltip matches **FR-022**; stride uses **FR-023**.  
**Acceptance scenarios:** see ### US-16.5 under Acceptance Criteria

### US-16.6: Convert Existing Values When Units Change

**As a** local user  
**I want** every stored value that used the old unit to convert when I change units in Config  
**So that** history and active fields stay numerically correct in the new unit

**Priority:** P1  
**Independent test:** Changing weight lbs->stones (or distance mi->m, etc.) rewrites affected entry metrics and display labels using **FR-024** / **FR-025**; Steps conversions use stride from **FR-023**.  
**Acceptance scenarios:** see ### US-16.6 under Acceptance Criteria

---

## Requirements

### Functional Requirements

#### Languages & codes

- **FR-001**: Support exactly these UI languages (BCP 47 tags for `config.txt` values):

  | Language (English name) | Tag       | Script / notes                                   |
  | ----------------------- | --------- | ------------------------------------------------ |
  | English                 | `en`      | Default                                          |
  | Mandarin Chinese        | `zh-Hans` | Simplified Chinese                               |
  | Hindi                   | `hi`      | Devanagari                                       |
  | Spanish                 | `es`      | Neutral international Spanish                    |
  | Standard Arabic         | `ar`      | Modern Standard Arabic; **RTL**                  |
  | French                  | `fr`      |                                                  |
  | German                  | `de`      |                                                  |
  | Portuguese              | `pt`      | Neutral (not forced BR vs PT unless later split) |
  | Russian                 | `ru`      | Cyrillic                                         |
  | Japanese                | `ja`      |                                                  |

- **FR-002**: Persist selection as `language: [tag]` in `config.txt` (Feature 11 format). Default **`en`**. If omitted or unknown -> `en` (coerce; prefer no full config reset solely for an unknown language tag).
- **FR-003**: Config **Language** control lists all ten languages by **native endonym** (and MAY show English name in secondary text). Changing language applies immediately to the running UI (or on confirm + soft reload of views - pick one; prefer **immediate** re-render).

#### Message catalogs

- **FR-004**: Ship offline JSON (or equivalent) catalogs under e.g. `locales/[tag].json` (or `data/locales/`), bundled with the app. No download, no cloud translate.
- **FR-005**: All user-visible **app chrome** strings MUST go through `t(key)` / `i18n.t(key, params)`:
  - Nav labels, headings, buttons (`Get Started`, `Save`, `Cancel`, `Complete`, `Back`, …)
  - Empty states, confirm dialogs, inline errors from Features 2-16 that are product copy
  - Feature 15 tip strings (translated equivalents; attribution MAY stay or be localized consistently)
  - Config section titles and control labels
- **FR-006**: **Do not translate** (leave as stored / file text):
  - Exercise names, headers, and notes from `format.txt` / `ranks.txt`
  - Rank tier names from `ranks.txt`
  - User-typed metric numbers
  - File paths, `exerciseId`s, raw Rank Editor buffer
- **FR-007**: Missing key in a locale -> fall back to English string for that key; in development MAY log once. Never show raw key ids to end users if English exists.
- **FR-008**: Interpolation supported for dynamic bits (`"{field} is required."` -> localized pattern with `{field}` as the metric key label when that label is also localized).

#### Layout & formatting

- **FR-009**: When `language: ar`, set document/root direction to **RTL** (`dir="rtl"`). Other languages use **LTR**. Switching away from Arabic restores LTR.
- **FR-010**: Mirroring: horizontal nav, badge corners that are “start/end” aware (e.g. overall badge “top-start” vs hard-coded left/right where Feature 7/11 define left/top navbar - **navbar alignment left/top remains a layout preference**; in RTL, “left rail” still means physical left unless product later maps left->start; **draft clarification for implementers:** keep Feature 11 `navbar alignment: left|top` as physical left/top for v1 so Config behavior stays predictable).
- **FR-011**: Format dates and simple numbers with the active locale where the UI shows locale-friendly dates (Feature 7/9). Stored `localDate` remains `YYYY-MM-DD`.
- **FR-012**: Fonts: ensure bundled or system font stacks cover Latin, Cyrillic, CJK, Devanagari, and Arabic for the ten locales (CSS `font-family` fallbacks). Do not require a network font CDN.
- **FR-013**: Rank Editor help / STRANK formatting rules MAY remain English in v1 if full translation of rule text is deferred - but the Editor chrome (Save, Beautify, buttons) MUST be localized. If rules stay English, show a short note in the active language: e.g. “Formatting rules are shown in English.”
- **FR-014**: Backup ZIP includes `config.txt` (hence language). Import restores language.
- **FR-015**: No network. No OS-only dependency beyond fonts already on a typical Windows install when packaged (Feature 17).

#### Distance & weight units (extends Feature 11)

- **FR-016**: Config **distance units** MUST offer exactly:

  | Config value | Label (English) |
  | ------------ | --------------- |
  | `mi`         | Miles           |
  | `km`         | Kilometers      |
  | `m`          | Meters          |
  | `yd`         | Yards           |
  | `ft`         | Feet            |
  | `steps`      | Steps           |

  Persist as `distance units: <value>` in `config.txt`. Default remains **`mi`**. Unknown / omitted -> coerce to `mi` (no full config reset solely for this).

- **FR-017**: Config **weight units** MUST offer exactly:

  | Config value | Label (English)                                           |
  | ------------ | --------------------------------------------------------- |
  | `lbs`        | Pounds (lbs)                                              |
  | `kgs` / `kg` | Kilograms (kgs) - keep existing Feature 11 alias behavior |
  | `st`         | Stones                                                    |

  Persist as `weight units: <value>` (`lbs` \| `kg` \| `st`). Default remains **`lbs`**. Unknown / omitted -> coerce to `lbs`.

- **FR-018**: Document the new enums in the leading `#` comment block of `config.txt` (alongside existing unit docs).

#### Steps profile (biological sex + height)

- **FR-019**: When **distance units** is **`steps`**, Config MUST show two fields **beneath** the distance-units control (hidden for every other distance unit):
  1. **Biological sex** - binary choice for stride estimation: `male` | `female` (this is **biological sex**, not identified gender). Persist e.g. `stride sex: male|female` in `config.txt` (name MAY be `biological sex:` if preferred; document the chosen key once and keep it stable).
  2. **Height** - numeric height used for stride estimation. Persist e.g. `stride height ft:` as a decimal feet value (or store inches / cm consistently - **implementers MUST pick one canonical store unit and convert the input UI**; prefer **decimal feet** for alignment with **FR-023**).

- **FR-020**: Each of those fields MUST have a **question-mark** help control (same exercise-help / `?` pattern used elsewhere) beside the label.

- **FR-021**: Biological-sex tooltip copy (exact substance):

  > biological males and females have different strides at the same height

- **FR-022**: Height tooltip copy (exact substance pattern):

  > Strank needs your height to estimate how many steps it takes for you to walk one \<UNIT\>

  where `\<UNIT\>` is the **most recently selected other** (non-`steps`) distance unit’s display name (miles, kilometers, meters, yards, or feet). Persist that prior unit (e.g. `distance units previous: mi`) whenever the user selects `steps`, so the tooltip still names a concrete unit after relaunch. If no prior unit exists, default the placeholder to **miles**.

- **FR-023** - **Stride length model** (inches), fitted to the product reference points below.

  **Reference inputs (product approximates from design):**

  | Height | Female stride (in) | Male stride (in) |
  | ------ | ------------------ | ---------------- |
  | 4 ft   | 19.68              | 19.92            |
  | 5 ft   | 24.6               | 24.9             |
  | 6 ft   | ~29.5              | ~29.9            |

  The 4 ft and 5 ft rows fix the slopes. The 6 ft row is **approximate** (not used to fit a second slope). **Normative equations** (authoritative for implementation and tests):

  \[
  \begin{aligned}
  s*{\mathrm{female}}(h*{\mathrm{ft}}) &= 4.92 \times h*{\mathrm{ft}} \\
  s*{\mathrm{male}}(h*{\mathrm{ft}}) &= 4.98 \times h*{\mathrm{ft}}
  \end{aligned}
  \]

  where \(s\) is stride length in **inches** and \(h\_{\mathrm{ft}}\) is height in **feet** (decimals allowed).

  **Prefer the feet-form above in code.** The inch-height form is mathematically equivalent via \(h*{\mathrm{in}} = 12 \times h*{\mathrm{ft}}\):

  \[
  \begin{aligned}
  s*{\mathrm{female}}(h*{\mathrm{in}}) &= \frac{4.92}{12} \times h*{\mathrm{in}} = 0.41 \times h*{\mathrm{in}} \\
  s*{\mathrm{male}}(h*{\mathrm{in}}) &= \frac{4.98}{12} \times h*{\mathrm{in}} \approx 0.415 \times h*{\mathrm{in}}
  \end{aligned}
  \]

  Implementers MUST derive male inch-form as `(4.98 / 12) * h_in` (or simply use feet-form). Do **not** treat the rounded literal `0.415` as an independent constant - in IEEE-754 it is not bit-identical to `4.98 / 12`.

  **Normative checks (equations win over the ~6 ft table cells):**

  | Expression      | Result                    |
  | --------------- | ------------------------- |
  | \(4.92\times4\) | \(19.68\)                 |
  | \(4.92\times5\) | \(24.6\)                  |
  | \(4.92\times6\) | \(29.52\) (≈ table ~29.5) |
  | \(4.98\times4\) | \(19.92\)                 |
  | \(4.98\times5\) | \(24.9\)                  |
  | \(4.98\times6\) | \(29.88\) (≈ table ~29.9) |

  **Steps ↔ linear distance** (once stride \(s\) inches is known):

  \[
  \begin{aligned}
  d*{\mathrm{in}} &= n*{\mathrm{steps}} \times s \\
  n*{\mathrm{steps}} &= \frac{d*{\mathrm{in}}}{s} \quad (s > 0)
  \end{aligned}
  \]

  Convert \(d\_{\mathrm{in}}\) to/from mi, km, m, yd, ft using **FR-024**. If sex or height is missing when Steps is selected, do **not** invent a silent default for conversion prompts - require the fields before converting involving `steps` (or block selecting Steps until both are set - prefer **show fields and block Steps-related conversion** until valid).

#### Distance conversion constants

- **FR-024** - Canonical chain via **meters**. Hardcode these meter factors (international definitions; exact):

  \[
  \begin{aligned}
  1\,\mathrm{mi} &= 1609.344\,\mathrm{m} \\
  1\,\mathrm{yd} &= 0.9144\,\mathrm{m} \\
  1\,\mathrm{ft} &= 0.3048\,\mathrm{m} \\
  1\,\mathrm{in} &= 0.0254\,\mathrm{m} \\
  1\,\mathrm{km} &= 1000\,\mathrm{m} \\
  1\,\mathrm{m} &= 1\,\mathrm{m}
  \end{aligned}
  \]

  Convert \(A \to B\) as \(v_B = v_A \times (m_A / m_B)\). Derived helpers are identities of the above (use for UI / tests with float epsilon - do not introduce a second incompatible factor table):

  \[
  \begin{aligned}
  1\,\mathrm{mi} &= 5280\,\mathrm{ft} = 1760\,\mathrm{yd} = 63360\,\mathrm{in} \\
  1\,\mathrm{yd} &= 3\,\mathrm{ft} = 36\,\mathrm{in} \\
  1\,\mathrm{ft} &= 12\,\mathrm{in}
  \end{aligned}
  \]

  **Steps:** convert via inches using stride from **FR-023**, then **FR-024**.

#### Weight conversion constants

- **FR-025** - **1 stone = 14 pounds exactly.**

  **Normative hardcodes** (only these two; derive everything else):

  \[
  \begin{aligned}
  1\,\mathrm{st} &= 14\,\mathrm{lb} \\
  1\,\mathrm{lb} &= 0.45359237\,\mathrm{kg} \quad \text{(international avoirdupois; exact)}
  \end{aligned}
  \]

  **Derived** (compute in code; do not hardcode a truncated reciprocal as a second source of truth):

  \[
  \begin{aligned}
  1\,\mathrm{lb} &= \frac{1}{14}\,\mathrm{st} \\
  1\,\mathrm{kg} &= \frac{1}{0.45359237}\,\mathrm{lb} \approx 2.2046226218487757\,\mathrm{lb} \\
  1\,\mathrm{st} &= 14 \times 0.45359237\,\mathrm{kg} = 6.35029318\,\mathrm{kg} \\
  1\,\mathrm{kg} &= \frac{1}{14 \times 0.45359237}\,\mathrm{st} \approx 0.15747304441777\,\mathrm{st}
  \end{aligned}
  \]

  (Printed `2.2046226218` / `0.1574730444` in older notes are truncations - fine for prose, **not** for a second hardcoded constant.)

  Convert any weight \(w\) from unit \(A\) to unit \(B\) by going through **pounds** (or kg) as an intermediate.

#### Convert on unit change

- **FR-026**: When the user changes **weight units** in Config, every stored metric value whose schema key is a **weight** metric (e.g. `weight`) MUST be converted from the previous unit to the new unit using **FR-025**, and subsequent UI labels MUST show the new unit. Apply across: store `entries[].metrics`, Active Workout draft (if any), History edit dialogs after reload, Landing/Ranks summaries that surface those numbers.
- **FR-027**: When the user changes **distance units** in Config, every stored metric value whose schema key is a **distance** metric (e.g. `distance`) MUST be converted from the previous unit to the new unit using **FR-024** (and **FR-023** when either side is `steps`), and UI labels MUST update. Same surfaces as **FR-026**.
- **FR-028**: Conversion MUST be **eager on change** (when Config commits the new unit): rewrite persisted store values so relaunch does not depend on “display-only” conversion. Use sufficient floating precision; round for **display** per existing product rules, but avoid destructive double-rounding when toggling A->B->A within the same session when feasible (best-effort; document tolerance in tests).
- **FR-029**: Rank thresholds in `ranks.txt` / catalog expectations that encode absolute weight or distance amounts: **draft** - convert **logged entry metrics** and user-facing inputs first (**FR-026**/**FR-027**). If rank threshold tokens are unit-agnostic numbers today, continue comparing in a **canonical internal unit** (prefer kg for weight, m for distance) after converting both sides; do **not** rewrite `ranks.txt` on Config unit change unless a later FR explicitly requires it.
- **FR-030**: Changing units MUST NOT invent entries; only rewrite eligible numeric metric fields. Non-weight / non-distance metrics (reps, sets, duration, …) are untouched.

---

## Assumptions

- English catalog is the source of truth for keys; other locales are complete translations of the same key set.
- “Standard Arabic” means MSA UI copy, not dialect-specific variants.
- Mandarin uses Simplified (`zh-Hans`), not Traditional, unless a later feature adds `zh-Hant`.
- Portuguese is a single `pt` catalog for v1.
- Stride reference table is an intentional product approximation (linear model), not a medical claim.
- **FR-023** feet-form equations are normative; 6 ft table cells are ≈ only. Prefer `4.92 * h_ft` / `4.98 * h_ft` in code.
- **FR-025** hardcodes only `1 st = 14 lb` and `1 lb = 0.45359237 kg`; derive all other weight factors.
- Biological sex for stride is a binary male/female input for estimation only.
- Stone means the British stone of **exactly 14 lb**.
- Feature 11’s distance `custom` token is superseded by the explicit **FR-016** enum (no free-text custom distance unit in Feature 16).

---

## Edge Cases

- Partial locale file -> missing keys fall back to English (**FR-007**).
- Corrupt locale file -> fall back entirely to English for that session; keep `language` setting; optionally toast in English.
- Metric field names in errors: localize label (`reps` -> localized “Reps”) when showing `{field} is required.`
- Screen-reader mode (Feature 11) + RTL: accessible names use the active language.
- Feature 15 welcome-back and tips: fully localized.
- Height <= 0 or missing sex while `steps` selected -> cannot convert involving steps; keep previous distance unit or show inline validation (**FR-023**).
- Toggling distance `mi` -> `steps` -> `mi` should round-trip within a small epsilon for ordinary values when sex/height are fixed.
- Zero distance / weight remains zero in every unit.
- Very large values: convert without overflow where JS `number` allows; otherwise clamp/toast (prefer convert + keep finite).

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: All ten languages selectable; each loads a catalog; UI strings resolve without throwing.
- **SC-003**: `language` persists across relaunch.
- **SC-004**: Arabic enables RTL; other languages LTR.
- **SC-005**: User data / ranks / format exercise text is not auto-translated.
- **SC-006**: Distance and weight unit lists match **FR-016** / **FR-017**; Steps profile UI matches **FR-019**-**FR-022**.
- **SC-007**: Stride and unit equations match **FR-023**-**FR-025** (tested numerically on reference points).
- **SC-008**: Changing weight or distance units converts existing eligible stored metrics (**FR-026**-**FR-028**, **FR-030**).

---

## Data Ownership & Isolation

Feature 16 owns locale catalogs, `i18n` runtime, and the Config language control (or extends Feature 11 Appearance with a language field - this feature specifies behavior; Config UI hosts the picker). It writes the `language:` line via Feature 11 config APIs. It **also** specifies expanded distance/weight enums, Steps profile keys, stride math, and convert-on-change behavior; Config UI hosts the controls and Feature 11-style persistence in `config.txt`, while Feature 2 store rewrites are performed through existing storage APIs when units change.

---

## Key Entities

- **LocaleTag:** `'en' | 'zh-Hans' | 'hi' | 'es' | 'ar' | 'fr' | 'de' | 'pt' | 'ru' | 'ja'`
- **MessageCatalog:** `{ [key: string]: string }`
- **I18nState:** `{ language: LocaleTag, dir: 'ltr' | 'rtl', catalog: MessageCatalog }`
- **DistanceUnit:** `'mi' | 'km' | 'm' | 'yd' | 'ft' | 'steps'`
- **WeightUnit:** `'lbs' | 'kg' | 'st'`
- **StrideProfile:** `{ sex: 'male' | 'female', heightFt: number }`
- **UnitConversion:** pure functions distance/weight/steps using **FR-023**-**FR-025**

---

## Local Service Requirements

| Module                                 | Method                                             | Purpose                                   |
| -------------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| `i18n`                                 | `init()` / `setLanguage(tag)`                      | Load catalog, set dir, persist via config |
| `i18n`                                 | `t(key, params?)`                                  | Translate with fallback                   |
| `i18n`                                 | `getLanguage()` / `getDir()`                       | Current locale + direction                |
| `i18n`                                 | `listLanguages()`                                  | Tags + native labels for Config picker    |
| `i18n`                                 | `formatDate(localDate)`                            | Locale display for `YYYY-MM-DD`           |
| `unitConversion` (or `config` helpers) | `strideInches(sex, heightFt)`                      | **FR-023**                                |
| `unitConversion`                       | `convertDistance(value, from, to, strideProfile?)` | **FR-024** + steps                        |
| `unitConversion`                       | `convertWeight(value, from, to)`                   | **FR-025**                                |
| `unitConversion` / store pass          | `rewriteStoreMetricsOnUnitChange(...)`             | **FR-026**-**FR-028**                     |

---

## Screen Requirements

### Config - Language (extends Feature 11)

- Section: Appearance (or dedicated **Language**)
- Control: language select / list of ten options
- On change: update `config.txt`, re-render app strings, toggle RTL if needed

### Config - Distance & weight units (extends Feature 11)

- **Distance units** select: mi, km, m, yd, ft, steps (**FR-016**)
- When `steps` selected: biological sex control + height field with `?` tooltips (**FR-019**-**FR-022**)
- **Weight units** select: lbs, kgs, stones (**FR-017**)
- On unit change: persist config, run convert-on-change (**FR-026**-**FR-028**), refresh open views

### App-wide

- All Feature 2-16 chrome uses `t(...)` once this feature ships (incremental OK if build order places 17 after primary screens - any screen merged without keys must be fixed before release).
- Weight/distance field labels and summaries use the active Config unit after conversion.

---

## Acceptance Criteria (Gherkin)

### US-16.1 - Choose App Language

#### Scenario: Language persists in config

- **Given** I am on Config
- **When** I set language to Spanish (`es`)
- **Then** primary chrome strings use the Spanish catalog
- **And** `config.txt` contains `language: es`
- **And** after relaunch the UI remains Spanish

### US-16.2 - Use Supported Locales

#### Scenario: Each supported language loads

- **Given** the app is running
- **When** I select each of `en`, `zh-Hans`, `hi`, `es`, `ar`, `fr`, `de`, `pt`, `ru`, `ja` in turn
- **Then** `i18n.t` resolves a known key (e.g. nav Today / Landing label) without falling through to a missing-key error
- **And** no network requests are made

#### Scenario: Missing key falls back to English

- **Given** language is `fr` and key `test.only.in.english` exists only in `en`
- **When** I call `t('test.only.in.english')`
- **Then** the English string is returned

#### Scenario: Exercise names stay untranslated

- **Given** language is `ja`
- **And** `ranks.txt` contains exercise name `pull-ups`
- **When** I view that exercise on Landing or Ranks
- **Then** the displayed exercise name is still `pull-ups` (file text), not a Japanese translation invented by the app

### US-16.3 - Arabic Right-To-Left Layout

#### Scenario: Arabic sets RTL direction

- **Given** I set language to Standard Arabic (`ar`)
- **When** the UI refreshes
- **Then** the document root direction is `rtl`
- **And** when I switch back to `en`, direction is `ltr`

### US-16.4 - Choose Expanded Distance And Weight Units

#### Scenario: Distance list includes new units

- **Given** I am on Config
- **When** I open the distance units control
- **Then** I can select `mi`, `km`, `m`, `yd`, `ft`, and `steps`
- **And** choosing `yd` writes `distance units: yd` to `config.txt`

#### Scenario: Weight list includes stones

- **Given** I am on Config
- **When** I open the weight units control
- **Then** I can select lbs, kgs, and stones
- **And** choosing stones writes `weight units: st` to `config.txt`

### US-16.5 - Configure Steps Using Biological Sex And Height

#### Scenario: Steps reveals sex and height with tooltips

- **Given** I am on Config
- **When** I set distance units to `steps`
- **Then** biological sex and height fields appear beneath the distance control
- **And** the sex `?` tooltip includes “biological males and females have different strides at the same height”
- **And** the height `?` tooltip includes “Strank needs your height to estimate how many steps it takes for you to walk one” followed by the prior non-steps unit name

#### Scenario: Stride matches reference model

- **Given** biological sex is female and height is 5 ft
- **When** stride is computed per **FR-023**
- **Then** stride length is 24.6 inches
- **And** for male at 6 ft, stride length is 29.88 inches (≈ product table ~29.9; equation is normative)

### US-16.6 - Convert Existing Values When Units Change

#### Scenario: Weight converts on unit change

- **Given** an entry has `weight: 14` while units are `lbs`
- **When** I change weight units to stones (`st`)
- **Then** that entry’s stored weight becomes `1` (14 lb = 1 st)
- **And** UI labels show stones

#### Scenario: Distance converts on unit change including steps

- **Given** stride profile is male, 5 ft (stride 24.9 in)
- **And** an entry has distance `1` while units are `ft`
- **When** I change distance units to `steps`
- **Then** the stored distance becomes the step count for 12 inches of travel at that stride (\(12 / 24.9\))
- **And** changing back to `ft` restores approximately `1` within a small epsilon

---

## Test Coverage Map

| Story   | Scenario                                         | Test file                                           | Test name                                          |
| ------- | ------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------- |
| US-16.1 | Language persists in config                      | `tests/i18n.test.js`                                | `Language persists in config`                      |
| US-16.2 | Each supported language loads                    | `tests/i18n.test.js`                                | `Each supported language loads`                    |
| US-16.2 | Missing key falls back to English                | `tests/i18n.test.js`                                | `Missing key falls back to English`                |
| US-16.2 | Exercise names stay untranslated                 | `tests/i18n.test.js`                                | `Exercise names stay untranslated`                 |
| US-16.3 | Arabic sets RTL direction                        | `tests/I18nView.test.js`                            | `Arabic sets RTL direction`                        |
| US-16.4 | Distance list includes new units                 | `tests/config.test.js` / `tests/ConfigView.test.js` | `Distance list includes new units`                 |
| US-16.4 | Weight list includes stones                      | `tests/config.test.js` / `tests/ConfigView.test.js` | `Weight list includes stones`                      |
| US-16.5 | Steps reveals sex and height with tooltips       | `tests/ConfigView.test.js`                          | `Steps reveals sex and height with tooltips`       |
| US-16.5 | Stride matches reference model                   | `tests/unitConversion.test.js`                      | `Stride matches reference model`                   |
| US-16.6 | Weight converts on unit change                   | `tests/unitConversion.test.js`                      | `Weight converts on unit change`                   |
| US-16.6 | Distance converts on unit change including steps | `tests/unitConversion.test.js`                      | `Distance converts on unit change including steps` |

---

## Test traceability

```text
feature-16-Localization.md
  L___ US-16.1 - Choose App Language
        L___ Scenario: Language persists in config
              L___ tests/i18n.test.js -> it("Language persists in config")
  L___ US-16.6 - Convert Existing Values When Units Change
        L___ Scenario: Weight converts on unit change
              L___ tests/unitConversion.test.js -> it("Weight converts on unit change")
```

### File header

```javascript
/**
 * Feature 16 - Localization & Language Support
 * Spec: features/feature-16-Localization.md
 */
```

---

## Agent implementation request

```text
Implement Feature 16 from @features/feature-16-Localization.md on branch `feature/16-Localization`.

Offline catalogs for en, zh-Hans, hi, es, ar, fr, de, pt, ru, ja; Config language picker; t() for chrome; Arabic RTL; do not translate ranks/format exercise text.
Persist language: [tag] in config.txt.

Also: expand distance units (m, yd, ft, steps) and weight units (stones); Steps sex+height fields/tooltips; stride + unit equations; convert stored metrics when Config units change.
Follow Test Traceability.
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] i18n runtime + ten catalogs + Config picker (**FR-001** through **FR-015**)
- [ ] Distance/weight enums + Steps profile + conversion (**FR-016** through **FR-030**)
- [ ] **SC-001** through **SC-008** met
- [ ] Mapped tests pass
- [ ] Primary shipped screens use `t()` for chrome strings
- [ ] Unit change rewrites eligible store metrics

---

## Out of Scope

- Traditional Chinese, Brazilian vs European Portuguese splits, Arabic dialects
- Machine translation of `ranks.txt` / `format.txt`
- Cloud / online translation APIs
- Per-string crowdin workflow (plain JSON catalogs are enough)
- Translating Rank Editor formatting-rules body (optional follow-up; chrome still localized)
- Non-binary sex options for stride (v1 is male/female biological only)
- Rewriting `ranks.txt` threshold tokens on unit change (**FR-029** keeps canonical compare)
- GPS / pedometer hardware integration (Steps is a unit + stride estimate only)
