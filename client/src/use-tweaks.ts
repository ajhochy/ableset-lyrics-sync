// use-tweaks.ts — localStorage-backed tweaks hook
// Hydrates from 'ableset-sync.tweaks' on mount; writes on every change.
// Per-key validation guards against schema drift (e.g. stored values from
// a future version that are no longer valid in this one).

import { useState, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tweaks = {
  theme: 'dark' | 'light';
  accent: 'teal' | 'amber' | 'blue' | 'violet';
  headerCompact: boolean;
  lyricSize: 'balanced' | 'massive';
  logDensity: 'tight' | 'spacious';
  showSectionHeaders: boolean;
  connectionStatus: 'connected' | 'disconnected';
};

// ---------------------------------------------------------------------------
// Validation helpers
// Rejects stored values that don't belong to the current union — prevents a
// stale/future accent like "rainbow" from leaking into the app.
// ---------------------------------------------------------------------------

const VALID_THEME = new Set<Tweaks['theme']>(['dark', 'light']);
const VALID_ACCENT = new Set<Tweaks['accent']>(['teal', 'amber', 'blue', 'violet']);
const VALID_LYRIC_SIZE = new Set<Tweaks['lyricSize']>(['balanced', 'massive']);
const VALID_LOG_DENSITY = new Set<Tweaks['logDensity']>(['tight', 'spacious']);
const VALID_CONNECTION_STATUS = new Set<Tweaks['connectionStatus']>(['connected', 'disconnected']);

function sanitize(stored: Record<string, unknown>, defaults: Tweaks): Tweaks {
  return {
    theme: VALID_THEME.has(stored['theme'] as Tweaks['theme'])
      ? (stored['theme'] as Tweaks['theme'])
      : defaults.theme,
    accent: VALID_ACCENT.has(stored['accent'] as Tweaks['accent'])
      ? (stored['accent'] as Tweaks['accent'])
      : defaults.accent,
    headerCompact:
      typeof stored['headerCompact'] === 'boolean'
        ? stored['headerCompact']
        : defaults.headerCompact,
    lyricSize: VALID_LYRIC_SIZE.has(stored['lyricSize'] as Tweaks['lyricSize'])
      ? (stored['lyricSize'] as Tweaks['lyricSize'])
      : defaults.lyricSize,
    logDensity: VALID_LOG_DENSITY.has(stored['logDensity'] as Tweaks['logDensity'])
      ? (stored['logDensity'] as Tweaks['logDensity'])
      : defaults.logDensity,
    showSectionHeaders:
      typeof stored['showSectionHeaders'] === 'boolean'
        ? stored['showSectionHeaders']
        : defaults.showSectionHeaders,
    connectionStatus: VALID_CONNECTION_STATUS.has(
      stored['connectionStatus'] as Tweaks['connectionStatus'],
    )
      ? (stored['connectionStatus'] as Tweaks['connectionStatus'])
      : defaults.connectionStatus,
  };
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ableset-sync.tweaks';

function loadFromStorage(defaults: Tweaks): Tweaks {
  // Lazy-init / SSR guard: if window is unavailable, fall back to defaults.
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return defaults;
    }
    // Merge stored values with defaults so newly added keys are always present,
    // then validate each key against its allowed set.
    return sanitize({ ...defaults, ...(parsed as Record<string, unknown>) }, defaults);
  } catch {
    // Corrupted JSON — fall back silently.
    return defaults;
  }
}

function saveToStorage(tweaks: Tweaks): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
  } catch {
    // Quota exceeded or storage unavailable — ignore.
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTweaks(
  defaults: Tweaks,
): [Tweaks, (key: keyof Tweaks, value: Tweaks[keyof Tweaks]) => void] {
  // Lazy initialiser keeps the localStorage read out of the render phase —
  // safe for SSR and avoids repeated reads on re-renders.
  const [values, setValues] = useState<Tweaks>(() => loadFromStorage(defaults));

  // Persist to localStorage whenever state changes (including the initial
  // mount value, so a fresh load always writes back sanitised defaults).
  useEffect(() => {
    saveToStorage(values);
  }, [values]);

  const setTweak = useCallback(
    (key: keyof Tweaks, value: Tweaks[keyof Tweaks]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return [values, setTweak];
}
