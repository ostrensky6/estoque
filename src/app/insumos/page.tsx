import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { atualizarInsumoLinha } from "@/lib/actions/insumos";

export const dynamic = "force-dynamic";

const brl = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function InsumosPage({
  searchParams,
}: {
  searchParams: Promise<{ analise?: string }>;
}) {
  const { analise } = await searchParams;
  const supabase = await createClient();

  const { data: analises } = await supabase
    .from("analises")
    .select("codigo")
    .order("codigo");

  const atual = analise ?? analises?.[0]?.codigo ?? "";

  const { data: linhas } = await supabase
    .from("insumo_analise")
    .select(
      "id, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, modo_cobranca, insumos(custo_unitario)",
    )
    .eq("codigo_analise", atual)
    .order("id");

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Insumos por análise
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Edite <b>grupo de escolha</b> (alternativas mutuamente exclusivas) e{" "}
          <b>modo de cobrança</b> (por amostra ou por execução). As mudanças
          recalculam o custeio.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2">
          {analises?.map((a) => (
            <Link
              key={a.codigo}
              href={`/insumos?analise=${encodeURIComponent(a.codigo)}`}
              className={`rounded-full px-3 py-1 text-xs ${
                a.codigo === atual
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {a.codigo}
            </Link>
          ))}
        </nav>

        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left">Etapa / Atividade</th>
                <th className="px-3 py-2 text-left">Insumo</th>
                <th className="px-3 py-2 text-right">Custo un.</th>
                <th className="px-3 py-2 text-right">Qtd/am.</th>
                <th className="px-3 py-2 text-left">Grupo de escolha</th>
                <th className="px-3 py-2 text-left">Cobrança</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {linhas?.map((l) => {
                const custo =
                  (l.insumos as { custo_unitario: number | null } | null)
                    ?.custo_unitario ?? null;
                return (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {l.nome_etapa}
                      <br />
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {l.nome_atividade}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate" title={l.especificacao_insumo ?? ""}>
                      {l.especificacao_insumo ?? (
                        <span className="text-red-500">(sem insumo)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {brl(custo)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.quantidade_por_amostra ?? "—"}
                    </td>
                    <td colSpan={3} className="px-3 py-2">
                      <form action={atualizarInsumoLinha} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={l.id} />
                        <input
                          name="grupo_escolha"
                          defaultValue={l.grupo_escolha ?? ""}
                          placeholder="(nenhum)"
                          className="w-44 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        <select
                          name="modo_cobranca"
                          defaultValue={l.modo_cobranca ?? ""}
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="">por amostra (padrão)</option>
                          <option value="por_amostra">por amostra</option>
                          <option value="por_execucao">por execução</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded bg-zinc-900 px-3 py-1 text-xs text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
                        >
                          Salvar
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          {linhas?.length ?? 0} linhas · análise {atual}
        </p>
      </main>
    </div>
  );
}
