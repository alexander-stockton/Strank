# Feature: Localization & Language Support

**Feature ID:** 16  
**Branch pattern:** `feature/16-Localization`  
**Status:** Ready  
**Created:** 2026-10-17  
**Input:** The app supports **ten UI languages**. The user picks a language in Config; the choice persists in `config.txt` and applies app-wide to chrome, buttons, labels, empty states, errors, notices (including Feature 15 tips), and date/number formatting. User-authored content in `format.txt` / `ranks.txt` / logged exercise names stays as written (not machine-translated). Arabic uses **RTL** layout. No network translation APIs.  
**Depends on:** Feature 11 Config (`config.txt`); Feature 1 shell; all user-facing screens that ship before or with this feature (at minimum Features 2, 7–15 when present)  
**Related:** `features/feature-11-Config-Accessibility-Backup.md`, `features/feature-17-Packaging-Distribution.md`, `features/feature-15-App-Animations.md`

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

---

## Requirements

### Functional Requirements

#### Languages & codes

- **FR-001**: Support exactly these UI languages (BCP 47 tags for `config.txt` values):

  | Language (English name) | Tag | Script / notes |
  | ----------------------- | --- | -------------- |
  | English | `en` | Default |
  | Mandarin Chinese | `zh-Hans` | Simplified Chinese |
  | Hindi | `hi` | Devanagari |
  | Spanish | `es` | Neutral international Spanish |
  | Standard Arabic | `ar` | Modern Standard Arabic; **RTL** |
  | French | `fr` | |
  | German | `de` | |
  | Portuguese | `pt` | Neutral (not forced BR vs PT unless later split) |
  | Russian | `ru` | Cyrillic |
  | Japanese | `ja` | |

- **FR-002**: Persist selection as `language: <tag>` in `config.txt` (Feature 11 format). Default **`en`**. If omitted or unknown → `en` (coerce; prefer no full config reset solely for an unknown language tag).
- **FR-003**: Config **Language** control lists all ten languages by **native endonym** (and MAY show English name in secondary text). Changing language applies immediately to the running UI (or on confirm + soft reload of views—pick one; prefer **immediate** re-render).

#### Message catalogs

- **FR-004**: Ship offline JSON (or equivalent) catalogs under e.g. `locales/<tag>.json` (or `data/locales/`), bundled with the app. No download, no cloud translate.
- **FR-005**: All user-visible **app chrome** strings MUST go through `t(key)` / `i18n.t(key, params)`:
  - Nav labels, headings, buttons (`Get Started`, `Save`, `Cancel`, `Complete`, `Back`, …)
  - Empty states, confirm dialogs, inline errors from Features 2–16 that are product copy
  - Feature 15 tip strings (translated equivalents; attribution MAY stay or be localized consistently)
  - Config section titles and control labels
- **FR-006**: **Do not translate** (leave as stored / file text):
  - Exercise names, headers, and notes from `format.txt` / `ranks.txt`
  - Rank tier names from `ranks.txt`
  - User-typed metric numbers
  - File paths, `exerciseId`s, raw Rank Editor buffer
- **FR-007**: Missing key in a locale → fall back to English string for that key; in development MAY log once. Never show raw key ids to end users if English exists.
- **FR-008**: Interpolation supported for dynamic bits (`"{field} is required."` → localized pattern with `{field}` as the metric key label when that label is also localized).

#### Layout & formatting

- **FR-009**: When `language: ar`, set document/root direction to **RTL** (`dir="rtl"`). Other languages use **LTR**. Switching away from Arabic restores LTR.
- **FR-010**: Mirroring: horizontal nav, badge corners that are “start/end” aware (e.g. overall badge “top-start” vs hard-coded left/right where Feature 7/11 define left/top navbar—**navbar alignment left/top remains a layout preference**; in RTL, “left rail” still means physical left unless product later maps left→start; **draft clarification for implementers:** keep Feature 11 `navbar alignment: left|top` as physical left/top for v1 so Config behavior stays predictable).
- **FR-011**: Format dates and simple numbers with the active locale where the UI shows locale-friendly dates (Feature 7/9). Stored `localDate` remains `YYYY-MM-DD`.
- **FR-012**: Fonts: ensure bundled or system font stacks cover Latin, Cyrillic, CJK, Devanagari, and Arabic for the ten locales (CSS `font-family` fallbacks). Do not require a network font CDN.
- **FR-013**: Rank Editor help / STRANK formatting rules MAY remain English in v1 if full translation of rule text is deferred—but the Editor chrome (Save, Beautify, buttons) MUST be localized. If rules stay English, show a short note in the active language: e.g. “Formatting rules are shown in English.”
- **FR-014**: Backup ZIP includes `config.txt` (hence language). Import restores language.
- **FR-015**: No network. No OS-only dependency beyond fonts already on a typical Windows install when packaged (Feature 17).

---

## Assumptions

- English catalog is the source of truth for keys; other locales are complete translations of the same key set.
- “Standard Arabic” means MSA UI copy, not dialect-specific variants.
- Mandarin uses Simplified (`zh-Hans`), not Traditional, unless a later feature adds `zh-Hant`.
- Portuguese is a single `pt` catalog for v1.

