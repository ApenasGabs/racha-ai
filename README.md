# RachaAí 🧾⚡

App web mobile-first de **divisão colaborativa de conta em tempo real**, desenhado para funcionar em qualquer bar ou restaurante com privacidade total e custo zero de infraestrutura.

## Funcionalidades
- **Sessão em tempo real sem cadastro:** abra uma mesa em 1 clique e compartilhe o link ou código.
- **QR Code sempre no Header:** botão persistente no topo que exibe o QR Code de alto contraste para os amigos entrarem ao vivo.
- **Leitura de foto da nota fiscal (BYOK):** tire foto ou envie da galeria para extrair itens, quantidades, valores e taxa de serviço usando sua própria chave **Groq** (`gsk_...`, cota grátis rápida) ou **xAI Grok** (`xai-...`).
- **Divisão flexível por item:** entre com 1 toque ou ajuste cotas (`- / +`) para itens múltiplos (ex: chopps).
- **Participantes manuais:** inclua pessoas que não escanearam o QR Code e marque itens para elas normalmente.
- **Pagar por mais de uma pessoa:** qualquer participante pode assumir e consolidar o pagamento de outras pessoas da mesa (com taxa proporcional fechada ao centavo e resumo pronto para WhatsApp).

## Arquitetura (Privacidade Total & Zero Banco de Dados)
- **Dados 100% no Host:** o estado autoritativo da mesa e a chave BYOK ficam salvos **apenas no `localStorage` do dispositivo do Host**.
- **Cloudflare Worker + Durable Object (`RoomRelay`) Efêmero:** atua exclusivamente como relay WebSocket em memória (WebSocket Hibernation API, **sem uso de `ctx.storage`**). Quando a mesa fecha, nenhum dado permanece na nuvem.
- **Proxy `/api/ocr` Stateless:** encaminha a imagem comprimida e o header `Authorization` do Host para a Groq ou xAI sem gravar nem logar a chave, evitando bloqueios de CORS em navegadores mobile.

## Desenvolvimento Local
```bash
npm install --include=dev
npm run typecheck
npm run test
npm run build
```

Para rodar o frontend + Cloudflare Worker localmente (com Durable Object WebSocket):
```bash
# Terminal 1 (Worker + Durable Object)
npm run dev:worker

# Terminal 2 (Frontend Vite com proxy /ws e /api)
npm run dev
```

## Deploy na Cloudflare
```bash
npm run deploy
```
