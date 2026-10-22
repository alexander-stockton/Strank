# Strank

give yourself some extra workout motivation by rankings

Local NW.js desktop app (Feature specs under `features/`).

## Develop

```bash
npm install
npm start
```

Requires the `nw` package postinstall to complete (NW.js runtime).

Dev user data: **`.strank-user-data/`** (seeded from `data/` defaults on first run). See [docs/packaging.md](docs/packaging.md).

## Test

```bash
npm test
```

## Package (Windows x64)

```bash
npm run dist
```

Output: **`dist/Strank-win-x64/Strank.exe`**. The folder is self-contained: first launch shows an offline setup UI (no internet). End users do not need Node or NW.js installed.

Packaged user data: **`%APPDATA%\Strank\`**.

Full details: [docs/packaging.md](docs/packaging.md).

## Data

| Location | Contents |
| -------- | -------- |
| `data/` (install) | Bundled `format.txt`, `ranks.txt`, `defaults/`, `badges/`, `localization/` |
| `.strank-user-data/` (dev) / `%APPDATA%\Strank\` (packaged) | Writable `config.txt`, `store.json`, edited `format.txt` / `ranks.txt`, `badges/` |
