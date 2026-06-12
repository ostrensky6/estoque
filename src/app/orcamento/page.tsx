import Link from "next/link";
import { createClientUntyped } from "@/lib/supabase/server";
import { criarOrcamento } from "@/lib/actions/orcamentos";

export const dynamic = "force-dynamic";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  enviado: { label: "Enviado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  aprovado: { label: "Aprovado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  recusado: { label: "Recusado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

type ItemTot = { n_amostras: number; preco_unitario: number };

export default async function OrcamentosPage() {
  const supabase = await createClientUntyped();
  const [{ data: orcamentos }, { data: projetos }] = await Promise.all([
    supabase
      .from("orcamentos")
      .select(
        "id, cliente_nome, cliente_cnpj, data_orcamento, status, criado_em, projeto_id, orcamento_itens(n_amostras, preco_unitario)",
      )
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome"),
  ]);
  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));

  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Documentos por cliente: dados cadastrais, análises solicitadas e valor
          final. Cada orçamento guarda o preço do momento em que foi emitido.
        </p>

        {/* novo orçamento */}
        <form
          action={criarOrcamento}
          className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex-1 min-w-56">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Cliente
            </label>
            <input
              name="cliente_nome"
              placeholder="Ex.: Embrapa Suínos e Aves"
              className={`${inp} mt-1 w-full`}
            />
          </div>
          <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            + Novo orçamento
          </button>
        </form>

        {/* lista */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Projeto</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-right">Análises</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(orcamentos ?? []).map((o) => {
                const itens = (o.orcamento_itens as ItemTot[]) ?? [];
                const total = itens.reduce(
                  (a, it) => a + Number(it.preco_unitario) * Number(it.n_amostras),
                  0,
                );
                const st = STATUS[o.status] ?? { label: o.status, cls: "bg-zinc-100" };
                return (
                  <tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/orcamento/${o.id}`}
                        className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        {o.cliente_nome}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{o.projeto_id != null ? projetoNome.get(o.projeto_id) ?? "—" : "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{o.data_orcamento ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{itens.length}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {brl(total)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(orcamentos ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                    Nenhum orçamento ainda. Crie o primeiro acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
