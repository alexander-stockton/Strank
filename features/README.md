# Exercise Ranking — Feature Specs

Standalone **NW.js** (Node + WebKit) local-machine app. One user (the machine owner). **No authentication. No web requests.**

Exercise definitions: merged from `format.txt` and `ranks.txt` (**`ranks.txt` wins on conflict** — Feature 5).  
Rank ladder: whatever tiers appear in `ranks.txt` (Feature 6; not a fixed Bronze→Pro list).

## Feature map

| ID | Spec | Branch pattern | Summary |
| -- | ---- | -------------- | ------- |
| 1 | [feature-1-App-Foundation.md](./feature-1-App-Foundation.md) | `feature/1-App-Foundation` | NW.js shell, local storage, indentation-aware parse, offline-only |
| 2 | [feature-2-Daily-Exercise-Log.md](./feature-2-Daily-Exercise-Log.md) | `feature/2-Daily-Exercise-Log` | Entry model + CRUD services for a calendar day (used by workout + history) |
| 3 | [feature-3-Exercise-History.md](./feature-3-Exercise-History.md) | `feature/3-Exercise-History` | Full-history entry CRUD services (calendar UI is Feature 9) |
| 4 | [feature-4-Weekly-Ranking.md](./feature-4-Weekly-Ranking.md) | `feature/4-Weekly-Ranking` | Compile/average/compare to ranks (week + day); badge data for other screens |
| 5 | [feature-5-Dynamic-Exercise-Catalog.md](./feature-5-Dynamic-Exercise-Catalog.md) | `feature/5-Dynamic-Exercise-Catalog` | Live catalog; ranks priority; dynamic fields; orphans |
| 6 | [feature-6-Custom-Ranks.md](./feature-6-Custom-Ranks.md) | `feature/6-Custom-Ranks` | App accommodates any `ranks.txt` ladder; author via Rank Editor (Feature 13) |
| 7 | [feature-7-Landing-Page.md](./feature-7-Landing-Page.md) | `feature/7-Landing-Page` | Landing shell: navbar left/top, overall badge, today + next-rank panels, **Get Started** |
| 8 | [feature-8-Active-Workout.md](./feature-8-Active-Workout.md) | `feature/8-Active-Workout` | Scrollable checklist workout; **Complete** saves / **Cancel** discards |
| 9 | [feature-9-Workout-History-Calendar.md](./feature-9-Workout-History-Calendar.md) | `feature/9-Workout-History-Calendar` | Month calendar, week rank badges, day detail + edit, year/month/day nav |
| 10 | [feature-10-Ranks-Gallery.md](./feature-10-Ranks-Gallery.md) | `feature/10-Ranks-Gallery` | Horizontal scroll of rank badges + weekly expectations; back to landing |
| 11 | [feature-11-Config-Accessibility-Backup.md](./feature-11-Config-Accessibility-Backup.md) | `feature/11-Config-Accessibility-Backup` | Appearance (incl. navbar alignment), a11y, export/import ZIP, Advanced (logging, Rank Editor) |
| 12 | [feature-12-Packaging-Distribution.md](./feature-12-Packaging-Distribution.md) | `feature/12-Packaging-Distribution` | Windows `Strank.exe` package, install vs user-data paths, copy-on-first-run defaults |
| 13 | [feature-13-Rank-Editor.md](./feature-13-Rank-Editor.md) | `feature/13-Rank-Editor` | In-app ranks.txt editor + live Ranks Gallery–style preview; beautify/fix/save |
| 14 | [feature-14-Skill-Progress-Landing.md](./feature-14-Skill-Progress-Landing.md) | `feature/14-Skill-Progress-Landing` | Four-column skill progress + local ranks; overall = average of locals |
| 15 | [feature-15-Landing-Layout-Day-Focus.md](./feature-15-Landing-Layout-Day-Focus.md) | `feature/15-Landing-Layout-Day-Focus` | Landing layout drag/drop + weekday muscle-group focus menus |
| 16 | [feature-16-Workout-Start-Transition.md](./feature-16-Workout-Start-Transition.md) | `feature/16-Workout-Start-Transition` | **Draft:** Get Started warble/fade + tip notice → Active Workout |
| 17 | [feature-17-Localization.md](./feature-17-Localization.md) | `feature/17-Localization` | Offline UI locales: en, zh-Hans, hi, es, ar (RTL), fr, de, pt, ru, ja |

## Recommended build order

1 → 5 → 6 → 2 → 3 → 4 → 7 → 8 → 16 → 9 → 10 → 11 → 17 → 13 → 14 → 15 → 12

Foundation and dynamic catalog/ranks first, then entry + ranking services, then primary UX screens (Landing → Workout, with Feature 16 transition after both exist), then Config, then localization (so string keys stabilize), then Rank Editor + landing extensions, then packaging last (so paths/assets are stable).

## Navigation map (user-facing)

```text
Landing (Feature 7; +14 skill progress; +15 layout/day-focus menus)
  ├── Get Started → (Feature 16 transition notice) → Active Workout (Feature 8) → Complete/Cancel → Landing
  ├── Workout History (Feature 9) → Day detail → (edit) → Back… → Landing
  ├── Ranks (Feature 10) → Back → Landing
  └── Config (Feature 11) → Back → Landing
        └── Advanced → Edit ranks.txt → Rank Editor (Feature 13) → Back → Config
```

## Product rules (shared)

- **Indentation grammar:** In `format.txt` and `ranks.txt`, hierarchy is defined by tabs. For line `T`, a line `T+1` indented **one tab deeper** than `T` is a child of `T`. Section size under any header is **indeterminate**.
- **Catalog source:** Active exercises/metrics come from the **merged live catalog** (Feature 5). On conflict, **`ranks.txt` takes priority**.
- **History:** Stored entries MAY retain data for exercises later removed/changed. New/edit forms use the **current** schema.
- **Daily expectations:** Landing/workout targets are the exercise increments for the user’s **target tier**, filtered by Feature 15 weekday muscle-group focus when that feature is present—not hardcoded exercise lists.
- **Customization:** Edit `ranks.txt` via Rank Editor (Feature 13, opened from Config Advanced). Change `format.txt` via filesystem or backup import (no Config Advanced “Edit format.txt” control). Feature 5 reloads; Feature 6 ensures the ladder is fully accommodated.
- **Navbar:** `navbar alignment: left|top` in `config.txt` (Feature 11). Left: rail + overall badge top-left. Top: top tabs + overall badge top-right.
- **Language (Feature 17):** UI chrome via offline catalogs (`language: en|zh-Hans|hi|es|ar|fr|de|pt|ru|ja`). Arabic is RTL. Exercise/rank text from data files is not auto-translated.
- **Overall rank (landing):** After Feature 14, overall badge = average of per-skill local ranks (see Feature 14).
- A **calendar day** starts at local midnight. A **week** is Monday–Sunday local.
- All data stays on disk. No network I/O.
- **Packaging (Feature 12):** End users run a packaged Windows `Strank.exe`. Bundled defaults live in the install; history/settings/edited `format.txt`/`ranks.txt`/custom badges live in a writable user data directory (`%APPDATA%\Strank\` or equivalent). JS is packaged with the NW runtime—not AOT-compiled to bare machine code.

## Out of scope (whole project)

- Accounts, login, multi-user, cloud sync
- HTTP/HTTPS clients or remote APIs
- Mobile stores, signed installers, and non-Windows packages (unless a later feature adds them)
