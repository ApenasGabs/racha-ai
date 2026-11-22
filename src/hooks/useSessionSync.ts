import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionAction, SessionState } from '../types/session';
import { applySessionAction } from '../lib/reducer';
import { loadHostSession, saveHostSession } from '../lib/storage';
import { RoomSocketClient, type ConnectionState } from '../lib/ws-client';

interface UseSessionSyncParams {
  roomId: string | null;
  clientId: string;
  userName: string;
  isHost: boolean;
  hostSecret?: string;
  initialHostState?: SessionState | null;
}

export interface UseSessionSyncResult {
  state: SessionState | null;
  connectionState: ConnectionState;
  hostOnline: boolean;
  guestCount: number;
  lastError: string | null;
  dispatch: (action: SessionAction) => void;
  clearError: () => void;
}

export function useSessionSync({
  roomId,
  clientId,
  userName,
  isHost,
  hostSecret,
  initialHostState,
}: UseSessionSyncParams): UseSessionSyncResult {
  const [state, setState] = useState<SessionState | null>(() => {
    if (!roomId || !isHost) return null;
    if (initialHostState && initialHostState.roomId === roomId) return initialHostState;
    return loadHostSession(roomId)?.state ?? null;
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [hostOnline, setHostOnline] = useState<boolean>(isHost);
  const [guestCount, setGuestCount] = useState<number>(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<RoomSocketClient | null>(null);
  const stateRef = useRef<SessionState | null>(state);
  stateRef.current = state;

  // Sincroniza estado inicial quando troca de sala como Host
  useEffect(() => {
    if (!roomId) {
      setState(null);
      return;
    }
    if (isHost) {
      const next =
        initialHostState && initialHostState.roomId === roomId
          ? initialHostState
          : loadHostSession(roomId)?.state ?? null;
      setState(next);
      setHostOnline(true);
    } else {
      setState(null);
      setHostOnline(false);
    }
  }, [roomId, isHost, initialHostState]);

  const broadcastState = useCallback((nextState: SessionState, targetClientId?: string) => {
    socketRef.current?.send({
      type: 'state_sync',
      state: nextState,
      targetClientId,
    });
  }, []);

  const commitHostAction = useCallback(
    (action: SessionAction) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = applySessionAction(prev, action);
        if (next === prev) return prev;
        if (hostSecret) {
          saveHostSession({ roomId: next.roomId, hostSecret, state: next });
        }
        broadcastState(next);
        return next;
      });
    },
    [hostSecret, broadcastState]
  );

  // Conecta WebSocket ao Cloudflare Durable Object Relay efêmero
  useEffect(() => {
    if (!roomId) return;

    const client = new RoomSocketClient({
      roomId,
      role: isHost ? 'host' : 'guest',
      clientId,
      hostSecret,
      onStateChange: (nextConn) => {
        setConnectionState(nextConn);
        if (nextConn === 'connected') {
          setLastError(null);
          if (isHost && stateRef.current) {
            client.send({ type: 'state_sync', state: stateRef.current });
          } else if (!isHost && userName.trim()) {
            client.send({
              type: 'action',
              actionId: crypto.randomUUID(),
              action: {
                type: 'JOIN_PARTICIPANT',
                participant: { id: clientId, name: userName.trim() },
              },
            });
          }
        }
      },
      onMessage: (msg) => {
        if (msg.type === 'host_status') {
          setHostOnline(msg.online);
          setGuestCount(msg.guestCount);
          return;
        }
        if (msg.type === 'error') {
          setLastError(msg.message);
          return;
        }
        if (isHost) {
          if (msg.type === 'guest_joined' && stateRef.current) {
            client.send({
              type: 'state_sync',
              state: stateRef.current,
              targetClientId: msg.clientId,
            });
          } else if (msg.type === 'action') {
            commitHostAction(msg.action);
          }
        } else if (msg.type === 'state_sync') {
          setState(msg.state);
          setHostOnline(true);
        }
      },
    });

    socketRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      socketRef.current = null;
    };
  }, [roomId, isHost, clientId, hostSecret, userName, commitHostAction]);

  const dispatch = useCallback(
    (action: SessionAction) => {
      if (isHost) {
        commitHostAction(action);
      } else {
        socketRef.current?.send({
          type: 'action',
          actionId: crypto.randomUUID(),
          action,
        });
      }
    },
    [isHost, commitHostAction]
  );

  const clearError = useCallback(() => setLastError(null), []);

  return {
    state,
    connectionState,
    hostOnline,
    guestCount,
    lastError,
    dispatch,
    clearError,
  };
}
