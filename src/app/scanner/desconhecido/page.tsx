import Link from "next/link";
import { TriagemCodigoDesconhecidoForm } from "@/components/scanner/TriagemCodigoDesconhecidoForm";
import { prepararTriagemCadastro } from "@/lib/scanner/triagem";

export const dynamic = "force-dynamic";

type SearchParams = {
  codigo?: string;
  triagem?: string;
};

function mensagemTriagem(status?: string) {
  if (status === "registrada") {
    return "Triagem registrada como pendente.";
  }
  if (status === "existente") {
    return "Ja existe uma triagem pendente para este codigo.";
  }
  return null;
}

export default async function CodigoDesconhecidoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { codigo: codigoRaw = "", triagem } = await searchParams;
  const codigo = codigoRaw.trim();
  const detalhes = codigo ? prepararTriagemCadastro(codigo) : null;
  const mensagem = mensagemTriagem(triagem);

  return (
    <main className="mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-xl font-semibold text-foreground">
        Codigo nao encontrado
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O Kontrol nao encontrou uma entidade ativa para este codigo. Registre uma triagem para
        analise posterior, sem criar cadastro incompleto.
      </p>

      {codigo ? (
        <>
          <p className="mt-4 rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
            {codigo}
          </p>
          <dl className="mt-4 grid gap-2 rounded-md border border-border p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Formato</dt>
              <dd className="font-medium text-foreground">
                {detalhes?.formato ?? "desconhecido"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tipo sugerido</dt>
              <dd className="font-medium text-foreground">
                {detalhes?.tipoSugerido ?? "nao identificado"}
              </dd>
            </div>
          </dl>
          {mensagem && (
            <p className="mt-4 rounded-md border border-success-strong/30 bg-success-soft px-3 py-2 text-sm text-success-strong">
              {mensagem}
            </p>
          )}
          <TriagemCodigoDesconhecidoForm codigo={codigo} />
          <Link
            href="/scanner/triagem"
            className="mt-3 inline-flex text-sm font-medium text-brand-700 hover:text-brand-600 dark:text-brand-300"
          >
            Ver triagens pendentes
          </Link>
        </>
      ) : (
        <p className="mt-4 rounded-md border border-warning-strong/30 bg-warning-soft px-3 py-2 text-sm text-warning-strong">
          Nenhum codigo foi informado para triagem.
        </p>
      )}
    </main>
  );
}
