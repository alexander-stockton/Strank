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
| 6 | [feature-6-Custom-Ranks.md](./feature-6-Custom-Ranks.md) | `feature/6-Custom-Ranks` | App accommodates any `ranks.txt` ladder; edit via Config → system editor (Feature 11) |
| 7 | [feature-7-Landing-Page.md](./feature-7-Landing-Page.md) | `feature/7-Landing-Page` | Landing: expected daily increments, completed state, **Get Started** |
| 8 | [feature-8-Active-Workout.md](./feature-8-Active-Workout.md) | `feature/8-Active-Workout` | Scrollable checklist workout; **Complete** saves / **Cancel** discards |
| 9 | [feature-9-Workout-History-Calendar.md](./feature-9-Workout-History-Calendar.md) | `feature/9-Workout-History-Calendar` | Month calendar, week rank badges, day detail + edit, year/month/day nav |
| 10 | [feature-10-Ranks-Gallery.md](./feature-10-Ranks-Gallery.md) | `feature/10-Ranks-Gallery` | Horizontal scroll of rank badges + weekly expectations; back to landing |
| 11 | [feature-11-Config-Accessibility-Backup.md](./feature-11-Config-Accessibility-Backup.md) | `feature/11-Config-Accessibility-Backup` | Appearance, a11y, export/import ZIP, Advanced (notifications, edit txt files) |
| 12 | [feature-12-Packaging-Distribution.md](./feature-12-Packaging-Distribution.md) | `feature/12-Packaging-Distribution` | Windows `Strank.exe` package, install vs user-data paths, copy-on-first-run defaults |

## Recommended build order

1 → 5 → 6 → 2 → 3 → 4 → 7 → 8 → 9 → 10 → 11 → 12

Foundation and dynamic catalog/ranks first, then entry + ranking services, then primary UX screens, then Config, then packaging last (so paths/assets are stable).

## Navigation map (user-facing)

```text
Landing (Feature 7)
  ├── Get Started → Active Workout (Feature 8) → Complete/Cancel → Landing
  ├── Workout History (Feature 9) → Day detail → (edit) → Back… → Landing
  ├── Ranks (Feature 10) → Back → Landing
  └── Config (Feature 11) → Back → Landing
```

## Product rules (shared)

- **Indentation grammar:** In `format.txt` and `ranks.txt`, hierarchy is defined by tabs. For line `T`, a line `T+1` indented **one tab deeper** than `T` is a child of `T`. Section size under any header is **indeterminate**.
- **Catalog source:** Active exercises/metrics come from the **merged live catalog** (Feature 5). On conflict, **`ranks.txt` takes priority**.
- **History:** Stored entries MAY retain data for exercises later removed/changed. New/edit forms use the **current** schema.
- **Daily expectations:** Landing/workout targets are the exercise increments for the user’s **target tier** (see Feature 7)—not hardcoded exercise lists.
- **Customization:** Edit `format.txt` / `ranks.txt` via Config Advanced → system default editor (Feature 11); Feature 5 reloads; Feature 6 ensures the ladder is fully accommodated.
- A **calendar day** starts at local midnight. A **week** is Monday–Sunday local.
- All data stays on disk. No network I/O.
- **Packaging (Feature 12):** End users run a packaged Windows `Strank.exe`. Bundled defaults live in the install; history/settings/edited `format.txt`/`ranks.txt`/custom badges live in a writable user data directory (`%APPDATA%\Strank\` or equivalent). JS is packaged with the NW runtime—not AOT-compiled to bare machine code.

## Out of scope (whole project)

- Accounts, login, multi-user, cloud sync
- HTTP/HTTPS clients or remote APIs
- Mobile stores, signed installers, and non-Windows packages (unless a later feature adds them)
