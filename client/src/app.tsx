// app.tsx — AbleSet Sync main app component
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Icon } from './icons';
import { fmt } from './format';
import {
  SAMPLE_SONG,
  INITIAL_STAMPS,
  INITIAL_CURSOR,
  INITIAL_LEADSHEET_STAMPS,
  LEADSHEET_PAGES,
  type InitialStamp,
  type InitialLeadsheetStamp,
} from './data';
import { LyricsView, LeadsheetView, TweaksUI, type StampRow } from './views';
import { useTweaks, type Tweaks } from './use-tweaks';
import { useLive } from './use-live';
import type { Song } from '../../shared/types';

// ---------------------------------------------------------------------------
// Tweak defaults — must match Tweaks type from use-tweaks.ts.
// ---------------------------------------------------------------------------
const TWEAK_DEFAULTS: Tweaks = {
  theme: 'dark',
  accent: 'teal',
  headerCompact: false,
  lyricSize: 'balanced',
  logDensity: 'tight',
  showSectionHeaders: true,
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export function App() {
  // ---- Tweaks ----
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ---- App state ----
  const [tab, setTab] = useState<'lyrics' | 'leadsheet'>('lyrics');
  const [setupOpen, setSetupOpen] = useState<boolean>(false);
  const [song, setSong] = useState<Song>(SAMPLE_SONG);
  const [songName, setSongName] = useState<string>(SAMPLE_SONG.name);
  const [pasteText, setPasteText] = useState<string>(
    `{title: ${SAMPLE_SONG.name}}\n{key: G}\n\n[Verse 1]\n[Verse 1 line 1]\n[Verse 1 line 2]\n…`,
  );
  const [reloading, setReloading] = useState<boolean>(false);

  // Playback — driven by WebSocket (#17) and controlled via WebSocket (#18)
  const { state: liveState, sendCommand } = useLive();
  const { ts: time, bpm: liveBpm, playing: liveConnectedPlaying, connected } = liveState;
  // Optimistic local play state for the pill and hint bar.
  // Flips immediately on Space; the next tick (~100 ms) will confirm or correct.
  const [playing, setPlaying] = useState<boolean>(false);
  // Sync play state from live tick messages
  useEffect(() => {
    setPlaying(liveConnectedPlaying);
  }, [liveConnectedPlaying]);

  // Stamps
  const [stamps, setStamps] = useState<InitialStamp[]>(INITIAL_STAMPS);
  const [cursor, setCursor] = useState<number>(INITIAL_CURSOR);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);

  // Keyboard pressed visual indicator
  const [pressed, setPressed] = useState<string | null>(null);

  // Toasts
  type Toast = { id: string; msg: string; meta?: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((msg: string, meta?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((arr) => [...arr, { id, msg, meta }]);
    setTimeout(() => setToasts((arr) => arr.filter((t) => t.id !== id)), 2400);
  }, []);

  // Leadsheet
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [leadsheetStamps] = useState<InitialLeadsheetStamp[]>(INITIAL_LEADSHEET_STAMPS);

  // ---- Cursor lookup helpers ----
  const lineCount = useMemo(
    () => song.lines.filter((l) => l.text).length,
    [song],
  );

  const lineIndexOfCursor = useMemo(() => {
    let n = 0;
    for (let i = 0; i < song.lines.length; i++) {
      if (song.lines[i].text) {
        n++;
        if (i === cursor) return n;
      }
    }
    return n;
  }, [cursor, song]);

  const currentLineObj = song.lines[cursor] ?? {};

  const findNextTextLine = useCallback((from: number, dir: number): number | null => {
    let i = from + dir;
    while (i >= 0 && i < song.lines.length) {
      if (song.lines[i].text) return i;
      i += dir;
    }
    return null;
  }, [song]);

  const nextTextIdx = useMemo(() => findNextTextLine(cursor, 1), [cursor, findNextTextLine]);
  const nextLine =
    nextTextIdx != null ? (song.lines[nextTextIdx]?.text ?? null) : null;

  // Section header (preceding) for current line
  const currentSectionLabel = useMemo(() => {
    for (let i = cursor; i >= 0; i--) {
      if (song.lines[i].section) return song.lines[i].section ?? null;
    }
    return null;
  }, [cursor, song]);

  // ---- Stamp actions ----
  const stamp = useCallback(
    (advance: number = 1) => {
      if (!currentLineObj.text) {
        // skip section header — move past it
        const target = findNextTextLine(cursor, advance >= 0 ? 1 : -1);
        if (target != null) setCursor(target);
        return;
      }
      const newStamp: InitialStamp = {
        idx: cursor,
        ts: time,
        sectionStart: currentSectionLabel ?? undefined,
      };
      setStamps((arr) => {
        const next = [...arr, newStamp];
        setFlashIdx(next.length - 1);
        setTimeout(() => setFlashIdx(null), 600);
        return next;
      });

      const target = findNextTextLine(cursor, advance >= 0 ? 1 : -1);
      if (target != null) setCursor(target);
    },
    [cursor, time, currentLineObj.text, currentSectionLabel, findNextTextLine],
  );

  const undoStamp = useCallback((i: number) => {
    setStamps((arr) => arr.filter((_, j) => j !== i));
  }, []);

  // onReload — POST /api/song with current songName + pasteText, replace song state.
  const onReload = useCallback(async () => {
    setReloading(true);
    try {
      const res = await fetch('/api/song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: songName, chordpro: pasteText }),
      });
      if (!res.ok) {
        let errMsg = 'Unknown error';
        try {
          const body = await res.json() as { error?: string; message?: string };
          errMsg = body.error ?? body.message ?? errMsg;
        } catch {
          // body not JSON — use status text
          errMsg = res.statusText || errMsg;
        }
        pushToast(`Failed to parse: ${errMsg}`);
        return;
      }
      let parsed: Song;
      try {
        parsed = await res.json() as Song;
      } catch {
        pushToast('Backend returned malformed JSON');
        return;
      }
      setSong(parsed);
      setSongName(parsed.name);
      setCursor(0);
      setStamps([]);
      const textLines = parsed.lines.filter((l) => l.text).length;
      pushToast(`Loaded ${parsed.name}`, `${textLines} lines`);
    } catch {
      pushToast('Backend unreachable');
    } finally {
      setReloading(false);
    }
  }, [songName, pasteText, pushToast]);

  // exportFile — no-op + toast; real export lands in #21/#22
  const exportFile = useCallback(() => {
    const ext = tab === 'lyrics' ? '.als' : '.zip';
    pushToast(`Exported ${songName.replace(/\s+/g, '_')}${ext}`, `${stamps.length} clips`);
  }, [tab, songName, stamps.length, pushToast]);

  // ---- Keyboard handler ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Suppress shortcuts when typing in form fields
      const tag = ((e.target as HTMLElement | null)?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault();
        // Optimistically flip the pill; the next OSC tick will confirm (~100 ms).
        setPlaying((p) => {
          sendCommand({ type: 'transport', action: p ? 'pause' : 'play' });
          return !p;
        });
        setPressed('space');
        setTimeout(() => setPressed(null), 160);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (tab === 'lyrics') stamp(1);
        else setPdfPage((p) => Math.min(LEADSHEET_PAGES.length, p + 1));
        setPressed('right');
        setTimeout(() => setPressed(null), 160);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (tab === 'lyrics') stamp(-1);
        else setPdfPage((p) => Math.max(1, p - 1));
        setPressed('left');
        setTimeout(() => setPressed(null), 160);
      } else if (e.key.toLowerCase() === 'e') {
        exportFile();
        setPressed('e');
        setTimeout(() => setPressed(null), 160);
      } else if (e.key.toLowerCase() === 't') {
        setTab((x) => (x === 'lyrics' ? 'leadsheet' : 'lyrics'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, time, tab, stamps, stamp, exportFile, sendCommand]);

  // ---- Auto-scroll log to bottom on new stamp ----
  const logScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [stamps.length]);

  // ---- Apply theme + accent + lyric-size at root ----
  useEffect(() => {
    document.documentElement.dataset['theme'] = tweaks.theme;
    document.documentElement.dataset['accent'] = tweaks.accent;
    document.documentElement.dataset['lyricSize'] = tweaks.lyricSize;
  }, [tweaks.theme, tweaks.accent, tweaks.lyricSize]);

  // ---- Build stamp log rows (with optional section dividers) ----
  const stampRows = useMemo<StampRow[]>(() => {
    const rows: StampRow[] = [];
    let lastSection: string | null = null;
    stamps.forEach((s, i) => {
      const lineObj = song.lines[s.idx];
      const sec = s.sectionStart ?? null;
      if (tweaks.showSectionHeaders && sec && sec !== lastSection) {
        rows.push({ kind: 'section', label: sec, key: `sec-${i}` });
        lastSection = sec;
      } else if (sec) {
        lastSection = sec;
      }
      rows.push({
        kind: 'row',
        i,
        ts: s.ts,
        text: lineObj?.text ?? '—',
        recent: i === stamps.length - 1,
        flash: flashIdx === i,
      });
    });
    return rows;
  }, [stamps, flashIdx, tweaks.showSectionHeaders, song]);

  return (
    <div className="app">
      {/* HEADER */}
      <header className={`header${tweaks.headerCompact ? ' compact' : ''}`}>
        <div className="wordmark">
          <span className="dot" />
          <span className="name">
            AbleSet<span className="dim"> Sync</span>
          </span>
        </div>

        <span className="header-divider" />

        <span className={`badge${connected ? ' connected' : ''}`}>
          <span className="pulse" />
          {connected ? 'Connected' : 'Disconnected'}
        </span>

        <span className="header-divider" />

        <div className="live-meter">
          <span className={`play-state${playing ? ' playing' : ''}`}>
            <Icon name={playing ? 'pause' : 'play'} size={11} />
          </span>
          <span className="time">
            {fmt(time).split('.')[0]}
            <span className="ms">.{fmt(time).split('.')[1]}</span>
          </span>
          <span className="bpm">
            <span className="val">{liveBpm}</span>
            <span className="label">BPM</span>
            <span className="dot-sep" />
            <span className="val">{song.key}</span>
            <span className="label">KEY</span>
          </span>
        </div>

        <div className="tabs">
          <button
            className={`tab${tab === 'lyrics' ? ' active' : ''}`}
            onClick={() => setTab('lyrics')}
          >
            Lyrics
          </button>
          <button
            className={`tab${tab === 'leadsheet' ? ' active' : ''}`}
            onClick={() => setTab('leadsheet')}
          >
            Leadsheet
          </button>
        </div>

        <div className="header-actions">
          <button className="btn primary" onClick={exportFile}>
            <Icon name="download" size={12} />
            Export {tab === 'lyrics' ? '.als' : '.zip'}
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="main">
        {tab === 'lyrics' ? (
          <LyricsView
            songName={songName}
            setSongName={setSongName}
            pasteText={pasteText}
            setPasteText={setPasteText}
            onReload={onReload}
            reloading={reloading}
            lineCount={lineCount}
            setupOpen={setupOpen}
            setSetupOpen={setSetupOpen}
            currentLine={currentLineObj.text}
            currentSection={currentSectionLabel}
            nextLine={nextLine}
            lineIndex={lineIndexOfCursor}
            lineTotal={lineCount}
            stampRows={stampRows}
            stampsCount={stamps.length}
            onUndo={undoStamp}
            logScrollRef={logScrollRef}
            tweaks={tweaks}
          />
        ) : (
          <LeadsheetView
            songName={songName}
            setSongName={setSongName}
            page={pdfPage}
            setPage={setPdfPage}
            stamps={leadsheetStamps}
            tweaks={tweaks}
          />
        )}
      </div>

      {/* HINT BAR */}
      <footer className="hintbar">
        <div className="hints">
          <span className="hint">
            <span className={`kbd wide${pressed === 'space' ? ' pressed' : ''}`}>SPACE</span>
            {playing ? 'Pause' : 'Play'}
          </span>
          <span className="hint">
            <span className={`kbd${pressed === 'right' ? ' pressed' : ''}`}>→</span>
            {tab === 'lyrics' ? 'Stamp & advance' : 'Next page'}
          </span>
          <span className="hint">
            <span className={`kbd${pressed === 'left' ? ' pressed' : ''}`}>←</span>
            {tab === 'lyrics' ? 'Stamp & back' : 'Prev page'}
          </span>
          <span className="hint">
            <span className={`kbd${pressed === 'e' ? ' pressed' : ''}`}>E</span>
            Export
          </span>
          <span className="hint">
            <span className="kbd">T</span>
            Switch tab
          </span>
        </div>
        <div className="right">
          <span>
            {tab === 'lyrics'
              ? `${stamps.length} stamps`
              : `page ${pdfPage}/${LEADSHEET_PAGES.length}`}
          </span>
          <span className="dot-sep" />
          <span>v0.3.1</span>
        </div>
      </footer>

      {/* TOASTS */}
      <div className="toast-host">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className="check">
              <Icon name="check" size={11} />
            </span>
            <span>{t.msg}</span>
            {t.meta && <span className="meta">{t.meta}</span>}
          </div>
        ))}
      </div>

      {/* TWEAKS */}
      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}
