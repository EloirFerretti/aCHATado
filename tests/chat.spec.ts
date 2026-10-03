import { test, expect, type Page } from "@playwright/test";

// Isolated API fixtures: these are never imported by the application or sent upstream.
const platforms = ["twitch", "kick", "youtube"] as const;
const image = "/badges/kick/level-42.svg";
const channels = Object.fromEntries(
  platforms.map((platform) => [
    platform,
    {
      platform,
      input: `test-${platform}`,
      channelId: `${platform}-channel`,
      channelName: `test-${platform}`,
      videoId: platform === "youtube" ? "test-video" : undefined,
      liveChatId: platform === "youtube" ? "test-live-chat" : undefined,
    },
  ]),
);
const auth = Object.fromEntries(
  platforms.map((platform) => [
    platform,
    {
      configured: true,
      connected: true,
      userId: `viewer-${platform}`,
      userName: "Viewer",
      moderationReady: true,
    },
  ]),
);
const messages = [
  {
    id: 1,
    platform: "twitch",
    platform_message_id: "t1",
    channel_id: "twitch-channel",
    author_id: "alice",
    author_name: "Alice",
    author_avatar: image,
    author_color: "#a970ff",
    message: "Olá Kappa BTTV FFZ SEVEN",
    created_at: "2026-10-03T18:11:00Z",
    badges: [{ set_id: "moderator", id: "1" }],
    raw: {
      message: {
        fragments: [
          { type: "text", text: "Olá " },
          {
            type: "emote",
            text: "Kappa",
            emote: { id: "25", format: ["static"] },
          },
          { type: "text", text: " BTTV FFZ SEVEN" },
        ],
      },
    },
  },
  {
    id: 2,
    platform: "kick",
    platform_message_id: "k1",
    channel_id: "kick-channel",
    author_id: "bruno",
    author_name: "Bruno",
    author_avatar: image,
    author_color: "#53fc18",
    message: "@Viewer KickSmile",
    created_at: "2026-10-03T18:12:00Z",
    badges: [
      { type: "level", metadata: { level: 42 } },
      { type: "sub_gifter", count: 250 },
    ],
    raw: { content: "@Viewer [emote:123:KickSmile]" },
  },
  {
    id: 3,
    platform: "youtube",
    platform_message_id: "y1",
    channel_id: "youtube-channel",
    author_id: "carol",
    author_name: "Carol",
    author_avatar: image,
    author_color: "#ff4e45",
    message: "Olá :yt:",
    created_at: "2026-10-03T18:13:00Z",
    badges: ["moderator"],
  },
];
const thirdParty = Object.fromEntries(
  (["bttv", "ffz", "7tv"] as const).map((provider, i) => [
    ["BTTV", "FFZ", "SEVEN"][i],
    { code: ["BTTV", "FFZ", "SEVEN"][i], provider, url: image },
  ]),
);
const emotes = (platform: string) => [
  {
    id: platform === "kick" ? "123" : "25",
    code:
      platform === "kick"
        ? "KickSmile"
        : platform === "youtube"
          ? ":yt:"
          : "Kappa",
    provider: platform,
    category: "official",
    scope: "global",
    native: true,
    url: image,
  },
  ...Object.values(thirdParty).map((e) => ({
    ...e,
    category: "thirdparty",
    scope: "global",
  })),
  {
    id: "locked",
    code: "LockedSub",
    provider: platform,
    category: "user",
    scope: "user",
    url: image,
    locked: true,
    lockReason: "Requer assinatura",
  },
];

