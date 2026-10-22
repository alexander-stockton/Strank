# Strank

Welcome. Strank is a local desktop workout tracker that turns your training into readable ranks. Progress is something you can easily see.

This folder is a self-contained Windows build. Double-click `Strank.exe` to install and/or open the app. You do not need any secondary applications, installs, or an internet connection.

## What you can do

- Log exercises for a day, run an active workout with a timer, and keep a history of past sessions.
- Browse ranks and a gallery of badges that reflect how your recent work lines up against the rank definitions you ship or edit.
- Walk through an optional in-app tour and first-run onboarding; open Privacy Notice and Contributing from the UI when you want the details.
- Keep everything on this machine: history, settings, and edited definition files live under your Windows user data folder (`%APPDATA%\Strank\` by default).

## How to customize

Most customization is plain text and local files. There is no sign-up, no cloud, and no spying.

| Area                                                                                      | Where / how                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Language, theme colors, font size, units, navbar layout, animation toggles, accessibility | **Config** in the app (writes `config.txt` in your user data folder)      |
| Which muscle groups matter on which weekdays                                              | Day Focus / landing settings (`landing-config.txt`)                       |
| Exercise catalog and metrics                                                              | `format.txt` (seeded from defaults; editable)                             |
| Rank definitions, badges, and difficulty                                                  | `ranks.txt`, Rank Editor / Ranks Manager, and badge files under `badges/` |
| History database location                                                                 | Config **data directory** / **store path** (optional absolute paths)      |
| Install location                                                                          | Chosen on first launch in the offline setup screen                        |

Ship your own `ranks.txt`, badge SVGs, or localization folders if you fork or redistribute; the runtime prefers your user-data copies and never overwrites them after first seed.

## What makes it run completely offline

Strank is designed so the process never needs the network:

1. **Bundled runtime** - The package includes the NW.js/Chromium runtime and app files. Setup copies from this folder on disk; it does not download installers or updates.
2. **Chromium switches** - The app starts with offline-oriented `chromium-args` (including host resolver rules that fail external DNS locally, plus disabled background update/telemetry paths).
3. **Page policy** - The UI ships a Content Security Policy with `connect-src 'none'`, so the page cannot open fetch, XHR, WebSocket, or similar connections.
4. **Application guard** - Early Node/window bootstrap blocks outbound Node and browser networking APIs used by app code (`http`/`https`/`net`/`dns`, `fetch`, and related surfaces).
5. **Local data only** - Settings, `store.json`, ranks, format, and badges are read and written on the filesystem under your user data (or paths you configure).

Open Contributing in the app for contact links if you want to report issues or share plugins; copy those URLs into your own browser-the app itself will not open the network for you.

## Uninstall

Run `uninstall.exe` from this folder (Unranked badge icon). A console window offers:

1. Remove all traces (install files, desktop shortcut, and `%APPDATA%\Strank\` user data).
2. Remove Strank install files and the desktop shortcut, but keep your user data.
3. Cancel / quit.

Each choice prints the steps it takes as it runs.
