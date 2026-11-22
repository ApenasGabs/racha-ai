import { useEffect, useMemo, useState } from 'react';
import { HandCoins, Loader2, ReceiptText } from 'lucide-react';
import type { SessionState } from './types/session';
import {
  deleteHostSession,
  generateRoomCode,
  loadAllHostSessions,
  loadByokConfig,
  loadHostSession,
  loadLocalIdentity,
  saveByokConfig,
  saveHostSession,
  saveLocalIdentity,
  type StoredByokConfig,
  type StoredHostSession,
} from './lib/storage';
import { computeBillSummary, formatCurrency } from './lib/calculations';
import { pickColor } from './lib/reducer';
import { useSessionSync } from './hooks/useSessionSync';
import { LandingView } from './components/LandingView';
import { Header } from './components/Header';
import { QrModal } from './components/QrModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ReceiptScanner } from './components/ReceiptScanner';
import { ParticipantsBar } from './components/ParticipantsBar';
import { ItemCard } from './components/ItemCard';
import { SummaryView } from './components/SummaryView';

function parseRoomFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/sala\/([A-Z0-9-]{4,24})$/i);
  return match ? match[1].toUpperCase() : null;
}

export default function App() {
  const [identity, setIdentity] = useState(() => loadLocalIdentity());
  const [byokConfig, setByokConfig] = useState<StoredByokConfig | null>(() => loadByokConfig());
  const [savedSessions, setSavedSessions] = useState<StoredHostSession[]>(() =>
    Object.values(loadAllHostSessions()).sort((a, b) => b.state.updatedAt - a.state.updatedAt)
  );

  const [roomId, setRoomId] = useState<string | null>(() => parseRoomFromUrl());
  const [hostSecret, setHostSecret] = useState<string | undefined>(() => {
    const urlRoom = parseRoomFromUrl();
    return urlRoom ? loadHostSession(urlRoom)?.hostSecret : undefined;
  });
  const [initialHostState, setInitialHostState] = useState<SessionState | null>(() => {
    const urlRoom = parseRoomFromUrl();
    return urlRoom ? loadHostSession(urlRoom)?.state ?? null : null;
  });

  // Se Guest abriu link /sala/XXXX sem nome salvo ainda, pede o nome antes de conectar
  const [pendingGuestName, setPendingGuestName] = useState(identity.name);
  const [guestNameConfirmed, setGuestNameConfirmed] = useState(() => Boolean(identity.name.trim()));

  const [activeTab, setActiveTab] = useState<'items' | 'summary'>('items');
  const [activeParticipantId, setActiveParticipantId] = useState<string>(identity.clientId);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const isHost = Boolean(roomId && hostSecret);
  const shouldConnect = Boolean(roomId && (isHost || guestNameConfirmed));

  const { state, connectionState, hostOnline, guestCount, lastError, dispatch, clearError } =
    useSessionSync({
      roomId: shouldConnect ? roomId : null,
      clientId: identity.clientId,
      userName: identity.name,
      isHost,
      hostSecret,
      initialHostState,
    });

  // Garante que activeParticipantId sempre aponte para alguém válido na mesa
  useEffect(() => {
    if (!state) return;
    const exists = state.participants.some((p) => p.id === activeParticipantId);
    if (!exists) {
      const me = state.participants.find((p) => p.id === identity.clientId);
      setActiveParticipantId(me?.id ?? state.participants[0]?.id ?? identity.clientId);
    }
  }, [state, activeParticipantId, identity.clientId]);

  const refreshSavedSessions = () => {
    setSavedSessions(
      Object.values(loadAllHostSessions()).sort((a, b) => b.state.updatedAt - a.state.updatedAt)
    );
  };

  const navigateToRoom = (nextRoomId: string | null) => {
    const nextPath = nextRoomId ? `/sala/${nextRoomId}` : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  };

  const handleCreateSession = (title: string, hostName: string) => {
    const nextIdentity = { ...identity, name: hostName };
    setIdentity(nextIdentity);
    saveLocalIdentity(nextIdentity);

    const newRoomId = generateRoomCode();
    const secret = crypto.randomUUID();
    const now = Date.now();

    const newState: SessionState = {
      roomId: newRoomId,
      title,
      serviceFeePercent: 10,
      discountCents: 0,
      coverChargeCents: 0,
      participants: [
        {
          id: nextIdentity.clientId,
          name: hostName,
          color: pickColor(0),
          isHost: true,
          isManual: false,
          paidById: null,
          joinedAt: now,
        },
      ],
      items: [],
      updatedAt: now,
      version: 1,
    };

    saveHostSession({ roomId: newRoomId, hostSecret: secret, state: newState });
    refreshSavedSessions();

    setHostSecret(secret);
    setInitialHostState(newState);
    setActiveParticipantId(nextIdentity.clientId);
    setRoomId(newRoomId);
    setActiveTab('items');
    navigateToRoom(newRoomId);
  };

  const handleResumeSession = (targetRoomId: string) => {
    const stored = loadHostSession(targetRoomId);
    if (!stored) return;
    setHostSecret(stored.hostSecret);
    setInitialHostState(stored.state);
    setActiveParticipantId(identity.clientId);
    setRoomId(stored.roomId);
    setActiveTab('items');
    navigateToRoom(stored.roomId);
  };

  const handleJoinSession = (targetRoomId: string, guestName: string) => {
    const nextIdentity = { ...identity, name: guestName };
    setIdentity(nextIdentity);
    saveLocalIdentity(nextIdentity);
    setGuestNameConfirmed(true);

    // Se já é Host dessa sala localmente, abre como Host
    const storedHost = loadHostSession(targetRoomId);
    if (storedHost) {
      handleResumeSession(targetRoomId);
      return;
    }

    setHostSecret(undefined);
    setInitialHostState(null);
    setActiveParticipantId(nextIdentity.clientId);
    setRoomId(targetRoomId);
    setActiveTab('items');
    navigateToRoom(targetRoomId);
  };

  const handleLeaveRoom = () => {
    refreshSavedSessions();
    setRoomId(null);
    setHostSecret(undefined);
    setInitialHostState(null);
    navigateToRoom(null);
  };

  const handleSaveByok = (config: StoredByokConfig | null) => {
    setByokConfig(config);
    saveByokConfig(config);
  };

  const myTotalCents = useMemo(() => {
    if (!state) return 0;
    const summary = computeBillSummary(state);
    const myGroup = summary.payerGroups.find((g) => g.payer.id === identity.clientId);
    if (myGroup) return myGroup.totalCents;
    const myBreakdown = summary.byParticipant.find((b) => b.participant.id === identity.clientId);
    return myBreakdown?.totalCents ?? 0;
  }, [state, identity.clientId]);

  // 1. Tela inicial (sem sala ativa)
  if (!roomId) {
    return (
      <>
        <LandingView
          defaultName={identity.name}
          savedSessions={savedSessions}
          hasApiKey={Boolean(byokConfig?.apiKey)}
          onCreateSession={handleCreateSession}
          onJoinSession={handleJoinSession}
          onResumeSession={handleResumeSession}
          onDeleteSession={(id) => {
            deleteHostSession(id);
            refreshSavedSessions();
          }}
          onOpenApiKey={() => setShowApiKeyModal(true)}
        />
        {showApiKeyModal && (
          <ApiKeyModal
            currentConfig={byokConfig}
            onSave={handleSaveByok}
            onClose={() => setShowApiKeyModal(false)}
          />
        )}
      </>
    );
  }

  // 2. Convidado abriu link do QR Code e ainda precisa informar seu nome
  if (!isHost && !guestNameConfirmed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pendingGuestName.trim()) return;
            handleJoinSession(roomId, pendingGuestName.trim());
          }}
          className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4"
        >
          <div>
            <p className="font-mono text-xs font-bold text-emerald-400">{roomId}</p>
            <h1 className="mt-1 text-xl font-extrabold text-white">Entrar na mesa</h1>
            <p className="mt-1 text-xs text-zinc-400">
              Informe seu nome para marcar seus itens em tempo real.
            </p>
          </div>
          <input
            type="text"
            value={pendingGuestName}
            onChange={(e) => setPendingGuestName(e.target.value)}
            placeholder="Seu nome ou apelido"
            autoFocus
            required
            maxLength={32}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
          >
            Entrar Agora
          </button>
        </form>
      </div>
    );
  }

  // 3. Convidado aguardando o primeiro snapshot do Host
  if (!state) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header
          title="Conectando..."
          roomId={roomId}
          isHost={isHost}
          connectionState={connectionState}
          hostOnline={hostOnline}
          guestCount={guestCount}
          hasApiKey={Boolean(byokConfig?.apiKey)}
          onOpenQr={() => setShowQrModal(true)}
          onOpenApiKey={() => setShowApiKeyModal(true)}
          onLeave={handleLeaveRoom}
        />
        <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          <h2 className="mt-4 text-base font-bold text-white">Sincronizando com o Host...</h2>
          <p className="mt-1.5 text-xs text-zinc-400">
            {hostOnline
              ? 'Carregando os itens da mesa em tempo real.'
              : 'O celular do Host precisa estar com a mesa aberta para sincronizar os dados.'}
          </p>
        </div>
        {showQrModal && (
          <QrModal roomId={roomId} title="Mesa RachaAí" onClose={() => setShowQrModal(false)} />
        )}
      </div>
    );
  }

  // 4. Sessão ativa
  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <Header
        title={state.title}
        roomId={state.roomId}
        isHost={isHost}
        connectionState={connectionState}
        hostOnline={hostOnline}
        guestCount={guestCount}
        hasApiKey={Boolean(byokConfig?.apiKey)}
        onOpenQr={() => setShowQrModal(true)}
        onOpenApiKey={() => setShowApiKeyModal(true)}
        onLeave={handleLeaveRoom}
      />

      <main className="mx-auto max-w-2xl space-y-3.5 px-3 py-4 sm:px-4">
        {lastError && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
            <span>{lastError}</span>
            <button
              type="button"
              onClick={clearError}
              className="shrink-0 font-bold text-amber-300 hover:underline"
            >
              OK
            </button>
          </div>
        )}

        {activeTab === 'items' ? (
          <>
            {isHost && (
              <ReceiptScanner
                byokConfig={byokConfig}
                onOpenApiKey={() => setShowApiKeyModal(true)}
                onImportItems={(items, serviceFeePercent, discountCents) =>
                  dispatch({
                    type: 'ADD_ITEMS_BATCH',
                    items,
                    serviceFeePercent,
                    discountCents,
                  })
                }
                onAddManualItem={(name, quantity, totalCents) =>
                  dispatch({ type: 'ADD_ITEM', name, quantity, totalCents })
                }
              />
            )}

            <ParticipantsBar
              participants={state.participants}
              activeParticipantId={activeParticipantId}
              myParticipantId={identity.clientId}
              isHost={isHost}
              onSelectActive={setActiveParticipantId}
              onAddManual={(name) => dispatch({ type: 'ADD_MANUAL_PARTICIPANT', name })}
              onRemoveParticipant={(participantId) =>
                dispatch({ type: 'REMOVE_PARTICIPANT', participantId })
              }
            />

            {state.items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
                <ReceiptText className="mx-auto h-10 w-10 text-zinc-600" />
                <h2 className="mt-3 text-base font-bold text-zinc-200">Nenhum item na mesa ainda</h2>
                <p className="mt-1 text-xs text-zinc-400">
                  {isHost
                    ? 'Tire uma foto da nota fiscal acima ou adicione itens manualmente.'
                    : 'Aguarde o Host fotografar a nota fiscal ou adicionar os itens.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {state.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    participants={state.participants}
                    activeParticipantId={activeParticipantId}
                    myParticipantId={identity.clientId}
                    isHost={isHost}
                    onToggleClaim={(itemId, participantId) =>
                      dispatch({ type: 'TOGGLE_CLAIM', itemId, participantId })
                    }
                    onSetShares={(itemId, participantId, shares) =>
                      dispatch({ type: 'SET_CLAIM_SHARES', itemId, participantId, shares })
                    }
                    onUpdateItem={(itemId, name, quantity, totalCents) =>
                      dispatch({ type: 'UPDATE_ITEM', itemId, name, quantity, totalCents })
                    }
                    onRemoveItem={(itemId) => dispatch({ type: 'REMOVE_ITEM', itemId })}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <SummaryView
            state={state}
            myParticipantId={identity.clientId}
            isHost={isHost}
            onSetPaidBy={(participantId, paidById) =>
              dispatch({ type: 'SET_PAID_BY', participantId, paidById })
            }
            onSplitUnclaimed={() => dispatch({ type: 'SPLIT_UNCLAIMED_EQUALLY' })}
            onUpdateSettings={(patch) => dispatch({ type: 'UPDATE_SETTINGS', ...patch })}
          />
        )}
      </main>

      {/* Navegação inferior fixa (mobile-first) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
              activeTab === 'items'
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <ReceiptText className="h-4 w-4" />
            Itens ({state.items.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
              activeTab === 'summary'
                ? 'bg-emerald-500 text-zinc-950'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <HandCoins className="h-4 w-4" />
            Resumo · {formatCurrency(myTotalCents)}
          </button>
        </div>
      </nav>

      {showQrModal && (
        <QrModal roomId={state.roomId} title={state.title} onClose={() => setShowQrModal(false)} />
      )}

      {showApiKeyModal && (
        <ApiKeyModal
          currentConfig={byokConfig}
          onSave={handleSaveByok}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
    </div>
  );
}
