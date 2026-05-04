/**
 * als-writer.ts
 *
 * Builds a gzipped Ableton Live 11 .als file by injecting MidiClip elements
 * into the blank-stamp-track.als template.
 *
 * Reference MidiClip XML structure (Ableton Live 11 / SchemaVersion 3):
 * -----------------------------------------------------------------------
 * <MidiClip Id="0" Time="{beats}">
 *   <LomId Value="0" />
 *   <LomIdView Value="0" />
 *   <CurrentStart Value="{beats}" />
 *   <CurrentEnd Value="{beats + 0.25}" />
 *   <Loop>
 *     <LoopStart Value="0" />
 *     <LoopEnd Value="0.25" />
 *     <StartRelative Value="0" />
 *     <LoopOn Value="false" />
 *     <OutMarker Value="0.25" />
 *     <HiddenLoopStart Value="0" />
 *     <HiddenLoopEnd Value="0.25" />
 *   </Loop>
 *   <Name Value="{clipName}" />
 *   <Annotation Value="" />
 *   <Color Value="4" />
 *   <LaunchMode Value="0" />
 *   <LaunchQuantisation Value="0" />
 *   <TimeSignature>
 *     <TimeSignatures>
 *       <RemoteableTimeSignature Id="0">
 *         <Numerator Value="4" />
 *         <Denominator Value="4" />
 *         <Time Value="0" />
 *       </RemoteableTimeSignature>
 *     </TimeSignatures>
 *   </TimeSignature>
 *   <Envelopes>
 *     <Envelopes />
 *   </Envelopes>
 *   <ScrollerTimePreserver>
 *     <LeftTime Value="0" />
 *     <RightTime Value="0.25" />
 *   </ScrollerTimePreserver>
 *   <TimeSelection>
 *     <AnchorTime Value="0" />
 *     <OtherTime Value="0" />
 *   </TimeSelection>
 *   <Legato Value="false" />
 *   <Ram Value="false" />
 *   <GrooveSettings>
 *     <GrooveId Value="-1" />
 *   </GrooveSettings>
 *   <Disabled Value="false" />
 *   <VelocityAmount Value="0" />
 *   <FollowAction>
 *     <FollowTime Value="4" />
 *     <IsLinked Value="true" />
 *     <LoopIterations Value="1" />
 *     <FollowActionA Value="4" />
 *     <FollowActionB Value="0" />
 *     <FollowChanceA Value="100" />
 *     <FollowChanceB Value="0" />
 *     <JumpIndexA Value="1" />
 *     <JumpIndexB Value="1" />
 *     <FollowActionEnabled Value="false" />
 *   </FollowAction>
 *   <Grid>
 *     <FixedNumerator Value="1" />
 *     <FixedDenominator Value="16" />
 *     <GridIntervalPixel Value="20" />
 *     <Ntoles Value="2" />
 *     <SnapToGrid Value="true" />
 *     <Fixed Value="false" />
 *   </Grid>
 *   <FreezeStart Value="0" />
 *   <FreezeEnd Value="0" />
 *   <IsWarped Value="true" />
 *   <TakeId Value="1" />
 *   <Notes>
 *     <KeyTracks>
 *       <KeyTrack Id="0">
 *         <Notes>
 *           <MidiNoteEvent Time="0" Duration="0.25" Velocity="100" OffVelocity="64" IsEnabled="true" />
 *         </Notes>
 *         <MidiKey Value="60" />
 *       </KeyTrack>
 *     </KeyTracks>
 *     <PerNoteEventStore>
 *       <EventLists />
 *     </PerNoteEventStore>
 *     <NoteIdGenerator>
 *       <NextId Value="2" />
 *     </NoteIdGenerator>
 *   </Notes>
 *   <BankSelectCoarse Value="-1" />
 *   <BankSelectFine Value="-1" />
 *   <ProgramChange Value="-1" />
 *   <NoteEditorFoldInZoom Value="-1" />
 *   <NoteEditorFoldInScroll Value="-1" />
 *   <NoteEditorFoldOutZoom Value="905" />
 *   <NoteEditorFoldOutScroll Value="-389" />
 * </MidiClip>
 * -----------------------------------------------------------------------
 */

