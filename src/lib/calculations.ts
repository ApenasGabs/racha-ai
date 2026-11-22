import type { BillItem, Participant, SessionState } from '../types/session';

export interface ParticipantItemLine {
  itemId: string;
  itemName: string;
  shares: number;
  totalShares: number;
  amountCents: number;
}

export interface ParticipantBreakdown {
  participant: Participant;
  itemsSubtotalCents: number;
  serviceFeeCents: number;
  coverChargeCents: number;
  discountCents: number;
  totalCents: number;
  lines: ParticipantItemLine[];
}

export interface PayerGroup {
  payer: Participant;
  members: ParticipantBreakdown[];
  itemsSubtotalCents: number;
  serviceFeeCents: number;
  coverChargeCents: number;
  discountCents: number;
  totalCents: number;
}

export interface BillSummary {
  itemsTotalCents: number;
  claimedItemsCents: number;
  unclaimedItemsCents: number;
  unclaimedItems: BillItem[];
  serviceFeeCents: number;
  coverChargeCents: number;
  discountCents: number;
  grandTotalCents: number;
  byParticipant: ParticipantBreakdown[];
  payerGroups: PayerGroup[];
}

export function formatCurrency(cents: number): string {
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function parseCurrencyToCents(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;

  // Se houver vírgula, assume formato pt-BR (ex: 1.234,56 -> 1234.56)
  let normalized = cleaned;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Distribui um valor inteiro em centavos proporcionalmente aos pesos informados
 * usando o método do Maior Resto (Hamilton) para garantir soma exata ao centavo.
 */
export function distributeCents(
  totalCents: number,
  entries: Array<{ id: string; weight: number }>
): Record<string, number> {
  const valid = entries.filter((e) => e.weight > 0);
  if (totalCents === 0 || valid.length === 0) {
    return Object.fromEntries(entries.map((e) => [e.id, 0]));
  }

  const sign = totalCents < 0 ? -1 : 1;
  const absTotal = Math.abs(Math.round(totalCents));
  const totalWeight = valid.reduce((acc, e) => acc + e.weight, 0);

  const rawShares = valid.map((e, idx) => {
    const exact = (absTotal * e.weight) / totalWeight;
    const floored = Math.floor(exact);
    return {
      id: e.id,
      idx,
      floored,
      remainder: exact - floored,
    };
  });

  const allocated = rawShares.reduce((acc, s) => acc + s.floored, 0);
  let remaining = absTotal - allocated;

  const sortedByRemainder = [...rawShares].sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-12) {
      return b.remainder - a.remainder;
    }
    return a.idx - b.idx;
  });

  const result: Record<string, number> = Object.fromEntries(entries.map((e) => [e.id, 0]));
  for (const s of rawShares) {
    result[s.id] = s.floored;
  }
  for (let i = 0; i < remaining && i < sortedByRemainder.length; i++) {
    result[sortedByRemainder[i].id] += 1;
  }

  if (sign < 0) {
    for (const key of Object.keys(result)) {
      result[key] = -result[key];
    }
  }

  return result;
}

/**
 * Resolve quem efetivamente paga por um participante, protegendo contra ciclos
 * (ex: A -> B -> A) ou referências a participantes removidos.
 */
export function resolveEffectivePayerId(
  participantId: string,
  participantMap: Map<string, Participant>
): string {
  const visited = new Set<string>();
  let currentId = participantId;

  while (true) {
    visited.add(currentId);
    const current = participantMap.get(currentId);
    if (!current || !current.paidById) {
      return currentId;
    }
    const nextId = current.paidById;
    if (!participantMap.has(nextId) || visited.has(nextId)) {
      return currentId;
    }
    currentId = nextId;
  }
}

