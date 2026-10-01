"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Platform = "twitch" | "kick" | "youtube";
type Message = {
  id?: number;
  platform: Platform;
  platform_message_id: string;
  author_name: string;
  author_avatar?: string | null;
  author_color?: string | null;
  message: string;
  created_at: string;
  badges?: unknown[];
};

type AuthInfo = Record<Platform, { connected: boolean; userName?: string; avatar?: string }>;

const labels: Record<Platform, string> = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
};

const initials: Record<Platform, string> = {
  twitch: "T",
  kick: "K",
  youtube: "Y",
};

const emptyAuth: AuthInfo = {
  twitch: { connected: false },
  kick: { connected: false },
  youtube: { connected: false },
};

function timeLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function avatarFallback(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const [selected, setSelected] = useState<Platform>("twitch");
  const [auth, setAuth] = useState<AuthInfo>(emptyAuth);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const lastId = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadAuth() {
    const res = await fetch("/api/auth/status", { cache: "no-store" });
    if (res.ok) setAuth(await res.json());
  }

  async function loadMessages(initial = false) {
    const after = initial ? 0 : lastId.current;
    const res = await fetch(`/api/messages?after=${after}&limit=120`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setDemo(!json.dbConfigured);
    const incoming: Message[] = json.messages || [];
    if (!incoming.length) return;
    setMessages((prev) => {
      if (initial) return incoming;
      const known = new Set(prev.map((m) => m.platform_message_id));
      return [...prev, ...incoming.filter((m) => !known.has(m.platform_message_id))].slice(-500);
    });
    for (const m of incoming) lastId.current = Math.max(lastId.current, Number(m.id || 0));
  }

  useEffect(() => {
    loadAuth();
    loadMessages(true);
    const tick = window.setInterval(() => loadMessages(false), 1100);
    const yt = window.setInterval(() => {
      fetch("/api/youtube/poll", { method: "POST" }).catch(() => undefined);
    }, 2200);
    return () => {
      clearInterval(tick);
      clearInterval(yt);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, filter]);

  const visible = useMemo(
    () => messages.filter((m) => filter === "all" || m.platform === filter),
    [messages, filter],
  );

  const counts = useMemo(() => ({
    twitch: messages.filter((m) => m.platform === "twitch").length,
    kick: messages.filter((m) => m.platform === "kick").length,
    youtube: messages.filter((m) => m.platform === "youtube").length,
  }), [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!text.trim()) return;
    if (!auth[selected]?.connected) {
      window.location.href = `/api/auth/${selected}/start`;
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: selected, message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não foi possível enviar a mensagem.");
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function logout(platform: Platform) {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    await loadAuth();
  }

  const maxLength = selected === "youtube" ? 200 : 500;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark"><span>T</span><span>K</span><span>Y</span></div>
          <div>
            <h1>Unified Stream Chat</h1>
            <p>Twitch + Kick + YouTube em um só lugar</p>
          </div>
        </div>
        <div className="livePill"><span className="liveDot" /> AO VIVO</div>
      </header>

      {demo && (
        <div className="demoBanner">
          <strong>Modo demonstração.</strong> Configure o Supabase e as APIs no <code>.env.local</code> para usar mensagens reais.
        </div>
      )}

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebarTitle">EXIBIR MENSAGENS</div>
          <button className={`filterButton ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            <span className="allIcon">∞</span><span>Todas</span><b>{messages.length}</b>
          </button>
          {(["twitch", "kick", "youtube"] as Platform[]).map((p) => (
            <button key={p} className={`filterButton ${filter === p ? "active" : ""}`} onClick={() => setFilter(p)}>
              <span className={`platformIcon ${p}`}>{initials[p]}</span><span>{labels[p]}</span><b>{counts[p]}</b>
            </button>
          ))}

          <div className="sidebarTitle accountsTitle">SUAS CONTAS</div>
          {(["twitch", "kick", "youtube"] as Platform[]).map((p) => (
            <div className="accountRow" key={p}>
              <span className={`platformIcon ${p}`}>{initials[p]}</span>
              <div className="accountText">
                <strong>{labels[p]}</strong>
                <small>{auth[p]?.connected ? auth[p]?.userName || "Conectado" : "Não conectado"}</small>
              </div>
              {auth[p]?.connected ? (
                <button className="tinyButton" onClick={() => logout(p)}>Sair</button>
              ) : (
                <a className="tinyButton" href={`/api/auth/${p}/start`}>Conectar</a>
              )}
            </div>
          ))}
        </aside>

        <section className="chatPanel">
          <div className="chatHeader">
            <div>
              <strong>{filter === "all" ? "Chat unificado" : `Chat da ${labels[filter]}`}</strong>
              <span>{visible.length} mensagens carregadas</span>
            </div>
            <div className="status"><span /> sincronizando</div>
          </div>

          <div className="messageList">
            {visible.map((m) => (
              <article className="message" key={`${m.platform}-${m.platform_message_id}`}>
                <div className={`avatarRing ${m.platform}`}>
                  {m.author_avatar ? <img src={m.author_avatar} alt="" /> : <span>{avatarFallback(m.author_name)}</span>}
                  <span className={`miniPlatform ${m.platform}`}>{initials[m.platform]}</span>
                </div>
                <div className="messageBody">
                  <div className="meta">
                    <strong style={m.author_color ? { color: m.author_color } : undefined}>{m.author_name}</strong>
                    <span className={`platformLabel ${m.platform}`}>{labels[m.platform]}</span>
                    <time>{timeLabel(m.created_at)}</time>
                  </div>
                  <p>{m.message}</p>
                </div>
              </article>
            ))}
            {!visible.length && <div className="emptyState">Nenhuma mensagem neste filtro ainda.</div>}
            <div ref={bottomRef} />
          </div>

          <form className="composer" onSubmit={send}>
            <div className="sendVia">
              <span>Enviar pela</span>
              <div className="platformSwitch">
                {(["twitch", "kick", "youtube"] as Platform[]).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => { setSelected(p); setError(""); }}
                    className={`${selected === p ? "selected" : ""} ${p}`}
                  >
                    <span>{initials[p]}</span>{labels[p]}
                    <i className={auth[p]?.connected ? "connected" : ""} />
                  </button>
                ))}
              </div>
            </div>

            {!auth[selected]?.connected ? (
              <a className={`connectCallout ${selected}`} href={`/api/auth/${selected}/start`}>
                Conectar {labels[selected]} para enviar mensagens como você
              </a>
            ) : (
              <div className="inputRow">
                <div className="textWrap">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, maxLength))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={`Mensagem como ${auth[selected]?.userName || "você"} na ${labels[selected]}...`}
                    rows={1}
                    maxLength={maxLength}
                  />
                  <span className="counter">{[...text].length}/{maxLength}</span>
                </div>
                <button className={`sendButton ${selected}`} disabled={sending || !text.trim()}>
                  {sending ? "Enviando…" : "Enviar"}
                </button>
              </div>
            )}
            {error && <div className="errorBox">{error}</div>}
          </form>
        </section>
      </section>
    </main>
  );
}
