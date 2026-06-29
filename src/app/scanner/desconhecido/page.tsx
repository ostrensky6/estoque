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
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Codigo nao encontrado
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        O Kontrol nao encontrou uma entidade ativa para este codigo. Registre uma triagem para
        analise posterior, sem criar cadastro incompleto.
      </p>

      {codigo ? (
        <>
          <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
            {codigo}
          </p>
          <dl className="mt-4 grid gap-2 rounded-md border border-slate-200 p-3 text-sm dark:border-zinc-800">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-zinc-400">Formato</dt>
              <dd className="font-medium text-slate-800 dark:text-zinc-100">
                {detalhes?.formato ?? "desconhecido"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-zinc-400">Tipo sugerido</dt>
              <dd className="font-medium text-slate-800 dark:text-zinc-100">
                {detalhes?.tipoSugerido ?? "nao identificado"}
              </dd>
            </div>
          </dl>
          {mensagem && (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
              {mensagem}
            </p>
          )}
          <TriagemCodigoDesconhecidoForm codigo={codigo} />
        </>
      ) : (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          Nenhum codigo foi informado para triagem.
        </p>
      )}
    </main>
  );
}
