import { DurableObject } from 'cloudflare:workers';

interface SocketMeta {
  role: 'host' | 'guest';
  clientId: string;
}

const MAX_MESSAGE_BYTES = 256 * 1024; // 256KB max por frame (snapshot completo de mesa grande cabe folgado)

/**
 * Relay WebSocket 100% EFÊMERO em memória.
 * NÃO utiliza ctx.storage — nenhum dado da conta é persistido na nuvem.
 * O estado autoritativo vive exclusivamente no navegador do Host.
 */
export class RoomRelay extends DurableObject {
  private hostSecret: string | null = null;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const url = new URL(request.url);
    const roleParam = url.searchParams.get('role');
    const role: 'host' | 'guest' = roleParam === 'host' ? 'host' : 'guest';
    const clientId = (url.searchParams.get('clientId') || crypto.randomUUID()).slice(0, 64);
    const secret = url.searchParams.get('secret') || '';

    if (role === 'host') {
      if (!secret || secret.length < 8) {
        return new Response('Host secret required', { status: 403 });
      }
      if (this.hostSecret && this.hostSecret !== secret) {
        // Verifica se ainda existe um host ativo; se não existir, permite assumir após expiração
        const activeHost = this.getHostSocket();
        if (activeHost) {
          return new Response('Room already owned by another host', { status: 403 });
        }
      }
      this.hostSecret = secret;

      // Fecha conexão anterior do mesmo host (ex: reload de página)
      const prevHost = this.getHostSocket();
      if (prevHost) {
        try {
          prevHost.close(4001, 'Replaced by newer host connection');
        } catch {
          // ignore
        }
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const meta: SocketMeta = { role, clientId };
    this.ctx.acceptWebSocket(server, [role, clientId]);
    server.serializeAttachment(meta);

    if (role === 'host') {
      this.broadcastHostStatus();
    } else {
      const host = this.getHostSocket();
      this.safeSend(server, {
        type: 'host_status',
        online: Boolean(host),
        guestCount: this.getGuestSockets().length,
      });
      if (host) {
        this.safeSend(host, { type: 'guest_joined', clientId });
        this.broadcastHostStatus();
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (raw.length > MAX_MESSAGE_BYTES) {
      this.safeSend(ws, {
        type: 'error',
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Mensagem excede o limite permitido.',
      });
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if (parsed.type === 'ping') {
      this.safeSend(ws, { type: 'pong', ts: typeof parsed.ts === 'number' ? parsed.ts : Date.now() });
      return;
    }

    const meta = ws.deserializeAttachment() as SocketMeta | null;
    if (!meta) return;

    if (meta.role === 'host') {
      if (parsed.type === 'state_sync' && parsed.state) {
        const targetClientId = typeof parsed.targetClientId === 'string' ? parsed.targetClientId : undefined;
        const payload = JSON.stringify({ type: 'state_sync', state: parsed.state });
        for (const guest of this.getGuestSockets()) {
          if (targetClientId) {
            const gMeta = guest.deserializeAttachment() as SocketMeta | null;
            if (gMeta?.clientId !== targetClientId) continue;
          }
          try {
            guest.send(payload);
          } catch {
            // ignore broken pipe
          }
        }
      }
      return;
    }

    // Guest enviando uma ação para o Host autoritativo
    if (meta.role === 'guest' && parsed.type === 'action' && parsed.action) {
      const host = this.getHostSocket();
      if (!host) {
        this.safeSend(ws, {
          type: 'error',
          code: 'HOST_OFFLINE',
          message: 'O Host está temporariamente desconectado. Sua ação será reenviada quando ele voltar.',
        });
        return;
      }

      this.safeSend(host, {
        type: 'action',
        action: parsed.action,
        actionId: typeof parsed.actionId === 'string' ? parsed.actionId : crypto.randomUUID(),
        fromClientId: meta.clientId,
      });
    }
  }

  webSocketClose(ws: WebSocket): void {
    const meta = ws.deserializeAttachment() as SocketMeta | null;
    if (!meta) return;
    // Pequeno broadcast atualizado de presença
    this.broadcastHostStatus(ws);
  }

  webSocketError(ws: WebSocket): void {
    try {
      ws.close(1011, 'WebSocket error');
    } catch {
      // ignore
    }
    this.broadcastHostStatus(ws);
  }

  private getHostSocket(exclude?: WebSocket): WebSocket | null {
    const hosts = this.ctx.getWebSockets('host');
    for (const sock of hosts) {
      if (sock !== exclude && sock.readyState === WebSocket.READY_STATE_OPEN) {
        return sock;
      }
    }
    return null;
  }

  private getGuestSockets(exclude?: WebSocket): WebSocket[] {
    return this.ctx
      .getWebSockets('guest')
      .filter((sock) => sock !== exclude && sock.readyState === WebSocket.READY_STATE_OPEN);
  }

  private broadcastHostStatus(exclude?: WebSocket): void {
    const host = this.getHostSocket(exclude);
    const guests = this.getGuestSockets(exclude);
    const statusMsg = {
      type: 'host_status',
      online: Boolean(host),
      guestCount: guests.length,
    };

    if (host) {
      this.safeSend(host, statusMsg);
    }
    for (const guest of guests) {
      this.safeSend(guest, statusMsg);
    }
  }

  private safeSend(ws: WebSocket, payload: unknown): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }
}
