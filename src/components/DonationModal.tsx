import { useEffect, useState } from 'react';
import { Coffee, ExternalLink, Heart, ShieldCheck, Sparkles, X } from 'lucide-react';
import { buildLivePixDonationUrl, PRESET_DONATION_AMOUNTS } from '../lib/livepix';

interface DonationModalProps {
  onClose: () => void;
}

export const DonationModal = ({ onClose }: DonationModalProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const currentAmount = isCustom ? Number(customAmount) || 0 : selectedAmount;

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount('');
  };

  const handleCustomChange = (val: string) => {
    const raw = val.replace(/[^0-9]/g, '');
    setCustomAmount(raw);
    setIsCustom(true);
  };

  const handleDonate = () => {
    const finalAmount = currentAmount > 0 ? currentAmount : 10;
    const url = buildLivePixDonationUrl({
      amount: finalAmount,
      message: message.trim() || undefined,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donation-modal-title"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 bg-gradient-to-r from-rose-500/10 via-zinc-900 to-emerald-500/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
              <Heart className="h-5 w-5 fill-rose-500/30" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="donation-modal-title" className="text-base font-extrabold text-white">
                  Apoie o RachaAí
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" /> 100% Grátis
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                O app salvou a conta da mesa? Pague um café ou um chopp pro dev!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de apoio"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3.5 text-xs text-zinc-400">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-zinc-200">
              <Coffee className="h-4 w-4 text-amber-400" />
              <span>Por que apoiar?</span>
            </div>
            <ul className="list-inside list-disc space-y-1">
              <li>Mantém o domínio e a infraestrutura online sem anúncios nem paywalls.</li>
              <li>Incentiva novas ferramentas gratuitas e open-source feitas pela comunidade.</li>
            </ul>
          </div>

          {/* Valores sugeridos */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Escolha um valor (R$)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {PRESET_DONATION_AMOUNTS.map((amt) => {
                const isSelected = !isCustom && selectedAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelectPreset(amt)}
                    className={`rounded-xl border py-2 font-mono text-xs font-bold transition active:scale-95 ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/20'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    R${amt}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              inputMode="numeric"
              placeholder="Ou digite outro valor (ex: 15)"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              aria-label="Outro valor para doação"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Mensagem opcional */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Mensagem de incentivo (opcional)
            </label>
            <input
              type="text"
              maxLength={120}
              placeholder="Ex: Salvou o rolê de sexta! Valeu!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Selo de privacidade */}
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[11px] text-emerald-200/90">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              <strong>Privacidade total:</strong> Pix processado com segurança pela LivePix (dados bancários permanecem protegidos).
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/60 px-5 py-4">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Valor</span>
            <span className="font-mono text-lg font-extrabold text-white">
              R$ {(currentAmount > 0 ? currentAmount : 10).toFixed(2).replace('.', ',')}
            </span>
          </div>

          <button
            type="button"
            onClick={handleDonate}
            className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 active:scale-95 sm:text-sm"
          >
            <Heart className="h-4 w-4 fill-current" />
            Apoiar via LivePix
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
}
