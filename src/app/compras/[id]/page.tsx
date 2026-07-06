import { notFound } from "next/navigation";
import Link from "next/link";
import { createClientUntyped } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import {
  adicionarItemPedido,
  removerItemPedido,
} from "@/lib/actions/compras";
import { PedidoAcoes } from "@/components/compras/PedidoAcoes";
import { ScannerRecebimentoCompra } from "@/components/compras/ScannerRecebimentoCompra";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
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

type PedidoCompraItemRow = {
  id: number;
  quantidade: number;
  quantidade_recebida: number | null;
  divergencia_recebimento: string | null;
  custo_unitario_estimado: number | null;
  lote_id: number | null;
  pedido_interno_item_id: number | null;
  insumo_id: number | null;
  insumos: { especificacao: string | null; unidade: string | null } | null;
  pedidos_internos_itens?: { pedido_interno_id: number | null } | null;
};

type PedidoCompraItensQuery = {
  select: (columns: string) => {
    eq: (column: string, value: number) => {
      order: (column: string) => PromiseLike<{ data: PedidoCompraItemRow[] | null; error: unknown }>;
    };
  };
};

export default async function PedidoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedidoId = Number(id);
  const supabase = await createClientUntyped();

  const { data: pedido } = await supabase
    .from("pedidos_compra")
    .select("*, fornecedores(nome)")
    .eq("id", pedidoId)
    .single();
  if (!pedido) notFound();

  const [{ data: itens }, { data: insumos }, podeGerir] = await Promise.all([
    (supabase.from("pedidos_compra_itens") as unknown as PedidoCompraItensQuery)
      .select("id, quantidade, quantidade_recebida, divergencia_recebimento, custo_unitario_estimado, lote_id, pedido_interno_item_id, insumo_id, insumos(especificacao, unidade), pedidos_internos_itens(pedido_interno_id)")
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
  const inp = "rounded-md border border-input bg-card px-2 py-1.5 text-sm font-medium text-brand-700 dark:text-brand-300"; // §8.2: entrada em azul

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <Breadcrumbs items={[{ label: "Compras", href: "/compras" }, { label: `Pedido #${pedido.id}` }]} />
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Pedido #{pedido.id}</h1>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {STATUS[pedido.status] ?? pedido.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {forn ? `Fornecedor: ${forn} · ` : ""}
          {pedido.projeto ? `Projeto: ${pedido.projeto} · ` : ""}
          Solicitante: {pedido.solicitante ?? "—"}
          {pedido.aprovador ? ` · Aprovado por ${pedido.aprovador}` : ""}
          {pedido.data_prevista_entrega ? ` · Previsão: ${pedido.data_prevista_entrega}` : ""}
        </p>

        {/* itens */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Itens</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-transparent text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-left">Origem</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Custo est.</th>
                  <th className="px-4 py-3 text-center">Recebido</th>
                  {(editavel || recebivel) && <th className="px-4 py-3 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {(itens ?? []).map((it) => {
                  const ins = it.insumos as { especificacao: string | null; unidade: string | null } | null;
                  return (
                    <tr key={it.id}>
                      <td className="px-4 py-2.5 max-w-xs truncate" title={ins?.especificacao ?? ""}>{ins?.especificacao}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {it.pedidos_internos_itens?.pedido_interno_id ? (
                          <Link href={`/pedido/${it.pedidos_internos_itens.pedido_interno_id}`} className="text-primary hover:underline">
                            Pedido interno #{it.pedidos_internos_itens.pedido_interno_id}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(it.quantidade)} {ins?.unidade ?? ""}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{brl(it.custo_unitario_estimado)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {it.lote_id ? (
                          <span className="inline-flex flex-col items-center gap-0.5">
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">✓ lote {it.lote_id}</span>
                            {it.divergencia_recebimento && (
                              <span className="text-[10px] text-warning-strong">
                                {it.divergencia_recebimento}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/80">—</span>
                        )}
                      </td>
                      {(editavel || recebivel) && (
                        <td className="px-4 py-2.5 text-right">
                          {editavel && (
                            <form action={removerItemPedido} className="inline">
                              <input type="hidden" name="item_id" value={it.id} />
                              <input type="hidden" name="pedido_id" value={pedidoId} />
                              <button className="text-xs text-danger-strong hover:underline">Remover</button>
                            </form>
                          )}
                          {recebivel && !it.lote_id && (
                            <ScannerRecebimentoCompra
                              item={{
                                id: it.id,
                                pedidoId,
                                quantidade: Number(it.quantidade),
                                insumoId: it.insumo_id,
                                insumoDescricao: ins?.especificacao ?? null,
                                unidade: ins?.unidade ?? null,
                              }}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {(itens ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground/80">Nenhum item.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-right text-sm text-muted-foreground">Total estimado: <b>{brl(total)}</b></p>

          {editavel && (
            <form action={adicionarItemPedido} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="pedido_id" value={pedidoId} />
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Insumo</label>
                <select name="insumo_id" className={inp} defaultValue="">
                  <option value="" disabled>Selecione…</option>
                  {(insumos ?? []).map((i) => (
                    <option key={i.id} value={i.id}>{i.especificacao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Qtd</label>
                <input name="quantidade" type="number" min="0" step="any" className={`${inp} w-24`} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Custo un. est.</label>
                <input name="custo_unitario_estimado" type="number" min="0" step="0.01" className={`${inp} w-28`} />
              </div>
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Adicionar</button>
            </form>
          )}
        </section>

        {/* ações de status */}
        <section className="mt-8">
          <PedidoAcoes pedidoId={pedidoId} status={pedido.status} podeGerir={podeGerir} />
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Linha do tempo</h2>
          <div className="mt-3">
            <Timeline eventos={eventos} />
          </div>
        </section>
      </main>
    </div>
  );
}
