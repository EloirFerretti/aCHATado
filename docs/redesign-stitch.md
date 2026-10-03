# Redesign Stitch do aCHATado

## Referência e análise

Referência: `stitch_achatado_interface_redesign(3).zip`, com uma página `code.html` e uma captura `screen.png`. O HTML reúne o chat, filtros, canais, contas, notificações de menções, perfil, configurações, seletor de emotes, composer e rodapé. Não há outras páginas ou coleção de assets locais no ZIP. Fontes, ícones e imagens externas do protótipo foram inventariados; avatares, mensagens e badges ilustrativos não foram incorporados ao aplicativo.

A análise do protótipo e do repositório antecedeu as alterações. O frontend existente serviu de fonte dos comportamentos e integrações, e o protótipo definiu o visual. A branch `redesign-stitch` parte de `1494e1b`.

## Mapeamento para dados reais

| Elemento visual | Fonte e comportamento preservados |
| --- | --- |
| Feed e filtros | `Message`, histórico `/api/messages`, SSE `/api/events`, Twitch EventSub, Kick realtime e YouTube stream/poll |
| Nome, cor e avatar | Campos reais da mensagem, resolução de avatares e fallback por inicial quando necessário |
| Badges | Catálogo Twitch; badges Kick, nível e sub gifter com tooltip; papéis reais informados pelo YouTube |
| Emotes nas mensagens | Parsers existentes de fragmentos Twitch, emotes nativos Kick e catálogo YouTube; BTTV, FFZ e 7TV |
| Seletor de emotes | `/api/emote-picker`, pesquisa, provedores, bloqueios, favoritos/recentes locais e inserção no editor existente |
| Contas e envio | OAuth de cada plataforma, `/api/auth/status`, seleção da conta e POST `/api/send`; nenhuma mensagem de sucesso artificial no feed |
| Perfil e moderação | Histórico do usuário, perfil externo, permissões reais, timeout/ban/unban e exclusão via endpoints existentes |
| Preferências | Persistência local, salvar/cancelar/restaurar, badges, horários, tamanho, compactação, bots, links e sons |
| Menções | Mensagens que mencionam uma conta conectada; marcação de leitura e salto para a mensagem |

## Organização

- `app/chat/page.tsx` conserva a coordenação das integrações e do editor. Não houve reescrita das APIs de envio, OAuth, moderação ou streams.
- `components/chat/` contém cartões de mensagens, sidebar, configurações, diálogo acessível, ícones, seletor de emotes, badges YouTube e utilitários extraídos.
- `app/chat/redesign.css` define a linguagem visual e os breakpoints; estilos antigos conflitantes foram retirados de `app/globals.css`.
- `app/layout.tsx` carrega Inter e Plus Jakarta Sans com `next/font`.
- `lib/store.ts` deixa o histórico vazio quando não há banco configurado, removendo o antigo fallback com mensagens demonstrativas.

Dimensões verificadas em 1280 px: cabeçalho de 58 px, margem lateral de 32 px, sidebar de 215 px, intervalo de 16 px e início do painel em x=263. Cartões, bordas, cores, sombras, estados de seleção/hover e popovers seguem o HTML do protótipo. O conteúdo e as alturas variáveis dependem dos dados reais e dos estados de autenticação.

## Controles complementares

Mencionar insere o username real no composer da plataforma correspondente. Silenciar oculta as mensagens desse usuário apenas na sessão atual, com ação para mostrá-las novamente; não aplica um ban na plataforma. Fixar destaca uma mensagem no próprio chat e pode ser desfeito. Não sincroniza uma seleção fixada entre navegadores independentes.

O atalho **OBS Overlay URL** gera uma URL de leitura com identificadores públicos dos canais selecionados. O modo `?overlay=1` usa o mesmo feed e renderizadores, fundo transparente e nenhum composer. Não inclui tokens nem depende do armazenamento local do navegador do OBS. Se os canais forem alterados, gere uma nova URL. A renderização desse modo foi verificada em Chromium; a integração com o aplicativo OBS não foi executada.

YouTube fornece flags de papel (dono, moderador, membro, verificado), mas não entrega a arte personalizada de todas as badges de membros pelo fluxo atual. A interface mostra esses papéis reais sem inventar uma imagem oficial. Twitch e Kick mantêm seus catálogos e imagens existentes.

## Validação local

```sh
npm ci
npx playwright install chromium
npm run lint
npm run typecheck
npm run build
npm test
```

O Playwright inicia `next start` na porta 3100 se necessário. Use um ambiente local sem credenciais de produção. As fixtures ficam exclusivamente em `tests/`; as rotas de envio do navegador são interceptadas antes de acessar o backend. O teste do backend sem sessão verifica a rejeição 401, antes de qualquer envio upstream.

Foram acrescentados 15 testes cobrindo feed unificado, cores/avatares, badges de nível 42 e sub gifter 250+, tooltip, badges YouTube, seis provedores de emotes, inserção/envio das três plataformas até a fronteira da API, falha de envio com preservação do texto, configurações, menções, respostas, pausa, limpeza, favoritos, bloqueios, perfil, fixação, silenciamento, overlay e larguras de 375/768/1280/1600 px.

A verificação visual adicional usa replay local de 99 mensagens públicas reais da Kick, sem modificar seus dados, para inspecionar nomes, cores, avatares, badges e emotes. Os cenários das três plataformas usam fixtures isoladas, necessárias por não haver autenticação local. Capturas foram inspecionadas em desktop e celular, incluindo perfil, configurações, emotes, menções e overlay. Não houve erros de JavaScript ou respostas HTTP de erro nos cenários visuais; imagens externas fora da área visível podem continuar carregando no instante da captura.

Não existiam scripts de testes ou lint no checkout inicial. ESLint agora roda sobre o projeto: regras incompatíveis com padrões legados de parsing e sincronização de streams estão explicitamente delimitadas aos arquivos de integração; os componentes novos usam as regras de hooks normalmente. Imagens nativas/animadas dos CDNs usam `img` intencionalmente.

## Validação pendente e entrega

Por instrução do responsável, nenhuma credencial do Render foi consultada, copiada ou alterada. Não houve login OAuth nem envios reais para Twitch, Kick ou YouTube. Permanecem pendentes a validação autenticada de recebimento/envio, permissões de moderação e catálogos privados/de assinantes com contas reais das três plataformas, em uma etapa autorizada separadamente.

Não há mudanças em `render.yaml`, deploy ou merge para `main` nesta entrega. A homologação visual pelo responsável continua sendo necessária antes do merge.
