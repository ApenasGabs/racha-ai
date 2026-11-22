import type { ClientToRelayMessage, RelayToClientMessage } from '../types/session';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface RoomSocketOptions {
  roomId: string;
  role: 'host' | 'guest';
  clientId: string;
  hostSecret?: string;
  onMessage: (msg: RelayToClientMessage) => void;
  onStateChange: (state: ConnectionState) => void;
}

const HEARTBEAT_MS = 25_000;
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

export class RoomSocketClient {
  private ws: WebSocket | null = null;
  private opts: RoomSocketOptions;
  private closedByUser = false;
  private retryAttempt = 0;
  private retryTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private pendingQueue: ClientToRelayMessage[] = [];

  constructor(opts: RoomSocketOptions) {
    this.opts = opts;
  }

  connect(): void {
    this.closedByUser = false;
    this.openSocket();
  }

  send(msg: ClientToRelayMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return;
    }
    // Enfileira ações (não enfileira pings nem múltiplos state_sync redundantes)
    if (msg.type === 'action') {
      this.pendingQueue.push(msg);
      if (this.pendingQueue.length > 50) {
        this.pendingQueue.shift();
      }
    } else if (msg.type === 'state_sync') {
      this.pendingQueue = this.pendingQueue.filter((m) => m.type !== 'state_sync');
      this.pendingQueue.push(msg);
    }
  }

  disconnect(): void {
    this.closedByUser = true;
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnected');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.opts.onStateChange('disconnected');
  }

  private openSocket(): void {
    this.clearTimers();
    this.opts.onStateChange(this.retryAttempt > 0 ? 'reconnecting' : 'connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      role: this.opts.role,
      clientId: this.opts.clientId,
    });
    if (this.opts.role === 'host' && this.opts.hostSecret) {
      params.set('secret', this.opts.hostSecret);
    }

    const url = `${protocol}//${window.location.host}/ws/${encodeURIComponent(this.opts.roomId)}?${params.toString()}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.retryAttempt = 0;
      this.opts.onStateChange('connected');
      this.flushQueue();
      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data) as RelayToClientMessage;
        if (msg.type === 'pong') return;
        this.opts.onMessage(msg);
      } catch {
        // ignore invalid json
      }
    };

    ws.onclose = (event) => {
      this.clearTimers();
      this.ws = null;
      if (this.closedByUser || event.code === 4001) {
        this.opts.onStateChange('disconnected');
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose cuidará da reconexão
    };
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.pendingQueue.length > 0) {
      const next = this.pendingQueue.shift();
      if (next) {
        this.ws.send(JSON.stringify(next));
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, HEARTBEAT_MS);
  }

  private scheduleReconnect(): void {
    this.opts.onStateChange('reconnecting');
    const delay = Math.min(
      MAX_RETRY_MS,
      BASE_RETRY_MS * Math.pow(2, this.retryAttempt) + Math.round(Math.random() * 500)
    );
    this.retryAttempt += 1;
    this.retryTimer = window.setTimeout(() => {
      if (!this.closedByUser) {
        this.openSocket();
      }
    }, delay);
  }

  private clearTimers(): void {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
