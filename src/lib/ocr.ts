import type { AiProvider, OcrResponse } from '../types/session';

/**
 * Redimensiona e comprime a imagem da nota fiscal no navegador (max 1400px, JPEG 0.82)
 * para economizar banda 4G e acelerar a leitura na Groq / xAI Grok.
 */
export async function compressReceiptImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1400;
  let { width, height } = bitmap;

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Não foi possível inicializar o canvas para processar a imagem.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.82);
}

export async function extractReceiptItems(params: {
  file: File;
  provider: AiProvider;
  apiKey: string;
  model?: string;
}): Promise<OcrResponse> {
  const imageDataUrl = await compressReceiptImage(params.file);

  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey.trim()}`,
    },
    body: JSON.stringify({
      provider: params.provider,
      model: params.model?.trim() || undefined,
      imageDataUrl,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<OcrResponse> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `Falha na leitura da nota (HTTP ${response.status}).`);
  }

  return {
    items: data.items ?? [],
    serviceFeePercent: data.serviceFeePercent ?? null,
    discountCents: data.discountCents ?? null,
    provider: data.provider ?? params.provider,
    model: data.model ?? params.model ?? '',
  };
}
