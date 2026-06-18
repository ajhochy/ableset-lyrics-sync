---
date: 2026-06-04
repo: lyricstamp
tags: [decision, lyricstamp]
---

# Ableton Live version compatibility for .als template (#26)

**Decision**: Patch `MinorVersion` / `Creator` attributes in the gzipped template XML at export time (or use a native Live 12 template binary) rather than shipping multiple version-specific templates.

**Context**: `templates/blank-stamp-track.als` was authored in Live 11.3. Live 12 rejects files with a Live 11 MinorVersion string. Patching the XML attribute after gunzip avoids requiring the user to maintain multiple template files.

**Alternatives considered**:
- Ship separate `blank-stamp-track-live11.als` and `blank-stamp-track-live12.als` — adds file management complexity and user configuration
- Let users regenerate the template from their Live version — requires documented tooling and a `generate-template` step

**Consequences**:
- Live 11 compatibility is unverified after the patch; cross-version manual smoke needed before shipping to Live 11 users
- The backup of the original Live 11 template is at `templates/blank-stamp-track.als.live11.bak`
