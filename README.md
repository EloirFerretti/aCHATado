# aCHATado — Unified Stream Chat

Web app para reunir mensagens de **Twitch, Kick e YouTube** em um único feed e permitir que cada viewer escolha por qual plataforma deseja enviar sua mensagem.

## O que já está implementado

- Feed único com filtros por plataforma.
- Identificação visual da origem de cada mensagem.
- Login individual do viewer via OAuth na Twitch, Kick e YouTube.
- Envio como o próprio viewer para a plataforma selecionada.
- Twitch: envio por Helix Chat API e recebimento por EventSub webhook.
- Kick: envio pela Public API e recebimento pelo evento `chat.message.sent`.
- YouTube: leitura pelo Live Chat API e envio por `liveChatMessages.insert`.
- Tokens OAuth guardados em cookies HTTP-only criptografados com AES-256-GCM.
- Persistência de mensagens em Supabase via REST somente pelo backend.
- Sem banco configurado, o histórico fica vazio; mensagens reais recebidas ao vivo continuam disponíveis.
- Layout responsivo para desktop e celular.
- Configuração pronta para deploy no Render por `render.yaml`.
- Endpoint de health check em `/api/health`.

## 1. Banco de dados

O redesign Stitch, o mapeamento das integrações e os comandos de validação local estão documentados em [docs/redesign-stitch.md](docs/redesign-stitch.md).

Crie um projeto no Supabase, abra o SQL Editor e execute `sql/schema.sql`.

Depois configure:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

A service role fica somente no servidor. As tabelas usam RLS e não possuem policy pública.

## 2. Variáveis de ambiente

Use `.env.example` como referência.

Crie um segredo longo para:

```env
SESSION_SECRET=uma-chave-longa-com-pelo-menos-24-caracteres
```

Em produção, `APP_URL` deve ser a URL pública exata do Render, sem barra no final:

```env
APP_URL=https://SEU-SERVICO.onrender.com
```

Variáveis usadas pela aplicação:

```env
APP_URL=
SESSION_SECRET=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_BROADCASTER_ID=
TWITCH_EVENTSUB_SECRET=

KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
KICK_BROADCASTER_ID=
KICK_PUBLIC_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YOUTUBE_API_KEY=
YOUTUBE_VIDEO_ID=
YOUTUBE_LIVE_CHAT_ID=
```

`KICK_PUBLIC_KEY` é opcional. Se ficar vazia, a aplicação busca a chave pública oficial da Kick automaticamente.

Para o YouTube, use `YOUTUBE_VIDEO_ID` **ou** `YOUTUBE_LIVE_CHAT_ID`.

## 3. Twitch

Crie uma aplicação no Twitch Developer Console.

Redirect URI do OAuth do viewer:

```text
https://SEU-DOMINIO/api/auth/twitch/callback
```

Webhook do EventSub:

```text
https://SEU-DOMINIO/api/webhooks/twitch
```

O envio feito pelo viewer usa `user:write:chat`.

Defina:

```env
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_BROADCASTER_ID=
TWITCH_EVENTSUB_SECRET=
```

Crie a subscription `channel.chat.message` apontando para o webhook acima.

## 4. Kick

Crie a aplicação no Kick Dev e use como redirect:

```text
https://SEU-DOMINIO/api/auth/kick/callback
```

O OAuth usa PKCE automaticamente e solicita:

```text
user:read chat:write
```

Para receber o chat, o streamer/broadcaster precisa autorizar sua aplicação com `events:subscribe` e você deve criar uma assinatura para `chat.message.sent`.

Webhook:

```text
https://SEU-DOMINIO/api/webhooks/kick
```

Defina:

```env
KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
KICK_BROADCASTER_ID=
```

## 5. YouTube

No Google Cloud, habilite a YouTube Data API v3 e crie OAuth Client ID + API key.

Redirect URI:

```text
https://SEU-DOMINIO/api/auth/youtube/callback
```

Defina:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YOUTUBE_API_KEY=
YOUTUBE_VIDEO_ID=
```

Se você já souber o `liveChatId`, pode usar `YOUTUBE_LIVE_CHAT_ID` no lugar de `YOUTUBE_VIDEO_ID`.

A rota `/api/youtube/poll` respeita `pollingIntervalMillis` devolvido pela API e persiste o `nextPageToken` no banco.

## 6. Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## 7. Deploy no Render

O repositório contém um `render.yaml` pronto para criar um **Web Service Node**.

### Opção recomendada — Blueprint

1. Entre no Render.
2. Clique em **New → Blueprint**.
3. Conecte sua conta do GitHub, se ainda não estiver conectada.
4. Selecione o repositório `EloirFerretti/aCHATado`.
5. O Render detectará o `render.yaml`.
6. Confira o serviço `achatado` e aplique o Blueprint.
7. Aguarde o primeiro build.
8. Abra o serviço criado e copie a URL `https://...onrender.com`.
9. Em **Environment**, adicione as variáveis de `.env.example`.
10. Defina `APP_URL` com a URL exata copiada no passo anterior.
11. Faça um novo deploy depois de salvar as variáveis.

O Blueprint atual usa:

```text
Runtime: Node
Region: Virginia
Plan: Free
Build Command: npm install && npm run build
Start Command: npm start
Health Check: /api/health
Auto Deploy: a cada commit
Node: 24.21.0
```

### Deploy manual

Se preferir criar o serviço sem Blueprint:

- **New → Web Service**
- Repositório: `EloirFerretti/aCHATado`
- Branch: `main`
- Language/Runtime: `Node`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Depois adicione as variáveis em **Environment**.

### Depois do primeiro deploy

Com o domínio definitivo do Render, atualize os callbacks:

```text
Twitch OAuth:
https://SEU-DOMINIO/api/auth/twitch/callback

Twitch EventSub:
https://SEU-DOMINIO/api/webhooks/twitch

Kick OAuth:
https://SEU-DOMINIO/api/auth/kick/callback

Kick webhook:
https://SEU-DOMINIO/api/webhooks/kick

Google/YouTube OAuth:
https://SEU-DOMINIO/api/auth/youtube/callback
```

Teste também:

```text
https://SEU-DOMINIO/api/health
```

O retorno deve conter `"ok": true`.

### Atenção ao plano Free

O plano gratuito do Render é adequado para testes, mas pode colocar o serviço em suspensão após um período sem tráfego. Para um agregador de chat que precisa receber webhooks mesmo quando nenhum viewer está com a página aberta, um serviço sempre ativo é mais confiável.

## Fluxo do viewer

1. O viewer abre o chat unificado.
2. Pode ler Twitch, Kick e YouTube no mesmo feed.
3. Escolhe Twitch, Kick ou YouTube em **Enviar pela**.
4. Se a conta ainda não estiver conectada, faz OAuth.
5. Escreve a mensagem.
6. O backend envia usando o token daquele viewer somente para a plataforma selecionada.
7. A mensagem reaparece no feed quando a própria plataforma a entrega pelo EventSub/webhook/API.

## Observação importante

Não é necessário nem desejável copiar automaticamente uma mensagem enviada em uma plataforma para as outras duas. Cada mensagem é enviada exclusivamente para a rede escolhida pelo viewer, mantendo a identidade e as regras de chat daquela plataforma.
