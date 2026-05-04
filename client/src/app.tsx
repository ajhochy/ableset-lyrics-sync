// app.tsx — AbleSet Sync main app component
// Ported from design/app.jsx. Mocked clock + connection kept intact; real wiring lands in #17–#22.
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
import { LyricsView, LeadsheetView, TweaksUI, type StampRow, type Tweaks } from './views';

// ---------------------------------------------------------------------------
// Inline useTweaks stub — real localStorage persistence lands in #16.
// ---------------------------------------------------------------------------
const TWEAK_DEFAULTS: Tweaks = {
  theme: 'dark',
  accent: 'teal',
  headerCompact: false,
  lyricSize: 'balanced',
  logDensity: 'tight',
  showSectionHeaders: true,
  connectionStatus: 'connected',
};

function useTweaks(
  defaults: Tweaks,
): [Tweaks, (key: keyof Tweaks, value: Tweaks[keyof Tweaks]) => void] {
  const [values, setValues] = useState<Tweaks>(defaults);
  const setTweak = useCallback(
    (key: keyof Tweaks, value: Tweaks[keyof Tweaks]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      // TODO (#16): persist to localStorage
    },
    [],
  );
  return [values, setTweak];
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export function App() {
  // ---- Tweaks ----
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ---- App state ----
  const [tab, setTab] = useState<'lyrics' | 'leadsheet'>('lyrics');
  const [setupOpen, setSetupOpen] = useState<boolean>(false);
  const [songName, setSongName] = useState<string>(SAMPLE_SONG.name);
  const [pasteText] = useState<string>(
    `{title: ${SAMPLE_SONG.name}}\n{key: G}\n\n[Verse 1]\n[Verse 1 line 1]\n[Verse 1 line 2]\n…`,
  );

  // Playback — mocked clock; real WebSocket clock lands in #17
  const [playing, setPlaying] = useState<boolean>(true);
  const [time, setTime] = useState<number>(72.4);

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

  // ---- Time tick — mocked; replaced by WebSocket in #17 ----
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => setTime((t) => +(t + 0.1).toFixed(2)), 100);
    return () => clearInterval(iv);
  }, [playing]);

  // ---- Cursor lookup helpers ----
  const lineCount = useMemo(
    () => SAMPLE_SONG.lines.filter((l) => l.text).length,
    [],
  );

  const lineIndexOfCursor = useMemo(() => {
    let n = 0;
    for (let i = 0; i < SAMPLE_SONG.lines.length; i++) {
      if (SAMPLE_SONG.lines[i].text) {
        n++;
        if (i === cursor) return n;
      }
    }
    return n;
  }, [cursor]);

  const currentLineObj = SAMPLE_SONG.lines[cursor] ?? {};

  const findNextTextLine = (from: number, dir: number): number | null => {
    let i = from + dir;
    while (i >= 0 && i < SAMPLE_SONG.lines.length) {
      if (SAMPLE_SONG.lines[i].text) return i;
      i += dir;
    }
    return null;
  };

  const nextTextIdx = useMemo(() => findNextTextLine(cursor, 1), [cursor]);
  const nextLine =
    nextTextIdx != null ? (SAMPLE_SONG.lines[nextTextIdx]?.text ?? null) : null;

  // Section header (preceding) for current line
  const currentSectionLabel = useMemo(() => {
    for (let i = cursor; i >= 0; i--) {
      if (SAMPLE_SONG.lines[i].section) return SAMPLE_SONG.lines[i].section ?? null;
    }
    return null;
  }, [cursor]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cursor, time, currentLineObj.text, currentSectionLabel],
  );

  const undoStamp = useCallback((i: number) => {
    setStamps((arr) => arr.filter((_, j) => j !== i));
  }, []);

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
        setPlaying((p) => !p);
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
  }, [cursor, time, tab, stamps, stamp, exportFile]);

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
      const lineObj = SAMPLE_SONG.lines[s.idx];
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
  }, [stamps, flashIdx, tweaks.showSectionHeaders]);

  // ---- Adapter: setTweak for TweaksUI (string key) ----
  const setTweakForUI = useCallback(
    (key: string, value: unknown) => {
      setTweak(key as keyof Tweaks, value as Tweaks[keyof Tweaks]);
    },
    [setTweak],
  );

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

        <span className={`badge${tweaks.connectionStatus === 'connected' ? ' connected' : ''}`}>
          <span className="pulse" />
          {tweaks.connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
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
            <span className="val">{SAMPLE_SONG.bpm}</span>
            <span className="label">BPM</span>
            <span className="dot-sep" />
            <span className="val">{SAMPLE_SONG.key}</span>
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
      <TweaksUI tweaks={tweaks} setTweak={setTweakForUI} />
    </div>
  );
}
