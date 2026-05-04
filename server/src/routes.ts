import type http from 'node:http';
import { parseChordPro } from './chordpro.js';

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

  json(res, 404, { error: 'Not found' });
}