export function computeBillSummary(state: SessionState): BillSummary {
  const participantMap = new Map(state.participants.map((p) => [p.id, p]));
  const linesByParticipant = new Map<string, ParticipantItemLine[]>();
  const subtotalByParticipant = new Map<string, number>();

  for (const p of state.participants) {
    linesByParticipant.set(p.id, []);
    subtotalByParticipant.set(p.id, 0);
  }

  let itemsTotalCents = 0;
  let claimedItemsCents = 0;
  const unclaimedItems: BillItem[] = [];

  for (const item of state.items) {
    itemsTotalCents += item.totalCents;

    const validClaims = Object.entries(item.claims)
      .filter(([pid, shares]) => shares > 0 && participantMap.has(pid))
      .map(([pid, shares]) => ({ id: pid, weight: shares }));

    if (validClaims.length === 0) {
      unclaimedItems.push(item);
      continue;
    }

    claimedItemsCents += item.totalCents;
    const totalShares = validClaims.reduce((acc, c) => acc + c.weight, 0);
    const split = distributeCents(item.totalCents, validClaims);

    for (const claim of validClaims) {
      const amountCents = split[claim.id] ?? 0;
      subtotalByParticipant.set(claim.id, (subtotalByParticipant.get(claim.id) ?? 0) + amountCents);
      linesByParticipant.get(claim.id)?.push({
        itemId: item.id,
        itemName: item.name,
        shares: claim.weight,
        totalShares,
        amountCents,
      });
    }
  }

  const unclaimedItemsCents = itemsTotalCents - claimedItemsCents;
  const totalServiceFeeCents = Math.round((itemsTotalCents * Math.max(0, state.serviceFeePercent)) / 100);
  const claimedServiceFeeCents = Math.round((claimedItemsCents * Math.max(0, state.serviceFeePercent)) / 100);
  const totalCoverChargeCents = Math.max(0, Math.round(state.coverChargeCents));
  const totalDiscountCents = Math.min(
    itemsTotalCents + totalServiceFeeCents + totalCoverChargeCents,
    Math.max(0, Math.round(state.discountCents))
  );

  const consumptionWeights = state.participants.map((p) => ({
    id: p.id,
    weight: subtotalByParticipant.get(p.id) ?? 0,
  }));
  const hasAnyConsumption = consumptionWeights.some((w) => w.weight > 0);
  const equalWeights = state.participants.map((p) => ({ id: p.id, weight: 1 }));

  const serviceFeeSplit = distributeCents(claimedServiceFeeCents, consumptionWeights);
  const coverSplit = distributeCents(totalCoverChargeCents, equalWeights);
  const discountSplit = distributeCents(
    totalDiscountCents,
    hasAnyConsumption ? consumptionWeights : equalWeights
  );

  const byParticipant: ParticipantBreakdown[] = state.participants.map((p) => {
    const itemsSubtotalCents = subtotalByParticipant.get(p.id) ?? 0;
    const serviceFeeCents = serviceFeeSplit[p.id] ?? 0;
    const coverChargeCents = coverSplit[p.id] ?? 0;
    const discountCents = discountSplit[p.id] ?? 0;
    const totalCents = Math.max(0, itemsSubtotalCents + serviceFeeCents + coverChargeCents - discountCents);

    return {
      participant: p,
      itemsSubtotalCents,
      serviceFeeCents,
      coverChargeCents,
      discountCents,
      totalCents,
      lines: linesByParticipant.get(p.id) ?? [],
    };
  });

  // Agrupamento de pagamentos ("pagar por mais de uma pessoa")
  const groupMap = new Map<string, PayerGroup>();
  for (const breakdown of byParticipant) {
    const payerId = resolveEffectivePayerId(breakdown.participant.id, participantMap);
    const payer = participantMap.get(payerId) ?? breakdown.participant;

    let group = groupMap.get(payer.id);
    if (!group) {
      group = {
        payer,
        members: [],
        itemsSubtotalCents: 0,
        serviceFeeCents: 0,
        coverChargeCents: 0,
        discountCents: 0,
        totalCents: 0,
      };
      groupMap.set(payer.id, group);
    }

    group.members.push(breakdown);
    group.itemsSubtotalCents += breakdown.itemsSubtotalCents;
    group.serviceFeeCents += breakdown.serviceFeeCents;
    group.coverChargeCents += breakdown.coverChargeCents;
    group.discountCents += breakdown.discountCents;
    group.totalCents += breakdown.totalCents;
  }

  // Garante que o próprio pagador apareça primeiro na lista de members do seu grupo
  const payerGroups = Array.from(groupMap.values()).map((group) => ({
    ...group,
    members: [...group.members].sort((a, b) => {
      if (a.participant.id === group.payer.id) return -1;
      if (b.participant.id === group.payer.id) return 1;
      return a.participant.name.localeCompare(b.participant.name);
    }),
  }));

  const grandTotalCents = Math.max(
    0,
    itemsTotalCents + totalServiceFeeCents + totalCoverChargeCents - totalDiscountCents
  );

  return {
    itemsTotalCents,
    claimedItemsCents,
    unclaimedItemsCents,
    unclaimedItems,
    serviceFeeCents: totalServiceFeeCents,
    coverChargeCents: totalCoverChargeCents,
    discountCents: totalDiscountCents,
    grandTotalCents,
    byParticipant,
    payerGroups,
  };
}
