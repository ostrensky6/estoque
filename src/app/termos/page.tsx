import { InstitutionalPage } from "@/components/layout/InstitutionalPage";

export default function TermosPage() {
  return (
    <InstitutionalPage
      title="Termos de uso"
      description="Os termos de uso definitivos do Kontrol estão em preparação e serão publicados após revisão responsável."
    >
      <section aria-labelledby="termos-uso" className="border-t border-border pt-6">
        <h2 id="termos-uso" className="text-base font-semibold text-foreground">
          Uso responsável
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Utilize sua conta individual somente para atividades autorizadas e
          preserve a confidencialidade das credenciais e das informações acessadas.
        </p>
      </section>

      <section aria-labelledby="termos-preparacao" className="border-t border-border pt-6">
        <h2 id="termos-preparacao" className="text-base font-semibold text-foreground">
          Documento em preparação
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Este conteúdo é informativo e não estabelece condições jurídicas finais,
          níveis de serviço ou compromissos ainda não formalizados.
        </p>
      </section>
    </InstitutionalPage>
  );
}
