import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  HandCoins,
  Split,
  Users,
} from 'lucide-react';
import type { SessionState } from '../types/session';
import { computeBillSummary, formatCurrency, parseCurrencyToCents } from '../lib/calculations';
import { buildWhatsAppSummary } from '../lib/share';

interface SummaryViewProps {
  state: SessionState;
  myParticipantId: string;
  isHost: boolean;
  onSetPaidBy: (participantId: string, paidById: string | null) => void;
  onSplitUnclaimed: () => void;
  onUpdateSettings: (patch: {
    serviceFeePercent?: number;
    coverChargeCents?: number;
    discountCents?: number;
  }) => void;
}

export function SummaryView({
  state,
  myParticipantId,
  isHost,
  onSetPaidBy,
  onSplitUnclaimed,
  onUpdateSettings,
}: SummaryViewProps) {
  const [copied, setCopied] = useState(false);
  const [expandedPayerId, setExpandedPayerId] = useState<string | null>(myParticipantId);
  const [managingPayerId, setManagingPayerId] = useState<string | null>(null);

  const summary = computeBillSummary(state);

  const handleCopySummary = async () => {
    const text = buildWhatsAppSummary(state);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Cartão Geral da Conta */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Total da Mesa
            </p>
            <p className="mt-0.5 font-mono text-3xl font-extrabold text-white">
              {formatCurrency(summary.grandTotalCents)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-95"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Resumo WhatsApp
              </>
            )}
          </button>
        </div>

        {/* Breakdown de Taxa de Serviço / Couvert / Desconto */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
          <div className="rounded-xl bg-zinc-950/70 p-2.5">
            <label className="block text-[11px] text-zinc-400">Taxa Serviço</label>
            {isHost ? (
              <div className="mt-1 flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={state.serviceFeePercent}
                  onChange={(e) =>
                    onUpdateSettings({ serviceFeePercent: Number(e.target.value) || 0 })
                  }
                  className="w-12 rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-xs text-zinc-400">%</span>
              </div>
            ) : (
              <p className="mt-1 font-mono text-xs font-bold text-zinc-200">
                {state.serviceFeePercent}% ({formatCurrency(summary.serviceFeeCents)})
              </p>
            )}
          </div>

          <div className="rounded-xl bg-zinc-950/70 p-2.5">
            <label className="block text-[11px] text-zinc-400">Couvert/Extra</label>
            {isHost ? (
              <input
                type="text"
                inputMode="decimal"
                defaultValue={(state.coverChargeCents / 100).toFixed(2).replace('.', ',')}
                onBlur={(e) =>
                  onUpdateSettings({ coverChargeCents: parseCurrencyToCents(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
              />
            ) : (
              <p className="mt-1 font-mono text-xs font-bold text-zinc-200">
                {formatCurrency(summary.coverChargeCents)}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-zinc-950/70 p-2.5">
            <label className="block text-[11px] text-zinc-400">Desconto</label>
            {isHost ? (
              <input
                type="text"
                inputMode="decimal"
                defaultValue={(state.discountCents / 100).toFixed(2).replace('.', ',')}
                onBlur={(e) =>
                  onUpdateSettings({ discountCents: parseCurrencyToCents(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-xs font-bold text-emerald-300 focus:border-emerald-500 focus:outline-none"
              />
            ) : (
              <p className="mt-1 font-mono text-xs font-bold text-emerald-300">
                -{formatCurrency(summary.discountCents)}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Alerta de itens sem ninguém */}
      {summary.unclaimedItems.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-bold text-amber-200">
                {summary.unclaimedItems.length}{' '}
                {summary.unclaimedItems.length === 1 ? 'item sem ninguém' : 'itens sem ninguém'} (
                {formatCurrency(summary.unclaimedItemsCents)})
              </p>
              <p className="text-xs text-amber-200/80">
                Faltam marcar estes itens para a soma bater 100% com a conta.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSplitUnclaimed}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-300 active:scale-95"
          >
            <Split className="h-3.5 w-3.5" />
            Dividir entre todos
          </button>
        </section>
      )}

      {/* Lista de Pagadores (com suporte a pagar por mais de uma pessoa) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-white">
            <HandCoins className="h-4 w-4 text-emerald-400" />
            Fechamento por Pagador ({summary.payerGroups.length})
          </h2>
          <span className="text-[11px] text-zinc-400">
            Você pode assumir a parte de outras pessoas
          </span>
        </div>

        {summary.payerGroups.map((group) => {
          const isExpanded = expandedPayerId === group.payer.id;
          const isManaging = managingPayerId === group.payer.id;
          const isMe = group.payer.id === myParticipantId;
          const coveredOthers = group.members.filter((m) => m.participant.id !== group.payer.id);

          // Quem este pagador pode escolher para pagar junto (qualquer pessoa exceto ele mesmo)
          const selectableOthers = state.participants.filter((p) => p.id !== group.payer.id);

          return (
            <div
              key={group.payer.id}
              className={`rounded-2xl border p-4 transition ${
                isMe
                  ? 'border-emerald-500/50 bg-emerald-950/20'
                  : 'border-zinc-800 bg-zinc-900/70'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedPayerId(isExpanded ? null : group.payer.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-zinc-950"
                    style={{ backgroundColor: group.payer.color }}
                  >
                    {group.payer.name.slice(0, 1).toUpperCase()}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-base font-bold text-white">
                        {group.payer.name}
                      </span>
                      {isMe && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          VOCÊ
                        </span>
                      )}
                    </div>
                    {coveredOthers.length > 0 ? (
                      <p className="truncate text-xs text-emerald-300">
                        Paga também por: {coveredOthers.map((m) => m.participant.name).join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-400">
                        {group.members[0]?.lines.length ?? 0}{' '}
                        {(group.members[0]?.lines.length ?? 0) === 1 ? 'item' : 'itens'}
                      </p>
                    )}
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="font-mono text-lg font-extrabold text-white">
                      {formatCurrency(group.totalCents)}
                    </p>
                    {group.serviceFeeCents > 0 && (
                      <p className="text-[10px] text-zinc-400">
                        incl. {formatCurrency(group.serviceFeeCents)} taxa
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedPayerId(isExpanded ? null : group.payer.id)}
                    aria-label="Ver detalhes"
                    className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Botão rápido para pagar por mais de uma pessoa */}
              {selectableOthers.length > 0 && (
                <div className="mt-3 flex items-center justify-between border-t border-zinc-800/70 pt-2.5">
                  <button
                    type="button"
                    onClick={() => setManagingPayerId(isManaging ? null : group.payer.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-emerald-500/50 hover:text-white"
                  >
                    <Users className="h-3.5 w-3.5 text-emerald-400" />
                    {coveredOthers.length > 0
                      ? 'Editar quem este pagador cobre'
                      : 'Pagar por mais alguém'}
                  </button>
                </div>
              )}

              {/* Seletor de pessoas cobertas por este pagador */}
              {isManaging && (
                <div className="mt-2.5 rounded-xl border border-zinc-800 bg-zinc-950/90 p-3">
                  <p className="mb-2 text-xs font-medium text-zinc-300">
                    Selecione quem <strong>{group.payer.name}</strong> vai pagar junto:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectableOthers.map((other) => {
                      const isCoveredByThisPayer = other.paidById === group.payer.id;
                      return (
                        <button
                          key={other.id}
                          type="button"
                          onClick={() =>
                            onSetPaidBy(other.id, isCoveredByThisPayer ? null : group.payer.id)
                          }
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                            isCoveredByThisPayer
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: other.color }}
                          />
                          {other.name}
                          {other.isManual && <span className="text-[10px] opacity-70">(manual)</span>}
                          {isCoveredByThisPayer && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detalhamento de itens por pessoa dentro do grupo pagador */}
              {isExpanded && (
                <div className="mt-3 space-y-3 border-t border-zinc-800/70 pt-3">
                  {group.members.map((member) => (
                    <div key={member.participant.id} className="rounded-xl bg-zinc-950/70 p-3">
                      <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                        <span className="text-zinc-200">
                          {member.participant.name}
                          {member.participant.isManual ? ' (manual)' : ''}
                        </span>
                        <span className="font-mono text-emerald-300">
                          {formatCurrency(member.totalCents)}
                        </span>
                      </div>

                      {member.lines.length === 0 ? (
                        <p className="text-[11px] text-zinc-500">Nenhum item marcado</p>
                      ) : (
                        <ul className="space-y-1 text-xs text-zinc-400">
                          {member.lines.map((line) => (
                            <li key={line.itemId} className="flex items-center justify-between gap-2">
                              <span className="truncate">
                                {line.itemName}
                                {line.totalShares > 1 && (
                                  <span className="ml-1 text-[10px] text-zinc-500">
                                    ({line.shares}/{line.totalShares})
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 font-mono text-zinc-300">
                                {formatCurrency(line.amountCents)}
                              </span>
                            </li>
                          ))}
                          {member.serviceFeeCents > 0 && (
                            <li className="flex items-center justify-between text-[11px] text-zinc-500">
                              <span>Taxa de serviço ({state.serviceFeePercent}%)</span>
                              <span className="font-mono">{formatCurrency(member.serviceFeeCents)}</span>
                            </li>
                          )}
                          {member.coverChargeCents > 0 && (
                            <li className="flex items-center justify-between text-[11px] text-zinc-500">
                              <span>Couvert/Extras</span>
                              <span className="font-mono">{formatCurrency(member.coverChargeCents)}</span>
                            </li>
                          )}
                          {member.discountCents > 0 && (
                            <li className="flex items-center justify-between text-[11px] text-emerald-400/80">
                              <span>Desconto</span>
                              <span className="font-mono">-{formatCurrency(member.discountCents)}</span>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
