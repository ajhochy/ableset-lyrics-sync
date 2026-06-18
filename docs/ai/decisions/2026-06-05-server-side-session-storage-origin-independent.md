---
date: 2026-06-05
repo: lyricstamp
tags: [decision, lyricstamp]
---

# Server-side session storage (origin-independent)

**Decision**: Store named sessions on the server filesystem under `<dataDir>/sessions-data/` (`<id>.json` + `<id>.pdf`) rather than browser IndexedDB.

**Context**: IndexedDB is origin-partitioned — sessions saved at `localhost:3000` (dev) are invisible to the packaged Electron app at `127.0.0.1:7878`. The user had two real sessions stranded in the dev-origin store.

**Data dir resolution** (priority): `ABLESET_DATA_DIR` (tests/CI) → `ELECTRON_USER_DATA` (set by `electron/main.ts` before `start()`) → derived `~/Library/Application Support/ableset-lyrics-sync` (macOS). All three processes (dev tsx server, packaged Electron in-process server, and E2E test server) resolve to the same location.

**Alternatives considered**:
- Keep IndexedDB + duplicate data across origins — fragile and user-hostile
- Electron `contextBridge` + IPC for storage — requires preload script, breaks non-Electron dev mode

**Consequences**:
- `client/src/session-store.ts` fully rewrites with `fetch()` — same exports so `app.tsx` is unchanged
- One-time migration: `client/src/migrate-sessions.ts` reads legacy IDB sessions and POSTs them to the server API; guarded by `localStorage['ableset-sync.migrated-v1']`; called on `App` mount
- PDF bytes round-trip via `GET /api/sessions/:id/pdf`; metadata (name, type) stored in the `.json` sidecar
- E2E tests always use a throwaway `ABLESET_DATA_DIR` temp dir — user's real sessions are never touched by tests
- `getSession` returns `state: Record<string, unknown>` (not `unknown`) to satisfy the contract test's `full!.state.songName` access without a cast
