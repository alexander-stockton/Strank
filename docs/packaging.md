# Packaging & Distribution (Feature 19)

Windows x64 shippable build for Strank. NSIS/MSI/Squirrel installers and code signing remain out of scope; the packaged app includes an **offline setup UI** instead.

## Develop (unpackaged)

```bash
npm install
npm start
```

Runs the NW.js SDK against the repo (`nw .`). No `npm run dist` required. The setup/installer UI is **not** shown in dev.

### User data (dev)

Writable files live under **`.strank-user-data/`** at the project root (gitignored):

- `config.txt`, `window-state.json`, `setup-state.json`
- `format.txt`, `ranks.txt`, `store.json`, `landing-config.txt`
- `badges/` (seeded defaults + `badges/custom/`)

Bundled templates stay in `data/` / `data/defaults/` / `data/badges/` / `data/localization/` and are **copy-on-first-run** seeded into `.strank-user-data/` when missing. Existing user copies are never overwritten.

## Package (Windows x64)

```bash
npm install
npm run dist
```

Downloads the NW.js **normal** (non-SDK) runtime at **build time only** on the developer machine, then writes a **fully offline** folder:

```text
dist/Strank-win-x64/
  Strank.exe
  assets/icon.png   (window / taskbar)
  assets/icon.ico   (Explorer exe + desktop shortcut; built from icon.png)
  (NW runtime + bundled app files + defaults)
```

`npm run dist` regenerates `assets/icon.ico` from `assets/icon.png` and embeds that `.ico` into `Strank.exe`. The offline setup shortcut uses the same badge.

End users do **not** need Node.js, NW.js, or an internet connection to install or run.

### First launch (offline setup)

1. Double-click `Strank.exe`.
2. An installer-like screen asks for an install folder (default `%LOCALAPPDATA%\Programs\Strank`) and optional desktop shortcut.
3. **Install** copies files from the package on disk (no downloads) and seeds `%APPDATA%\Strank\`.
4. **Launch Strank** opens the app (relaunches from the install folder when it differs from the package location).

Later launches skip setup (`setup-state.json` under user data).

### User data (packaged)

`%APPDATA%\Strank\` (typically `C:\Users\<you>\AppData\Roaming\Strank\`).

Same layout as dev user data. Reinstalling the app does not wipe this folder unless the user deletes it.

### Offline / no internet

Strank is built for **zero network access**. Enforcement is layered:

1. **Chromium / NW.js** — `src/chromiumOfflineArgs.js` → `package.json` `chromium-args` (stamped into every `npm run dist` package). Includes `--host-resolver-rules=MAP * ~NOTFOUND` (fail all DNS locally), DoH/QUIC/WebRTC off, and background-update/telemetry switches disabled.
2. **Page CSP** — `index.html` uses `connect-src 'none'` so the UI cannot open fetch/XHR/WebSocket/EventSource connections.
3. **App JS** — `src/networkGuard.js` (from `node-main` and app boot) blocks Node `http`/`https`/`net`/`tls`/`dns`/`dgram`, `fetch`, XHR, WebSocket, `sendBeacon`, and `nw.Shell.openExternal`.
4. **Setup** — copies files only from the local package folder.

Rebuild with `npm run dist` after changing offline args so `package.nw` picks them up. Quit any running `Strank.exe` before rebuilding (Windows locks `package.nw`).

### Antivirus / SmartScreen

Unsigned NW.js executables may trigger warnings. Code signing is out of scope for Feature 19.

## Smoke checklist (manual)

1. `npm run dist` exits 0 and `dist/Strank-win-x64/Strank.exe` exists.
2. Disconnect network (or block outbound). Launch `Strank.exe` → setup UI appears; Install completes without errors.
3. Launch Strank → Landing (or onboarding) opens; `%APPDATA%\Strank\` has `format.txt`, `ranks.txt`, and default badges.
4. Quit and relaunch → setup UI does not appear again; edited `ranks.txt` is preserved.
5. `npm start` in the repo still works without packaging first (no setup UI).
