---
date: 2026-06-05
repo: lyricstamp
tags: [decision, lyricstamp]
---

# afterSign notarization hook (scripts/notarize.cjs)

**Decision**: Add an explicit `afterSign` hook in `scripts/notarize.cjs` for notarization, and set `"mac": { "notarize": false }` to disable electron-builder 26's built-in `notarizeIfProvided()` path.

**Context**: electron-builder 26 already reads `APPLE_API_KEY*` / `APPLE_ID*` env vars and calls `@electron/notarize` internally (in `macPackager.notarizeIfProvided`). However, with a custom `mac.sign` hook the sequencing is harder to reason about and CI failures are hard to diagnose. An explicit `afterSign` hook makes the notarization step visible, guarded, and testable.

**Why disable `mac.notarize`**: Without `"notarize": false`, both the `afterSign` hook AND the built-in `notarizeIfProvided` would run in CI (both detect the same `APPLE_API_KEY*` env vars), causing a double submission to Apple's notary service. Setting `"notarize": false` disables the built-in path — confirmed by reading `node_modules/app-builder-lib/out/macPackager.js:503` (`if (notarizeOptions === false) { ... return; }`).

**Credential strategy**: API key (`APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`) is the preferred path — CI exports these from the `.p8` key content secret. Apple-ID + app-specific password is the fallback. When neither is present the hook logs and returns (no-op), so local `electron:dist` never fails.

**Stapling**: After `notarize()` resolves, the hook calls `xcrun stapler staple <appPath>` so the ticket is embedded and the DMG is mountable offline.

**Consequences**:
- `scripts/notarize.cjs` — new afterSign hook
- `package.json` — `"afterSign": "scripts/notarize.cjs"` + `"mac": { "notarize": false }`
- `docs/release-notarization.md` — new doc: 5 GitHub secrets, how to obtain them, how to trigger a release
- The old `docs/ai/decisions.md` entry "2026-06-02 — Distribution target: small team" is superseded; notarization now ships.
