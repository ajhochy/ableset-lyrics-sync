export type LyricStamp = {
  id: string;
  lineIdx: number;
  lineText: string;
  section: string | null;
  ts: number;
  beats: number;
};

export type SheetStamp = {
  id: string;
  page: number;
  region: string;
  imageRef: string;
  pngDataUrl: string;
  ts: number;
};

export type Song = {
  name: string;
  bpm: number;
  key: string;
  lines: Array<{ section?: string; text?: string }>;
};

export type LiveMsg =
  | { type: 'tick'; ts: number; bpm: number; playing: boolean }
  | { type: 'connection'; connected: boolean }
  | { type: 'song'; bpm: number; tempo: number; signature: string };
