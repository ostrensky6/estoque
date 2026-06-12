import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { criarPedido } from "@/lib/actions/compras";

export const dynamic = "force-dynamic";

const fmt = (v: number | null) => (v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const STATUS: Record<string, { label: string; cls: string }> = {
  solicitado: { label: "Solicitado", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  aprovado: { label: "Aprovado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  enviado: { label: "Enviado", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300" },
  recebido: { label: "Recebido", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

export default async function ComprasPage() {
  const supabase = await createClient();
  const [{ data: pedidos }, { data: fornecedores }, { data: saldo }] = await Promise.all([
    supabase
      .from("pedidos_compra")
      .select("id, status, projeto, solicitante, data_solicitacao, fornecedores(nome)")
      .order("criado_em", { ascending: false }),
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("v_estoque_saldo").select("*"),
  ]);

  // sugestões de compra: disponível abaixo do ponto de reposição
  const sugestoes = (saldo ?? [])
    .filter((s) => (s.ponto_reposicao ?? 0) > 0 && (s.disponivel ?? 0) <= (s.ponto_reposicao ?? 0))
    .map((s) => ({
      especificacao: s.especificacao,
      disponivel: s.disponivel ?? 0,
      ponto: s.ponto_reposicao ?? 0,
      sugerido: Math.max(0, (s.ponto_reposicao ?? 0) + (s.estoque_seguranca ?? 0) - (s.disponivel ?? 0)),
      categoria: s.categoria_compra,
    }))
    .sort((a, b) => b.sugerido - a.sugerido);

  const inp = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Compras</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Solicitação → aprovação → recebimento. O material recebido entra em
          quarentena até a aceitação.
        </p>

        {/* sugestões */}
        {sugestoes.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Sugestões de compra ({sugestoes.length}) — abaixo do ponto de reposição
            </h2>
            <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-200">
              {sugestoes.slice(0, 8).map((s, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span className="truncate">
                    {s.categoria === "critico" && "🔴 "}
                    {s.especificacao}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    disp. {fmt(s.disponivel)} · comprar ~{fmt(s.sugerido)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* novo pedido */}
        <form action={criarPedido} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Fornecedor</label>
            <select name="fornecedor_id" className={`${inp} mt-1`} defaultValue="">
              <option value="">—</option>
              {(fornecedores ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Projeto / campanha</label>
            <input name="projeto" className={`${inp} mt-1 w-full`} />
          </div>
          <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            + Nova solicitação
          </button>
        </form>

        {/* lista */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Pedido</th>
                <th className="px-4 py-3 text-left">Fornecedor</th>
                <th className="px-4 py-3 text-left">Projeto</th>
                <th className="px-4 py-3 text-left">Solicitante</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(pedidos ?? []).map((p) => {
                const st = STATUS[p.status] ?? { label: p.status, cls: "bg-zinc-100" };
                const forn = (p.fornecedores as { nome: string | null } | null)?.nome;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/compras/${p.id}`} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                        #{p.id} · {p.data_solicitacao}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{forn ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{p.projeto ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{p.solicitante ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
              {(pedidos ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                    Nenhum pedido. Crie uma solicitação acima.
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
