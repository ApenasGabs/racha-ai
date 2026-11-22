import { describe, expect, it } from 'vitest';
import {
  computeBillSummary,
  distributeCents,
  parseCurrencyToCents,
  resolveEffectivePayerId,
} from './calculations';
import type { Participant, SessionState } from '../types/session';

function makeParticipant(overrides: Partial<Participant> & { id: string; name: string }): Participant {
  return {
    color: '#10b981',
    isHost: false,
    isManual: false,
    paidById: null,
    joinedAt: 1000,
    ...overrides,
  };
}

describe('parseCurrencyToCents', () => {
  it('converte valores pt-BR e decimais com precisão', () => {
    expect(parseCurrencyToCents('R$ 24,90')).toBe(2490);
    expect(parseCurrencyToCents('1.234,56')).toBe(123456);
    expect(parseCurrencyToCents('18.5')).toBe(1850);
    expect(parseCurrencyToCents('')).toBe(0);
  });
});

describe('distributeCents', () => {
  it('divide R$ 10,00 entre 3 pessoas sem perder nenhum centavo', () => {
    const res = distributeCents(1000, [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 1 },
    ]);
    expect(res.a + res.b + res.c).toBe(1000);
    expect(res.a).toBe(334);
    expect(res.b).toBe(333);
    expect(res.c).toBe(333);
  });

  it('respeita cotas diferentes proporcionalmente', () => {
    const res = distributeCents(3600, [
      { id: 'a', weight: 2 },
      { id: 'b', weight: 1 },
    ]);
    expect(res.a).toBe(2400);
    expect(res.b).toBe(1200);
  });
});

describe('computeBillSummary', () => {
  it('calcula divisão com taxa de serviço, participante manual e pagar por mais de uma pessoa', () => {
    const gabs = makeParticipant({ id: 'gabs', name: 'Gabs', isHost: true });
    const maria = makeParticipant({ id: 'maria', name: 'Maria', isManual: true, paidById: 'gabs' });
    const joao = makeParticipant({ id: 'joao', name: 'João' });

    const state: SessionState = {
      roomId: 'MESA-1234',
      title: 'Bar do Zé',
      serviceFeePercent: 10,
      discountCents: 0,
      coverChargeCents: 0,
      participants: [gabs, maria, joao],
      items: [
        {
          id: 'item-1',
          name: 'Porção de Fritas',
          quantity: 1,
          totalCents: 3000, // R$ 30,00 dividido por 3 = R$ 10,00 cada
          claims: { gabs: 1, maria: 1, joao: 1 },
          createdAt: 1000,
        },
        {
          id: 'item-2',
          name: 'Chopp 300ml',
          quantity: 3,
          totalCents: 3600, // R$ 36,00 -> Gabs 2 cotas (24,00), João 1 cota (12,00)
          claims: { gabs: 2, joao: 1 },
          createdAt: 1001,
        },
        {
          id: 'item-3',
          name: 'Suco de Laranja',
          quantity: 1,
          totalCents: 1400, // R$ 14,00 só Maria
          claims: { maria: 1 },
          createdAt: 1002,
        },
      ],
      updatedAt: 2000,
      version: 1,
    };

    const summary = computeBillSummary(state);

    // Total dos itens: 30 + 36 + 14 = R$ 80,00 (8000 centavos)
    // 10% = R$ 8,00 (800 centavos) -> Grand total = R$ 88,00 (8800 centavos)
    expect(summary.itemsTotalCents).toBe(8000);
    expect(summary.serviceFeeCents).toBe(800);
    expect(summary.grandTotalCents).toBe(8800);
    expect(summary.unclaimedItems).toHaveLength(0);

    // Subtotais individuais:
    // Gabs: 1000 + 2400 = 3400 (+10% = 340 -> 3740)
    // Maria: 1000 + 1400 = 2400 (+10% = 240 -> 2640)
    // João: 1000 + 1200 = 2200 (+10% = 220 -> 2420)
    // Como Gabs paga por Maria: grupo Gabs = 3740 + 2640 = 6380; grupo João = 2420
    expect(summary.payerGroups).toHaveLength(2);

    const gabsGroup = summary.payerGroups.find((g) => g.payer.id === 'gabs');
    const joaoGroup = summary.payerGroups.find((g) => g.payer.id === 'joao');

    expect(gabsGroup?.members).toHaveLength(2);
    expect(gabsGroup?.totalCents).toBe(6380);
    expect(joaoGroup?.members).toHaveLength(1);
    expect(joaoGroup?.totalCents).toBe(2420);
    expect((gabsGroup?.totalCents ?? 0) + (joaoGroup?.totalCents ?? 0)).toBe(8800);
  });

  it('protege contra ciclo no paidById e identifica itens sem dono', () => {
    const a = makeParticipant({ id: 'a', name: 'Ana', paidById: 'b' });
    const b = makeParticipant({ id: 'b', name: 'Beto', paidById: 'a' });
    const map = new Map([
      ['a', a],
      ['b', b],
    ]);

    expect(resolveEffectivePayerId('a', map)).toBe('b');

    const state: SessionState = {
      roomId: 'TEST-1',
      title: 'Teste',
      serviceFeePercent: 10,
      discountCents: 0,
      coverChargeCents: 0,
      participants: [a, b],
      items: [
        {
          id: 'i1',
          name: 'Água sem dono',
          quantity: 1,
          totalCents: 600,
          claims: {},
          createdAt: 1000,
        },
      ],
      updatedAt: 1000,
      version: 1,
    };

    const summary = computeBillSummary(state);
    expect(summary.unclaimedItems).toHaveLength(1);
    expect(summary.unclaimedItemsCents).toBe(600);
  });

  it('divide 1 frango em 5 partes sem precisar cadastrar 5 pessoas', () => {
    const gabs = makeParticipant({ id: 'gabs', name: 'Gabs', isHost: true });
    const state: SessionState = {
      roomId: 'FRANGO-5',
      title: 'Frango na Mesa',
      serviceFeePercent: 10,
      discountCents: 0,
      coverChargeCents: 0,
      participants: [gabs],
      items: [
        {
          id: 'frango',
          name: 'Frango à Passarinho',
          quantity: 1,
          totalCents: 7500, // R$ 75,00 dividido em 5 = R$ 15,00 por parte
          splitTotalShares: 5,
          claims: { gabs: 1 },
          createdAt: 1000,
        },
      ],
      updatedAt: 1000,
      version: 1,
    };

    const summary = computeBillSummary(state);
    const gabsBreakdown = summary.byParticipant.find((b) => b.participant.id === 'gabs');

    expect(gabsBreakdown?.itemsSubtotalCents).toBe(1500); // 1/5 de R$ 75,00
    expect(gabsBreakdown?.serviceFeeCents).toBe(150); // 10% sobre R$ 15,00
    expect(gabsBreakdown?.totalCents).toBe(1650); // R$ 16,50
    expect(gabsBreakdown?.lines[0]?.shares).toBe(1);
    expect(gabsBreakdown?.lines[0]?.totalShares).toBe(5);
    expect(summary.claimedItemsCents).toBe(1500);
    expect(summary.unclaimedItemsCents).toBe(6000); // 4/5 restantes = R$ 60,00
  });
});
