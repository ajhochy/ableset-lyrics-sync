---
date: 2026-06-04
repo: lyricstamp
tags: [decision, lyricstamp]
---

# ChordPro chord display: inline concatenation (#27)

**Decision**: Concatenate chord + lyric text inline (`[G]Amazing grace`) in `chordpro.ts` rather than rendering a chord-above-lyric grid via `HtmlTableFormatter`.

**Context**: The original design stripped chords entirely; the smoke test revealed users need to see chord notation in the stamp preview to navigate the song. Full chord-grid rendering (HtmlTableFormatter) would require adding a separate preview component and CSS.

**Alternatives considered**:
- Client-side `HtmlTableFormatter` rendering — richer visual but requires importing chordsheetjs in the client bundle and adding CSS
- Server-side HTML rendering — couples presentation to the API layer

**Consequences**:
- Chord names appear inline before the lyric word: `[G]Amazing grace [D]how sweet the [Em]sound`
- Stamp clip names in the exported `.als` now include chord annotations — may look noisy in Ableton's clip view
- A follow-up issue should add proper chord-grid rendering in the client if users find inline chords hard to read
