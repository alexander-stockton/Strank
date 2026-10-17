# Strank

give yourself some extra workout motivation by rankings

Local NW.js desktop app (Feature specs under `features/`).

## Feature 1 — App Foundation

Offline shell, indentation-aware `format.txt` / `ranks.txt` parsers, and local `store.json`.

### Develop

```bash
npm install
npm start
```

Requires the `nw` package postinstall to complete (NW.js runtime).

### Test

```bash
npm test
```

### Data

Bundled defaults live in `data/` (`format.txt`, `ranks.txt`, `badges/`, `config.txt`).  
Runtime store: `data/store.json` (created on first launch; gitignored).
