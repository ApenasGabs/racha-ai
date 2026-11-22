import type { SessionState } from '../types/session';
import { computeBillSummary, formatCurrency } from './calculations';

export function buildRoomShareUrl(roomId: string): string {
  const url = new URL(window.location.href);
  url.pathname = `/sala/${encodeURIComponent(roomId.toUpperCase())}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function buildWhatsAppSummary(state: SessionState): string {
  const summary = computeBillSummary(state);
  const lines: string[] = [
    `🧾 *${state.title}* (${state.roomId})`,
    `Total da conta: *${formatCurrency(summary.grandTotalCents)}*`,
  ];

  if (state.serviceFeePercent > 0) {
    lines.push(`Taxa de serviço: ${state.serviceFeePercent}% (${formatCurrency(summary.serviceFeeCents)})`);
  }
  if (summary.coverChargeCents > 0) {
    lines.push(`Couvert/Extras: ${formatCurrency(summary.coverChargeCents)}`);
  }
  if (summary.discountCents > 0) {
    lines.push(`Desconto: -${formatCurrency(summary.discountCents)}`);
  }

  lines.push('', '👥 *Fechamento por Pagador:*');

  for (const group of summary.payerGroups) {
    if (group.members.length === 1) {
      lines.push(`• *${group.payer.name}*: ${formatCurrency(group.totalCents)}`);
    } else {
      const coveredNames = group.members.map((m) => m.participant.name).join(' + ');
      lines.push(`• *${group.payer.name}* (paga por ${coveredNames}): *${formatCurrency(group.totalCents)}*`);
      for (const m of group.members) {
        lines.push(`   ↳ ${m.participant.name}: ${formatCurrency(m.totalCents)}`);
      }
    }
  }

  if (summary.unclaimedItems.length > 0) {
    lines.push('', `⚠️ *Itens ainda sem divisão:* ${formatCurrency(summary.unclaimedItemsCents)}`);
  }

  lines.push('', `Feito no RachaAí ⚡`);
  return lines.join('\n');
}
