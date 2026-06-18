---
date: 2026-06-06
repo: lyricstamp
tags: [decision, lyricstamp]
---

# Rebrand to "LyricStamp" is display-only; internal identifiers pinned

**Decision**: Rebrand the product from "AbleSet Sync" to **LyricStamp** (to avoid trademark proximity to the AbleSet product), but rename **only display surfaces**. All on-disk/protocol identifiers keep their original `ableset-*` strings.

**Context**: "AbleSet" appears in three distinct roles in this repo: (1) our old brand "AbleSet Sync" / slug `ableset-lyrics-sync`; (2) **AbleSet the third-party iPad app** we integrate with (nominative, factual); (3) internal identifiers — the `ableset-2` `arrangement_writer_version` handshake, the `session-store` data dir `appName='ableset-lyrics-sync'`, and the renderer's `ableset-sync.` localStorage prefix / `ableset-sync` IndexedDB name. Renaming (2) would be inaccurate; renaming (3) would break already-installed remote scripts and orphan existing user data.

**Key trap**: `package.json` `name`/`productName` drives `app.getName()` → `app.getPath('userData')`. Changing `name` to `lyricstamp` would move the Electron userData dir from `~/Library/Application Support/ableset-lyrics-sync` to `.../lyricstamp`, orphaning the live session store (`sessions-data/`). Fixed by explicitly pinning `app.setPath('userData', join(app.getPath('appData'), 'ableset-lyrics-sync'))` before `whenReady` in `electron/main.ts`. `getPath('appData')` is OS-level and independent of the app name.

**Alternatives considered**:
- Rename internal storage keys + migrate data — more churn, more breakage surface, no user-visible benefit (keys are invisible).
- Full sweep including `docs/ai/*` / `design/` — deferred (visible-surface-only chosen) to keep the diff tight and avoid hitting "keep" strings.

**Consequences**:
- appId changed to `com.lyricstamp` (clean identity) while data paths stay on the old slug — verified the signed `LyricStamp.app` still resolves sessions to the original dir.
- New contributors will see `ableset-*` strings in storage/protocol code that must NOT be "cleaned up" to match the brand — see the data-safety KEEPS list in project-state.md.
- `scripts/e2e-app.mjs` now derives the Mach-O binary name from the `.app` bundle dir name (robust to future product renames).
