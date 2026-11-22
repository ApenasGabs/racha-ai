import { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
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

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    setVerifyResult(null);
    const detected = detectProviderFromKey(val);
    if (detected) {
      setProvider(detected);
    }
  };

  const handleVerify = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setVerifying(true);
    setVerifyResult(null);

    try {
      const res = await fetch('/api/ocr/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${trimmed}`,
        },
        body: JSON.stringify({
          provider,
          model: customModel.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        model?: string;
        modelAvailable?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setVerifyResult({
          ok: false,
          message: data.error || 'Chave inválida. Verifique se copiou corretamente.',
        });
      } else if (data.modelAvailable === false) {
        setVerifyResult({
          ok: false,
          message: `Chave aceita, mas o modelo "${data.model}" não está disponível nessa conta. Deixe o campo Modelo vazio ou escolha outro.`,
        });
      } else {
        setVerifyResult({
          ok: true,
          message: `Chave válida! Modelo ${data.model} pronto para ler fotos de nota.`,
        });
      }
    } catch {
      setVerifyResult({
        ok: false,
        message: 'Não foi possível testar agora. Verifique sua conexão.',
      });
    } finally {
      setVerifying(false);
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Configurar chave de API BYOK"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:p-6"
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
            <label className="mb-1.5 block text-xs font-medium text-zinc-300">Escolha o provedor</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setProvider('groq');
                  setVerifyResult(null);
                }}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  provider === 'groq'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Groq</span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                    Grátis
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">Sem cartão (gsk_...)</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProvider('xai');
                  setVerifyResult(null);
                }}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  provider === 'xai'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="text-sm font-bold">xAI Grok</div>
                <div className="text-[11px] text-zinc-400">Console xAI (xai-...)</div>
              </button>
            </div>
          </div>

          {/* Guia passo-a-passo com links diretos */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3.5 text-xs">
            <p className="mb-2 font-semibold text-zinc-200">
              Como pegar sua chave {provider === 'groq' ? 'grátis na Groq em 30s' : 'na xAI'}:
            </p>
            {provider === 'groq' ? (
              <ol className="space-y-2 text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                    1
                  </span>
                  <span>
                    <a
                      href="https://console.groq.com/login"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:underline"
                    >
                      Crie sua conta grátis na Groq
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    (entra com Google em 1 clique, sem cartão).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                    2
                  </span>
                  <span>
                    Abra{' '}
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:underline"
                    >
                      console.groq.com/keys
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    , clique em <strong>Create API Key</strong> e copie o código <code className="text-zinc-200">gsk_...</code>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                    3
                  </span>
                  <span>Cole a chave abaixo e clique em <strong>Testar</strong>.</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2 text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                    1
                  </span>
                  <span>
                    Acesse{' '}
                    <a
                      href="https://console.x.ai"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:underline"
                    >
                      console.x.ai
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    (a chave da API é separada da assinatura do X/Grok web).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                    2
                  </span>
                  <span>
                    Crie uma nova chave em <strong>API Keys</strong> (<code className="text-zinc-200">xai-...</code>) e cole abaixo.
                  </span>
                </li>
              </ol>
            )}
          </div>

          {/* Campo da chave + botão testar */}
          <div>
            <label htmlFor="byok-key-input" className="mb-1.5 block text-xs font-medium text-zinc-300">
              Sua API Key
            </label>
            <div className="flex gap-2">
              <input
                id="byok-key-input"
                type="password"
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={provider === 'groq' ? 'gsk_...' : 'xai-...'}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 font-mono text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={verifying || apiKey.trim().length < 10}
                onClick={() => void handleVerify()}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Testar'}
              </button>
            </div>

            {verifyResult && (
              <div
                className={`mt-2 flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs ${
                  verifyResult.ok
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border border-rose-500/30 bg-rose-500/10 text-rose-200'
                }`}
              >
                {verifyResult.ok ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>{verifyResult.message}</span>
              </div>
            )}
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
              onChange={(e) => {
                setCustomModel(e.target.value);
                setVerifyResult(null);
              }}
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