---

## Edge Cases

- Partial locale file → missing keys fall back to English (**FR-007**).
- Corrupt locale file → fall back entirely to English for that session; keep `language` setting; optionally toast in English.
- Metric field names in errors: localize label (`reps` → localized “Reps”) when showing `{field} is required.`
- Screen-reader mode (Feature 11) + RTL: accessible names use the active language.
- Feature 15 welcome-back and tips: fully localized.

---

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: All ten languages selectable; each loads a catalog; UI strings resolve without throwing.
- **SC-003**: `language` persists across relaunch.
- **SC-004**: Arabic enables RTL; other languages LTR.
- **SC-005**: User data / ranks / format exercise text is not auto-translated.

---

## Data Ownership & Isolation

Feature 16 owns locale catalogs, `i18n` runtime, and the Config language control (or extends Feature 11 Appearance with a language field—this feature specifies behavior; Config UI hosts the picker). It writes only the `language:` line via Feature 11 config APIs.

---

## Key Entities

- **LocaleTag:** `'en' | 'zh-Hans' | 'hi' | 'es' | 'ar' | 'fr' | 'de' | 'pt' | 'ru' | 'ja'`
- **MessageCatalog:** `{ [key: string]: string }`
- **I18nState:** `{ language: LocaleTag, dir: 'ltr' | 'rtl', catalog: MessageCatalog }`

---

## Local Service Requirements

| Module | Method | Purpose |
| ------ | ------ | ------- |
| `i18n` | `init()` / `setLanguage(tag)` | Load catalog, set dir, persist via config |
| `i18n` | `t(key, params?)` | Translate with fallback |
| `i18n` | `getLanguage()` / `getDir()` | Current locale + direction |
| `i18n` | `listLanguages()` | Tags + native labels for Config picker |
| `i18n` | `formatDate(localDate)` | Locale display for `YYYY-MM-DD` |

---

## Screen Requirements

### Config — Language (extends Feature 11)

- Section: Appearance (or dedicated **Language**)
- Control: language select / list of ten options
- On change: update `config.txt`, re-render app strings, toggle RTL if needed

### App-wide

- All Feature 2–16 chrome uses `t(...)` once this feature ships (incremental OK if build order places 17 after primary screens—any screen merged without keys must be fixed before release).

---

## Acceptance Criteria (Gherkin)

### US-16.1 — Choose App Language

#### Scenario: Language persists in config

- **Given** I am on Config
- **When** I set language to Spanish (`es`)
- **Then** primary chrome strings use the Spanish catalog
- **And** `config.txt` contains `language: es`
- **And** after relaunch the UI remains Spanish

### US-16.2 — Use Supported Locales

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

### US-16.3 — Arabic Right-To-Left Layout

#### Scenario: Arabic sets RTL direction

- **Given** I set language to Standard Arabic (`ar`)
- **When** the UI refreshes
- **Then** the document root direction is `rtl`
- **And** when I switch back to `en`, direction is `ltr`

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
| ----- | -------- | --------- | --------- |
| US-16.1 | Language persists in config | `tests/i18n.test.js` | `Language persists in config` |
| US-16.2 | Each supported language loads | `tests/i18n.test.js` | `Each supported language loads` |
| US-16.2 | Missing key falls back to English | `tests/i18n.test.js` | `Missing key falls back to English` |
| US-16.2 | Exercise names stay untranslated | `tests/i18n.test.js` | `Exercise names stay untranslated` |
| US-16.3 | Arabic sets RTL direction | `tests/I18nView.test.js` | `Arabic sets RTL direction` |

---

## Test traceability

```text
feature-16-Localization.md
  └── US-16.1 — Choose App Language
        └── Scenario: Language persists in config
              └── tests/i18n.test.js → it("Language persists in config")
```

### File header

```javascript
/**
 * Feature 16 — Localization & Language Support
 * Spec: features/feature-16-Localization.md
 */
```

---

## Agent implementation request

```text
Implement Feature 16 from @features/feature-16-Localization.md on branch `feature/16-Localization`.

Offline catalogs for en, zh-Hans, hi, es, ar, fr, de, pt, ru, ja; Config language picker; t() for chrome; Arabic RTL; do not translate ranks/format exercise text.
Persist language: <tag> in config.txt. Follow Test Traceability.
Do not implement behavior not in this spec.
```

---

## Definition of Done

- [ ] i18n runtime + ten catalogs + Config picker (**FR-001** through **FR-015**)
- [ ] **SC-001** through **SC-005** met
- [ ] Mapped tests pass
- [ ] Primary shipped screens use `t()` for chrome strings

---

## Out of Scope

- Traditional Chinese, Brazilian vs European Portuguese splits, Arabic dialects
- Machine translation of `ranks.txt` / `format.txt`
- Cloud / online translation APIs
- Per-string crowdin workflow (plain JSON catalogs are enough)
- Translating Rank Editor formatting-rules body (optional follow-up; chrome still localized)
