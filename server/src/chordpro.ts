// chordsheetjs ships a CJS bundle as its Node.js entry point; named ESM
// imports are not available via Node's module resolution. Import the default
// and destructure from it.
import chordsheetjs from 'chordsheetjs';
const { ChordProParser, ChordLyricsPair, Tag } = chordsheetjs as typeof import('chordsheetjs');
import type { Song } from '../../shared/types.js';

/**
 * Map a chordsheetjs paragraph type to a human-readable section label.
 * Falls back to the paragraph's own label property (from e.g. {start_of_verse: label="Verse 1"})
 * and then to a title-cased version of the type string.
 */
function sectionLabel(type: string, label: string | null): string {
  if (label) return label;
  // Title-case the type
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Parse a ChordPro string into the application Song shape.
 *
 * @param name  The song name supplied by the caller. If empty, falls back to
 *              the {title} directive in the ChordPro text.
 * @param chordpro  The raw ChordPro text.
 */
export function parseChordPro(name: string, chordpro: string): Song {
  const parsed = new ChordProParser().parse(chordpro);

  // --- metadata ---
  const resolvedName = name || parsed.title || '';

  const tempoStr = parsed.tempo;
  const bpm = tempoStr ? parseInt(tempoStr, 10) || 120 : 120;

  const key = parsed.key || 'C';

  // --- lines ---
  const lines: Array<{ section?: string; text?: string }> = [];

  for (const paragraph of parsed.paragraphs) {
    if (paragraph.isEmpty()) continue;

    const paragraphType = paragraph.type; // 'verse' | 'chorus' | 'bridge' | 'none' | ...
    const paragraphLabel = paragraph.label; // label attribute from start_of_* directive

    // Emit a section header if this paragraph has a meaningful type or label.
    const hasNamedType =
      paragraphType !== 'none' && paragraphType !== 'indeterminate';
    if (hasNamedType || paragraphLabel) {
      lines.push({ section: sectionLabel(paragraphType, paragraphLabel) });
    }

    for (const line of paragraph.lines) {
      if (line.isEmpty()) continue;

      // Collect lyrics text from ChordLyricsPair items (strip chords, keep text)
      let text = '';
      for (const item of line.items) {
        if (item instanceof ChordLyricsPair) {
          text += item.lyrics ?? '';
        } else if (item instanceof Tag) {
          // Inline tags (e.g. comments) are skipped; section delimiters are
          // already handled at the paragraph level.
        }
        // Comment and other items are skipped
      }

      text = text.trim();
      if (text) {
        lines.push({ text });
      }
    }
  }

  return { name: resolvedName, bpm, key, lines };
}