async function setup(
  page: Page,
  sendStatus = 200,
  authState: typeof auth = auth,
) {
  const sends: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((channels) => {
    localStorage.setItem("achatado_channels", JSON.stringify(channels));
    localStorage.setItem(
      "achatado_channel_inputs",
      JSON.stringify({
        twitch: "test-twitch",
        kick: "test-kick",
        youtube: "test-youtube",
      }),
    );
    localStorage.setItem(
      "achatado_chat_settings",
      JSON.stringify({ mentionSound: false }),
    );
  }, channels);
  await page.routeWebSocket("**", (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "localhost") {
      if (route.request().resourceType() === "image")
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="#c0c1ff"/></svg>',
        });
      return route.fulfill({ json: [] });
    }
    const p = url.pathname;
    if (!p.startsWith("/api/")) return route.continue();
    if (p === "/api/auth/status") return route.fulfill({ json: authState });
    if (p === "/api/messages")
      return route.fulfill({
        json: {
          dbConfigured: true,
          messages: url.searchParams.get("after") === "0" ? messages : [],
        },
      });
    if (p === "/api/emotes")
      return route.fulfill({ json: { emotes: thirdParty } });
    if (p === "/api/twitch/badges")
      return route.fulfill({
        json: {
          badges: {
            "moderator:1": {
              setId: "moderator",
              id: "1",
              title: "Moderador",
              imageUrl: image,
            },
          },
        },
      });
    if (p === "/api/kick/badges")
      return route.fulfill({ json: { badges: [] } });
    if (p === "/api/youtube/emotes")
      return route.fulfill({
        json: {
          emotes: { ":yt:": { shortcut: ":yt:", url: image, custom: false } },
        },
      });
    if (p === "/api/emote-picker")
      return route.fulfill({
        json: { emotes: emotes(url.searchParams.get("platform") || "twitch") },
      });
    if (p === "/api/moderation/status")
      return route.fulfill({ json: { role: "moderator" } });
    if (p === "/api/send") {
      sends.push(route.request().postDataJSON());
      return route.fulfill({
        status: sendStatus,
        json:
          sendStatus === 200
            ? { ok: true }
            : { error: "Plataforma indisponível" },
      });
    }
    if (p === "/api/events" || p === "/api/twitch/stream")
      return route.fulfill({
        contentType: "text/event-stream",
        body: ": test\n\n",
      });
    return route.fulfill({ json: { mode: "stream", active: true, ok: true } });
  });
  await page.goto("/chat");
  await expect(page.locator("article.message")).toHaveCount(3);
  return { sends, errors };
}

