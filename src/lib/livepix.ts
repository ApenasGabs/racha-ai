export const DEFAULT_LIVEPIX_USERNAME = 'apenasgabs';

export const PRESET_DONATION_AMOUNTS = [5, 10, 25, 50, 100] as const;

export interface LivePixDonationOptions {
  username?: string;
  amount?: number;
  message?: string;
}

export function isSafeLivePixUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'livepix.gg' || parsed.hostname.endsWith('.livepix.gg'))
    );
  } catch {
    return false;
  }
}

export function buildLivePixDonationUrl(options?: LivePixDonationOptions): string {
  const username = (options?.username?.trim() || DEFAULT_LIVEPIX_USERNAME).replace(/^@/, '');
  const url = new URL(`https://livepix.gg/${encodeURIComponent(username)}`);

  if (options?.amount && options.amount > 0) {
    url.searchParams.set('amount', String(Math.round(options.amount)));
  }

  if (options?.message && options.message.trim()) {
    url.searchParams.set('message', options.message.trim());
  }

  const finalUrl = url.toString();
  if (!isSafeLivePixUrl(finalUrl)) {
    throw new Error('URL de doação inválida.');
  }
  return finalUrl;
}
