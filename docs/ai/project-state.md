# Project State — LyricStamp (repo slug: lyricstamp; data dir stays ableset-lyrics-sync)

_Last updated: 2026-06-11_

## Current focus
**Bug-fix run #30/#27/#28** (branch `workflow/run-2026-06-11`, off fresh `main`). Triage outcome: **#30 (spacebar pause-in-place)** and **#28 (stamp preview labels)** were already implemented in `main` (commit `054b717`, Electron PR #25) — `osc-client.pausePlaying()`→`stop_playing` (Live does not rewind), `continuePlaying()`→`continue_playing`, `returnToStart()` is the separate "Stop (to start)" control; `views.tsx` already has "Now playing"/"Next to stamp →"/`next-up` labelling. The GitHub issues were stale/never-closed. This run added executable acceptance contracts pinning that behavior (no code change for #30/#28). **#27 (ChordPro preview) was the real new work**: new `client/src/chord-preview.ts` (`renderChordProHtml` via chordsheetjs `HtmlTableFormatter`) rendered chord-above-lyric + directive-labels into the setup-body preview (`client/src/views.tsx` + `.chordpro-preview` CSS), stamp path (`server/src/chordpro.ts`) untouched. Verified PASS: typecheck, lint, 145 unit, 10 contract, web build, electron:build, 52 Playwright e2e, plus a visual screenshot of the preview. **Manual-smoke remaining (Ableton-required, in PR body): #30 true pause/resume playhead retention (contract c1/c2/c3).** Draft PR pending.

Note: stale leftover branch `issue-30-pause-playhead` (local + origin) is based on old `main` and superseded by the better in-main impl — not used, safe to delete later.

### Prior focus (rebrand — still pending merge)
**Rebrand "AbleSet Sync" → "LyricStamp"** (branch `workflow/rebrand-lyricstamp`, stacked on `chore/add-license`). Display-only: `package.json` name→`lyricstamp`, productName→`LyricStamp`, appId→`com.lyricstamp`; UI wordmark/title/Electron dialogs+logs/`README`/`NOTICE`; `scripts/e2e-app.mjs` resolves `LyricStamp.app` (+ robust binary-from-bundle-name fallback); e2e wordmark assertion → `LyricStamp`. **Data-safety KEEPS (must not rename):** Electron `userData` is now explicitly pinned to the original `<appData>/ableset-lyrics-sync` dir (so the appId/name change does NOT move the session store), `session-store.ts` `appName='ableset-lyrics-sync'`, localStorage prefix `ableset-sync.` / IndexedDB `ableset-sync`, and the `ableset-2` `arrangement_writer_version` handshake. References to **AbleSet** (the iPad app) stay as factual integration. Doc scope was visible-surface-only (`docs/ai/*`, `HANDOFF*`, `design/` NOT swept). Verified PASS: typecheck/lint, 133 unit, build, `electron:dist` (signed `LyricStamp.app` + dmg/zip), 47 packaged-app e2e. **Pending: GitHub repo rename (`ableset-lyrics-sync`→`lyricstamp`) + local dir rename + PR review/merge.**

Shipped & merged to main: PR #25 (Electron wrapper + session storage), PR #32 (lyrics live-apply), PR #34 (notarization), PR #35 (release publish fix), **PR #36 (leadsheet "Apply to Ableton")**. **v0.1.1 published** (signed+notarized, Latest); v0.1.0 left as stale draft. License **PR #39** (PolyForm Noncommercial 1.0.0) open.

## Active branch / PR
- **Branch: `workflow/run-2026-06-11`** (off fresh `main`) — issues #30/#27/#28; draft PR pending; merge manual
- Prior: `workflow/rebrand-lyricstamp` (stacked on `chore/add-license`); merge manual
- License: PR #39 `chore/add-license` → main (open)
- Out-of-scope flags: committed `Ableset Lyrics Sync.zip` artifact; untracked `assets/icon.icns`+`icon.png` the build depends on (latent CI-release risk)

## In progress
- live-stamp-write: code complete + verified on `feat/live-stamp-write`. Awaiting **manual Ableton smoke** (run `npm run install:remote-script`, restart Live, stamp, "Apply to Ableton", confirm clips land in the Arrangement + AbleSet reads them — see `docs/testing/manual-smoke.md`), then open PR → main.

## Risks / known issues
- Live 12 `.als` patch may break Live 11 compatibility — needs cross-version manual smoke before shipping to Live 11 users
- `process.cwd()` used for template/static paths — requires running from repo root in standalone server mode
- CI: `.github/workflows/ci.yml` + `release-electron.yml` exist; push to the branch triggers CI (watch with `gh run watch`). The `release-electron` signing/notarization pipeline is separate and untouched by this change.
- Migration runs origin-side on app mount, guarded by `localStorage['ableset-sync.migrated-v1']` per origin. The user's `localhost:3000` data is now migrated; a packaged-origin (`127.0.0.1:7878`) launch has no legacy IndexedDB so it no-ops correctly. The working-session auto-restore PDF (`pdf-store.ts`, IndexedDB `kv`) is still origin-bound — tracked as a follow-up, out of scope here.

## Test status (verified 2026-06-11, `workflow/run-2026-06-11`)
- Unit tests: **145 passing** (`npm test` — 10 files)
- Contract tests: **10 passing** (`npx vitest run --config vitest.contract.config.ts` — issue-27 ×5, issue-28 ×2, issue-30 ×3; kept out of the default `npm test` glob)
- Playwright E2E (build target): **52 passing** (`npm run test:e2e`; +1 new `#27` preview-DOM test in `verification.spec.ts`). Requires `npm run electron:build` first (e2e reads `out/renderer`).
- TypeScript / Lint / web build / electron:build: passing
- UI screenshot verified: ChordPro chord-above-lyric preview renders (title header, accent chords above lyrics, comment label) — `/tmp/ls-chordpro-preview.png`
- **Manual-smoke only (Ableton required):** #30 true pause-in-place / resume-from-position playhead retention (contract issue-30 c1/c2/c3) — OSC mapping is unit-pinned (c5) but the playhead behavior needs a running Live instance.

## Next step
1. Open **draft PR** `workflow/run-2026-06-11` → main with `Closes #30`, `Closes #27`, `Closes #28`; push triggers CI (`gh run watch`).
2. **Manual Ableton smoke** of #30: play, press Space mid-song → confirm playhead stays put (does not jump to beat 1); press Space again → resumes from paused position; confirm "Stop (to start)" still rewinds to beat 1.
3. (Carried over) rebrand `workflow/rebrand-lyricstamp` merge + repo rename; cross-version Live 11/12 `.als` manual check.

---

**Run history:** one file per run under `docs/ai/runs/` (surfaced as `ai-runs/`). This snapshot is overwritten in place.
