import { RoomRelay } from './room-relay';

export { RoomRelay };

export interface Env {
  ROOM_RELAY: DurableObjectNamespace<RoomRelay>;
  ASSETS: Fetcher;
}

const PROVIDER_CONFIG = {
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    defaultModel: 'qwen/qwen3.8-27b',
  },
  xai: {
    endpoint: 'https://api.x.ai/v1/chat/completions',
    modelsEndpoint: 'https://api.x.ai/v1/models',
    defaultModel: 'grok-2-vision-latest',
  },
} as const;

type ProviderKey = keyof typeof PROVIDER_CONFIG;

const RECEIPT_SYSTEM_PROMPT = `Você é um extrator especialista em notas fiscais, cupons fiscais e comandas de bares e restaurantes brasileiros.
Analise a imagem enviada e extraia TODOS os itens consumidos com máxima precisão.

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS um objeto JSON válido, sem markdown, sem crases e sem explicações extras.
2. Formato exato do JSON:
{
  "items": [
    { "name": "Nome limpo do item", "quantity": 1, "totalCents": 1850 }
  ],
  "serviceFeePercent": 10,
  "discountCents": 0
}
3. "totalCents" deve ser o valor TOTAL da linha em CENTAVOS (número inteiro). Exemplo: R$ 24,90 -> 2490. Se houver "3x Chopp 12,00 = 36,00", coloque quantity: 3 e totalCents: 3600.
4. NÃO inclua linhas de SUBTOTAL, TOTAL A PAGAR, TROCO, FORMA DE PAGAMENTO (PIX/CARTÃO) ou TAXA DE SERVIÇO/10% dentro do array "items".
5. Se a nota listar taxa de serviço (ex: 10% ou 12% ou "Serv"), informe em "serviceFeePercent" (número, ex: 10). Caso não apareça, retorne null.
6. Se houver desconto global, informe em "discountCents" (inteiro positivo em centavos). Caso contrário, 0.
7. Limpe códigos internos numéricos do início do nome (ex: "00421 BATATA FRITA G" -> "Batata Frita G").`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function parseJsonFromLlm(rawText: string): Record<string, unknown> {
  const withoutThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : withoutThink;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('A IA não retornou um JSON estruturado válido.');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

async function handleOcr(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ') || authHeader.length < 16) {
    return jsonResponse({ error: 'Chave de API ausente no header Authorization.' }, 401);
  }

  let body: { provider?: string; model?: string; imageDataUrl?: string };
  try {
    body = (await request.json()) as { provider?: string; model?: string; imageDataUrl?: string };
  } catch {
    return jsonResponse({ error: 'Corpo JSON inválido.' }, 400);
  }

  const provider = body.provider as ProviderKey | undefined;
  if (!provider || !(provider in PROVIDER_CONFIG)) {
    return jsonResponse({ error: 'Provedor inválido. Use "groq" ou "xai".' }, 400);
  }

  const imageDataUrl = body.imageDataUrl || '';
  if (!imageDataUrl.startsWith('data:image/') || imageDataUrl.length > 6_000_000) {
    return jsonResponse({ error: 'Imagem inválida ou muito grande (máx 6MB).' }, 400);
  }

  const config = PROVIDER_CONFIG[provider];
  const model =
    typeof body.model === 'string' && body.model.trim().length > 0 && body.model.trim().length < 100
      ? body.model.trim()
      : config.defaultModel;

  try {
    const upstream = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      signal: AbortSignal.timeout(35_000),
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: RECEIPT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia todos os itens, quantidades e valores em centavos desta nota fiscal/comanda.',
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      let errMsg = `Erro do provedor ${provider.toUpperCase()} (HTTP ${upstream.status}).`;
      try {
        const parsedErr = JSON.parse(errText) as { error?: { message?: string } };
        if (parsedErr.error?.message) {
          errMsg = parsedErr.error.message;
        }
      } catch {
        // fallback generic message
      }
      return jsonResponse({ error: errMsg }, upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502);
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return jsonResponse({ error: 'Resposta vazia da IA ao ler a nota.' }, 502);
    }

    const parsed = parseJsonFromLlm(content);
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items = rawItems
      .map((item) => {
        const rec = item as Record<string, unknown>;
        const name = typeof rec.name === 'string' ? rec.name.trim() : '';
        const quantity = Math.max(1, Math.round(Number(rec.quantity) || 1));
        const totalCents = Math.max(0, Math.round(Number(rec.totalCents) || 0));
        return { name, quantity, totalCents };
      })
      .filter((item) => item.name.length > 0 && item.totalCents > 0);

    const serviceFeePercent =
      typeof parsed.serviceFeePercent === 'number' && Number.isFinite(parsed.serviceFeePercent)
        ? Math.max(0, Math.min(30, parsed.serviceFeePercent))
        : null;

    const discountCents =
      typeof parsed.discountCents === 'number' && Number.isFinite(parsed.discountCents)
        ? Math.max(0, Math.round(parsed.discountCents))
        : null;

    return jsonResponse({
      items,
      serviceFeePercent,
      discountCents,
      provider,
      model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado ao processar a nota fiscal.';
    return jsonResponse({ error: message }, 502);
  }
}

const handleVerifyKey = async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ') || authHeader.length < 16) {
    return jsonResponse({ error: 'Chave de API ausente ou muito curta.' }, 401);
  }

  let body: { provider?: string; model?: string };
  try {
    body = (await request.json()) as { provider?: string; model?: string };
  } catch {
    return jsonResponse({ error: 'Corpo JSON inválido.' }, 400);
  }

  const provider = body.provider as ProviderKey | undefined;
  if (!provider || !(provider in PROVIDER_CONFIG)) {
    return jsonResponse({ error: 'Provedor inválido.' }, 400);
  }

  const config = PROVIDER_CONFIG[provider];
  const targetModel = body.model?.trim() || config.defaultModel;

  try {
    const res = await fetch(config.modelsEndpoint, {
      method: 'GET',
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return jsonResponse(
        { ok: false, error: `Chave rejeitada pela ${provider.toUpperCase()} (HTTP ${res.status}). Verifique se copiou corretamente.` },
        res.status === 401 || res.status === 403 ? 401 : 502
      );
    }

    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
    const modelAvailable = ids.length === 0 || ids.includes(targetModel);

    return jsonResponse({
      ok: true,
      provider,
      model: targetModel,
      modelAvailable,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao conectar no provedor.';
    return jsonResponse({ ok: false, error: message }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket Relay efêmero por sala
    if (url.pathname.startsWith('/ws/')) {
      const roomId = url.pathname.slice('/ws/'.length).trim().toUpperCase();
      if (!/^[A-Z0-9-]{4,24}$/.test(roomId)) {
        return jsonResponse({ error: 'Código de sala inválido.' }, 400);
      }
      const id = env.ROOM_RELAY.idFromName(roomId);
      const stub = env.ROOM_RELAY.get(id);
      return stub.fetch(request);
    }

    // Verificação stateless da chave BYOK (sem gastar tokens)
    if (url.pathname === '/api/ocr/verify') {
      return handleVerifyKey(request);
    }

    // Proxy stateless BYOK para evitar CORS (nunca persiste nem loga chaves)
    if (url.pathname === '/api/ocr') {
      return handleOcr(request);
    }

    // Healthcheck leve
    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true, mode: 'ephemeral-relay' });
    }

    // Frontend React (SPA)
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
