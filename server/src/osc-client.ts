import { EventEmitter } from 'node:events';
import { Client, Server } from 'node-osc';

export interface TickPayload {
  ts: number;
  bpm: number;
  playing: boolean;
}

export interface ConnectionPayload {
  connected: boolean;
}

const OSC_SEND_PORT = 11000;
const OSC_RECV_PORT = 11001;
const OSC_HOST = '127.0.0.1';

const POLL_INTERVAL_MS = 100; // 10 Hz
const HEARTBEAT_INTERVAL_MS = 1000; // 1 Hz
const HEARTBEAT_TIMEOUT_MS = 2000; // 2 s

const ADDR_SONG_TIME = '/live/song/get/current_song_time';
const ADDR_TEMPO = '/live/song/get/tempo';
const ADDR_IS_PLAYING = '/live/song/get/is_playing';
const ADDR_TEST = '/live/test';
const ADDR_START_PLAYING = '/live/song/start_playing';
const ADDR_STOP_PLAYING = '/live/song/stop_playing';

type OscClientEvents = {
  tick: [TickPayload];
  connection: [ConnectionPayload];
};

export class OscClient extends EventEmitter<OscClientEvents> {
  private _oscClient: Client | null = null;
  private _oscServer: Server | null = null;

  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private _lastTs: number | null = null;
  private _lastBpm: number | null = null;
  private _lastPlaying: boolean | null = null;

  private _lastHeartbeatReplyAt = 0;
  private _connected = false;
  private _started = false;

  start(): void {
    if (this._started) {
      return;
    }
    this._started = true;

    // Open the receive server first so replies are captured
    this._oscServer = new Server(OSC_RECV_PORT, OSC_HOST, () => {
      console.log(`[OSC] Listening on ${OSC_HOST}:${OSC_RECV_PORT}`);
    });

    this._oscServer.on('message', (msg: unknown[]) => {
      this._handleMessage(msg);
    });

    this._oscServer.on('error', (err: Error) => {
      console.error('[OSC] Server error:', err.message);
    });

    // Open the send client
    this._oscClient = new Client(OSC_HOST, OSC_SEND_PORT);

    this._oscClient.on('error', (err: Error) => {
      console.error('[OSC] Client error:', err.message);
    });

    // Start poll loop at 10 Hz
    this._pollTimer = setInterval(() => {
      this._poll();
    }, POLL_INTERVAL_MS);

    // Start heartbeat loop at 1 Hz
    this._heartbeatTimer = setInterval(() => {
      this._heartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    // Kick off an immediate heartbeat
    this._heartbeat();
  }

  stop(): void {
    if (!this._started) {
      return;
    }
    this._started = false;

    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }

    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }

    if (this._oscClient !== null) {
      this._oscClient.close();
      this._oscClient = null;
    }

    if (this._oscServer !== null) {
      this._oscServer.close();
      this._oscServer = null;
    }
  }

  startPlaying(): void {
    this._send(ADDR_START_PLAYING);
  }

  stopPlaying(): void {
    this._send(ADDR_STOP_PLAYING);
  }

  private _send(address: string): void {
    if (this._oscClient === null) {
      return;
    }
    this._oscClient.send(address, (err?: Error) => {
      if (err) {
        console.error(`[OSC] Send error for ${address}:`, err.message);
      }
    });
  }

  private _poll(): void {
    this._send(ADDR_SONG_TIME);
    this._send(ADDR_TEMPO);
    this._send(ADDR_IS_PLAYING);
  }

  private _heartbeat(): void {
    this._send(ADDR_TEST);
    // Check if the last reply was too long ago
    if (this._lastHeartbeatReplyAt > 0) {
      const elapsed = Date.now() - this._lastHeartbeatReplyAt;
      if (elapsed > HEARTBEAT_TIMEOUT_MS) {
        this._setConnected(false);
      }
    }
  }

  private _handleMessage(msg: unknown[]): void {
    try {
      if (!Array.isArray(msg) || msg.length === 0) {
        return;
      }

      const address = msg[0] as string;

      if (address === ADDR_TEST) {
        this._lastHeartbeatReplyAt = Date.now();
        this._setConnected(true);
        return;
      }

      if (address === ADDR_SONG_TIME) {
        const val = msg[1];
        if (typeof val === 'number') {
          this._lastTs = val;
        }
      } else if (address === ADDR_TEMPO) {
        const val = msg[1];
        if (typeof val === 'number') {
          this._lastBpm = val;
        }
      } else if (address === ADDR_IS_PLAYING) {
        const val = msg[1];
        // AbletonOSC returns 1/0 or true/false
        if (typeof val === 'number') {
          this._lastPlaying = val !== 0;
        } else if (typeof val === 'boolean') {
          this._lastPlaying = val;
        }
      }

      // Emit tick once all three values have been received at least once
      if (
        this._lastTs !== null &&
        this._lastBpm !== null &&
        this._lastPlaying !== null
      ) {
        const payload: TickPayload = {
          ts: this._lastTs,
          bpm: this._lastBpm,
          playing: this._lastPlaying,
        };
        this.emit('tick', payload);
      }
    } catch (err) {
      console.error('[OSC] Error handling message:', err);
    }
  }

  private _setConnected(value: boolean): void {
    if (value !== this._connected) {
      this._connected = value;
      const payload: ConnectionPayload = { connected: value };
      this.emit('connection', payload);
      console.log(`[OSC] Connection state: ${value ? 'connected' : 'disconnected'}`);
    }
  }
}
