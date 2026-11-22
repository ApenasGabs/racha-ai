import type { AiProvider, SessionState } from '../types/session';

const HOST_SESSIONS_KEY = 'racha_ai_host_sessions_v1';
const BYOK_STORAGE_KEY = 'racha_ai_byok_v1';
const IDENTITY_STORAGE_KEY = 'racha_ai_identity_v1';

export interface StoredHostSession {
  roomId: string;
  hostSecret: string;
  state: SessionState;
}

export interface StoredByokConfig {
  provider: AiProvider;
  apiKey: string;
  customModel?: string;
}

export interface LocalIdentity {
  clientId: string;
  name: string;
}

export function detectProviderFromKey(apiKey: string): AiProvider | null {
  const trimmed = apiKey.trim();
  if (trimmed.startsWith('gsk_')) return 'groq';
  if (trimmed.startsWith('xai-')) return 'xai';
  return null;
}

export function loadLocalIdentity(): LocalIdentity {
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalIdentity>;
      if (parsed.clientId) {
        return { clientId: parsed.clientId, name: parsed.name || '' };
      }
    }
  } catch {
    // ignore
  }
  const fresh: LocalIdentity = {
    clientId: `user-${crypto.randomUUID().slice(0, 10)}`,
    name: '',
  };
  saveLocalIdentity(fresh);
  return fresh;
}

export function saveLocalIdentity(identity: LocalIdentity): void {
  try {
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // ignore quota errors
  }
}

export function loadByokConfig(): StoredByokConfig | null {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredByokConfig>;
    if (!parsed.apiKey) return null;
    return {
      provider: parsed.provider === 'xai' ? 'xai' : 'groq',
      apiKey: parsed.apiKey,
      customModel: parsed.customModel,
    };
  } catch {
    return null;
  }
}

export function saveByokConfig(config: StoredByokConfig | null): void {
  try {
    if (!config || !config.apiKey.trim()) {
      localStorage.removeItem(BYOK_STORAGE_KEY);
      return;
    }
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function loadAllHostSessions(): Record<string, StoredHostSession> {
  try {
    const raw = localStorage.getItem(HOST_SESSIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredHostSession>;
  } catch {
    return {};
  }
}

export function loadHostSession(roomId: string): StoredHostSession | null {
  const all = loadAllHostSessions();
  return all[roomId.toUpperCase()] ?? null;
}

export function saveHostSession(session: StoredHostSession): void {
  try {
    const all = loadAllHostSessions();
    all[session.roomId.toUpperCase()] = session;
    localStorage.setItem(HOST_SESSIONS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function deleteHostSession(roomId: string): void {
  try {
    const all = loadAllHostSessions();
    delete all[roomId.toUpperCase()];
    localStorage.setItem(HOST_SESSIONS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `MESA-${code.slice(0, 4)}`;
}
