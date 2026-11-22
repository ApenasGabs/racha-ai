import type { Participant, SessionAction, SessionState } from '../types/session';

const AVATAR_PALETTE = [
  '#10b981', // emerald
  '#38bdf8', // sky
  '#f59e0b', // amber
  '#f472b6', // pink
  '#a78bfa', // violet
  '#fb7185', // rose
  '#2dd4bf', // teal
  '#facc15', // yellow
];

export function pickColor(index: number): string {
  return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
}

function wouldCreateCycle(
  participants: Participant[],
  participantId: string,
  targetPayerId: string
): boolean {
  if (participantId === targetPayerId) return true;
  const map = new Map(participants.map((p) => [p.id, p]));
  let current: string | null = targetPayerId;
  const visited = new Set<string>([participantId]);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = map.get(current)?.paidById ?? null;
  }
  return false;
}

export function applySessionAction(state: SessionState, action: SessionAction): SessionState {
  const now = Date.now();
  const nextBase = { updatedAt: now, version: state.version + 1 };

  switch (action.type) {
    case 'JOIN_PARTICIPANT': {
      const name = action.participant.name.trim().slice(0, 32);
      if (!name) return state;
      const existing = state.participants.find((p) => p.id === action.participant.id);
      if (existing) {
        if (existing.name === name) return state;
        return {
          ...state,
          ...nextBase,
          participants: state.participants.map((p) =>
            p.id === action.participant.id ? { ...p, name, isManual: false } : p
          ),
        };
      }
      const newParticipant: Participant = {
        id: action.participant.id,
        name,
        color: pickColor(state.participants.length),
        isHost: false,
        isManual: false,
        paidById: null,
        joinedAt: now,
      };
      return {
        ...state,
        ...nextBase,
        participants: [...state.participants, newParticipant],
      };
    }

    case 'ADD_MANUAL_PARTICIPANT': {
      const name = action.name.trim().slice(0, 32);
      if (!name) return state;
      const newParticipant: Participant = {
        id: `manual-${crypto.randomUUID().slice(0, 8)}`,
        name,
        color: pickColor(state.participants.length),
        isHost: false,
        isManual: true,
        paidById: null,
        joinedAt: now,
      };
      return {
        ...state,
        ...nextBase,
        participants: [...state.participants, newParticipant],
      };
    }

    case 'REMOVE_PARTICIPANT': {
      const target = state.participants.find((p) => p.id === action.participantId);
      if (!target || target.isHost) return state;
      return {
        ...state,
        ...nextBase,
        participants: state.participants
          .filter((p) => p.id !== action.participantId)
          .map((p) => (p.paidById === action.participantId ? { ...p, paidById: null } : p)),
        items: state.items.map((item) => {
          if (!(action.participantId in item.claims)) return item;
          const nextClaims = { ...item.claims };
          delete nextClaims[action.participantId];
          return { ...item, claims: nextClaims };
        }),
      };
    }

    case 'TOGGLE_CLAIM': {
      if (!state.participants.some((p) => p.id === action.participantId)) return state;
      return {
        ...state,
        ...nextBase,
        items: state.items.map((item) => {
          if (item.id !== action.itemId) return item;
          const nextClaims = { ...item.claims };
          if ((nextClaims[action.participantId] ?? 0) > 0) {
            delete nextClaims[action.participantId];
          } else {
            nextClaims[action.participantId] = 1;
          }
          return { ...item, claims: nextClaims };
        }),
      };
    }

    case 'SET_CLAIM_SHARES': {
      if (!state.participants.some((p) => p.id === action.participantId)) return state;
      const shares = Math.max(0, Math.min(99, Math.round(action.shares)));
      return {
        ...state,
        ...nextBase,
        items: state.items.map((item) => {
          if (item.id !== action.itemId) return item;
          const nextClaims = { ...item.claims };
          if (shares <= 0) {
            delete nextClaims[action.participantId];
          } else {
            nextClaims[action.participantId] = shares;
          }
          return { ...item, claims: nextClaims };
        }),
      };
    }

    case 'SET_PAID_BY': {
      const { participantId, paidById } = action;
      if (!state.participants.some((p) => p.id === participantId)) return state;
      if (paidById !== null) {
        if (!state.participants.some((p) => p.id === paidById)) return state;
        if (wouldCreateCycle(state.participants, participantId, paidById)) return state;
      }
      return {
        ...state,
        ...nextBase,
        participants: state.participants.map((p) =>
          p.id === participantId ? { ...p, paidById } : p
        ),
      };
    }

    case 'ADD_ITEM': {
      const name = action.name.trim().slice(0, 80);
      const quantity = Math.max(1, Math.round(action.quantity || 1));
      const totalCents = Math.max(0, Math.round(action.totalCents));
      if (!name || totalCents <= 0) return state;
      return {
        ...state,
        ...nextBase,
        items: [
          ...state.items,
          {
            id: `item-${crypto.randomUUID().slice(0, 8)}`,
            name,
            quantity,
            totalCents,
            claims: {},
            createdAt: now,
          },
        ],
      };
    }

    case 'ADD_ITEMS_BATCH': {
      const newItems = action.items
        .map((raw) => ({
          id: `item-${crypto.randomUUID().slice(0, 8)}`,
          name: raw.name.trim().slice(0, 80),
          quantity: Math.max(1, Math.round(raw.quantity || 1)),
          totalCents: Math.max(0, Math.round(raw.totalCents)),
          claims: {} as Record<string, number>,
          createdAt: now,
        }))
        .filter((i) => i.name.length > 0 && i.totalCents > 0);

      if (newItems.length === 0) return state;

      return {
        ...state,
        ...nextBase,
        serviceFeePercent:
          typeof action.serviceFeePercent === 'number'
            ? Math.max(0, Math.min(30, action.serviceFeePercent))
            : state.serviceFeePercent,
        discountCents:
          typeof action.discountCents === 'number' && action.discountCents > 0
            ? state.discountCents + Math.round(action.discountCents)
            : state.discountCents,
        items: [...state.items, ...newItems],
      };
    }

    case 'UPDATE_ITEM': {
      const name = action.name.trim().slice(0, 80);
      const quantity = Math.max(1, Math.round(action.quantity || 1));
      const totalCents = Math.max(0, Math.round(action.totalCents));
      if (!name || totalCents <= 0) return state;
      return {
        ...state,
        ...nextBase,
        items: state.items.map((item) =>
          item.id === action.itemId ? { ...item, name, quantity, totalCents } : item
        ),
      };
    }

    case 'REMOVE_ITEM': {
      return {
        ...state,
        ...nextBase,
        items: state.items.filter((item) => item.id !== action.itemId),
      };
    }

    case 'SPLIT_UNCLAIMED_EQUALLY': {
      if (state.participants.length === 0) return state;
      const equalClaims = Object.fromEntries(state.participants.map((p) => [p.id, 1]));
      return {
        ...state,
        ...nextBase,
        items: state.items.map((item) => {
          const hasClaims = Object.values(item.claims).some((s) => s > 0);
          if (hasClaims) return item;
          return { ...item, claims: { ...equalClaims } };
        }),
      };
    }

    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        ...nextBase,
        title: action.title !== undefined ? action.title.trim().slice(0, 48) || state.title : state.title,
        serviceFeePercent:
          action.serviceFeePercent !== undefined
            ? Math.max(0, Math.min(30, action.serviceFeePercent))
            : state.serviceFeePercent,
        discountCents:
          action.discountCents !== undefined
            ? Math.max(0, Math.round(action.discountCents))
            : state.discountCents,
        coverChargeCents:
          action.coverChargeCents !== undefined
            ? Math.max(0, Math.round(action.coverChargeCents))
            : state.coverChargeCents,
      };
    }

    default:
      return state;
  }
}
