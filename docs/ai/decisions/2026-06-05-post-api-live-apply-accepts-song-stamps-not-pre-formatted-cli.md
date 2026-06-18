---
date: 2026-06-05
repo: lyricstamp
tags: [decision, lyricstamp]
---

# POST /api/live/apply accepts song+stamps (not pre-formatted clips)

**Decision**: Changed `POST /api/live/apply` to accept `{ trackIndex, song, stamps }` (the same shape as the `.als` export endpoint) rather than `{ trackIndex, clips: [{name, beat}] }`. A new exported `stampsToClips(song, stamps)` helper converts stamps to `{name, beat}` pairs server-side using the same logic as the `.als` export route.

**Why**: If the client had to pre-format clip names, it would duplicate the clip-name logic that already exists in the export route (`stamp.text ?? song.lines[stamp.idx]?.text`). A shared server-side formatter guarantees live-applied clips and `.als` export clips carry identical names — important for AbleSet to treat them consistently. The `stampsToClips` function is exported and directly tested against the expected formatter output.

**Consequences**:
- `routes.ts`: `handlePostLiveApply` validates `song.lines` + `stamps[*].{idx, ts}` instead of `clips[*].{name, beat}`
- `routes.test.ts`: all apply tests now send `{ trackIndex, song, stamps }` and assert clip names come from song lines
- Client `app.tsx`: `applyToAbleton()` sends `{ trackIndex: liveTrackIndex, song, stamps }` — no client-side name formatting needed
