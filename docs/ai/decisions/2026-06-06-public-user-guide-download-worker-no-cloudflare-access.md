---
date: 2026-06-06
repo: lyricstamp
tags: [decision, lyricstamp]
---

# Public user guide + download Worker (no Cloudflare Access)

**Decision**: Ship a public LyricStamp user guide (`docs/manual/index.html`) and a Cloudflare
Worker (`worker/staff-guide.js`, `wrangler.jsonc` → `lyricstamp-guide`) with a `/download/mac`
proxy. Mirror the Rhythm / Statement Automator manual+worker pattern, but **without Cloudflare
Access** and with `workers_dev: true`.

**Context**: Rhythm and Statement Automator gate their guides behind Cloudflare Access (church
Google login) because those apps expose user data and a cloud API. LyricStamp is **local-only**:
no accounts, no cloud database; the guide and download expose no user data or app API. The user
wants to share it with other churches, so the guide must be publicly reachable.

**Download asset selection**: The single `/download/mac` route must tolerate the current/older
release asset name (`AbleSet.Sync-0.1.1-arm64.dmg`, published by the pre-rename release pipeline)
and future `LyricStamp-*.dmg` names. `pickMacDmg()` scores `.dmg` assets universal(100) >
arm64(50) > x64(10), +5 for LyricStamp branding within a tier. The app ships arm64 only today,
so arm64 wins.

**Token reuse**: The Worker uses the same `GITHUB_WORKER_TOKEN` secret value as the other two
guides, but treats it as **optional** — if absent it falls back to the unauthenticated GitHub
Releases API (lyricstamp releases are public). Cloudflare does not allow reading/copying a
secret's value, so reusing the token requires re-setting it per Worker:
`printf '%s' "$GITHUB_WORKER_TOKEN" | npx wrangler secret put GITHUB_WORKER_TOKEN --name lyricstamp-guide`.

**Alternatives considered**:
- Access-gated like the siblings — rejected: no data to protect, and gating defeats the
  share-with-other-churches goal.
- Hard-require the token — rejected: public releases make it unnecessary and would break the
  download if the secret were ever missing.

**Consequences**:
- The `*.workers.dev` URL is intentionally left enabled (public). A custom domain is left as an
  optional TODO in `wrangler.jsonc`; if added, it must NOT be put behind Access.
- Screenshots are captured from the live dev app via `scripts/capture-manual-screenshots.mjs`
  (committed dev utility) so they can be regenerated as the UI evolves.
