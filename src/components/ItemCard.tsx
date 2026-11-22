import { useState } from 'react';
import { Check, Minus, Pencil, Plus, Trash2, Users } from 'lucide-react';
import type { BillItem, Participant } from '../types/session';
import { formatCurrency, parseCurrencyToCents } from '../lib/calculations';

interface ItemCardProps {
  item: BillItem;
  participants: Participant[];
  activeParticipantId: string;
  myParticipantId: string;
  isHost: boolean;
  onToggleClaim: (itemId: string, participantId: string) => void;
  onSetShares: (itemId: string, participantId: string, shares: number) => void;
  onUpdateItem: (itemId: string, name: string, quantity: number, totalCents: number) => void;
  onRemoveItem: (itemId: string) => void;
}

export function ItemCard({
  item,
  participants,
  activeParticipantId,
  myParticipantId,
  isHost,
  onToggleClaim,
  onSetShares,
  onUpdateItem,
  onRemoveItem,
}: ItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(String(item.quantity));
  const [editPrice, setEditPrice] = useState((item.totalCents / 100).toFixed(2).replace('.', ','));

  const activeShares = item.claims[activeParticipantId] ?? 0;
  const isClaimedByActive = activeShares > 0;
  const activePerson = participants.find((p) => p.id === activeParticipantId);

  const claimEntries = participants
    .map((p) => ({ participant: p, shares: item.claims[p.id] ?? 0 }))
    .filter((entry) => entry.shares > 0);

  const totalShares = claimEntries.reduce((acc, e) => acc + e.shares, 0);
  const perShareCents = totalShares > 0 ? Math.round(item.totalCents / totalShares) : item.totalCents;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseCurrencyToCents(editPrice);
    const qty = Math.max(1, Number.parseInt(editQty, 10) || 1);
    if (!editName.trim() || cents <= 0) return;
    onUpdateItem(item.id, editName.trim(), qty, cents);
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={handleSaveEdit}
        className="rounded-2xl border border-emerald-500/40 bg-zinc-900 p-3.5 space-y-2.5"
      >
        <div className="grid grid-cols-12 gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            className="col-span-12 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none sm:col-span-6"
          />
          <input
            type="number"
            min={1}
            max={99}
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            className="col-span-4 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none sm:col-span-2"
          />
          <input
            type="text"
            inputMode="decimal"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
            required
            className="col-span-8 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none sm:col-span-4"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
          >
            Salvar
          </button>
        </div>
      </form>
    );
  }

  return (
    <article
      className={`rounded-2xl border p-3.5 transition ${
        isClaimedByActive
          ? 'border-emerald-500/50 bg-emerald-950/20'
          : claimEntries.length === 0
            ? 'border-amber-500/30 bg-zinc-900/70'
            : 'border-zinc-800 bg-zinc-900/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Info do item */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {item.quantity > 1 && (
              <span className="shrink-0 rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-zinc-300">
                {item.quantity}x
              </span>
            )}
            <h3 className="truncate text-sm font-semibold text-white sm:text-base">{item.name}</h3>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
            <span className="font-mono font-bold text-zinc-100">{formatCurrency(item.totalCents)}</span>
            {claimEntries.length > 0 ? (
              <span className="text-zinc-400">
                {formatCurrency(perShareCents)} / cota
              </span>
            ) : (
              <span className="text-amber-400/90">Ninguém entrou ainda</span>
            )}
          </div>
        </div>

        {/* Botão principal de entrar / cotas */}
        <div className="flex shrink-0 items-center gap-1.5">
          {isClaimedByActive && (
            <div className="flex items-center rounded-xl border border-emerald-500/30 bg-zinc-950/90">
              <button
                type="button"
                onClick={() => onSetShares(item.id, activeParticipantId, activeShares - 1)}
                aria-label="Diminuir cota"
                className="flex h-8 w-7 items-center justify-center text-zinc-300 transition hover:text-white"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[20px] text-center font-mono text-xs font-bold text-emerald-300">
                {activeShares}
              </span>
              <button
                type="button"
                onClick={() => onSetShares(item.id, activeParticipantId, activeShares + 1)}
                aria-label="Aumentar cota"
                className="flex h-8 w-7 items-center justify-center text-zinc-300 transition hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => onToggleClaim(item.id, activeParticipantId)}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition active:scale-95 ${
              isClaimedByActive
                ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                : 'border border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-emerald-500/50 hover:text-white'
            }`}
          >
            {isClaimedByActive ? (
              <>
                <Check className="h-3.5 w-3.5" />
                {activeParticipantId === myParticipantId ? 'Tô dentro' : activePerson?.name.split(' ')[0]}
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                {activeParticipantId === myParticipantId ? 'Entrar' : activePerson?.name.split(' ')[0]}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rodapé do item: quem entrou + botão atribuir para outras pessoas + ações Host */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/70 pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {claimEntries.map(({ participant, shares }) => (
            <button
              key={participant.id}
              type="button"
              onClick={() => onToggleClaim(item.id, participant.id)}
              title={`Clique para remover ${participant.name} deste item`}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-800/90 pl-1 pr-2 py-0.5 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-700"
            >
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-zinc-950"
                style={{ backgroundColor: participant.color }}
              >
                {participant.name.slice(0, 1).toUpperCase()}
              </span>
              <span>{participant.name}</span>
              {shares > 1 && <span className="font-mono text-[10px] text-emerald-400">×{shares}</span>}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
          >
            <Users className="h-3 w-3" />
            Marcar pessoas
          </button>
        </div>

        {isHost && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditName(item.name);
                setEditQty(String(item.quantity));
                setEditPrice((item.totalCents / 100).toFixed(2).replace('.', ','));
                setEditing(true);
              }}
              aria-label={`Editar ${item.name}`}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onRemoveItem(item.id)}
              aria-label={`Remover ${item.name}`}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Picker rápido para marcar/desmarcar qualquer participante (ideal para manuais) */}
      {showPicker && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 rounded-xl bg-zinc-950/80 p-2.5">
          {participants.map((p) => {
            const checked = (item.claims[p.id] ?? 0) > 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggleClaim(item.id, p.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  checked
                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
                {checked && <Check className="h-3 w-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
