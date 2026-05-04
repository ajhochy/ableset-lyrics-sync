import type http from 'node:http';
import { parseChordPro } from './chordpro.js';
import { writeAlsFile } from './als-writer.js';
import type { Song, LyricStamp } from '../../shared/types.js';

const MAX_BODY_BYTES = 50 * 1024 * 1024; // 50 MB — generous for future PDF data-URL payloads

/** Read the full request body as a UTF-8 string, rejecting oversized requests. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Send a JSON response. */
function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): void {
  json(res, 200, { ok: true });
}

async function handlePostSong(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    json(res, 400, { error: 'Failed to read request body' });
    return;
  }

  // Parse JSON body
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    json(res, 400, { error: 'Invalid JSON' });
    return;
  }

  if (typeof body !== 'object' || body === null) {
    json(res, 400, { error: 'Body must be a JSON object' });
    return;
  }

  const { name, chordpro } = body as Record<string, unknown>;

  if (typeof chordpro !== 'string') {
    json(res, 400, { error: 'Missing required field: chordpro (string)' });
    return;
  }

  const songName = typeof name === 'string' ? name : '';

  try {
    const song = parseChordPro(songName, chordpro);
    json(res, 200, song);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    json(res, 400, { error: `ChordPro parse error: ${message}` });
  }
}

const MAX_STAMPS = 1000;

/** Sanitize a song name for use as a filename. */
function sanitizeFilename(name: string): string {
  const sanitized = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  return sanitized.length > 0 ? sanitized : 'export';
}

async function handlePostExportAls(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    json(res, 400, { error: 'Failed to read request body' });
    return;
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    json(res, 400, { error: 'Invalid JSON' });
    return;
  }

  if (typeof body !== 'object' || body === null) {
    json(res, 400, { error: 'Body must be a JSON object' });
    return;
  }

  const { song, stamps } = body as Record<string, unknown>;

  if (song === undefined || song === null) {
    json(res, 400, { error: 'Missing required field: song' });
    return;
  }

  if (!Array.isArray(stamps)) {
    json(res, 400, { error: 'Missing required field: stamps (array)' });
    return;
  }

  if (stamps.length > MAX_STAMPS) {
    json(res, 400, { error: `stamps array exceeds maximum length of ${MAX_STAMPS}` });
    return;
  }

  // Validate song shape
  if (
    typeof song !== 'object' ||
    typeof (song as Record<string, unknown>).bpm !== 'number' ||
    typeof (song as Record<string, unknown>).name !== 'string'
  ) {
    json(res, 400, { error: 'Invalid song object: must have name (string) and bpm (number)' });
    return;
  }

  const songObj = song as Song;

  // Validate each stamp has required fields
  for (let i = 0; i < stamps.length; i++) {
    const stamp = stamps[i] as Record<string, unknown>;
    if (
      typeof stamp.lineIdx !== 'number' ||
      typeof stamp.lineText !== 'string' ||
      typeof stamp.ts !== 'number'
    ) {
      json(res, 400, { error: `stamps[${i}] missing required fields: lineIdx (number), lineText (string), ts (number)` });
      return;
    }
  }

  const stampInputs = (stamps as LyricStamp[]).map((stamp) => ({
    ts: stamp.ts,
    clipName: `${stamp.lineIdx + 1}: ${stamp.lineText.slice(0, 24)}`,
  }));

  let alsBuffer: Buffer;
  try {
    alsBuffer = writeAlsFile({
      bpm: songObj.bpm,
      trackName: 'Vocals +LYRICS',
      stamps: stampInputs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    json(res, 400, { error: `Failed to generate .als file: ${message}` });
    return;
  }

  const filename = `${sanitizeFilename(songObj.name)}.als`;

  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': alsBuffer.byteLength,
  });
  res.end(alsBuffer);
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Route an incoming HTTP request to the appropriate handler.
 * WebSocket upgrade requests are never passed here (handled by the upgrade
 * event in index.ts), so we don't need to worry about them.
 */
export async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const method = req.method ?? '';
  const url = req.url ?? '';
  // Strip query string for routing
  const path = url.split('?')[0];

  if (method === 'GET' && path === '/api/health') {
    handleHealth(req, res);
    return;
  }

  if (method === 'POST' && path === '/api/song') {
    await handlePostSong(req, res);
    return;
  }

  if (method === 'POST' && path === '/api/export/als') {
    await handlePostExportAls(req, res);
    return;
  }

  json(res, 404, { error: 'Not found' });
}
