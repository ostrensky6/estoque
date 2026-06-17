import { createClient } from "@/lib/supabase/server";
import {
  PEDIDO_INTERNO_AGUARDANDO_CHEGADA,
  pedidoInternoNumero,
  pedidoInternoStatus,
  type PedidoInternoStatus,
} from "@/lib/pedido/status";
import {
  RecebimentoItensTable,
  type RecebimentoItemRow,
} from "@/components/pedido/RecebimentoItensTable";

export const dynamic = "force-dynamic";

type ItemRaw = {
  id: number;
  especificacao: string;
  quantidade: number;
  unidade: string | null;
  insumo_id: number | null;
  fornecedor_sugerido: string | null;
  orcamento_previo: number | null;
  pedido_interno_id: number;
  pedidos_internos: {
    id: number;
    titulo: string;
    status: string;
    projetos: { nome: string | null } | null;
  } | null;
};

export default async function RecebimentoPage() {
  const supabase = await createClient();
  const [{ data: itensData }, { data: insumos }] = await Promise.all([
    supabase
      .from("pedidos_internos_itens")
      .select(
        "id, especificacao, quantidade, unidade, insumo_id, fornecedor_sugerido, orcamento_previo, pedido_interno_id, pedidos_internos!inner(id, titulo, status, projetos(nome))",
      )
      .is("recebido_em", null)
      .order("id", { ascending: false }),
    supabase.from("insumos").select("id, especificacao, unidade").order("especificacao"),
  ]);

  const itens = ((itensData ?? []) as unknown as ItemRaw[]).filter(
    (item) => item.pedidos_internos && item.pedidos_internos.status !== "cancelado",
  );

  const rows: RecebimentoItemRow[] = itens.map((item) => {
    const pedido = item.pedidos_internos!;
    const status = pedido.status;
    return {
      id: item.id,
      pedidoId: pedido.id,
      pedidoNumero: pedidoInternoNumero(pedido.id),
      pedidoTitulo: pedido.titulo,
      especificacao: item.especificacao,
      quantidade: Number(item.quantidade),
      unidade: item.unidade,
      insumoId: item.insumo_id,
      fornecedorSugerido: item.fornecedor_sugerido,
      orcamentoPrevio: item.orcamento_previo,
      projeto: pedido.projetos?.nome ?? "—",
      status,
      statusLabel: pedidoInternoStatus(status).label,
      podeReceber: PEDIDO_INTERNO_AGUARDANDO_CHEGADA.includes(status as PedidoInternoStatus),
    };
  });

  const prontos = rows.filter((row) => row.podeReceber).length;

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Recebimento</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Todos os itens de pedidos internos por estágio, até a chegada. Ao receber um item, a quantidade
              entra em estoque e o item sai desta lista.
            </p>
          </div>
          <div className="grid min-w-56 grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-zinc-500">Aguardando</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{rows.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-zinc-500">Prontos p/ receber</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-leaf-700 dark:text-leaf-400">{prontos}</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <RecebimentoItensTable rows={rows} insumos={insumos ?? []} />
        </div>
      </main>
    </div>
  );
}
