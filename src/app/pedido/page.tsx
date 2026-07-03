import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { criarPedidoInterno } from "@/lib/actions/pedidos-internos";
import { PedidosInternosTable, type PedidoInternoRow } from "@/components/pedido/PedidosInternosTable";
import type { PedidoItemView } from "@/components/pedido/PedidoItensQuickView";
import { pedidoInternoNumero, pedidoInternoStatus } from "@/lib/pedido/status";
import { formatCurrency as brl, formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function PedidoPage() {
  const supabase = await createClient();
  const [{ data: pedidos }, { data: projetos }, podeExcluir] = await Promise.all([
    supabase
      .from("pedidos_internos")
      .select("id, titulo, status, solicitante, data_necessidade, urgencia, criado_em, projetos(nome), pedidos_internos_itens(id, tipo, especificacao, modelo, volume, quantidade, unidade, orcamento_previo, fornecedor_sugerido)")
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome").order("nome"),
    temPapel("coordenador"),
  ]);

  const rows: PedidoInternoRow[] = (pedidos ?? []).map((pedido) => {
    const itens = ((pedido.pedidos_internos_itens ?? []) as PedidoItemView[]) ?? [];
    const total = itens.reduce(
      (acc, item) => acc + Number(item.quantidade ?? 0) * Number(item.orcamento_previo ?? 0),
      0,
    );
    const status = pedidoInternoStatus(pedido.status);
    const projeto = (pedido.projetos as { nome: string | null } | null)?.nome ?? "—";
    return {
      id: pedido.id,
      numero: pedidoInternoNumero(pedido.id),
      titulo: pedido.titulo,
      projeto,
      solicitante: pedido.solicitante ?? "—",
      necessidade: formatDate(pedido.data_necessidade),
      urgencia: pedido.urgencia ?? "normal",
      itens: itens.length,
      itensDetalhe: itens,
      total: brl(total),
      status: pedido.status,
      statusLabel: status.label,
    };
  });

  const inputCls = "mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Pedido</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Demandas internas do GATGF para materiais e serviços antes da compra formal.
            </p>
          </div>
          <div className="grid min-w-56 grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-muted-foreground">Abertos</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {rows.filter((row) => !["cancelado", "compra_concluida"].includes(row.status)).length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-muted-foreground">Em validação</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {rows.filter((row) => row.status === "em_validacao").length}
              </p>
            </div>
          </div>
        </div>

        <form action={criarPedidoInterno} className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-muted-foreground">Demanda inicial</label>
            <input name="titulo" required placeholder="Ex.: Reagentes para sequenciamento de junho" className={inputCls} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-muted-foreground">Projeto</label>
            <select name="projeto_id" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {(projetos ?? []).map((projeto) => (
                <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground">Necessidade</label>
            <input name="data_necessidade" type="date" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground">Urgência</label>
            <select name="urgencia" defaultValue="normal" className={inputCls}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-muted-foreground">Fonte provável</label>
            <input name="fonte_recurso" placeholder="Projeto, convênio, recurso interno..." className={inputCls} />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-muted-foreground">Justificativa</label>
            <input name="justificativa" placeholder="Experimentos, análises ou problema que originou a compra" className={inputCls} />
          </div>
          <div className="flex items-end md:col-span-2">
            <button className="h-10 w-full rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500">
              Novo pedido
            </button>
          </div>
        </form>

        <div className="mt-6">
          <PedidosInternosTable rows={rows} podeExcluir={podeExcluir} />
        </div>
      </main>
    </div>
  );
}
