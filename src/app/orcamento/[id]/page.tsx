import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";
import { PrintButton } from "@/components/orcamento/PrintButton";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { Combobox } from "@/components/ui/combobox";
import {
  salvarCabecalho,
  adicionarItemOrcamento,
  removerItemOrcamento,
  recalcularOrcamento,
  cancelarOrcamento,
  excluirOrcamento,
} from "@/lib/actions/orcamentos";
import { gerarPlanejamentoDeOrcamento } from "@/lib/actions/planejamento";
import { listarEventos } from "@/lib/actions/eventos";
import { Timeline } from "@/components/common/Timeline";
import { formatCurrency as brl, formatDate } from "@/lib/formatters";
import { montarSnapshotLaboratorio } from "@/lib/orcamento/laboratorio-operacional";

export const dynamic = "force-dynamic";

type Item = {
  id: number;
  codigo_analise: string;
  n_amostras: number;
  custo_unitario: number;
  preco_unitario: number;
};

type SnapshotLaboratorio = {
  totais?: {
    reagentes?: number;
    materiais?: number;
    equipamentos?: number;
    mao_obra?: number;
    terceiros?: number;
    overhead?: number;
    custo?: number;
    preco?: number;
    amostras?: number;
  };
};

export default async function OrcamentoDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro_exclusao?: string }>;
}) {
  const { id } = await params;
  const { erro_exclusao: erroExclusao } = await searchParams;
  const orcId = Number(id);
  const supabase = await createClient();

  const { data: orc } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("id", orcId)
    .single();
  if (!orc) notFound();

  const [{ data: itensRaw }, { data: analises }, { breakdowns }, { data: clientes }, { data: projetos }] =
    await Promise.all([
      supabase
        .from("orcamento_itens")
        .select("id, codigo_analise, n_amostras, custo_unitario, preco_unitario")
        .eq("orcamento_id", orcId)
        .order("id"),
      supabase.from("analises").select("codigo, nome").eq("ativo", true).order("codigo"),
      calcularTodas(),
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("projetos").select("id, nome").order("nome"),
    ]);

  const projetoNome =
    orc.projeto_id != null
      ? (projetos ?? []).find((p) => p.id === orc.projeto_id)?.nome ?? null
      : null;

  const itens = (itensRaw ?? []) as Item[];
  const totalAmostras = itens.reduce((a, it) => a + Number(it.n_amostras), 0);
  const totalCusto = itens.reduce(
    (a, it) => a + Number(it.custo_unitario) * Number(it.n_amostras),
    0,
  );
  const totalPreco = itens.reduce(
    (a, it) => a + Number(it.preco_unitario) * Number(it.n_amostras),
    0,
  );
  const snapshotCalculado = montarSnapshotLaboratorio(itens, breakdowns) as SnapshotLaboratorio;
  const snapshotPersistido = (orc.custo_snapshot ?? {}) as SnapshotLaboratorio;
  const snapshotOperacional = snapshotPersistido.totais ? snapshotPersistido : snapshotCalculado;
  const totaisOperacionais = snapshotOperacional.totais ?? {};
  const statusOperacional = orc.status_operacional ?? (
    orc.status === "cancelado" ? "cancelado" : ["enviado", "aprovado"].includes(orc.status) ? "revisado" : itens.length > 0 ? "preenchido" : "pendente"
  );

  // detecta itens cujo preço atual difere do snapshot (parâmetros mudaram)
  const precoAtual = new Map(breakdowns.map((b) => [b.codigo, b.preco]));
  const desatualizado = itens.some((it) => {
    const atual = precoAtual.get(it.codigo_analise);
    return atual != null && Math.abs(atual - Number(it.preco_unitario)) > 0.005;
  });

  const eventos = await listarEventos("orcamento", orcId);

  const validade =
    orc.data_orcamento && orc.validade_dias
      ? formatDate(
          new Date(
            new Date(orc.data_orcamento).getTime() +
              orc.validade_dias * 86400000,
          ),
        )
      : null;

  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
  const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="print-area mx-auto max-w-4xl px-6 py-10">
        <div className="no-print flex items-center justify-between">
          <Breadcrumbs items={[{ label: "Análises/Lab.", href: "/orcamento" }, { label: `Orçamento #${orc.id}` }]} />
          <div className="flex items-center gap-2">
            <PrintButton />
            {orc.status === "aprovado" && itens.length > 0 && (
              <form action={gerarPlanejamentoDeOrcamento}>
                <input type="hidden" name="orcamento_id" value={orcId} />
                <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
                  Gerar planejamento
                </button>
              </form>
            )}
            <form action={recalcularOrcamento}>
              <input type="hidden" name="orcamento_id" value={orcId} />
              <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Recalcular preços
              </button>
            </form>
          </div>
        </div>

        {/* Documento imprimível */}
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 print:border-0 print:shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Análises/Lab.
              </h1>
              <p className="text-sm text-zinc-500">
                Laboratório ATGC — Biologia Molecular
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">Nº {orc.id}</p>
              <p className="text-zinc-500">Data: {orc.data_orcamento ?? "—"}</p>
              {validade && (
                <p className="text-zinc-500">Válido até: {validade}</p>
              )}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-zinc-500">Cliente:</dt>
              <dd className="font-medium">{orc.cliente_nome}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">CNPJ:</dt>
              <dd>{orc.cliente_cnpj ?? "—"}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="text-zinc-500">Endereço:</dt>
              <dd>{orc.cliente_endereco ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Contato:</dt>
              <dd>{orc.cliente_contato ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Responsável:</dt>
              <dd>{orc.responsavel ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Projeto:</dt>
              <dd>{projetoNome ?? "—"}</dd>
            </div>
          </dl>

          <section className="no-print mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Preenchimento interno</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Base operacional por custo. O preço de saída fica preservado no documento e no orçamento final.
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700">
                {statusOperacional}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <ResumoOperacional titulo="Reagentes" valor={Number(totaisOperacionais.reagentes ?? 0)} />
              <ResumoOperacional titulo="Materiais" valor={Number(totaisOperacionais.materiais ?? 0)} />
              <ResumoOperacional titulo="Equipamentos" valor={Number(totaisOperacionais.equipamentos ?? 0)} />
              <ResumoOperacional titulo="Mão de obra" valor={Number(totaisOperacionais.mao_obra ?? 0)} />
              <ResumoOperacional titulo="Terceiros" valor={Number(totaisOperacionais.terceiros ?? 0)} />
              <ResumoOperacional titulo="Overhead" valor={Number(totaisOperacionais.overhead ?? 0)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <ResumoOperacional titulo="Subtotal custo" valor={Number(totaisOperacionais.custo ?? totalCusto)} destaque />
              <ResumoOperacional titulo="Amostras" valor={Number(totaisOperacionais.amostras ?? totalAmostras)} numero />
              <ResumoOperacional titulo="Preço preservado" valor={Number(totaisOperacionais.preco ?? totalPreco)} discreto />
            </div>
          </section>

          {/* Análises solicitadas */}
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Análises solicitadas
          </h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-right text-sm">
              <thead className="bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-3 py-2 text-left">Análise</th>
                  <th className="px-3 py-2 no-print">Custo/amostra</th>
                  <th className="px-3 py-2 print:hidden">Preço/amostra</th>
                  <th className="px-3 py-2">Amostras</th>
                  <th className="px-3 py-2">Subtotal</th>
                  <th className="px-3 py-2 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {itens.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2 text-left font-medium">
                      {it.codigo_analise}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500 no-print">
                      {brl(Number(it.custo_unitario))}
                    </td>
                    <td className="px-3 py-2 tabular-nums print:hidden">
                      {brl(Number(it.preco_unitario))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{Number(it.n_amostras)}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {brl(Number(it.custo_unitario) * Number(it.n_amostras))}
                    </td>
                    <td className="px-3 py-2 no-print">
                      <form action={removerItemOrcamento}>
                        <input type="hidden" name="orcamento_id" value={orcId} />
                        <input type="hidden" name="item_id" value={it.id} />
                        <button className="text-xs text-red-600 hover:underline">
                          Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">
                      Nenhuma análise. Adicione abaixo.
                    </td>
                  </tr>
                )}
              </tbody>
              {itens.length > 0 && (
                <tfoot className="border-t border-zinc-200 bg-transparent dark:border-zinc-800 dark:bg-zinc-900/60">
                  <tr>
                    <td className="px-3 py-2.5 text-left font-medium">Total</td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-500 no-print">
                      {brl(totalCusto)}
                    </td>
                    <td></td>
                    <td className="px-3 py-2.5 tabular-nums">{totalAmostras}</td>
                    <td className="px-3 py-2.5 text-base font-semibold tabular-nums text-brand-700 dark:text-brand-400">
                      {brl(totalCusto)}
                    </td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {orc.observacoes && (
            <div className="mt-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Observações
              </p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {orc.observacoes}
              </p>
            </div>
          )}
        </div>

        {desatualizado && (
          <p className="no-print mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Os parâmetros de custo mudaram desde a emissão. Use “Recalcular
            preços” para atualizar os valores deste orçamento.
          </p>
        )}

        {erroExclusao && (
          <p className="no-print mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {erroExclusao}
          </p>
        )}

        {/* Form: adicionar análise */}
        <section className="no-print mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Adicionar análise solicitada</h2>
          <form action={adicionarItemOrcamento} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="orcamento_id" value={orcId} />
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">
                Análise
              </label>
              <div className="w-64">
                <Combobox
                  name="codigo_analise"
                  placeholder="Selecione…"
                  searchPlaceholder="Buscar análise…"
                  emptyText="Nenhuma análise."
                  options={(analises ?? []).map((a) => ({
                    value: a.codigo,
                    label: a.codigo,
                    hint: a.nome ?? undefined,
                  }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">
                Nº de amostras
              </label>
              <input
                aria-label="Nº de amostras"
                name="n_amostras"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                className={`${inp} w-28`}
              />
            </div>
            <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Adicionar
            </button>
          </form>
        </section>

        {/* Form: cabeçalho / dados do cliente */}
        <section className="no-print mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Dados do cliente e do orçamento</h2>
          <form action={salvarCabecalho} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="orcamento_id" value={orcId} />
            <div>
              <label className={lbl}>Cliente cadastrado</label>
              <select aria-label="Cliente cadastrado" name="cliente_id" defaultValue={orc.cliente_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">— (preencher manualmente abaixo)</option>
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-400">
                Ao vincular, os dados do documento são preenchidos a partir do cadastro.
              </p>
            </div>
            <div>
              <label className={lbl}>Projeto</label>
              <select aria-label="Projeto" name="projeto_id" defaultValue={orc.projeto_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">—</option>
                {(projetos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Cliente (texto livre, se não cadastrado)</label>
              <input aria-label="Cliente (texto livre, se não cadastrado)" name="cliente_nome" defaultValue={orc.cliente_nome ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>CNPJ</label>
              <input aria-label="CNPJ" name="cliente_cnpj" defaultValue={orc.cliente_cnpj ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Contato (e-mail / telefone)</label>
              <input aria-label="Contato (e-mail / telefone)" name="cliente_contato" defaultValue={orc.cliente_contato ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Endereço</label>
              <input aria-label="Endereço" name="cliente_endereco" defaultValue={orc.cliente_endereco ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Data do orçamento</label>
              <input aria-label="Data do orçamento" name="data_orcamento" type="date" defaultValue={orc.data_orcamento ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Validade (dias)</label>
              <input aria-label="Validade (dias)" name="validade_dias" type="number" min="0" step="1" defaultValue={orc.validade_dias ?? 30} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Responsável (laboratório)</label>
              <input aria-label="Responsável (laboratório)" name="responsavel" defaultValue={orc.responsavel ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select aria-label="Status" name="status" defaultValue={orc.status ?? "rascunho"} className={`${inp} mt-1 w-full`}>
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Observações</label>
              <textarea aria-label="Observações" name="observacoes" rows={3} defaultValue={orc.observacoes ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                Salvar dados
              </button>
            </div>
          </form>
        </section>

        <section className="no-print mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Linha do tempo</h2>
          <p className="mt-1 mb-3 text-xs text-zinc-500">
            Transições de status registradas (salve mudando o status acima para gerar eventos).
          </p>
          <Timeline eventos={eventos} />
        </section>

        <div className="no-print mt-6 flex flex-wrap gap-3">
          {["enviado", "aprovado"].includes(orc.status) ? (
            <ConfirmActionButton
              action={cancelarOrcamento}
              fields={{ orcamento_id: orcId, motivo: "Cancelamento operacional solicitado na tela do orçamento." }}
              trigger="Cancelar orçamento"
              titulo="Cancelar orçamento"
              mensagem={`Cancelar o orçamento de “${orc.cliente_nome}”? O histórico será preservado.`}
              confirmLabel="Cancelar orçamento"
              destrutivo={false}
              triggerClassName="text-xs text-amber-700 hover:underline dark:text-amber-300"
            />
          ) : (
            <ConfirmActionButton
              action={excluirOrcamento}
              fields={{ orcamento_id: orcId }}
              trigger="Excluir orçamento"
              titulo="Excluir orçamento"
              mensagem={`Excluir o orçamento de “${orc.cliente_nome}”? Esta ação não pode ser desfeita.`}
              confirmLabel="Excluir orçamento"
            />
          )}
        </div>
      </main>
    </div>
  );
}

function ResumoOperacional({
  titulo,
  valor,
  destaque = false,
  discreto = false,
  numero = false,
}: {
  titulo: string;
  valor: number;
  destaque?: boolean;
  discreto?: boolean;
  numero?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"} ${discreto ? "opacity-80" : ""}`}>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{titulo}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {numero ? valor.toLocaleString("pt-BR") : brl(valor)}
      </p>
    </div>
  );
}
