import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClientUntyped } from "@/lib/supabase/admin";
import { computarDemandaPlano } from "@/lib/costing/demanda";
import { adicionarItem, removerItem, excluirPlano } from "@/lib/actions/planejamento";
import { PlanoAcoes } from "@/components/planejamento/PlanoAcoes";

export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default async function PlanoDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const planId = Number(id);
  const supabase = createAdminClientUntyped();

  const { data: plano } = await supabase
    .from("planejamento")
    .select("*")
    .eq("id", planId)
    .single();
  if (!plano) notFound();

  const [{ data: itens }, { data: analises }, { data: reservas }] = await Promise.all([
    supabase.from("planejamento_itens").select("id, codigo_analise, n_amostras, n_controles, repeticoes, perda_percentual").eq("planejamento_id", planId).order("id"),
    supabase.from("analises").select("codigo").order("codigo"),
    supabase.from("reservas_estoque").select("status").eq("planejamento_id", planId),
  ]);

  const demanda = await computarDemandaPlano(supabase, planId);

  const rs = (reservas ?? []) as { status: string }[];
  const status = rs.some((r) => r.status === "consumido")
    ? "Iniciado"
    : rs.some((r) => r.status === "reservado")
      ? "Reservado"
      : rs.length > 0
        ? "Liberado"
        : "Rascunho";
  const temFalta = demanda.some((d) => d.falta > 0);

  const inp = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/planejamento" className="text-xs text-zinc-500 hover:underline">
          ← Planejamento
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{plano.nome}</h1>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">
            {status}
          </span>
        </div>
        {plano.data_alvo && (
          <p className="mt-1 text-sm text-zinc-500">Data alvo: {plano.data_alvo}</p>
        )}

        {/* itens do plano */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Análises do plano
          </h2>
          <div className="mt-3 space-y-2">
            {(itens ?? []).map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <span>
                  <span className="font-medium">{it.codigo_analise}</span>
                  <span className="text-zinc-500">
                    {" · "}{fmt(it.n_amostras)} amostras
                    {(it.n_controles ?? 0) > 0 ? ` + ${fmt(it.n_controles)} controles` : ""}
                    {(it.repeticoes ?? 1) !== 1 ? ` × ${fmt(it.repeticoes)} rep.` : ""}
                    {(it.perda_percentual ?? 0) > 0 ? ` · ${fmt(it.perda_percentual)}% perda` : ""}
                  </span>
                </span>
                <form action={removerItem}>
                  <input type="hidden" name="item_id" value={it.id} />
                  <input type="hidden" name="planejamento_id" value={planId} />
                  <button className="text-xs text-red-600 hover:underline">Remover</button>
                </form>
              </div>
            ))}
            {(itens ?? []).length === 0 && (
              <p className="text-sm text-zinc-400">Nenhuma análise. Adicione abaixo.</p>
            )}
          </div>

          <form action={adicionarItem} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="planejamento_id" value={planId} />
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Análise</label>
              <select name="codigo_analise" className={inp} defaultValue="">
                <option value="" disabled>Selecione…</option>
                {(analises ?? []).map((a) => (
                  <option key={a.codigo} value={a.codigo}>{a.codigo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Amostras</label>
              <input name="n_amostras" type="number" min="1" step="1" className={`${inp} w-24`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Controles</label>
              <input name="n_controles" type="number" min="0" step="1" defaultValue="0" className={`${inp} w-24`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Repetições</label>
              <input name="repeticoes" type="number" min="1" step="1" defaultValue="1" className={`${inp} w-24`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">% perda</label>
              <input name="perda_percentual" type="number" min="0" step="1" defaultValue="0" className={`${inp} w-20`} />
            </div>
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
              Adicionar
            </button>
          </form>
        </section>

        {/* demanda */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Demanda de insumos {temFalta && <span className="text-amber-600">· há faltas</span>}
          </h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-4 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-left">Un.</th>
                  <th className="px-4 py-3 text-right">Demanda</th>
                  <th className="px-4 py-3 text-right">Disponível</th>
                  <th className="px-4 py-3 text-right">Falta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {demanda.map((d) => (
                  <tr key={d.insumo_id} className={d.falta > 0 ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                    <td className="px-4 py-2 max-w-sm truncate" title={d.especificacao}>{d.especificacao}</td>
                    <td className="px-4 py-2 text-zinc-500">{d.unidade ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(d.demanda)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{fmt(d.disponivel)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${d.falta > 0 ? "text-amber-700 dark:text-amber-400" : "text-zinc-400"}`}>
                      {d.falta > 0 ? fmt(d.falta) : "—"}
                    </td>
                  </tr>
                ))}
                {demanda.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                      Adicione análises para calcular a demanda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ações */}
        <section className="mt-8">
          <PlanoAcoes planId={planId} />
          <form action={excluirPlano} className="mt-6">
            <input type="hidden" name="planejamento_id" value={planId} />
            <button className="text-xs text-zinc-400 hover:text-red-600">Excluir plano</button>
          </form>
        </section>
      </main>
    </div>
  );
}
