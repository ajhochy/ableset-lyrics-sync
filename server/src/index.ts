import http from 'node:http';
import { OscClient } from './osc-client.js';
import { attachWebSocketServer } from './ws-server.js';
import { handleRequest } from './routes.js';

const HOST = '127.0.0.1';
const PORT = 7878;

// Instantiate and start the OSC client on server boot.
const oscClient = new OscClient();

oscClient.on('connection', ({ connected }) => {
  console.log(`[server] Ableton Live ${connected ? 'connected' : 'disconnected'}`);
});

oscClient.start();

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    console.error('[server] Unhandled route error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  });
});

// Attach the WebSocket broadcast server on the same HTTP server at path /live.
attachWebSocketServer(server, oscClient);

server.listen(PORT, HOST, () => {
  console.log(`AbleSet Sync server listening on :${PORT}`);
  console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/live`);
});
