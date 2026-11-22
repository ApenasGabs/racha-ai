import { ArrowLeft, HelpCircle, KeyRound, QrCode, Users, Wifi, WifiOff } from 'lucide-react';
import type { ConnectionState } from '../lib/ws-client';

interface HeaderProps {
  title: string;
  roomId: string;
  isHost: boolean;
  connectionState: ConnectionState;
  hostOnline: boolean;
  guestCount: number;
  hasApiKey: boolean;
  onOpenQr: () => void;
  onOpenApiKey: () => void;
  onStartTour: () => void;
  onLeave: () => void;
}

export function Header({
  title,
  roomId,
  isHost,
  connectionState,
  hostOnline,
  guestCount,
  hasApiKey,
  onOpenQr,
  onOpenApiKey,
  onStartTour,
  onLeave,
}: HeaderProps) {
  const isOnline = connectionState === 'connected' && (isHost || hostOnline);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        {/* Esquerda: Voltar + Título da Mesa + Status */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onLeave}
            aria-label="Voltar ao início"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-semibold text-white sm:text-base">{title}</h1>
              {isHost && (
                <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                  Host
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Ao vivo</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-amber-400" />
                    <span className="text-amber-400">
                      {!isHost && !hostOnline ? 'Aguardando Host' : 'Reconectando...'}
                    </span>
                  </>
                )}
              </span>
              {guestCount > 0 && (
                <span className="inline-flex items-center gap-1 text-zinc-400">
                  <Users className="h-3 w-3" />
                  {guestCount + 1} online
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Direita: Ajuda + Chave BYOK (Host) + Botão QR Code SEMPRE VISÍVEL */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onStartTour}
            title="Como usar o RachaAí"
            aria-label="Abrir tutorial de como usar"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:border-zinc-700 hover:text-white active:scale-95"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {isHost && (
            <button
              type="button"
              onClick={onOpenApiKey}
              title={hasApiKey ? 'Chave IA configurada (BYOK)' : 'Configurar chave Groq / Grok'}
              aria-label="Configurar chave de API"
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-95 ${
                hasApiKey
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <KeyRound className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            data-tour="header-qr"
            onClick={onOpenQr}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-xs font-bold text-zinc-950 shadow-sm shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-95"
          >
            <QrCode className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">{roomId}</span>
            <span className="sm:hidden">QR</span>
          </button>
        </div>
      </div>
    </header>
  );
}
