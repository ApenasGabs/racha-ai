import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Share2, ShieldCheck, X } from 'lucide-react';
import { buildRoomShareUrl } from '../lib/share';

interface QrModalProps {
  roomId: string;
  title: string;
  onClose: () => void;
}

export function QrModal({ roomId, title, onClose }: QrModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = buildRoomShareUrl(roomId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: `RachaAí — ${title}`,
        text: `Entre na nossa mesa "${title}" para escolher seus itens da conta:`,
        url: shareUrl,
      });
    } catch {
      // usuário cancelou
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="QR Code para entrar na mesa"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Entrar na Mesa
            </p>
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* QR Code em cartão branco de alto contraste para leitura em bar escuro */}
        <div className="mx-auto flex flex-col items-center rounded-2xl bg-white p-5 shadow-inner">
          <QRCodeSVG
            value={shareUrl}
            size={216}
            level="M"
            bgColor="#ffffff"
            fgColor="#09090b"
          />
          <p className="mt-3 font-mono text-base font-extrabold tracking-widest text-zinc-900">
            {roomId}
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-400">
          Aponte a câmera do celular para entrar ao vivo. Quem não quiser escanear pode ser adicionado manualmente.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 active:scale-95"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar Link
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-95"
          >
            <Share2 className="h-4 w-4" />
            Enviar Link
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/80" />
          <span>Dados salvos somente no dispositivo do Host</span>
        </div>
      </div>
    </div>
  );
}
