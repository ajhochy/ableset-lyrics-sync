---
date: 2026-06-11
repo: lyricstamp
tags: [decision, lyricstamp]
---

# ChordPro preview as a pure client function; contract tests in a separate config

**Decision**: For issue #27, render the chord-above-lyric preview from the **raw `pasteText`**
(not the parsed stamp `song`) via a pure `renderChordProHtml(text)` in `client/src/chord-preview.ts`
using chordsheetjs `HtmlTableFormatter`, injected with `dangerouslySetInnerHTML`. Acceptance
contract tests live under `tests/contract/` with a dedicated `vitest.contract.config.ts`, kept
**out of** the default `npm test` glob (`server/**`, `client/**`, `scripts/**`).

**Context / alternatives**:
- The server `chordpro.ts` stamp path intentionally flattens chords into a single
  `[G]lyric` string for `.als` clip names — reusing it for the preview would lose the
  chord-above-lyric layout. A separate pure renderer keeps the stamp path untouched (#27-c3) and
  makes the preview unit-testable in the node vitest env (no DOM/jsdom needed).
- The preview reads raw paste so it updates live as the user types, before "Reload song".
- Contract tests are isolated from `npm test`/CI so the unit-test surface (what CI runs) stays
  stable; the orchestrator/verification-gate runs them explicitly via the dedicated config.
- `dangerouslySetInnerHTML` is safe here: `HtmlTableFormatter` HTML-escapes chord/lyric text,
  and a malformed-parse fallback escapes the raw text into a `<pre>`.

**Consequences**: A future change to the preview must keep `renderChordProHtml` pure (its
contract test asserts the HtmlTableFormatter output shape). CI does not run contract tests today;
if that's wanted, add `tests/contract/**` to a CI step or merge the configs.
