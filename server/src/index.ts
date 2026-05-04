import http from 'node:http';
import { OscClient } from './osc-client.js';
import { attachWebSocketServer } from './ws-server.js';

const HOST = '127.0.0.1';
const PORT = 7878;

// Instantiate and start the OSC client on server boot.
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

// Attach the WebSocket broadcast server on the same HTTP server at path /live.
attachWebSocketServer(server, oscClient);

server.listen(PORT, HOST, () => {
  console.log(`AbleSet Sync server listening on :${PORT}`);
  console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/live`);
});
