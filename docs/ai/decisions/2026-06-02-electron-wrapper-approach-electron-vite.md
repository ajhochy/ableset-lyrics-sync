---
date: 2026-06-02
repo: lyricstamp
tags: [decision, lyricstamp]
---

# Electron wrapper approach: electron-vite

**Decision**: Use electron-vite (Option A) over electron-forge or manual Electron + child process fork.

**Context**: App has an existing Vite/React client and a plain Node.js server. Team distribution requires code signing but not notarization.

**Alternatives considered**:
- B: Electron + child process fork — more server isolation but more boilerplate, no hot reload
- C: electron-forge — more future-proof for auto-updates but heavy config overhead

**Consequences**:
- `"type": "module"` requires electron-vite to output `.cjs` for main process — handled automatically
- In production the server serves static client files at `:7878`, so the BrowserWindow points to `http://127.0.0.1:7878` (no file:// relative URL issues)
- Dev workflow unchanged: `npm run dev` still runs client + server via concurrently
