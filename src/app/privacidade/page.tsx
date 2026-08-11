import Link from "next/link";

import { InstitutionalPage } from "@/components/layout/InstitutionalPage";

export default function PrivacidadePage() {
  return (
    <InstitutionalPage
      title="Privacidade"
      description="A política de privacidade definitiva do Kontrol está em preparação e será publicada após validação responsável."
    >
      <section aria-labelledby="privacidade-compromisso" className="border-t border-border pt-6">
        <h2 id="privacidade-compromisso" className="text-base font-semibold text-foreground">
          Compromisso atual
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          O Kontrol utiliza dados necessários para autenticação e para as rotinas
          administrativas disponibilizadas ao usuário. Esta página não substitui
          a política jurídica definitiva.
        </p>
      </section>

      <section aria-labelledby="privacidade-cuidados" className="border-t border-border pt-6">
        <h2 id="privacidade-cuidados" className="text-base font-semibold text-foreground">
          Cuidados ao usar o sistema
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Não compartilhe senhas, chaves de acesso ou informações sensíveis fora
          dos fluxos autorizados. Para orientações adicionais, consulte a{" "}
          <Link
            href="/suporte"
            className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
          >
            página de suporte
          </Link>
          .
        </p>
      </section>
    </InstitutionalPage>
  );
}
