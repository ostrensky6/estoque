import { InstitutionalPage } from "@/components/layout/InstitutionalPage";

export default function SuportePage() {
  return (
    <InstitutionalPage
      title="Suporte"
      description="A estrutura definitiva de atendimento do Kontrol está em preparação. Nenhum canal externo ou prazo oficial é publicado neste momento."
    >
      <section aria-labelledby="suporte-ajuda" className="border-t border-border pt-6">
        <h2 id="suporte-ajuda" className="text-base font-semibold text-foreground">
          Como buscar ajuda
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Caso sua organização já tenha um canal interno acordado para o Kontrol,
          utilize esse fluxo. Esta página será atualizada quando houver um canal
          institucional validado.
        </p>
      </section>

      <section aria-labelledby="suporte-informacoes" className="border-t border-border pt-6">
        <h2 id="suporte-informacoes" className="text-base font-semibold text-foreground">
          Informações úteis
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ao relatar um problema, registre a rota acessada, a ação realizada e a
          mensagem exibida. Não inclua senhas, chaves, tokens ou outros segredos.
        </p>
      </section>
    </InstitutionalPage>
  );
}
