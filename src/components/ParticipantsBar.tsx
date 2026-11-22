import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { Participant } from '../types/session';

interface ParticipantsBarProps {
  participants: Participant[];
  activeParticipantId: string;
  myParticipantId: string;
  isHost: boolean;
  onSelectActive: (id: string) => void;
  onAddManual: (name: string) => void;
  onRemoveParticipant: (id: string) => void;
}

export function ParticipantsBar({
  participants,
  activeParticipantId,
  myParticipantId,
  isHost,
  onSelectActive,
  onAddManual,
  onRemoveParticipant,
}: ParticipantsBarProps) {
  const [adding, setAdding] = useState(false);
  const [manualName, setManualName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualName.trim();
    if (!trimmed) return;
    onAddManual(trimmed);
    setManualName('');
    setAdding(false);
  };

  const activePerson = participants.find((p) => p.id === activeParticipantId);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-400">
          Marcando itens para:{' '}
          <strong className="text-white">
            {activePerson?.id === myParticipantId
              ? `${activePerson.name} (Você)`
              : activePerson?.name ?? '—'}
          </strong>
        </span>

        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-zinc-700 active:scale-95"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Pessoa manual
        </button>
      </div>

      {/* Lista de participantes clicável */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {participants.map((p) => {
          const isSelected = p.id === activeParticipantId;
          const isMe = p.id === myParticipantId;
          return (
            <div
              key={p.id}
              className={`group flex shrink-0 items-center gap-1.5 rounded-full border pl-1.5 pr-2.5 py-1 text-xs font-medium transition ${
                isSelected
                  ? 'border-emerald-400 bg-emerald-500/15 text-white shadow-sm shadow-emerald-500/10'
                  : 'border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectActive(p.id)}
                className="flex items-center gap-1.5"
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-zinc-950"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  {p.name}
                  {isMe ? ' (Você)' : ''}
                </span>
                {p.isManual && (
                  <span className="rounded bg-zinc-800 px-1 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400">
                    manual
                  </span>
                )}
              </button>

              {isHost && !p.isHost && (
                <button
                  type="button"
                  onClick={() => onRemoveParticipant(p.id)}
                  aria-label={`Remover ${p.name}`}
                  className="ml-0.5 rounded-full p-0.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-rose-400"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-2.5 flex items-center gap-2 border-t border-zinc-800 pt-2.5">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Nome de quem não entrou no app..."
            autoFocus
            maxLength={32}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
          >
            Incluir
          </button>
        </form>
      )}
    </section>
  );
}
