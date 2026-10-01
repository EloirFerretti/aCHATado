import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "aCHATado — Chat unificado para Twitch, Kick e YouTube",
  description:
    "O aCHATado reúne chats ao vivo da Twitch, Kick e YouTube em uma única interface e permite enviar mensagens pelas contas conectadas pelo próprio usuário.",
};

export default function HomePage() {
  return (
    <main className="shell homeShell">
      <header className="topbar homeTopbar">
        <a className="brand" href="/" aria-label="Página inicial do aCHATado">
          <div className="brandMark"><span>T</span><span>K</span><span>Y</span></div>
          <div>
            <h1>aCHATado</h1>
            <p>Twitch + Kick + YouTube em um só chat</p>
          </div>
        </a>

        <nav className="homeNav" aria-label="Navegação principal">
          <a href="/privacy">Privacidade</a>
          <a href="/terms">Termos</a>
          <a className="homeOpenButton" href="/chat">Abrir chat</a>
        </nav>
      </header>

      <section className="homeHero">
        <div className="homeHeroCopy">
          <div className="homeEyebrow">
            <span className="liveDot" />
            CHAT UNIFICADO PARA TRANSMISSÕES AO VIVO
          </div>

          <h2>Todos os chats.<br />Uma só conversa.</h2>

          <p className="homeLead">
            O aCHATado reúne mensagens da Twitch, Kick e YouTube em uma única interface.
            Escolha os canais que deseja acompanhar e, se quiser enviar mensagens, conecte
            suas próprias contas pelas APIs oficiais das plataformas.
          </p>

          <div className="homeActions">
            <a className="homePrimaryAction" href="/chat">Acessar o chat unificado</a>
            <a className="homeSecondaryAction" href="/privacy">Como seus dados são usados</a>
          </div>

          <div className="homePlatforms" aria-label="Plataformas compatíveis">
            <div><span className="platformIcon twitch">T</span><strong>Twitch</strong></div>
            <div><span className="platformIcon kick">K</span><strong>Kick</strong></div>
            <div><span className="platformIcon youtube">Y</span><strong>YouTube</strong></div>
          </div>
        </div>

        <div className="homePreview chatPanel" aria-label="Prévia visual do chat unificado">
          <div className="chatHeader">
            <div>
              <strong>Chat unificado</strong>
              <span>Twitch + Kick + YouTube</span>
            </div>
            <div className="status"><span /> sincronizando</div>
          </div>

          <div className="homePreviewMessages">
            <article className="message">
              <div className="avatarRing twitch"><span>A</span><span className="miniPlatform twitch">T</span></div>
              <div className="messageBody">
                <div className="meta">
                  <strong>alex_live</strong>
                  <span className="platformLabel twitch">Twitch</span>
                  <time>21:41</time>
                </div>
                <p>Boa live! O chat apareceu certinho aqui.</p>
              </div>
            </article>

            <article className="message">
              <div className="avatarRing kick"><span>M</span><span className="miniPlatform kick">K</span></div>
              <div className="messageBody">
                <div className="meta">
                  <strong>marina</strong>
                  <span className="platformLabel kick">Kick</span>
                  <time>21:42</time>
                </div>
                <p>Agora dá para acompanhar tudo em uma tela só.</p>
              </div>
            </article>

            <article className="message">
              <div className="avatarRing youtube"><span>R</span><span className="miniPlatform youtube">Y</span></div>
              <div className="messageBody">
                <div className="meta">
                  <strong>rafael</strong>
                  <span className="platformLabel youtube">YouTube</span>
                  <time>21:42</time>
                </div>
                <p>Mensagem do YouTube aparecendo junto com as outras.</p>
              </div>
            </article>
          </div>

          <div className="homePreviewComposer">
            <div className="sendVia">
              <span>Enviar pela</span>
              <div className="platformSwitch">
                <button type="button" className="selected twitch"><span>T</span>Twitch<i className="connected" /></button>
                <button type="button" className="kick"><span>K</span>Kick<i /></button>
                <button type="button" className="youtube"><span>Y</span>YouTube<i /></button>
              </div>
            </div>
            <div className="homeFakeInput">Digite sua mensagem… <span>0/500</span></div>
          </div>
        </div>
      </section>

      <section className="homeFeatureGrid">
        <article className="homeFeatureCard">
          <div className="homeFeatureIcon">∞</div>
          <h3>Chats em uma única tela</h3>
          <p>
            Acompanhe os canais selecionados sem alternar entre várias abas. Cada mensagem
            continua identificada pela plataforma de origem.
          </p>
        </article>

        <article className="homeFeatureCard">
          <div className="homeFeatureIcon">↗</div>
          <h3>Envio pelas contas conectadas</h3>
          <p>
            A conexão com Twitch, Kick ou Google/YouTube é opcional e feita por OAuth.
            O aCHATado não solicita nem recebe a senha dessas contas.
          </p>
        </article>

        <article className="homeFeatureCard">
          <div className="homeFeatureIcon">✓</div>
          <h3>Você mantém o controle</h3>
          <p>
            As autorizações podem ser desconectadas no aCHATado ou revogadas diretamente
            nas configurações da plataforma correspondente.
          </p>
        </article>
      </section>

      <section className="homeInfoPanel">
        <div>
          <span className="sidebarTitle homeInfoLabel">PRIVACIDADE E TRANSPARÊNCIA</span>
          <h2>Conecte apenas o que quiser.</h2>
          <p>
            A página inicial é pública e pode ser consultada sem login. Uma conta só é
            conectada quando você decide usar recursos que dependem dela, como enviar uma
            mensagem no chat. O aCHATado é um projeto independente e não é afiliado,
            patrocinado ou endossado por Twitch, Kick, Google ou YouTube.
          </p>
        </div>
        <div className="homeInfoLinks">
          <a href="/privacy">Política de Privacidade</a>
          <a href="/terms">Termos de Serviço</a>
          <a href="mailto:eloir.ferretti@gmail.com">Contato</a>
        </div>
      </section>

      <footer className="siteFooter homeFooter">
        <span>aCHATado</span>
        <nav aria-label="Links legais">
          <a href="/privacy">Política de Privacidade</a>
          <a href="/terms">Termos de Serviço</a>
        </nav>
      </footer>
    </main>
  );
}
