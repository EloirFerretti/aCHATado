import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "aCHATado — Chat unificado para Twitch, Kick e YouTube",
  description:
    "O aCHATado reúne chats ao vivo da Twitch, Kick e YouTube em uma única interface e permite enviar mensagens pelas contas conectadas pelo próprio usuário.",
};

const pageStyle = {
  minHeight: "100vh",
  background: "radial-gradient(circle at 65% -20%, #24283a 0, transparent 33%), #090b10",
  color: "#f6f7fb",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
} as const;

const wrapStyle = {
  width: "min(1080px, calc(100% - 40px))",
  margin: "0 auto",
} as const;

const cardStyle = {
  background: "rgba(17, 20, 27, 0.92)",
  border: "1px solid #252b37",
  borderRadius: 20,
  padding: 28,
} as const;

export default function HomePage() {
  return (
    <main style={pageStyle}>
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,.07)",
          background: "rgba(9, 11, 16, 0.96)",
        }}
      >
        <div
          style={{
            ...wrapStyle,
            minHeight: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <Link
            href="/"
            style={{ color: "#f6f7fb", textDecoration: "none", fontSize: 25, fontWeight: 800 }}
            aria-label="Página inicial do aCHATado"
          >
            aCHATado
          </Link>
          <nav style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/privacy" style={{ color: "#9299a8", textDecoration: "none" }}>
              Política de Privacidade
            </Link>
            <Link href="/terms" style={{ color: "#9299a8", textDecoration: "none" }}>
              Termos de Serviço
            </Link>
            <Link
              href="/chat"
              style={{
                color: "#f6f7fb",
                background: "#202632",
                border: "1px solid #3b4454",
                padding: "10px 16px",
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Abrir o aCHATado
            </Link>
          </nav>
        </div>
      </header>

      <section
        style={{
          ...wrapStyle,
          padding: "88px 0 56px",
          display: "grid",
          gap: 28,
        }}
      >
        <div style={{ maxWidth: 820 }}>
          <p
            style={{
              margin: "0 0 14px",
              color: "#9299a8",
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              fontSize: 13,
            }}
          >
            Chat unificado para transmissões ao vivo
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(42px, 8vw, 76px)",
              lineHeight: 1,
              letterSpacing: "-0.045em",
            }}
          >
            aCHATado
          </h1>
          <p
            style={{
              margin: "24px 0 0",
              color: "#aeb5c2",
              fontSize: "clamp(19px, 2.5vw, 25px)",
              lineHeight: 1.55,
              maxWidth: 780,
            }}
          >
            O aCHATado é uma ferramenta independente que reúne, em uma única interface,
            mensagens de chats ao vivo da Twitch, Kick e YouTube. Você escolhe os canais que
            deseja acompanhar e pode conectar suas próprias contas para enviar mensagens pelas
            APIs oficiais das plataformas.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 32 }}>
            <Link
              href="/chat"
              style={{
                display: "inline-block",
                color: "#f6f7fb",
                background: "#202632",
                border: "1px solid #3b4454",
                padding: "14px 20px",
                borderRadius: 12,
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Acessar o chat unificado
            </Link>
            <Link
              href="/privacy"
              style={{
                display: "inline-block",
                color: "#adb4c1",
                background: "#171b23",
                border: "1px solid #303746",
                padding: "14px 20px",
                borderRadius: 12,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Como seus dados são usados
            </Link>
          </div>
        </div>
      </section>

      <section style={{ ...wrapStyle, padding: "20px 0 64px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0, fontSize: 21 }}>O que o aplicativo faz</h2>
            <p style={{ color: "#aeb5c2", lineHeight: 1.7, marginBottom: 0 }}>
              Mostra em um só lugar os chats dos canais selecionados e identifica a origem de
              cada mensagem, facilitando o acompanhamento simultâneo de diferentes plataformas.
            </p>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0, fontSize: 21 }}>Conexão de contas</h2>
            <p style={{ color: "#aeb5c2", lineHeight: 1.7, marginBottom: 0 }}>
              A conexão com Twitch, Kick ou Google/YouTube é opcional e utiliza OAuth. O
              aCHATado não solicita a senha dessas contas. A autorização é feita diretamente
              pela plataforma escolhida.
            </p>
          </article>
          <article style={cardStyle}>
            <h2 style={{ marginTop: 0, fontSize: 21 }}>YouTube</h2>
            <p style={{ color: "#aeb5c2", lineHeight: 1.7, marginBottom: 0 }}>
              Quando você conecta o YouTube, a autorização é usada para identificar o canal da
              conta conectada, ler informações necessárias do chat ao vivo e enviar mensagens
              ao chat em seu nome quando você solicitar.
            </p>
          </article>
        </div>
      </section>

      <section style={{ ...wrapStyle, padding: "0 0 72px" }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0, fontSize: 26 }}>Privacidade e controle</h2>
          <p style={{ color: "#aeb5c2", lineHeight: 1.7, maxWidth: 900 }}>
            Você pode usar a página inicial e consultar as informações sobre o serviço sem
            fazer login. Para recursos que exigem ações em uma plataforma, como enviar uma
            mensagem, você decide se deseja conectar a respectiva conta. O acesso pode ser
            desconectado no aCHATado e também revogado diretamente nas configurações da
            plataforma correspondente.
          </p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Link href="/privacy" style={{ color: "#a970ff" }}>Política de Privacidade</Link>
            <Link href="/terms" style={{ color: "#a970ff" }}>Termos de Serviço</Link>
            <a href="mailto:eloir.ferretti@gmail.com" style={{ color: "#a970ff" }}>
              Contato
            </a>
          </div>
        </div>
      </section>

      <footer
        style={{
          borderTop: "1px solid #252b37",
          color: "#697181",
          padding: "28px 0 42px",
        }}
      >
        <div style={wrapStyle}>
          <strong style={{ color: "#aeb5c2" }}>aCHATado</strong>
          <p style={{ lineHeight: 1.65, marginBottom: 0 }}>
            Projeto independente. Não é afiliado, patrocinado ou endossado por Twitch, Kick,
            Google ou YouTube.
          </p>
        </div>
      </footer>
    </main>
  );
}
