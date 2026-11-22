export type AiProvider = 'groq' | 'xai';

export interface Participant {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  /** True quando foi adicionado manualmente por alguém da mesa (não entrou pelo próprio celular) */
  isManual: boolean;
  /** ID de outro participante que vai pagar a parte desta pessoa (ex: "Eu pago por mim e pela Maria") */
  paidById: string | null;
  joinedAt: number;
}

export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  /** Preço total da linha em centavos (ex: 3 chopps = R$ 36,00 -> 3600) */
  totalCents: number;
  /**
   * Número fixo de partes para dividir o item (ex: 5 para dividir 1 frango em 5 sem cadastrar 5 pessoas).
   * Quando null/undefined, divide automaticamente pela soma das cotas de quem entrou.
   */
  splitTotalShares?: number | null;
  /** Mapa participantId -> cotas/peso (padrão 1 = entra igualmente; >1 = múltiplas unidades/cotas) */
  claims: Record<string, number>;
  createdAt: number;
}

export interface SessionState {
  roomId: string;
  title: string;
  /** Taxa de serviço percentual (ex: 10 para 10%) */
  serviceFeePercent: number;
  /** Desconto global em centavos (ex: cupom ou cortesia) */
  discountCents: number;
  /** Taxa fixa extra / couvert artístico em centavos (dividido igualmente entre quem consumiu ou todos) */
  coverChargeCents: number;
  participants: Participant[];
  items: BillItem[];
  updatedAt: number;
  version: number;
}

/** Ações que convidados (ou o próprio Host) podem solicitar para mutar o estado no Host */
export type SessionAction =
  | { type: 'JOIN_PARTICIPANT'; participant: { id: string; name: string } }
  | { type: 'ADD_MANUAL_PARTICIPANT'; name: string }
  | { type: 'REMOVE_PARTICIPANT'; participantId: string }
  | { type: 'TOGGLE_CLAIM'; itemId: string; participantId: string }
  | { type: 'SET_CLAIM_SHARES'; itemId: string; participantId: string; shares: number }
  | { type: 'SET_ITEM_SPLIT_PARTS'; itemId: string; splitTotalShares: number | null }
  | { type: 'SET_PAID_BY'; participantId: string; paidById: string | null }
  | { type: 'ADD_ITEM'; name: string; quantity: number; totalCents: number }
  | { type: 'ADD_ITEMS_BATCH'; items: Array<{ name: string; quantity: number; totalCents: number }>; serviceFeePercent?: number | null; discountCents?: number | null }
  | { type: 'UPDATE_ITEM'; itemId: string; name: string; quantity: number; totalCents: number }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'SPLIT_UNCLAIMED_EQUALLY' }
  | { type: 'UPDATE_SETTINGS'; title?: string; serviceFeePercent?: number; discountCents?: number; coverChargeCents?: number };

export type ClientToRelayMessage =
  | { type: 'ping'; ts: number }
  | { type: 'state_sync'; state: SessionState; targetClientId?: string }
  | { type: 'action'; action: SessionAction; actionId: string };

export type RelayToClientMessage =
  | { type: 'pong'; ts: number }
  | { type: 'host_status'; online: boolean; guestCount: number }
  | { type: 'guest_joined'; clientId: string }
  | { type: 'state_sync'; state: SessionState }
  | { type: 'action'; action: SessionAction; actionId: string; fromClientId: string }
  | { type: 'error'; code: string; message: string };

export interface OcrExtractedItem {
  name: string;
  quantity: number;
  totalCents: number;
}

export interface OcrResponse {
  items: OcrExtractedItem[];
  serviceFeePercent: number | null;
  discountCents: number | null;
  provider: AiProvider;
  model: string;
}