test("unified feed preserves colors, avatars, real badge formats and all emote providers", async ({
  page,
}) => {
  const { errors } = await setup(page);
  await expect(page.locator(".message .avatarProfileLink img")).toHaveCount(3);
  await expect(page.locator('.message [title="Nível 42"]')).toBeVisible();
  await expect(
    page.locator('.message [title="Sub Gifter · 250+ sub gifts"]'),
  ).toBeVisible();
  await expect(
    page.locator('.message [title="Moderador"]').first(),
  ).toBeVisible();
  await expect(page.locator(".message .chatEmote")).toHaveCount(6);
  await expect(
    page.locator('.youtubeRoleBadge[title="Moderador do YouTube"]'),
  ).toBeVisible();
  await expect(page.locator(".messageMentioned")).toHaveCount(1);
  await expect(
    page.locator(".message.kick .authorProfileButton strong"),
  ).toHaveCSS("color", "rgb(83, 252, 24)");
  await page.getByRole("button", { name: "Kick 1", exact: true }).click();
  await expect(page.locator("article.message")).toHaveCount(1);
  await page.getByRole("button", { name: /Todas 3/ }).click();
  await expect(page.locator("article.message")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("disconnected account replaces message controls with the connect action", async ({
  page,
}) => {
  await setup(page, 200, {
    ...auth,
    twitch: { ...auth.twitch, connected: false },
  });

  const connect = page.getByRole("link", {
    name: "Conecte sua conta da Twitch para enviar mensagens",
  });
  await expect(connect).toBeVisible();
  await expect(connect).toHaveAttribute("href", "/api/auth/twitch/start");
  await expect(
    page.getByRole("textbox", { name: "Mensagem", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Abrir menu de emotes" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Comandos do chat" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toHaveCount(0);
});

for (const platform of platforms)
  test(`emote insertion and ${platform} send stop at the API boundary`, async ({
    page,
  }) => {
    const { sends } = await setup(page);
    await page.locator(`.platformSwitch .${platform}`).click();
    const code =
      platform === "kick"
        ? "KickSmile"
        : platform === "youtube"
          ? ":yt:"
          : "Kappa";
    await page.getByRole("button", { name: "Abrir menu de emotes" }).click();
    await page.getByRole("button", { name: code, exact: true }).click();
    await expect(page.locator(".composerRichEmote")).toHaveAttribute(
      "data-emote-code",
      code,
    );
    await page.getByRole("button", { name: "Fechar emotes" }).click();
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect.poll(() => sends.length).toBe(1);
    expect(sends[0]).toMatchObject({
      platform,
      channelId: `${platform}-channel`,
    });
    expect(String(sends[0].message).trim()).toBe(
      platform === "kick" ? "[emote:123:KickSmile]" : code,
    );
    await expect(
      page.getByRole("textbox", { name: "Mensagem", exact: true }),
    ).toBeEmpty();
    await expect(page.locator("article.message")).toHaveCount(3); // No fake local success message.
  });

test("failed send keeps the draft and reports the error", async ({ page }) => {
  const { sends } = await setup(page, 503);
  await page
    .getByRole("textbox", { name: "Mensagem", exact: true })
    .fill("Mensagem de teste isolado");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.locator(".errorBox")).toHaveText("Plataforma indisponível");
  await expect(
    page.getByRole("textbox", { name: "Mensagem", exact: true }),
  ).toHaveText("Mensagem de teste isolado");
  expect(sends).toHaveLength(1);
});

test("preferences save, cancel and restore; badge and timestamp visibility", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Abrir configurações do chat" })
    .click();
  await page.getByRole("switch", { name: "Modo Compacto" }).click();
  await page
    .getByRole("switch", { name: "Exibir Badges de Plataforma" })
    .click();
  await page.getByRole("switch", { name: "Timestamps / Horário" }).click();
  await page.getByRole("button", { name: "Salvar Alterações" }).click();
  await expect(page.locator(".chatShell")).toHaveClass(/compactFeed/);
  await expect(page.locator(".message .chatUserBadge")).toHaveCount(0);
  await expect(page.locator(".message time")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Abrir configurações do chat" })
    .click();
  await page.getByRole("button", { name: "Restaurar Padrões" }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator(".chatShell")).toHaveClass(/compactFeed/);
  await page
    .getByRole("button", { name: "Abrir configurações do chat" })
    .click();
  await page.getByRole("button", { name: "Restaurar Padrões" }).click();
  await page.getByRole("button", { name: "Salvar Alterações" }).click();
  await expect(page.locator(".message time")).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("achatado_chat_settings")!)
          .showPlatformBadges,
    ),
  ).toBe(true);
});

test("mentions, profiles, reply payload, pause and clear preserve application behavior", async ({
  page,
}) => {
  const { sends } = await setup(page);
  await page
    .getByRole("button", { name: "Menções recentes", exact: true })
    .click();
  await expect(page.locator(".mentionItem")).toHaveCount(1);
  await page.getByRole("button", { name: "Marcar todas como lidas" }).click();
  await expect(page.locator(".notificationDot")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fechar menções", exact: true })
    .last()
    .click();
  await page.locator(".message.twitch .authorProfileButton").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".userProfileMessage")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Fechar perfil", exact: true })
    .click();
  await page.locator(".message.twitch").hover();
  await page.getByRole("button", { name: "Responder a Alice" }).click();
  await page
    .getByRole("textbox", { name: "Mensagem", exact: true })
    .fill("Resposta isolada");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect.poll(() => sends.length).toBe(1);
  expect(sends[0].replyToMessageId).toBe("t1");
  await page.getByRole("button", { name: "Pausar rolagem do chat" }).click();
  await expect(
    page.getByRole("button", { name: "Retomar rolagem do chat" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Limpar chat", exact: true }).click();
  await expect(page.locator("article.message")).toHaveCount(0);
});

test("emote search, locked emotes, favorites and recents", async ({ page }) => {
  const { sends } = await setup(page);
  await page.getByRole("button", { name: "Abrir menu de emotes" }).click();
  await page.getByRole("textbox", { name: "Buscar emote" }).fill("LockedSub");
  await expect(
    page.getByRole("button", { name: "LockedSub, bloqueado" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Mensagem", exact: true }),
  ).toBeEmpty();
  await page.getByRole("textbox", { name: "Buscar emote" }).fill("Kappa");
  await page.getByRole("button", { name: "Kappa", exact: true }).hover();
  await page.getByRole("button", { name: "Favoritar emote" }).click();
  await page.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(page.locator(".emotePickerItem")).toHaveCount(1);
  await page.getByRole("button", { name: "Kappa", exact: true }).click();
  await page.getByRole("button", { name: "Recentes", exact: true }).click();
  await expect(page.locator(".emotePickerItem")).toHaveCount(1);
  expect(sends).toHaveLength(0);
});

test("profile mention, session mute and pin work with actual message objects", async ({
  page,
}) => {
  const { sends } = await setup(page);
  await page.locator(".message.kick .authorProfileButton").click();
  await page.getByRole("button", { name: "Mencionar", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Mensagem", exact: true }),
  ).toHaveText("@Bruno ");
  await expect(page.locator(".platformSwitch .kick")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator(".message.kick .authorProfileButton").click();
  await page.getByRole("button", { name: "Silenciar", exact: true }).click();
  await expect(page.locator("article.message")).toHaveCount(2);
  await page.getByRole("button", { name: "Mostrar novamente" }).click();
  await expect(page.locator("article.message")).toHaveCount(3);
  await page.locator(".message.twitch").hover();
  await page.getByRole("button", { name: "Fixar mensagem de Alice" }).click();
  await expect(page.locator(".pinnedMessage")).toContainText("Alice");
  await page.getByRole("button", { name: "Desafixar mensagem" }).click();
  await expect(page.locator(".pinnedMessage")).toHaveCount(0);
  expect(sends).toHaveLength(0);
});

test("OBS URL carries public channel identifiers and renders a transparent read-only feed", async ({
  page,
}) => {
  const { sends } = await setup(page);
  await page.getByRole("button", { name: "OBS Overlay URL" }).click();
  const value = await page
    .getByRole("textbox", { name: "URL do overlay" })
    .inputValue();
  const url = new URL(value);
  expect(url.searchParams.get("kick")).toBe("kick-channel");
  expect(url.searchParams.has("token")).toBe(false);
  await page.goto(value);
  await expect(page.locator("article.message")).toHaveCount(3);
  await expect(page.locator(".composer")).toHaveCount(0);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(page.locator(".messageList")).toHaveCSS(
    "background-image",
    "none",
  );
  expect(sends).toHaveLength(0);
});

for (const width of [375, 768, 1280, 1600])
  test(`responsive layout and settings remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    if (width < 768) {
      await page
        .getByRole("combobox", { name: "Plataforma para enviar" })
        .selectOption("kick");
      await expect(
        page.getByRole("combobox", { name: "Plataforma para enviar" }),
      ).toHaveValue("kick");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Enviar", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Abrir configurações do chat" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator(".settingsAccounts summary").click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Canal da Twitch" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Abrir configurações do chat" }),
    ).toBeFocused();
  });

test("unconfigured backend provides no fictional history and rejects unauthenticated sends", async ({
  request,
}) => {
  const history = await request.get("/api/messages");
  const data = await history.json();
  if (!data.dbConfigured) expect(data.messages).toEqual([]);
  for (const platform of platforms) {
    const response = await request.post("/api/send", {
      data: { platform, channelId: "test", message: "API boundary test" },
    });
    expect(response.status()).toBe(401);
  }
});
