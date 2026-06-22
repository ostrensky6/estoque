import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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
import { formatCurrency as brl, formatDate, formatDateTime } from "@/lib/formatters";
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
  gerado_em?: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

  const { data: demanda } = orc.demanda_id
    ? await supabase
        .from("demandas_propostas")
        .select("id, titulo, modalidade, status, matriz_amostra, responsavel_interno")
        .eq("id", orc.demanda_id)
        .single()
    : { data: null };

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
  const snapshotPersistido = isRecord(orc.custo_snapshot) ? (orc.custo_snapshot as SnapshotLaboratorio) : {};
  const snapshotOperacional = snapshotPersistido.totais ? snapshotPersistido : snapshotCalculado;
  const totaisOperacionais = snapshotOperacional.totais ?? {};
  const snapshotGeradoEm =
    isRecord(snapshotOperacional) && typeof snapshotOperacional.gerado_em === "string"
      ? snapshotOperacional.gerado_em
      : null;
  const statusOperacional = orc.status_operacional ?? (
    orc.status === "cancelado" ? "cancelado" : ["enviado", "aprovado"].includes(orc.status) ? "revisado" : itens.length > 0 ? "preenchido" : "pendente"
  );
  const nomeAnalise = new Map((analises ?? []).map((analise) => [analise.codigo, analise.nome ?? null]));
  const breakdownPorCodigo = new Map(breakdowns.map((breakdown) => [breakdown.codigo, breakdown]));
  const linhasTecnicas = itens.map((item) => {
    const quantidade = Number(item.n_amostras);
    const breakdown = breakdownPorCodigo.get(item.codigo_analise);
    const reagentes = Number(breakdown?.reagentes ?? 0) * quantidade;
    const equipamentos = Number(breakdown?.equipamento ?? 0) * quantidade;
    const maoObra = Number(breakdown?.pessoal ?? 0) * quantidade;
    const overhead = Number(breakdown?.overhead ?? 0) * quantidade;
    const custo = Number(item.custo_unitario) * quantidade;
    const preco = Number(item.preco_unitario) * quantidade;
    return {
      id: item.id,
      codigo: item.codigo_analise,
      nome: nomeAnalise.get(item.codigo_analise),
      quantidade,
      lote: breakdown?.lote ?? null,
      reagentes,
      materiais: reagentes,
      equipamentos,
      maoObra,
      terceiros: 0,
      overhead,
      custo,
      preco,
      custoUnitario: Number(item.custo_unitario),
      precoUnitario: Number(item.preco_unitario),
      origem: breakdown ? "Snapshot de custeio" : "Snapshot preservado no item",
    };
  });

  // detecta itens cujo preço atual difere do snapshot (parâmetros mudaram)
  const precoAtual = new Map(breakdowns.map((b) => [b.codigo, b.preco]));
  const desatualizado = itens.some((it) => {
    const atual = precoAtual.get(it.codigo_analise);
    return atual != null && Math.abs(atual - Number(it.preco_unitario)) > 0.005;
  });

  const eventos = await listarEventos("orcamento", orcId);
  const revisaoPendencias = [
    !orc.cliente_nome ? "informar cliente" : null,
    !orc.responsavel ? "informar responsável técnico" : null,
    itens.length === 0 ? "adicionar ao menos uma análise" : null,
    desatualizado ? "recalcular preços após mudança de parâmetros" : null,
  ].filter(Boolean) as string[];
  const tabs = [
    { href: "#identificacao-tecnica", label: "Identificação", meta: orc.responsavel ? "preenchida" : "pendente" },
    { href: "#analises-quantidades", label: "Análises", meta: `${itens.length} linha(s)` },
    { href: "#composicao-tecnica", label: "Composição", meta: `${totalAmostras} amostra(s)` },
    { href: "#totais-tecnicos", label: "Totais", meta: brl(Number(totaisOperacionais.custo ?? totalCusto)) },
    { href: "#revisao-laboratorio", label: "Revisão", meta: revisaoPendencias.length === 0 ? "liberada" : `${revisaoPendencias.length} pendência(s)` },
    { href: "#historico-laboratorio", label: "Histórico", meta: `${eventos.length} evento(s)` },
  ];

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
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-brand-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300"; // §8.2: entrada em azul
  const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="print-area mx-auto max-w-6xl px-6 py-10">
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
              <dt className="text-zinc-500">Orçamento lab:</dt>
              <dd className="font-medium">#{orc.id} · {orc.status}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Demanda:</dt>
              <dd>
                {demanda ? (
                  <Link href={`/orcamento/demandas/${demanda.id}`} className="font-medium text-primary hover:underline">
                    {demanda.titulo}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Cliente:</dt>
              <dd className="font-medium">{orc.cliente_nome}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Matriz/amostra:</dt>
              <dd>{demanda?.matriz_amostra ?? "—"}</dd>
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
              <dt className="text-zinc-500">Snapshot de custo:</dt>
              <dd>{formatDateTime(snapshotGeradoEm)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Projeto:</dt>
              <dd>{projetoNome ?? "—"}</dd>
            </div>
          </dl>

          <nav className="no-print sticky top-0 z-10 mt-6 overflow-x-auto border-y border-zinc-200 bg-white/95 py-2 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => (
                <a key={tab.href} href={tab.href} className="rounded-md border border-zinc-300 px-3 py-2 text-left text-xs text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
                  <span className="block font-semibold">{tab.label}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-zinc-500">{tab.meta}</span>
                </a>
              ))}
            </div>
          </nav>

          <section id="totais-tecnicos" className="no-print mt-6 scroll-mt-24 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
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
          <section id="analises-quantidades" className="mt-6 scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Análises e quantidades
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Leitura técnica por custo. Valores de preço ficam preservados no resumo e no documento final.
                </p>
              </div>
              <span className="text-xs text-zinc-400">{totalAmostras} amostra(s)</span>
            </div>
          <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-right text-sm">
              <thead className="bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-3 py-2 text-left">Análise</th>
                  <th className="px-3 py-2 text-left">Matriz</th>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Amostras</th>
                  <th className="px-3 py-2">Reagentes</th>
                  <th className="px-3 py-2">Equip.</th>
                  <th className="px-3 py-2">Mão obra</th>
                  <th className="px-3 py-2">Overhead</th>
                  <th className="px-3 py-2">Custo</th>
                  <th className="px-3 py-2 text-left">Origem</th>
                  <th className="px-3 py-2 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {linhasTecnicas.map((linha) => (
                  <tr key={linha.id}>
                    <td className="px-3 py-2 text-left font-medium">
                      <p>{linha.codigo}</p>
                      <p className="text-xs font-normal text-zinc-500">{linha.nome ?? "—"}</p>
                    </td>
                    <td className="px-3 py-2 text-left text-zinc-500">{demanda?.matriz_amostra ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{linha.lote ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{linha.quantidade}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500 no-print">
                      {brl(linha.reagentes)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{brl(linha.equipamentos)}</td>
                    <td className="px-3 py-2 tabular-nums">{brl(linha.maoObra)}</td>
                    <td className="px-3 py-2 tabular-nums">{brl(linha.overhead)}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {brl(linha.custo)}
                    </td>
                    <td className="px-3 py-2 text-left text-xs text-zinc-500">{linha.origem}</td>
                    <td className="px-3 py-2 no-print">
                      <form action={removerItemOrcamento}>
                        <input type="hidden" name="orcamento_id" value={orcId} />
                        <input type="hidden" name="item_id" value={linha.id} />
                        <button className="text-xs text-red-600 hover:underline">
                          Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-zinc-400">
                      Nenhuma análise. Adicione abaixo.
                    </td>
                  </tr>
                )}
              </tbody>
              {itens.length > 0 && (
                <tfoot className="border-t border-zinc-200 bg-transparent dark:border-zinc-800 dark:bg-zinc-900/60">
                  <tr>
                    <td className="px-3 py-2.5 text-left font-medium">Total</td>
                    <td></td>
                    <td></td>
                    <td className="px-3 py-2.5 tabular-nums">{totalAmostras}</td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-500 no-print">{brl(Number(totaisOperacionais.reagentes ?? 0))}</td>
                    <td className="px-3 py-2.5 tabular-nums">{brl(Number(totaisOperacionais.equipamentos ?? 0))}</td>
                    <td className="px-3 py-2.5 tabular-nums">{brl(Number(totaisOperacionais.mao_obra ?? 0))}</td>
                    <td className="px-3 py-2.5 tabular-nums">{brl(Number(totaisOperacionais.overhead ?? 0))}</td>
                    <td className="px-3 py-2.5 text-base font-semibold tabular-nums text-brand-700 dark:text-brand-400">
                      {brl(totalCusto)}
                    </td>
                    <td></td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          </section>

          <section id="composicao-tecnica" className="no-print mt-6 scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Composição técnica por bloco
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Cada subtotal mostra a origem calculada pela engine de custeio e a regra operacional aplicada.
                </p>
              </div>
            </div>
            <TabelaResumoTecnico
              colunas={["Bloco", "Origem", "Regra", "Subtotal"]}
              vazio="Sem composição técnica calculada."
              linhas={[
                ["Reagentes", "insumo_analise + custo_unitario do insumo", "Quantidade por amostra multiplicada pelas amostras; itens por execução são rateados pelo lote.", brl(Number(totaisOperacionais.reagentes ?? 0))],
                ["Materiais", "mesma base de insumos selecionados", "Material de consumo entra no custo técnico junto aos reagentes.", brl(Number(totaisOperacionais.materiais ?? 0))],
                ["Equipamentos", "equipamento_analise + depreciação/manutenção", "Custo diário do equipamento alocado por peso e capacidade diária da análise.", brl(Number(totaisOperacionais.equipamentos ?? 0))],
                ["Mão de obra", "tecnicos + etapas", "Horas de bancada por amostra multiplicadas pelo valor-hora dedicado.", brl(Number(totaisOperacionais.mao_obra ?? 0))],
                ["Terceiros", "lançamento reservado", "Sem terceiros laboratoriais próprios neste snapshot.", brl(Number(totaisOperacionais.terceiros ?? 0))],
                ["Overhead técnico", "overhead + etapas", "Horas de bancada por amostra multiplicadas pelo custo-hora de overhead.", brl(Number(totaisOperacionais.overhead ?? 0))],
              ]}
            />
          </section>

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
        <section id="identificacao-tecnica" className="no-print mt-6 scroll-mt-24 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Adicionar análise solicitada</h2>
          <p className="mt-1 text-[11px] text-zinc-400">
            Análises <span className="font-semibold text-red-600">bloqueadas</span> aparecem
            desabilitadas (cadastro incompleto geraria custo zero); as marcadas com{" "}
            <span className="font-semibold text-amber-600">alerta</span> podem ser incluídas, mas
            revise o cadastro.
          </p>
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
                  options={(analises ?? []).map((a) => {
                    const integ = breakdownPorCodigo.get(a.codigo)?.integridade;
                    const bloqueada = integ?.status === "BLOQUEADA";
                    const alerta = integ?.status === "COM_ALERTAS";
                    const motivo = integ?.problemas
                      .filter((p) => p.gravidade === (bloqueada ? "bloqueio" : "alerta"))
                      .map((p) => p.mensagem)
                      .join(" | ");
                    return {
                      value: a.codigo,
                      label: a.codigo,
                      hint: a.nome ?? undefined,
                      disabled: bloqueada,
                      badge: bloqueada ? "Bloqueada" : alerta ? "Alerta" : undefined,
                      badgeClassName: bloqueada
                        ? "bg-red-100 text-red-800"
                        : alerta
                          ? "bg-amber-100 text-amber-800"
                          : undefined,
                      description: motivo
                        ? `${bloqueada ? "Bloqueada" : "Alerta"}: ${motivo}`
                        : undefined,
                    };
                  })}
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

        <section id="revisao-laboratorio" className="no-print mt-6 scroll-mt-24 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Revisão técnica</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Checklist para marcar o orçamento como enviado, aprovado ou seguir para planejamento.
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${revisaoPendencias.length === 0 ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
              {revisaoPendencias.length === 0 ? "Liberado" : `${revisaoPendencias.length} pendência(s)`}
            </span>
          </div>
          {revisaoPendencias.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-800 dark:text-amber-200">
              {revisaoPendencias.map((pendencia) => (
                <li key={pendencia}>{pendencia}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-xs leading-5 text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
              Cabeçalho, responsável e análises estão coerentes. A próxima ação natural é salvar o status revisado no cabeçalho.
            </p>
          )}
        </section>

        <section id="historico-laboratorio" className="no-print mt-6 scroll-mt-24 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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

function TabelaResumoTecnico({
  colunas,
  linhas,
  vazio,
}: {
  colunas: string[];
  linhas: ReactNode[][];
  vazio: string;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {colunas.map((coluna) => (
              <th key={coluna} className="px-3 py-2">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {linhas.length > 0 ? (
            linhas.map((linha, index) => (
              <tr key={index}>
                {linha.map((celula, celulaIndex) => (
                  <td key={celulaIndex} className="max-w-lg px-3 py-2 text-zinc-700 dark:text-zinc-200">
                    {celula}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={colunas.length} className="px-3 py-8 text-center text-zinc-400">
                {vazio}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
