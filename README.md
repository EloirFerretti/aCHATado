# Unified Stream Chat

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
- Modo demonstração automático quando o banco ainda não foi configurado.
- Layout responsivo para desktop e celular.

## 1. Banco de dados

Crie um projeto no Supabase, abra o SQL Editor e execute `sql/schema.sql`.

Depois configure:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

A service role fica somente no servidor. As tabelas usam RLS e não possuem policy pública.

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha as credenciais.

Também crie um segredo longo para:

```env
SESSION_SECRET=uma-chave-longa-com-pelo-menos-24-caracteres
```

Em produção, defina `APP_URL=https://seu-dominio.com`.

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

O envio feito pelo viewer usa `user:write:chat`. Para receber `channel.chat.message` via **webhook**, a configuração de chatbot em nuvem da Twitch exige uma identidade de bot autorizada com `user:read:chat` + `user:bot` e autorização `channel:bot` concedida pelo broadcaster (ou o bot como moderador, conforme as regras atuais). A criação da subscription webhook usa um **App Access Token** do mesmo Client ID.

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

Para receber o chat, o streamer/broadcaster precisa autorizar sua aplicação com `events:subscribe` e você deve criar uma assinatura para `chat.message.sent`. Configure no Kick Dev o webhook:

```text
https://SEU-DOMINIO/api/webhooks/kick
```

Defina:

```env
KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
KICK_BROADCASTER_ID=
```

O webhook valida `Kick-Event-Signature` usando a chave pública oficial obtida em `GET /public/v1/public-key`.

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

A rota `/api/youtube/poll` respeita `pollingIntervalMillis` devolvido pela API e persiste o `nextPageToken` no banco para não começar do zero em toda chamada.

## 6. Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## 7. Deploy na Vercel

Importe o repositório na Vercel e copie todas as variáveis do `.env.local` para **Settings → Environment Variables**. Depois atualize `APP_URL` com o domínio de produção e cadastre os redirects/webhooks de produção nos painéis Twitch, Kick e Google.

## Fluxo do viewer

1. O viewer abre o chat unificado.
2. Pode ler Twitch, Kick e YouTube no mesmo feed.
3. Escolhe Twitch, Kick ou YouTube em **Enviar pela**.
4. Se a conta ainda não estiver conectada, faz OAuth uma única vez.
5. Escreve a mensagem.
6. O backend envia usando o token daquele viewer somente para a plataforma selecionada.
7. A mensagem reaparece no feed quando a própria plataforma a entrega pelo EventSub/webhook/API, evitando duplicação artificial.

## Observação importante

Não é necessário nem desejável copiar automaticamente uma mensagem enviada em uma plataforma para as outras duas. Cada mensagem é enviada exclusivamente para a rede escolhida pelo viewer, mantendo a identidade e as regras de chat daquela plataforma.
