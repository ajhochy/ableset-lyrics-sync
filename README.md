# AbleSet Sync

AbleSet Sync is a local-only macOS web tool for worship music directors. It bridges Ableton Live (via AbletonOSC) with a browser UI where the director stamps each lyric line or leadsheet page to the current playback position. The output is an Ableton `.als` project file with MIDI clips pre-positioned at those stamped times, ready for use with the AbleSet iPad app.

## Prerequisites

- macOS (Windows and Linux are not supported)
- Node.js 18 or newer
- Ableton Live 11 or newer
- AbletonOSC (see installation below)

## Installing AbletonOSC

AbletonOSC is a free Remote Script that bridges this app and Ableton Live. Install it once per machine:

1. Download AbletonOSC from <https://github.com/ideoforms/AbletonOSC> (clone or download ZIP).
2. Copy the `AbletonOSC` folder into Ableton's Remote Scripts directory:
   ```
   ~/Music/Ableton/User Library/Remote Scripts/
   ```
3. In Ableton Live → **Preferences → Link / Tempo / MIDI → Control Surfaces**, set one Control Surface slot to `AbletonOSC`.
4. Confirm Ableton's status bar shows:
   ```
   AbletonOSC: Listening for OSC on port 11000
   ```

The app shows **Disconnected** until AbletonOSC is active and a Live session is open.

## Running

```bash
npm install
npm run generate-template   # builds templates/blank-stamp-track.als (one-time)
npm run dev                 # starts client (:3000) and server (:7878)
```

Open <http://localhost:3000> in a browser. The **Connected** badge flips on once Ableton is open with a Live session and AbletonOSC is active.

## Keyboard shortcuts

Shortcuts are suppressed while focus is inside an input or textarea.

| Key     | Action |
|---------|--------|
| `Space` | Toggle Ableton play/pause |
| `→`     | Lyrics: stamp + advance to next line — Leadsheet: stamp + next page |
| `←`     | Lyrics: stamp + move to previous line — Leadsheet: stamp + previous page |
| `E`     | Export — `.als` (Lyrics tab) or `.zip` (Leadsheet tab) |
| `T`     | Switch tab |

## Verifying setup

Run through these seven checks after initial setup:

1. **Connection** — badge flips to Connected within 2 s of Ableton being open with AbletonOSC enabled.
2. **Play/pause** — `Space` toggles Live's transport; the play-state pill animates.
3. **Lyrics stamping** — arrow keys land timestamps within ±100 ms of Live's playhead.
4. **Lyrics export** — exported `.als` opens in Live with one MIDI clip per stamp on the `Vocals +LYRICS` track.
5. **Leadsheet PDF** — pages render correctly; arrow keys navigate freely including revisiting pages.
6. **Leadsheet export** — exported `.zip` contains a `Lyrics/` folder, `stamps.json`, and a `Stamps.als` that opens cleanly in Live with `[img:pageN.png]`-named clips.
7. **Tweaks persistence** — accent color and log density survive a page reload.

## Known limitations

- **macOS only.** The path to Ableton's Remote Scripts directory is macOS-specific; Windows and Linux paths are not supported.
- **Same machine required.** The app communicates with Ableton over localhost OSC. Running the browser on a separate machine is not supported.
- **No session persistence.** Closing the browser tab loses all loaded songs and stamps. Export before closing — the `.als` or `.zip` is the source of truth.
- **ChordPro subset.** The parser handles common directives (`title`, `key`, `tempo`, sections, lyric lines). Exotic ChordPro extensions may not parse correctly.
