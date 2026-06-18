---
date: 2026-06-05
repo: lyricstamp
tags: [decision, lyricstamp]
---

# Bundle patched AbletonOSC as a vendor fork (live-stamp-write)

**Decision**: Vendor a forked copy of AbletonOSC (MIT) into `vendor/AbletonOSC/`
with a single additive handler added to `abletonosc/track.py`, and ship an
`npm run install:remote-script` script that copies it to
`~/Music/Ableton/User Library/Remote Scripts/AbletonOSC/`.

**Context**: The live-stamp-write feature requires one AbletonOSC OSC handler
(`/live/track/duplicate_clip_to_arrangement`) that does not exist in the upstream
project.  Three delivery options were considered:

1. **Vendor a fork** (chosen): copy the full AbletonOSC source tree into
   `vendor/AbletonOSC/`, apply the patch, commit it.  A `scripts/install-remote-script.mjs`
   script copies it to the user's Remote Scripts folder.  `electron-builder`
   includes it in `extraResources` so the packaged `.app` can install it without
   the user downloading anything separately.
2. **Patch docs + manual user instruction**: ship no code, just document the
   6-line patch and ask users to apply it themselves.  Rejected: fragile
   (users can't apply diffs reliably), friction for new team members, breaks
   "install and use" promise of the Electron app.
3. **Submit upstream PR to AbletonOSC**: correct long-term but not actionable on
   our timeline.  AbletonOSC is a community project; PR acceptance is uncertain
   and could take months.

**Upstream drift**: `vendor/.upstream-sha` records the upstream commit the fork
was cut from.  When upstream releases a new version, a manual rebase of the
single patch file (`abletonosc/track.py`) onto the new release is straightforward
because the patch is additive (one `add_handler` block; does not touch any
existing handler).  An optional `scripts/check-upstream.mjs` can surface new
releases.

**Consequences**:
- `vendor/AbletonOSC/` is a committed source tree (~50 files, <200 KB), not a binary.
- Users who already have AbletonOSC installed will have it replaced (or must
  manually merge) — documented clearly in the install script's output.
- If the user's existing AbletonOSC is a custom fork, the install script offers
  a skip option.
- The app works without running `install:remote-script` as long as the user has
  previously installed the patched script; the handler-presence probe detects this.
