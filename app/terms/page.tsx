import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Serviço | aCHATado",
  description: "Termos de Serviço do aCHATado.",
};

export default function TermsPage() {
  return (
    <main className="legalPage">
      <div className="legalCard">
        <Link className="legalBack" href="/">← Voltar ao aCHATado</Link>
        <h1>Termos de Serviço</h1>
        <p className="legalUpdated">Última atualização: 1º de outubro de 2026</p>

        <p>
          Estes Termos de Serviço regulam o uso do aCHATado, ferramenta que reúne chats
          de transmissões da Twitch, Kick e YouTube e permite, quando autorizado, o envio
          de mensagens por contas conectadas pelo próprio usuário.
        </p>

        <h2>1. Aceitação</h2>
        <p>
          Ao utilizar o aCHATado, você concorda com estes Termos e se compromete a utilizar
          o serviço de acordo com a legislação aplicável e com as regras das plataformas
          integradas.
        </p>

        <h2>2. Contas conectadas</h2>
        <p>
          A conexão com Twitch, Kick ou Google/YouTube é opcional e ocorre por OAuth nas
          páginas oficiais das respectivas plataformas. Você é responsável pela conta que
          conectar e pelas mensagens enviadas por meio dela.
        </p>

        <h2>3. Uso permitido</h2>
        <p>
          Você não deve utilizar o aCHATado para enviar spam, praticar assédio, contornar
          moderação, violar direitos de terceiros ou realizar atividades proibidas pelos
          termos da Twitch, Kick, Google/YouTube ou pela legislação aplicável.
        </p>

        <h2>4. Conteúdo de terceiros</h2>
        <p>
          Mensagens, nomes, avatares, emotes e outros conteúdos exibidos pelo aCHATado são
          originados das plataformas e de seus usuários. O aCHATado não controla nem endossa
          o conteúdo publicado por terceiros.
        </p>

        <h2>5. Disponibilidade</h2>
        <p>
          O serviço depende de APIs, autenticação, limites, webhooks e infraestrutura de
          terceiros. Por isso, funcionalidades podem ficar temporariamente indisponíveis,
          atrasadas ou sujeitas a alterações quando esses fornecedores modificarem seus
          serviços.
        </p>

        <h2>6. Sem garantia de entrega</h2>
        <p>
          O aCHATado tenta enviar mensagens pelas APIs oficiais das plataformas. A entrega,
          publicação e visibilidade final de uma mensagem também dependem das regras de chat,
          filtros, moderação, permissões, bloqueios e disponibilidade da plataforma de destino.
        </p>

        <h2>7. Propriedade intelectual</h2>
        <p>
          Twitch, Kick, YouTube, Google e demais marcas citadas pertencem aos seus respectivos
          titulares. O uso de nomes e integrações tem finalidade exclusivamente funcional e
          identificadora.
        </p>

        <h2>8. Suspensão e alterações</h2>
        <p>
          Recursos do serviço podem ser modificados, suspensos ou removidos quando necessário
          para manutenção, segurança, conformidade ou adaptação a mudanças das plataformas.
        </p>

        <h2>9. Responsabilidade</h2>
        <p>
          Na medida permitida pela legislação aplicável, o aCHATado é fornecido no estado em
          que se encontra e não garante funcionamento ininterrupto das integrações externas.
          Nada nestes Termos exclui direitos que não possam ser afastados por lei.
        </p>

        <h2>10. Contato</h2>
        <p>
          Dúvidas sobre estes Termos podem ser enviadas para{" "}
          <a href="mailto:eloir.ferretti@gmail.com">eloir.ferretti@gmail.com</a>.
        </p>

        <h2>11. Independência das plataformas</h2>
        <p>
          O aCHATado é um projeto independente e não é afiliado, patrocinado ou endossado
          pela Twitch, Kick, Google ou YouTube.
        </p>
      </div>
    </main>
  );
}
