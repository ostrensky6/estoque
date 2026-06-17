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

  const inputCls = "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pedido</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Demandas internas do GATGF para materiais e serviços antes da compra formal.
            </p>
          </div>
          <div className="grid min-w-56 grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-zinc-500">Abertos</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {rows.filter((row) => !["cancelado", "compra_concluida"].includes(row.status)).length}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-zinc-500">Em validação</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {rows.filter((row) => row.status === "em_validacao").length}
              </p>
            </div>
          </div>
        </div>

        <form action={criarPedidoInterno} className="mt-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Demanda inicial</label>
            <input name="titulo" required placeholder="Ex.: Reagentes para sequenciamento de junho" className={inputCls} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Projeto</label>
            <select name="projeto_id" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {(projetos ?? []).map((projeto) => (
                <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Necessidade</label>
            <input name="data_necessidade" type="date" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Urgência</label>
            <select name="urgencia" defaultValue="normal" className={inputCls}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Fonte provável</label>
            <input name="fonte_recurso" placeholder="Projeto, convênio, recurso interno..." className={inputCls} />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Justificativa</label>
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
