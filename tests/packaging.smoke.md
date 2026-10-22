# Feature 19 — packaging smoke (manual)

Spec: `features/feature-19-Packaging-Distribution.md`

## Packaged exe opens the app

1. On a Windows x64 machine: `npm install` then `npm run dist`.
2. Confirm `dist/Strank-win-x64/Strank.exe` exists.
3. Optionally clear `nw` / `node` from PATH and disconnect the network.
4. Double-click (or run) `Strank.exe`.
5. **Expect (first run):** offline setup UI (install location + Install). Complete install without network.
6. **Expect (after Launch):** Landing (or onboarding). Later launches skip setup.

## Notes

- Path seeding is covered by automated `tests/paths.test.js`.
- Full `npm run dist` in CI: set `STRANK_DIST_SMOKE=1` when running `tests/packaging.test.js`.