import { gunzipSync, gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../templates/blank-stamp-track.als',
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AlsStampInput = {
  ts: number; // seconds
  clipName: string; // already-formatted name
};

/**
 * Build a gzipped .als Buffer from the blank-stamp-track template.
 *
 * @param opts.bpm - Song tempo in beats per minute (used to convert ts → beats).
 * @param opts.trackName - The EffectiveName for the MIDI track.
 * @param opts.stamps - List of stamps to insert as MidiClip elements.
 * @returns A Buffer containing the gzipped .als file contents.
 */
export function writeAlsFile(opts: {
  bpm: number;
  trackName: string;
  stamps: AlsStampInput[];
}): Buffer {
  const { bpm, trackName, stamps } = opts;

  // 1. Read and decompress template
  const templateBytes = readFileSync(TEMPLATE_PATH);
  let xml = gunzipSync(templateBytes).toString('utf-8');

  // 2. Rename the MIDI track's EffectiveName.
  //    The template has exactly one EffectiveName for the MIDI track.
  //    We replace the first occurrence (track name) leaving the others.
  xml = xml.replace(
    /<EffectiveName Value="Vocals \+LYRICS">/,
    `<EffectiveName Value="${escapeXml(trackName)}">`,
  );

  // 3. Build MidiClip XML for each stamp and inject into ArrangerAutomation > Events.
  if (stamps.length > 0) {
    const clipXml = stamps
      .map((stamp, idx) => buildMidiClipXml(idx, stamp.ts, bpm, stamp.clipName))
      .join('\n\t\t\t\t\t');

    // The template has: <ArrangerAutomation>\n\t\t\t\t\t<Events></Events>
    // Replace the empty Events element with one containing the clips.
    xml = xml.replace(
      /(<ArrangerAutomation>[\s\S]*?<Events>)<\/Events>/,
      `$1\n\t\t\t\t\t\t${clipXml}\n\t\t\t\t\t\t</Events>`,
    );
  }

  // 4. Gzip and return
  return gzipSync(Buffer.from(xml, 'utf-8'), { level: 9 });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Escape XML special characters in attribute values. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format a beat value as a string with up to 6 decimal places, trimming trailing zeros. */
function beatStr(beats: number): string {
  // Use a fixed precision but trim trailing zeros for cleanliness.
  // Avoid floating-point noise by rounding to 6 decimal places.
  return parseFloat(beats.toFixed(6)).toString();
}

const CLIP_LENGTH = 0.25; // sixteenth-note duration (beats)

/**
 * Build a single MidiClip XML snippet for insertion into ArrangerAutomation > Events.
 * The clip is a 0.25-beat marker with one C3 (pitch 60) note, velocity 100.
 */
function buildMidiClipXml(
  id: number,
  ts: number,
  bpm: number,
  clipName: string,
): string {
  const beats = ts * (bpm / 60);
  const start = beatStr(beats);
  const end = beatStr(beats + CLIP_LENGTH);
  const name = escapeXml(clipName);

  return [
    `<MidiClip Id="${id}" Time="${start}">`,
    `\t<LomId Value="0" />`,
    `\t<LomIdView Value="0" />`,
    `\t<CurrentStart Value="${start}" />`,
    `\t<CurrentEnd Value="${end}" />`,
    `\t<Loop>`,
    `\t\t<LoopStart Value="0" />`,
    `\t\t<LoopEnd Value="${CLIP_LENGTH}" />`,
    `\t\t<StartRelative Value="0" />`,
    `\t\t<LoopOn Value="false" />`,
    `\t\t<OutMarker Value="${CLIP_LENGTH}" />`,
    `\t\t<HiddenLoopStart Value="0" />`,
    `\t\t<HiddenLoopEnd Value="${CLIP_LENGTH}" />`,
    `\t</Loop>`,
    `\t<Name Value="${name}" />`,
    `\t<Annotation Value="" />`,
    `\t<Color Value="4" />`,
    `\t<LaunchMode Value="0" />`,
    `\t<LaunchQuantisation Value="0" />`,
    `\t<TimeSignature>`,
    `\t\t<TimeSignatures>`,
    `\t\t\t<RemoteableTimeSignature Id="0">`,
    `\t\t\t\t<Numerator Value="4" />`,
    `\t\t\t\t<Denominator Value="4" />`,
    `\t\t\t\t<Time Value="0" />`,
    `\t\t\t</RemoteableTimeSignature>`,
    `\t\t</TimeSignatures>`,
    `\t</TimeSignature>`,
    `\t<Envelopes>`,
    `\t\t<Envelopes />`,
    `\t</Envelopes>`,
    `\t<ScrollerTimePreserver>`,
    `\t\t<LeftTime Value="0" />`,
    `\t\t<RightTime Value="${CLIP_LENGTH}" />`,
    `\t</ScrollerTimePreserver>`,
    `\t<TimeSelection>`,
    `\t\t<AnchorTime Value="0" />`,
    `\t\t<OtherTime Value="0" />`,
    `\t</TimeSelection>`,
    `\t<Legato Value="false" />`,
    `\t<Ram Value="false" />`,
    `\t<GrooveSettings>`,
    `\t\t<GrooveId Value="-1" />`,
    `\t</GrooveSettings>`,
    `\t<Disabled Value="false" />`,
    `\t<VelocityAmount Value="0" />`,
    `\t<FollowAction>`,
    `\t\t<FollowTime Value="4" />`,
    `\t\t<IsLinked Value="true" />`,
    `\t\t<LoopIterations Value="1" />`,
    `\t\t<FollowActionA Value="4" />`,
    `\t\t<FollowActionB Value="0" />`,
    `\t\t<FollowChanceA Value="100" />`,
    `\t\t<FollowChanceB Value="0" />`,
    `\t\t<JumpIndexA Value="1" />`,
    `\t\t<JumpIndexB Value="1" />`,
    `\t\t<FollowActionEnabled Value="false" />`,
    `\t</FollowAction>`,
    `\t<Grid>`,
    `\t\t<FixedNumerator Value="1" />`,
    `\t\t<FixedDenominator Value="16" />`,
    `\t\t<GridIntervalPixel Value="20" />`,
    `\t\t<Ntoles Value="2" />`,
    `\t\t<SnapToGrid Value="true" />`,
    `\t\t<Fixed Value="false" />`,
    `\t</Grid>`,
    `\t<FreezeStart Value="0" />`,
    `\t<FreezeEnd Value="0" />`,
    `\t<IsWarped Value="true" />`,
    `\t<TakeId Value="${id + 1}" />`,
    `\t<Notes>`,
    `\t\t<KeyTracks>`,
    `\t\t\t<KeyTrack Id="0">`,
    `\t\t\t\t<Notes>`,
    `\t\t\t\t\t<MidiNoteEvent Time="0" Duration="${CLIP_LENGTH}" Velocity="100" OffVelocity="64" IsEnabled="true" />`,
    `\t\t\t\t</Notes>`,
    `\t\t\t\t<MidiKey Value="60" />`,
    `\t\t\t</KeyTrack>`,
    `\t\t</KeyTracks>`,
    `\t\t<PerNoteEventStore>`,
    `\t\t\t<EventLists />`,
    `\t\t</PerNoteEventStore>`,
    `\t\t<NoteIdGenerator>`,
    `\t\t\t<NextId Value="2" />`,
    `\t\t</NoteIdGenerator>`,
    `\t</Notes>`,
    `\t<BankSelectCoarse Value="-1" />`,
    `\t<BankSelectFine Value="-1" />`,
    `\t<ProgramChange Value="-1" />`,
    `\t<NoteEditorFoldInZoom Value="-1" />`,
    `\t<NoteEditorFoldInScroll Value="-1" />`,
    `\t<NoteEditorFoldOutZoom Value="905" />`,
    `\t<NoteEditorFoldOutScroll Value="-389" />`,
    `</MidiClip>`,
  ].join('\n\t\t\t\t\t\t');
}
