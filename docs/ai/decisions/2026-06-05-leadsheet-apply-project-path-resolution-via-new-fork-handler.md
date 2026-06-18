---
date: 2026-06-05
repo: lyricstamp
tags: [decision, lyricstamp]
---

# Leadsheet Apply: project-path resolution via new fork handler

**Decision**: Add a `/live/song/get/project_path` handler to the vendored AbletonOSC fork
(`vendor/AbletonOSC/abletonosc/song.py`) that returns `os.path.dirname(song.file_path)`
when the set is saved, or `""` when unsaved. The server calls this via a new `OscClient`
method `getSongProjectPath()` to determine where to write page PNGs.

**Investigation findings**:
- Option (a) — upstream AbletonOSC: `song.py` registers `can_redo`, `can_undo`, `is_playing`,
  `song_length`, `session_record_status` as read-only properties and ~22 read-write properties.
  No `file_path` or `project_path` is exposed. `application.py` only exposes version and CPU
  load. Definitively absent from the upstream codebase.
- Option (b) — ableton-mcp `get_session_path`: ableton-mcp is a different, separate remote
  script that is not installed or running in this project. Not viable.
- Option (c) — new fork handler: Ableton's Python `Live.Song.Song` object has a `file_path`
  attribute (string) that returns the absolute `.als` path for a saved set, or `""` for an
  unsaved set. `os.path.dirname(file_path)` gives the project directory. This is the
  standard community-known way to resolve the project path from inside a Remote Script.

**Why option (c)**:
- It is the only option that actually works.
- It is additive (no existing handler modified), following the established pattern of
  `arrangement_writer_version` in `track.py`.
- It is write-free (read-only), so it cannot corrupt the set.
- The `""` empty-string return for unsaved sets maps cleanly to a 409 HTTP response with
  "Save your Ableton set first" — satisfying locked product decision #1.
- Users already need `install:remote-script` to use Apply features; this extends that
  existing requirement without adding a new workflow step.

**Fork version bump**: `arrangement_writer_version` in `track.py` returns `"ableset-2"` in
this PR (was `"ableset-1"`). The probe still uses a timeout-based any-reply check, so no
code change is needed in `probeHandler()`. The version bump is informational for debugging.

**Consequences**:
- `vendor/AbletonOSC/abletonosc/song.py` — new `song_get_project_path` handler
- `vendor/AbletonOSC/abletonosc/track.py` — version string bumped to `"ableset-2"`
- `server/src/osc-client.ts` — new `getSongProjectPath()` method
- `server/src/routes.ts` — new endpoint calls `getSongProjectPath()` and blocks with 409 when `""`
- Users must re-run `npm run install:remote-script` + restart Ableton for the new handler to
  be available.
