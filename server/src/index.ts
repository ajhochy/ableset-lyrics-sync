import http from 'node:http';
// Verify shared types are reachable from the server — type-only import, no runtime cost.
import type {} from '../../shared/types';
import { OscClient } from './osc-client.js';

const HOST = '127.0.0.1';
const PORT = 7878;

// Instantiate and start the OSC client on server boot.
// The WebSocket broadcast layer (#7) will subscribe to 'tick' and 'connection' events.
const oscClient = new OscClient();

oscClient.on('connection', ({ connected }) => {
  console.log(`[server] Ableton Live ${connected ? 'connected' : 'disconnected'}`);
});

oscClient.start();

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`AbleSet Sync server listening on :${PORT}`);
});
