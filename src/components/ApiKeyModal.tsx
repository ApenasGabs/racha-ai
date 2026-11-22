import { useState } from 'react';
import { ExternalLink, KeyRound, Lock, Trash2, X } from 'lucide-react';
import type { AiProvider } from '../types/session';
import { detectProviderFromKey, type StoredByokConfig } from '../lib/storage';

interface ApiKeyModalProps {
  currentConfig: StoredByokConfig | null;
  onSave: (config: StoredByokConfig | null) => void;
  onClose: () => void;
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  groq: 'qwen/qwen3.8-27b',
  xai: 'grok-2-vision-latest',
};

export function ApiKeyModal({ currentConfig, onSave, onClose }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey ?? '');
  const [provider, setProvider] = useState<AiProvider>(currentConfig?.provider ?? 'groq');
  const [customModel, setCustomModel] = useState(currentConfig?.customModel ?? '');

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    const detected = detectProviderFromKey(val);
    if (detected) {
      setProvider(detected);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      onSave(null);
      onClose();
      return;
    }
    onSave({
      provider,
      apiKey: trimmed,
      customModel: customModel.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Configurar chave de API BYOK"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Chave de IA (BYOK)</h2>
              <p className="text-xs text-zinc-400">Para ler a foto da nota fiscal automaticamente</p>
            </div>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seletor de provedor */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Provedor</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider('groq')}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  provider === 'groq'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="text-sm font-bold">Groq</div>
                <div className="text-[11px] text-zinc-400">Cota grátis rápida (gsk_...)</div>
              </button>
              <button
                type="button"
                onClick={() => setProvider('xai')}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  provider === 'xai'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="text-sm font-bold">xAI Grok</div>
                <div className="text-[11px] text-zinc-400">Grok Vision (xai-...)</div>
              </button>
            </div>
          </div>

          {/* Campo da chave */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="byok-key-input" className="text-xs font-medium text-zinc-300">
                API Key
              </label>
              <a
                href={provider === 'groq' ? 'https://console.groq.com/keys' : 'https://console.x.ai'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:underline"
              >
                Gerar chave {provider === 'groq' ? 'grátis na Groq' : 'na xAI'}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <input
              id="byok-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={provider === 'groq' ? 'gsk_...' : 'xai-...'}
              autoComplete="off"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 font-mono text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Modelo opcional */}
          <div>
            <label htmlFor="byok-model-input" className="mb-1.5 block text-xs font-medium text-zinc-400">
              Modelo (opcional — padrão: <span className="font-mono text-zinc-300">{DEFAULT_MODELS[provider]}</span>)
            </label>
            <input
              id="byok-model-input"
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder={DEFAULT_MODELS[provider]}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-[11px] text-zinc-400">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>
              Sua chave fica salva <strong>somente no localStorage do seu celular</strong>. O Worker na Cloudflare apenas repassa a imagem sem gravar nem logar nada.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {currentConfig && (
              <button
                type="button"
                onClick={() => {
                  onSave(null);
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </button>
            )}
            <button
              type="submit"
              className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-95"
            >
              Salvar Chave Local
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
