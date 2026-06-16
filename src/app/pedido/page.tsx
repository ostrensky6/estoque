import { createClient } from "@/lib/supabase/server";
import { criarPedidoInterno } from "@/lib/actions/pedidos-internos";
import { PedidosInternosTable, type PedidoInternoRow } from "@/components/pedido/PedidosInternosTable";
import { pedidoInternoStatus } from "@/lib/pedido/status";
import { formatCurrency as brl, formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type PedidoItemResumo = {
  quantidade: number | null;
  orcamento_previo: number | null;
};

export default async function PedidoPage() {
  const supabase = await createClient();
  const [{ data: pedidos }, { data: projetos }, { data: planos }] = await Promise.all([
    supabase
      .from("pedidos_internos")
      .select("id, titulo, status, solicitante, data_necessidade, criado_em, projetos(nome), pedidos_internos_itens(quantidade, orcamento_previo)")
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome").order("nome"),
    supabase.from("planejamento").select("id, nome, data_alvo").order("criado_em", { ascending: false }).limit(50),
  ]);

  const rows: PedidoInternoRow[] = (pedidos ?? []).map((pedido) => {
    const itens = ((pedido.pedidos_internos_itens ?? []) as PedidoItemResumo[]) ?? [];
    const total = itens.reduce(
      (acc, item) => acc + Number(item.quantidade ?? 0) * Number(item.orcamento_previo ?? 0),
      0,
    );
    const status = pedidoInternoStatus(pedido.status);
    const projeto = (pedido.projetos as { nome: string | null } | null)?.nome ?? "—";
    return {
      id: pedido.id,
      titulo: pedido.titulo,
      projeto,
      solicitante: pedido.solicitante ?? "—",
      necessidade: formatDate(pedido.data_necessidade),
      itens: itens.length,
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
                {rows.filter((row) => !["cancelado", "compra_fechada", "encaminhado_instituicao"].includes(row.status)).length}
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
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Planejamento</label>
            <select name="planejamento_id" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {(planos ?? []).map((plano) => (
                <option key={plano.id} value={plano.id}>
                  #{plano.id} · {plano.nome ?? "Plano sem nome"}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-10">
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
          <PedidosInternosTable rows={rows} />
        </div>
      </main>
    </div>
  );
}
