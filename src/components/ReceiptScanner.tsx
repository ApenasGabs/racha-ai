import { useRef, useState } from 'react';
import { Camera, KeyRound, Loader2, Plus, Sparkles, Upload } from 'lucide-react';
import type { OcrExtractedItem } from '../types/session';
import type { StoredByokConfig } from '../lib/storage';
import { extractReceiptItems } from '../lib/ocr';
import { parseCurrencyToCents } from '../lib/calculations';

interface ReceiptScannerProps {
  byokConfig: StoredByokConfig | null;
  onOpenApiKey: () => void;
  onImportItems: (
    items: OcrExtractedItem[],
    serviceFeePercent: number | null,
    discountCents: number | null
  ) => void;
  onAddManualItem: (name: string, quantity: number, totalCents: number) => void;
}

export function ReceiptScanner({
  byokConfig,
  onOpenApiKey,
  onImportItems,
  onAddManualItem,
}: ReceiptScannerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Form rápido de adição manual de item
  const [showManualForm, setShowManualForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!byokConfig?.apiKey) {
      onOpenApiKey();
      return;
    }

    setScanning(true);
    setError(null);
    setStatusMsg('Lendo nota fiscal com IA...');

    try {
      const res = await extractReceiptItems({
        file,
        provider: byokConfig.provider,
        apiKey: byokConfig.apiKey,
        model: byokConfig.customModel,
      });

      if (res.items.length === 0) {
        setError('Nenhum item foi reconhecido na foto. Tente uma foto mais nítida ou adicione manualmente.');
      } else {
        onImportItems(res.items, res.serviceFeePercent, res.discountCents);
        setStatusMsg(`${res.items.length} ${res.items.length === 1 ? 'item importado' : 'itens importados'} da nota!`);
        window.setTimeout(() => setStatusMsg(null), 4000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar a foto da nota.');
    } finally {
      setScanning(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalCents = parseCurrencyToCents(itemPrice);
    const qty = Math.max(1, Number.parseInt(itemQty, 10) || 1);
    if (!itemName.trim() || totalCents <= 0) return;

    onAddManualItem(itemName.trim(), qty, totalCents);
    setItemName('');
    setItemQty('1');
    setItemPrice('');
    setShowManualForm(false);
  };

  return (
    <section data-tour="receipt-scanner" className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5">
      {/* Inputs ocultos para câmera e galeria */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFileSelected(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-2">
        {byokConfig ? (
          <>
            <button
              type="button"
              disabled={scanning}
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-95 disabled:opacity-60"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lendo nota...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Foto da Nota
                </>
              )}
            </button>

            <button
              type="button"
              disabled={scanning}
              onClick={() => galleryInputRef.current?.click()}
              aria-label="Enviar foto da galeria"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 active:scale-95 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Galeria</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenApiKey}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 active:scale-95 sm:text-sm"
          >
            <KeyRound className="h-4 w-4 text-amber-400" />
            Configurar chave Groq / Grok para ler foto da nota
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowManualForm((v) => !v)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Item manual
        </button>
      </div>

      {statusMsg && !error && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {statusMsg}
        </div>
      )}

      {error && (
        <div className="mt-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {showManualForm && (
        <form onSubmit={handleManualSubmit} className="mt-3 grid grid-cols-12 gap-2 border-t border-zinc-800 pt-3">
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Ex: Porção de Fritas"
            required
            className="col-span-12 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none sm:col-span-6"
          />
          <input
            type="number"
            min={1}
            max={99}
            value={itemQty}
            onChange={(e) => setItemQty(e.target.value)}
            aria-label="Quantidade"
            placeholder="Qtd"
            className="col-span-4 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none sm:col-span-2"
          />
          <input
            type="text"
            inputMode="decimal"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            placeholder="Total R$ (ex: 34,90)"
            required
            className="col-span-8 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none sm:col-span-4"
          />
          <div className="col-span-12 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
            >
              Adicionar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
