import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import {
  adicionarItemPedido,
  removerItemPedido,
  receberItemPedido,
} from "@/lib/actions/compras";
import { PedidoAcoes } from "@/components/compras/PedidoAcoes";
import { listarEventos } from "@/lib/actions/eventos";
import { Timeline } from "@/components/common/Timeline";
import { formatNumber as fmt, formatCurrency as brl } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  solicitado: "Solicitado",
  aprovado: "Aprovado",
  enviado: "Enviado",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

export default async function PedidoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedidoId = Number(id);
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos_compra")
    .select("*, fornecedores(nome)")
    .eq("id", pedidoId)
    .single();
  if (!pedido) notFound();

  const [{ data: itens }, { data: insumos }, podeGerir] = await Promise.all([
    supabase
      .from("pedidos_compra_itens")
      .select("id, quantidade, custo_unitario_estimado, lote_id, insumos(especificacao, unidade)")
      .eq("pedido_id", pedidoId)
      .order("id"),
    supabase.from("insumos").select("id, especificacao").order("especificacao"),
    temPapel("coordenador"),
  ]);

  const eventos = await listarEventos("pedido_compra", pedidoId);
  const editavel = pedido.status === "solicitado";
  const recebivel = (pedido.status === "aprovado" || pedido.status === "enviado") && podeGerir;
  const forn = (pedido.fornecedores as { nome: string | null } | null)?.nome;
  const total = (itens ?? []).reduce(
    (a, it) => a + Number(it.quantidade) * Number(it.custo_unitario_estimado ?? 0),
    0,
  );
  const inp = "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/compras" className="text-xs text-zinc-500 hover:underline">← Compras</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Pedido #{pedido.id}</h1>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">
            {STATUS[pedido.status] ?? pedido.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {forn ? `Fornecedor: ${forn} · ` : ""}
          {pedido.projeto ? `Projeto: ${pedido.projeto} · ` : ""}
          Solicitante: {pedido.solicitante ?? "—"}
          {pedido.aprovador ? ` · Aprovado por ${pedido.aprovador}` : ""}
          {pedido.data_prevista_entrega ? ` · Previsão: ${pedido.data_prevista_entrega}` : ""}
        </p>

        {/* itens */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Itens</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-4 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Custo est.</th>
                  <th className="px-4 py-3 text-center">Recebido</th>
                  {(editavel || recebivel) && <th className="px-4 py-3 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(itens ?? []).map((it) => {
                  const ins = it.insumos as { especificacao: string | null; unidade: string | null } | null;
                  return (
                    <tr key={it.id}>
                      <td className="px-4 py-2.5 max-w-xs truncate" title={ins?.especificacao ?? ""}>{ins?.especificacao}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(it.quantidade)} {ins?.unidade ?? ""}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{brl(it.custo_unitario_estimado)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {it.lote_id ? (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">✓ lote {it.lote_id}</span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      {(editavel || recebivel) && (
                        <td className="px-4 py-2.5 text-right">
                          {editavel && (
                            <form action={removerItemPedido} className="inline">
                              <input type="hidden" name="item_id" value={it.id} />
                              <input type="hidden" name="pedido_id" value={pedidoId} />
                              <button className="text-xs text-red-600 hover:underline">Remover</button>
                            </form>
                          )}
                          {recebivel && !it.lote_id && (
                            <form action={receberItemPedido} className="inline-flex items-center gap-1">
                              <input type="hidden" name="item_id" value={it.id} />
                              <input type="hidden" name="pedido_id" value={pedidoId} />
                              <input name="validade" type="date" className={inp} title="Validade do lote" />
                              <input name="codigo" placeholder="lote" className={`${inp} w-20`} />
                              <button className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-500">Receber</button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {(itens ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">Nenhum item.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-right text-sm text-zinc-500">Total estimado: <b>{brl(total)}</b></p>

          {editavel && (
            <form action={adicionarItemPedido} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="pedido_id" value={pedidoId} />
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Insumo</label>
                <select name="insumo_id" className={inp} defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  {(insumos ?? []).map((i) => (
                    <option key={i.id} value={i.id}>{i.especificacao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Qtd</label>
                <input name="quantidade" type="number" min="0" step="any" className={`${inp} w-24`} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Custo un. est.</label>
                <input name="custo_unitario_estimado" type="number" min="0" step="0.01" className={`${inp} w-28`} />
              </div>
              <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">Adicionar</button>
            </form>
          )}
        </section>

        {/* ações de status */}
        <section className="mt-8">
          <PedidoAcoes pedidoId={pedidoId} status={pedido.status} podeGerir={podeGerir} />
        </section>

        <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Linha do tempo</h2>
          <div className="mt-3">
            <Timeline eventos={eventos} />
          </div>
        </section>
      </main>
    </div>
  );
}
