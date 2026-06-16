import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import {
  adicionarItemPedidoInterno,
  registrarAnaliseAdministrativa,
  removerItemPedidoInterno,
} from "@/lib/actions/pedidos-internos";
import { PedidoInternoAcoes } from "@/components/pedido/PedidoInternoAcoes";
import { Timeline } from "@/components/common/Timeline";
import { listarEventos } from "@/lib/actions/eventos";
import { PEDIDO_INTERNO_FLUXO, pedidoInternoStatus, type PedidoInternoStatus } from "@/lib/pedido/status";
import { formatCurrency as brl, formatDate, formatDateTime, formatNumber as fmt } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type PedidoInternoItem = {
  id: number;
  tipo: string;
  especificacao: string;
  modelo: string | null;
  volume: string | null;
  quantidade: number;
  unidade: string | null;
  orcamento_previo: number | null;
  fornecedor_sugerido: string | null;
  observacao: string | null;
  insumo_id: number | null;
  insumos: { especificacao: string | null; unidade: string | null } | null;
};

export default async function PedidoInternoDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedidoId = Number(id);
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos_internos")
    .select("*, projetos(nome), planejamento(nome), pedidos_compra(id, status)")
    .eq("id", pedidoId)
    .single();
  if (!pedido) notFound();

  const [{ data: itens }, { data: insumos }, eventos, podeGerir] = await Promise.all([
    supabase
      .from("pedidos_internos_itens")
      .select("id, tipo, especificacao, modelo, volume, quantidade, unidade, orcamento_previo, fornecedor_sugerido, observacao, insumo_id, insumos(especificacao, unidade)")
      .eq("pedido_interno_id", pedidoId)
      .order("id"),
    supabase.from("insumos").select("id, especificacao, unidade").order("especificacao"),
    listarEventos("pedido_interno", pedidoId),
    temPapel("coordenador"),
  ]);

  const pedidoStatus = pedido.status as PedidoInternoStatus;
  const statusMeta = pedidoInternoStatus(pedidoStatus);
  const projeto = (pedido.projetos as { nome: string | null } | null)?.nome ?? "—";
  const plano = (pedido.planejamento as { nome: string | null } | null)?.nome ?? null;
  const compraFormal = pedido.pedidos_compra as { id: number; status: string } | null;
  const linhas = ((itens ?? []) as PedidoInternoItem[]) ?? [];
  const total = linhas.reduce(
    (acc, item) => acc + Number(item.quantidade ?? 0) * Number(item.orcamento_previo ?? 0),
    0,
  );
  const editavel = ["rascunho", "ajuste_solicitante", "ajuste_compras"].includes(pedido.status);
  const inputCls = "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
  const etapaAtual = Math.max(0, PEDIDO_INTERNO_FLUXO.indexOf(pedidoStatus));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/pedido" className="text-xs text-zinc-500 hover:underline">← Pedido</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{pedido.titulo}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Projeto: {projeto} · Solicitante: {pedido.solicitante ?? "—"}
              {pedido.data_necessidade ? ` · Necessidade: ${formatDate(pedido.data_necessidade)}` : ""}
            </p>
            {pedido.justificativa && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">{pedido.justificativa}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className={`rounded-md px-3 py-1 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <span className="text-xs text-zinc-500">Atualizado {formatDateTime(pedido.atualizado_em)}</span>
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3 md:grid-cols-7">
            {PEDIDO_INTERNO_FLUXO.map((status, index) => {
              const meta = pedidoInternoStatus(status);
              const ativo = status === pedidoStatus;
              const concluido = index < etapaAtual || ["compra_fechada", "encaminhado_instituicao"].includes(pedidoStatus);
              return (
                <div
                  key={status}
                  className={`min-h-20 rounded-lg border p-3 ${
                    ativo
                      ? "border-brand-300 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30"
                      : concluido
                        ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Etapa {index + 1}</p>
                  <p className="mt-1 text-sm font-medium">{meta.label}</p>
                  <p className="mt-1 text-xs leading-4 text-zinc-500">{meta.etapa}</p>
                </div>
              );
            })}
          </div>
          {pedido.status === "ajuste_solicitante" && (
            <p className="mt-3 text-sm text-orange-700 dark:text-orange-300">
              Compra não aprovada na validação. Revise os itens com o solicitante e reenvie.
            </p>
          )}
          {pedido.status === "ajuste_compras" && (
            <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">
              Compra não aprovada na análise administrativa. Revise com compras e/ou solicitante.
            </p>
          )}
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Materiais e serviços</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Inclua especificação, modelo, volume, quantidade e orçamento prévio.
              </p>
            </div>
            <p className="text-sm text-zinc-500">Total prévio: <b>{brl(total)}</b></p>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Modelo/volume</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Prévio un.</th>
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  {editavel && <th className="px-4 py-3 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {linhas.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-sm px-4 py-2.5">
                      <p className="font-medium">{item.especificacao}</p>
                      <p className="text-xs text-zinc-500">
                        {item.tipo === "servico" ? "Serviço" : "Material"}
                        {item.insumos?.especificacao ? ` · vinculado: ${item.insumos.especificacao}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {[item.modelo, item.volume].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmt(item.quantidade)} {item.unidade ?? item.insumos?.unidade ?? ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{brl(item.orcamento_previo)}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{item.fornecedor_sugerido ?? "—"}</td>
                    {editavel && (
                      <td className="px-4 py-2.5 text-right">
                        <form action={removerItemPedidoInterno}>
                          <input type="hidden" name="item_id" value={item.id} />
                          <input type="hidden" name="pedido_interno_id" value={pedidoId} />
                          <button className="text-xs text-red-600 hover:underline">Remover</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={editavel ? 6 : 5} className="px-4 py-8 text-center text-zinc-400">
                      Nenhum material ou serviço informado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editavel && (
            <form action={adicionarItemPedidoInterno} className="mt-3 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-12">
              <input type="hidden" name="pedido_interno_id" value={pedidoId} />
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Tipo</label>
                <select name="tipo" defaultValue="material" className={`${inputCls} mt-1 w-full`}>
                  <option value="material">Material</option>
                  <option value="servico">Serviço</option>
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Especificação</label>
                <input name="especificacao" required className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Insumo existente</label>
                <select name="insumo_id" defaultValue="" className={`${inputCls} mt-1 w-full`}>
                  <option value="">—</option>
                  {(insumos ?? []).map((insumo) => (
                    <option key={insumo.id} value={insumo.id}>{insumo.especificacao}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Fornecedor sugerido</label>
                <input name="fornecedor_sugerido" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Modelo</label>
                <input name="modelo" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Volume</label>
                <input name="volume" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Qtd</label>
                <input name="quantidade" type="number" min="0.0001" step="any" defaultValue="1" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Unidade</label>
                <input name="unidade" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Orçamento prévio un.</label>
                <input name="orcamento_previo" type="number" min="0" step="0.01" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-9">
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Observação</label>
                <input name="observacao" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="flex items-end md:col-span-3">
                <button className="h-10 w-full rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                  Adicionar item
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Próxima ação</h2>
            <p className="mt-1 text-xs text-zinc-500">{statusMeta.etapa}</p>
            <div className="mt-4">
              {statusMeta && <PedidoInternoAcoes pedidoId={pedidoId} status={pedido.status} podeGerir={podeGerir} />}
              {!podeGerir && !["rascunho", "ajuste_solicitante", "ajuste_compras"].includes(pedido.status) && (
                <p className="text-sm text-zinc-400">Esta etapa exige papel coordenador ou superior.</p>
              )}
            </div>

            {pedido.status === "formalizado" && podeGerir && (
              <form action={registrarAnaliseAdministrativa} className="mt-5 grid gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 md:grid-cols-2">
                <input type="hidden" name="pedido_interno_id" value={pedidoId} />
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Fonte do recurso</label>
                  <input name="fonte_recurso" defaultValue={pedido.fonte_recurso ?? ""} className={`${inputCls} mt-1 w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Rubrica</label>
                  <input name="rubrica" defaultValue={pedido.rubrica ?? ""} className={`${inputCls} mt-1 w-full`} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Conformidades administrativas</label>
                  <textarea name="conformidade_admin" defaultValue={pedido.conformidade_admin ?? ""} rows={3} className={`${inputCls} mt-1 w-full`} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Observação</label>
                  <input name="observacao" defaultValue={pedido.observacao_compras ?? ""} className={`${inputCls} mt-1 w-full`} />
                </div>
                <div className="md:col-span-2">
                  <button className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500">
                    Registrar análise administrativa
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Referências</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Planejamento</dt>
                <dd className="text-right">{plano ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Compra formal</dt>
                <dd className="text-right">
                  {compraFormal ? (
                    <Link href={`/compras/${compraFormal.id}`} className="text-primary hover:underline">
                      #{compraFormal.id} · {compraFormal.status}
                    </Link>
                  ) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Fonte</dt>
                <dd className="text-right">{pedido.fonte_recurso ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Rubrica</dt>
                <dd className="text-right">{pedido.rubrica ?? "—"}</dd>
              </div>
            </dl>
          </aside>
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
