import { describe, expect, it } from 'vitest';
import { buildLivePixDonationUrl, isSafeLivePixUrl } from './livepix';

describe('livepix', () => {
  it('aceita apenas URLs HTTPS oficiais do domínio livepix.gg', () => {
    expect(isSafeLivePixUrl('https://livepix.gg/apenasgabs')).toBe(true);
    expect(isSafeLivePixUrl('https://pay.livepix.gg/apenasgabs')).toBe(true);
    expect(isSafeLivePixUrl('http://livepix.gg/apenasgabs')).toBe(false);
    expect(isSafeLivePixUrl('https://evil-livepix.gg/apenasgabs')).toBe(false);
    expect(isSafeLivePixUrl('javascript:alert(1)')).toBe(false);
  });

  it('constrói URL de apoio com username padrão, valor e mensagem opcional', () => {
    const url = buildLivePixDonationUrl({ amount: 25, message: 'Valeu pelo RachaAí!' });
    expect(url).toContain('https://livepix.gg/apenasgabs');
    expect(url).toContain('amount=25');
    expect(url).toContain('message=Valeu+pelo+RachaA');
  });
});
