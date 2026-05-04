import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:http';
import { URL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import type { OscClient } from './osc-client.js';
import type { LiveMsg } from '../../shared/types.js';

const PING_INTERVAL_MS = 30_000;

export function attachWebSocketServer(httpServer: Server, oscClient: OscClient): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  // Track the most recent state so new clients get immediate data
  let lastTick: Extract<LiveMsg, { type: 'tick' }> | null = null;
  let lastConnection: Extract<LiveMsg, { type: 'connection' }> | null = null;

  function broadcast(msg: LiveMsg): void {
    const json = JSON.stringify(msg);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      }
    }
  }

  // Subscribe to OSC events
  oscClient.on('tick', (payload) => {
    const msg: LiveMsg = { type: 'tick', ...payload };
    lastTick = msg;
    broadcast(msg);
  });

  oscClient.on('connection', (payload) => {
    const msg: LiveMsg = { type: 'connection', ...payload };
    lastConnection = msg;
    broadcast(msg);
  });

  // Handle HTTP upgrades — only accept /live path
  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (pathname !== '/live') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);

    // Immediately push most recent known state so UI doesn't flash empty
    if (lastConnection !== null) {
      ws.send(JSON.stringify(lastConnection));
    }
    if (lastTick !== null) {
      ws.send(JSON.stringify(lastTick));
    }

    // Heartbeat: ping every 30 s; terminate unresponsive clients
    let isAlive = true;
    const pingTimer = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, PING_INTERVAL_MS);

    ws.on('pong', () => {
      isAlive = true;
    });

    ws.on('close', () => {
      clearInterval(pingTimer);
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clearInterval(pingTimer);
      clients.delete(ws);
    });
  });

  // Clean shutdown: close all clients when WS server closes
  wss.on('close', () => {
    for (const client of clients) {
      client.terminate();
    }
    clients.clear();
  });

  return wss;
}
