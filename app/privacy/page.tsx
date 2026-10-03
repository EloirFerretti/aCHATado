import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade | aCHATado",
  description: "Política de Privacidade do aCHATado.",
};

export default function PrivacyPage() {
  return (
    <main className="legalPage">
      <div className="legalCard">
        <Link className="legalBack" href="/">← Voltar ao aCHATado</Link>
        <h1>Política de Privacidade</h1>
        <p className="legalUpdated">Última atualização: 1º de outubro de 2026</p>

        <p>
          O aCHATado é uma ferramenta independente que reúne chats de transmissões ao vivo
          da Twitch, Kick e YouTube em uma única interface. Esta Política de Privacidade
          explica quais dados podem ser tratados quando você utiliza o serviço.
        </p>

        <h2>1. Dados tratados</h2>
        <p>
          Quando você escolhe um canal para acompanhar, o aCHATado pode processar dados
          disponibilizados pelas plataformas de streaming, como nome de usuário, identificador
          da conta, avatar, cor do nome, badges, conteúdo da mensagem, horário, identificador
          da mensagem e identificador do canal.
        </p>
        <p>
          Ao conectar sua própria conta por OAuth, o aCHATado recebe tokens de autorização
          fornecidos pela respectiva plataforma para executar somente as ações que você
          autorizou, como identificar sua conta e enviar mensagens em seu nome.
        </p>

        <h2>2. Senhas e credenciais</h2>
        <p>
          O aCHATado não recebe nem armazena sua senha da Twitch, Kick ou Google/YouTube.
          A autenticação é realizada diretamente pelas páginas oficiais dessas plataformas.
          Os tokens de sessão usados pelo aCHATado são protegidos e armazenados em cookies
          HTTP-only no navegador.
        </p>

        <h2>3. Armazenamento de mensagens</h2>
        <p>
          Mensagens coletadas dos chats podem ser armazenadas no banco de dados do serviço
          para permitir a exibição do histórico recente e a sincronização entre as plataformas.
          Esses registros podem permanecer armazenados até exclusão administrativa ou até que
          uma solicitação válida de exclusão seja processada.
        </p>

        <h2>4. Serviços de terceiros</h2>
        <p>
          O aCHATado integra serviços e APIs da Twitch, Kick, Google/YouTube e provedores
          de emotes como BetterTTV, FrankerFaceZ e 7TV. O uso desses serviços também está
          sujeito às políticas e aos termos próprios de cada fornecedor.
        </p>

        <h2>5. Cookies</h2>
        <p>
          O serviço utiliza cookies estritamente necessários para manter sessões OAuth,
          validar fluxos de autenticação e preservar conexões autorizadas. O aCHATado não
          utiliza esses cookies para publicidade comportamental.
        </p>

        <h2>6. Compartilhamento de dados</h2>
        <p>
          O aCHATado não vende dados pessoais. Dados são transmitidos às plataformas
          integradas somente quando necessário para fornecer as funcionalidades solicitadas,
          como ler chats ou enviar uma mensagem pela conta conectada.
        </p>

        <h2>7. Controle da conta</h2>
        <p>
          Você pode desconectar suas contas diretamente no aCHATado. Também pode revogar
          o acesso do aplicativo nas configurações de segurança ou aplicativos conectados da
          Twitch, Kick ou Conta Google.
        </p>

        <h2>8. Solicitações de privacidade</h2>
        <p>
          Para solicitar informações, correção ou exclusão de dados relacionados ao uso do
          aCHATado, entre em contato pelo e-mail{" "}
          <a href="mailto:eloir.ferretti@gmail.com">eloir.ferretti@gmail.com</a>.
        </p>

        <h2>9. Alterações nesta política</h2>
        <p>
          Esta política pode ser atualizada para refletir mudanças no funcionamento do
          serviço, nas integrações ou em requisitos legais. A data de atualização será
          indicada no início desta página.
        </p>

        <h2>10. Independência das plataformas</h2>
        <p>
          O aCHATado é um projeto independente e não é afiliado, patrocinado ou endossado
          pela Twitch, Kick, Google ou YouTube.
        </p>
      </div>
    </main>
  );
}
