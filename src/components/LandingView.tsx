import { useState } from 'react';
import { ArrowRight, HelpCircle, KeyRound, Plus, QrCode, Receipt, ShieldCheck, Trash2 } from 'lucide-react';
import type { StoredHostSession } from '../lib/storage';
import { computeBillSummary, formatCurrency } from '../lib/calculations';

interface LandingViewProps {
  defaultName: string;
  savedSessions: StoredHostSession[];
  hasApiKey: boolean;
  onCreateSession: (title: string, hostName: string) => void;
  onJoinSession: (roomId: string, guestName: string) => void;
  onResumeSession: (roomId: string) => void;
  onDeleteSession: (roomId: string) => void;
  onOpenApiKey: () => void;
  onStartTour: () => void;
}

export function LandingView({
  defaultName,
  savedSessions,
  hasApiKey,
  onCreateSession,
  onJoinSession,
  onResumeSession,
  onDeleteSession,
  onOpenApiKey,
  onStartTour,
}: LandingViewProps) {
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState(defaultName);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState(defaultName);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) return;
    onCreateSession(title.trim() || 'Mesa de Hoje', hostName.trim());
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code || !joinName.trim()) return;
    onJoinSession(code, joinName.trim());
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-md space-y-6">
        {/* Hero */}
        <header className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Receipt className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">RachaAí</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Tire foto da nota, compartilhe o QR Code e cada um escolhe o que consumiu em tempo real.
          </p>
          <button
            type="button"
            onClick={onStartTour}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-emerald-500/40 hover:text-white"
          >
            <HelpCircle className="h-3.5 w-3.5 text-emerald-400" />
            Como funciona? (Tour rápido)
          </button>
        </header>

        {/* Criar nova mesa */}
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Abrir nova mesa</h2>
            <button
              type="button"
              data-tour="byok-btn"
              onClick={onOpenApiKey}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                hasApiKey
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}
            >
              <KeyRound className="h-3 w-3" />
              {hasApiKey ? 'Chave IA OK' : 'Configurar BYOK'}
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label htmlFor="mesa-title" className="mb-1 block text-xs font-medium text-zinc-400">
                Nome do lugar ou mesa
              </label>
              <input
                id="mesa-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Bar do Zé, Pizzaria Sexta"
                maxLength={48}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="host-name" className="mb-1 block text-xs font-medium text-zinc-400">
                Seu nome
              </label>
              <input
                id="host-name"
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Ex: Gabs"
                required
                maxLength={32}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              data-tour="create-room"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Criar Mesa e Gerar QR Code
            </button>
          </form>
        </section>

        {/* Entrar em mesa existente */}
        <section data-tour="join-room" className="rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-200">
            <QrCode className="h-4 w-4 text-emerald-400" />
            Entrar com código da mesa
          </h2>
          <form onSubmit={handleJoin} className="grid grid-cols-12 gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="MESA-XXXX"
              required
              className="col-span-5 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs font-bold uppercase text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Seu nome"
              required
              maxLength={32}
              className="col-span-5 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Entrar na mesa"
              className="col-span-2 flex items-center justify-center rounded-xl bg-zinc-800 text-white transition hover:bg-zinc-700 active:scale-95"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </section>

        {/* Mesas salvas no dispositivo */}
        {savedSessions.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Suas mesas salvas neste dispositivo
            </h2>
            {savedSessions.map((session) => {
              const summary = computeBillSummary(session.state);
              return (
                <div
                  key={session.roomId}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5"
                >
                  <button
                    type="button"
                    onClick={() => onResumeSession(session.roomId)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-bold text-white">{session.state.title}</p>
                    <p className="text-xs text-zinc-400">
                      <span className="font-mono text-emerald-400">{session.roomId}</span> ·{' '}
                      {session.state.items.length} itens · {formatCurrency(summary.grandTotalCents)}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.roomId)}
                    aria-label={`Excluir mesa ${session.state.title}`}
                    className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </section>
        )}

        <footer className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/80" />
          <span>Privacidade total: dados ficam só no Host, relay efêmero via WebSocket.</span>
        </footer>
      </div>
    </div>
  );
}
