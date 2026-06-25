import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ParametrosDemandaGrossUp } from "@/components/orcamento/ParametrosDemandaGrossUp";
import {
  emitirOrcamentoFinalDaDemanda,
  gerarOrcamentoAnalisesDaDemanda,
  gerarOrcamentoProjetoDaDemanda,
} from "@/lib/actions/demandas";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";
import { avaliarModuloOperacional } from "@/lib/orcamento/modulo-status";
import { consolidarOrcamentoFinal } from "@/lib/orcamento/orcamento-final";
import {
  DemandaForm,
  type AnaliseCatalogoDemanda,
  type GrupoAmostraDemanda,
  type AnaliseSelecionadaDemanda,
} from "@/components/orcamento/DemandaForm";
import { formatCurrency as brl, formatDateTime } from "@/lib/formatters";
import { TOM_ENTRADA } from "@/lib/orcamento/tom-valor";
import {
  modalidadeExigeLaboratorio,
  modalidadeExigeProjeto,
  normalizarModalidadeOrcamento,
} from "@/lib/orcamento/orcamento-economico";
import { calcularPrevisaoOperacionalDemanda } from "@/lib/orcamento/previsao-operacional";
import { calcularFluxoDemanda, type EstadoEtapaDemanda, type EtapaFluxoDemanda } from "@/lib/orcamento/fluxo-demanda";

export const dynamic = "force-dynamic";

const MODALIDADES: Record<string, string> = {
  analises: "Apenas análises laboratoriais",
  projeto: "Apenas projeto",
  projeto_com_analises: "Projeto com análises laboratoriais",
  analises_projeto: "Projeto com análises laboratoriais",
  projeto_analises_custos: "Projeto com análises laboratoriais",
};

const PARAMETROS_INSTITUCIONAIS = {
  impostos_legacy: 16.33,
  incubacao: 2,
  reserva: 5,
  investimentos: 5,
  lucro: 30,
};

type OrcamentoAnalisesResumo = {
  id: number;
  status: string;
  data_orcamento: string | null;
  orcamento_itens?: { id: number; codigo_analise?: string | null; n_amostras: number; custo_unitario: number; preco_unitario: number }[] | null;
};

type OrcamentoProjetoResumo = {
  id: number;
  status: string;
  data_orcamento: string | null;
  titulo: string | null;
  projeto_sem_custo_justificativa?: string | null;
  impostos: number | null;
  margem_lucro: number | null;
  impostos_legacy: number | null;
  incubacao: number | null;
  reserva: number | null;
  investimentos: number | null;
  lucro: number | null;
  orcamento_projeto_analises?: { id: number; n_amostras: number; custo_unitario: number; preco_unitario: number }[] | null;
  orcamento_projeto_custos?: {
    id: number;
    rubrica: string | null;
    quantidade: number;
    custo_unitario: number;
    preco_unitario: number;
    meses_selecionados: number[] | null;
  }[] | null;
};

type EtapaAtivaDemanda = Extract<EtapaFluxoDemanda["id"], "demanda" | "laboratorio" | "projeto" | "final" | "historico">;

export default async function DemandaDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro_emissao?: string; erro_parametros?: string; etapa?: string }>;
}) {
  const { id } = await params;
  const { erro_emissao: erroEmissao, erro_parametros: erroParametros, etapa: etapaSolicitada } = await searchParams;
  const demandaId = Number(id);
  const supabase = await createClient();

  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", demandaId)
    .single();
  if (!demanda) notFound();

  const [
    { data: clientes },
    { data: projetos },
    { data: orcamentos },
    { data: orcProjetos },
    { data: versoesFinais },
    { data: analisesCatalogo },
    { data: gruposAmostras },
    { data: demandaAnalises },
    { data: etapasAnalises },
    { data: insumosAnalises },
    { data: saldoEstoque },
    { breakdowns },
  ] =
    await Promise.all([
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("projetos").select("id, nome").order("nome"),
      supabase
        .from("orcamentos")
        .select("id, status, data_orcamento, orcamento_itens(id, codigo_analise, n_amostras, custo_unitario, preco_unitario)")
        .eq("demanda_id", demandaId)
        .order("id"),
      supabase
        .from("orcamento_projetos")
        .select("id, status, data_orcamento, titulo, projeto_sem_custo_justificativa, impostos, margem_lucro, impostos_legacy, incubacao, reserva, investimentos, lucro, orcamento_projeto_analises(id, n_amostras, custo_unitario, preco_unitario), orcamento_projeto_custos(id, rubrica, quantidade, custo_unitario, preco_unitario, meses_selecionados)")
        .eq("demanda_id", demandaId)
        .order("id"),
      supabase
        .from("orcamento_final_versoes")
        .select("id, versao, numero, status, total_final, valido_ate, criado_em")
        .eq("demanda_id", demandaId)
        .order("versao", { ascending: false }),
      supabase
        .from("analises")
        .select("codigo, nome, nome_simplificado, descricao, status, ativo")
        .eq("ativo", true)
        .order("codigo"),
      (supabase as never as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: unknown) => { order: (column: string) => Promise<{ data: GrupoAmostraDemanda[] | null }> } } } })
        .from("demanda_grupos_amostras")
        .select("id, identificacao, tipo_matriz, quantidade_amostras, unidade, observacao")
        .eq("demanda_id", demandaId)
        .order("ordem"),
      supabase
        .from("demanda_analises")
        .select("grupo_amostra_id, codigo_analise, quantidade_amostras, origem_quantidade, status_custeio")
        .eq("demanda_id", demandaId)
        .order("codigo_analise"),
      supabase
        .from("etapas")
        .select("codigo_analise, nome_etapa, nome_atividade, execucoes_por_dia, amostras_por_execucao"),
      (supabase as never as { from: (table: string) => { select: (columns: string) => Promise<{ data: Array<{
        codigo_analise: string;
        especificacao_insumo: string | null;
        unidade: string | null;
        quantidade_por_amostra: number | null;
        modo_cobranca: string | null;
        status_vinculo_insumo: string | null;
        insumo_id: number | null;
        insumos: { custo_unitario?: number | null } | null;
      }> | null }> } })
        .from("insumo_analise")
        .select("codigo_analise, especificacao_insumo, unidade, quantidade_por_amostra, modo_cobranca, status_vinculo_insumo, insumo_id, insumos(custo_unitario)"),
      (supabase as never as { from: (table: string) => { select: (columns: string) => Promise<{ data: Array<{ insumo_id: number; disponivel?: number | null; especificacao?: string | null }> | null }> } })
        .from("v_estoque_saldo")
        .select("insumo_id, disponivel, especificacao"),
      calcularTodas(),
    ]);

  const modalidadeCanonica = normalizarModalidadeOrcamento(demanda.modalidade);
  const exigeAnalises = modalidadeExigeLaboratorio(demanda.modalidade);
  const exigeProjeto = modalidadeExigeProjeto(demanda.modalidade) || Boolean(demanda.projeto_id);
  const analisesFormulario: AnaliseCatalogoDemanda[] = (analisesCatalogo ?? []).map((analise) => {
    const etapasDaAnalise = (etapasAnalises ?? []).filter((etapa) => etapa.codigo_analise === analise.codigo);
    const capacidades = etapasDaAnalise
      .map((etapa) => Number(etapa.execucoes_por_dia ?? 0) * Number(etapa.amostras_por_execucao ?? 0))
      .filter((capacidade) => capacidade > 0);
    const metodo = etapasDaAnalise[0]?.nome_etapa ?? etapasDaAnalise[0]?.nome_atividade ?? null;
    const unidade = (insumosAnalises ?? []).find((item) => item.codigo_analise === analise.codigo)?.unidade ?? "amostra";
    const quantidadeBase = Number(demanda.quantidade_amostras_estimada ?? 1);
    const prazoTecnico = capacidades.length > 0 ? Math.max(1, Math.ceil(quantidadeBase / Math.min(...capacidades))) : null;
    const previsaoBase = calcularPrevisaoOperacionalDemanda({
      analises: [{ codigo_analise: analise.codigo, quantidade_amostras: quantidadeBase }],
      etapas: etapasAnalises ?? [],
      insumos: insumosAnalises ?? [],
    })[0];
    return {
      codigo: analise.codigo,
      nome: analise.nome,
      nome_simplificado: analise.nome_simplificado,
      descricao: analise.descricao,
      status: analise.status ?? "Ativa",
      metodo,
      unidade,
      prazo_tecnico_dias: prazoTecnico,
      matriz: null,
      custeio_disponivel: breakdowns.some((breakdown) => breakdown.codigo === analise.codigo && Number(breakdown.custoTotal) > 0),
      lote_padrao: previsaoBase?.lote_padrao ?? null,
      capacidade_dia: previsaoBase?.capacidade_dia ?? null,
      reagentes: (insumosAnalises ?? [])
        .filter((item) => item.codigo_analise === analise.codigo)
        .map((item) => {
          const saldo = (saldoEstoque ?? []).find((saldoItem) => Number(saldoItem.insumo_id) === Number(item.insumo_id));
          const disponivel = Number(saldo?.disponivel ?? 0);
          const custoUnitario = Number((item.insumos as { custo_unitario?: number | null } | null)?.custo_unitario ?? 0);
          return {
            especificacao: item.especificacao_insumo ?? "Insumo sem especificação",
            unidade: item.unidade ?? "un",
            quantidade_por_amostra: Number(item.quantidade_por_amostra ?? 0),
            custo_unitario: Number.isFinite(custoUnitario) ? custoUnitario : null,
            status_vinculo_insumo: item.status_vinculo_insumo,
            estoque_status: item.insumo_id == null ? "insumo não encontrado" : disponivel > 0 ? "suficiente" : "sem cadastro de saldo",
            modo_cobranca: item.modo_cobranca === "por_execucao" ? "por_execucao" as const : "por_amostra" as const,
          };
        })
        .filter((item) => item.quantidade_por_amostra > 0),
    };
  });
  const gruposFormulario: GrupoAmostraDemanda[] = ((gruposAmostras ?? []) as GrupoAmostraDemanda[]);
  const grupoPorId = new Map(gruposFormulario.map((grupo) => [Number(grupo.id), grupo.identificacao]));
  const analisesSelecionadasFormulario = ((demandaAnalises ?? []) as unknown as AnaliseSelecionadaDemanda[]).map((item) => {
    const breakdown = breakdowns.find((b) => b.codigo === item.codigo_analise);
    return {
      ...item,
      grupo_identificacao: item.grupo_amostra_id ? grupoPorId.get(Number(item.grupo_amostra_id)) ?? null : null,
      status_custeio: breakdown && Number(breakdown.custoTotal) > 0 ? "disponivel" : "pendente",
    };
  });
  const completudeDemanda = avaliarCompletudeDemanda({
    ...demanda,
    analises_solicitadas: analisesSelecionadasFormulario.length,
  });
  const orcamentosAnalises = ((orcamentos ?? []) as OrcamentoAnalisesResumo[]);
  const orcamentosProjeto = ((orcProjetos ?? []) as OrcamentoProjetoResumo[]);
  const itensAnalises = orcamentosAnalises.reduce((total, orcamento) => total + (orcamento.orcamento_itens?.length ?? 0), 0);
  const itensProjeto = orcamentosProjeto.reduce((total, orcamento) => total + (
    (orcamento.orcamento_projeto_custos?.length ?? 0) +
    (exigeAnalises ? 0 : (orcamento.orcamento_projeto_analises?.length ?? 0)) +
    (orcamento.projeto_sem_custo_justificativa ? 1 : 0)
  ), 0);
  const statusAnalises = orcamentosAnalises.some((orcamento) => orcamento.status === "aprovado")
    ? "aprovado"
    : orcamentosAnalises.some((orcamento) => orcamento.status === "enviado")
      ? "enviado"
      : orcamentosAnalises[0]?.status;
  const statusProjeto = orcamentosProjeto.some((orcamento) => orcamento.status === "aprovado")
    ? "aprovado"
    : orcamentosProjeto.some((orcamento) => orcamento.status === "enviado")
      ? "enviado"
      : orcamentosProjeto[0]?.status;
  const moduloAnalises = avaliarModuloOperacional({
    exigido: exigeAnalises,
    quantidadeItens: itensAnalises,
    statusDocumento: statusAnalises,
    pendenciaSemItens: "adicionar ao menos uma análise com custo",
  });
  const moduloProjeto = avaliarModuloOperacional({
    exigido: exigeProjeto,
    quantidadeItens: itensProjeto,
    statusDocumento: statusProjeto,
    pendenciaSemItens: "adicionar ao menos um custo, análise de projeto ou justificativa",
  });
  const projetoReferencia = orcamentosProjeto.at(-1);
  const parametrosEconomicosAtivos = parametrosEconomicosDaProposta(projetoReferencia);
  const orcamentoFinal = consolidarOrcamentoFinal({
    laboratorioExigido: exigeAnalises,
    projetoExigido: exigeProjeto,
    laboratorioRevisado: true,
    projetoRevisado: moduloProjeto.status === "revisado" || moduloProjeto.status === "nao_exigido",
    itensLaboratorio: orcamentosAnalises.flatMap((orcamento) => orcamento.orcamento_itens ?? []),
    itensProjeto: [
      ...orcamentosProjeto.flatMap((orcamento) => (
        orcamento.orcamento_projeto_custos ?? []
      )),
      ...(exigeAnalises ? [] : orcamentosProjeto.flatMap((orcamento) => (
        orcamento.orcamento_projeto_analises ?? []
      )).map((item) => ({
        rubrica: "MC",
        quantidade: Number(item.n_amostras),
        custo_unitario: Number(item.custo_unitario),
        preco_unitario: Number(item.preco_unitario),
        meses_selecionados: [],
      }))),
    ],
    parametrosProjeto: parametrosEconomicosAtivos,
  });
  const modulosPendentes = [
    moduloProjeto.status === "pendente" ? "preencher custos de projeto" : null,
    moduloProjeto.status === "preenchido" ? "revisar custos de projeto" : null,
  ].filter(Boolean) as string[];
  const podeConsolidar = modulosPendentes.length === 0;
  const etapasFluxo = calcularFluxoDemanda({
    modalidade: demanda.modalidade,
    projetoAssociado: Boolean(demanda.projeto_id),
    demandaCompleta: completudeDemanda.completa,
    demandaFaltante: completudeDemanda.faltante,
    laboratorioStatus: moduloAnalises.status,
    laboratorioLabel: moduloAnalises.label,
    projetoStatus: moduloProjeto.status,
    projetoLabel: moduloProjeto.label,
    parametrosLiberados: podeConsolidar,
    orcamentoFinalPronto: orcamentoFinal.pronto,
    versoesFinais: versoesFinais?.length ?? 0,
  });
  const etapasAplicaveis = new Set<EtapaAtivaDemanda>(["demanda", "final", "historico"]);
  if (exigeProjeto) etapasAplicaveis.add("projeto");
  const etapaPadrao: EtapaAtivaDemanda = !completudeDemanda.completa
    ? "demanda"
    : exigeProjeto && moduloProjeto.status !== "revisado"
      ? "projeto"
      : "final";
  const etapaAtiva = etapasAplicaveis.has(etapaSolicitada as EtapaAtivaDemanda)
    ? (etapaSolicitada as EtapaAtivaDemanda)
    : etapaPadrao;
  const pendenciasTabela = [
    {
      etapa: "Demanda",
      obrigatoria: true,
      status: completudeDemanda.completa ? "Completo" : "Pendente",
      pendencia: completudeDemanda.completa ? "concluida" : completudeDemanda.pendencias.join("; "),
      acao: `/orcamento/demandas/${demandaId}?etapa=demanda`,
    },
    {
      etapa: "Projeto",
      obrigatoria: exigeProjeto,
      status: moduloProjeto.label,
      pendencia: moduloProjeto.pendencias.join("; "),
      acao: `/orcamento/demandas/${demandaId}?etapa=projeto`,
    },
    {
      etapa: "Final",
      obrigatoria: true,
      status: orcamentoFinal.pronto ? "Pronto" : "Bloqueado",
      pendencia: orcamentoFinal.pendencias.length > 0 ? orcamentoFinal.pendencias.join("; ") : "pronto para emissao",
      acao: `/orcamento/demandas/${demandaId}?etapa=final`,
    },
  ];
  const totalAnalisesCusto = orcamentosAnalises.reduce(
    (total, orcamento) =>
      total + (orcamento.orcamento_itens ?? []).reduce((subtotal, item) => subtotal + Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0), 0),
    0,
  );
  const totalAnalisesPreco = orcamentosAnalises.reduce(
    (total, orcamento) =>
      total + (orcamento.orcamento_itens ?? []).reduce((subtotal, item) => subtotal + Number(item.preco_unitario ?? 0) * Number(item.n_amostras ?? 0), 0),
    0,
  );
  const totalProjetoCustos = orcamentosProjeto.reduce(
    (total, orcamento) =>
      total + (orcamento.orcamento_projeto_custos ?? []).reduce((subtotal, item) => subtotal + Number(item.custo_unitario ?? 0) * Number(item.quantidade ?? 0), 0),
    0,
  );
  const totalProjetoAnalises = orcamentosProjeto.reduce(
    (total, orcamento) =>
      total + (orcamento.orcamento_projeto_analises ?? []).reduce((subtotal, item) => subtotal + Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0), 0),
    0,
  );
  const rubricasProposta = resumirRubricasProposta({
    custosProjeto: orcamentosProjeto.flatMap((orcamento) => orcamento.orcamento_projeto_custos ?? []),
    analisesProjeto: exigeAnalises ? [] : orcamentosProjeto.flatMap((orcamento) => orcamento.orcamento_projeto_analises ?? []),
  });
  const analisesProposta = resumirAnalisesLaboratorio({
    itens: orcamentosAnalises.flatMap((orcamento) => orcamento.orcamento_itens ?? []),
    catalogo: analisesCatalogo ?? [],
  });

  // §8.2: valor digitado/escolhido pelo usuário aparece em azul (TOM_ENTRADA).
  const inp =
    `rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-950 ${TOM_ENTRADA}`;
  const hydrationSafe = { suppressHydrationWarning: true } as const;

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="w-full px-4 py-8 xl:px-6">
        <Breadcrumbs
          items={[
            { label: "Orçamentos não finalizados", href: "/orcamento/demandas" },
            { label: demanda.titulo },
          ]}
        />

        {etapaAtiva !== "final" && (
        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Demanda/Proposta
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{demanda.titulo}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                {MODALIDADES[modalidadeCanonica] ?? demanda.modalidade}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">Nº {demanda.id}</p>
              <p className="text-zinc-500">Status: {demanda.status}</p>
              <p className="text-zinc-500">Prioridade: {demanda.prioridade}</p>
              <p className={completudeDemanda.completa ? "text-brand-700 dark:text-brand-300" : "text-amber-700 dark:text-amber-300"}>
                {completudeDemanda.completa ? "Demanda pronta" : `${completudeDemanda.faltante}% faltante`}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Info titulo="Cliente" texto={demanda.cliente_nome} />
            <Info titulo="Contato" texto={demanda.cliente_contato} />
            <Info titulo="Solicitação" texto={demanda.data_solicitacao} />
            <Info titulo="Prazo esperado" texto={demanda.prazo_esperado} />
            <Info titulo="Matriz/amostra" texto={demanda.matriz_amostra} />
            <Info titulo="Qtd. estimada" texto={demanda.quantidade_amostras_estimada ? String(demanda.quantidade_amostras_estimada) : null} />
            <Info titulo="Prazo técnico" texto={demanda.prazo_tecnico_dias ? `${demanda.prazo_tecnico_dias} dias` : null} />
            <Info titulo="Completude atualizada" texto={formatDateTime(demanda.completude_atualizada_em)} />
          </div>

          <div className="mt-6 grid gap-4 text-sm md:grid-cols-3">
            <Texto titulo="Descrição" texto={demanda.descricao} />
            <Texto titulo="Escopo preliminar" texto={demanda.escopo_preliminar} />
            <Texto titulo="Observações" texto={demanda.observacoes} />
          </div>
        </section>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <FluxoEtapas etapas={etapasFluxo} demandaId={demandaId} etapaAtiva={etapaAtiva} />
          </aside>
          <div className="min-w-0 space-y-6">

        {etapaAtiva === "demanda" && (
        <section id="demanda" className="mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Dados da demanda</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Identificação, cliente, classificação e escopo inicial. Estes dados serão herdados pelos módulos seguintes.
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${completudeDemanda.completa ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
              {completudeDemanda.completa ? "Completa" : `${completudeDemanda.faltante}% faltante`}
            </span>
          </div>
          <DemandaForm
            demanda={demanda}
            clientes={(clientes ?? []) as { id: number; nome: string }[]}
            projetos={(projetos ?? []) as { id: number; nome: string }[]}
            analises={analisesFormulario}
            gruposAmostras={gruposFormulario}
            analisesSelecionadas={analisesSelecionadasFormulario}
            modo="demanda"
          />
        </section>
        )}

        {etapaAtiva === "laboratorio" && (
        <section id="laboratorio" className="mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Análises laboratoriais</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Amostras, análises por grupo e previsão operacional antes dos parâmetros econômicos.
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClasse(moduloAnalises.status)}`}>
              {exigeAnalises ? `${moduloAnalises.label} · ${moduloAnalises.faltante}% faltante` : "Pulada pela modalidade"}
            </span>
          </div>

          {!exigeAnalises ? (
            <div className="mt-4 rounded-md bg-zinc-50 px-3 py-4 text-sm text-zinc-500 dark:bg-zinc-950/50">
              Esta modalidade pula automaticamente a etapa de análises laboratoriais.
            </div>
          ) : (
            <>
              <ResumoHerdadoDemanda demanda={demanda} demandaId={demandaId} modalidade={MODALIDADES[modalidadeCanonica] ?? demanda.modalidade ?? "—"} />
              <TabelaSimples
                colunas={["Grupo", "Matriz", "Análise", "Quantidade", "Custeio"]}
                vazio="Nenhuma análise solicitada. Volte para a etapa Demanda para completar o formulário inicial."
                linhas={analisesSelecionadasFormulario.map((item) => [
                  item.grupo_identificacao ?? "Grupo",
                  gruposFormulario.find((grupo) => Number(grupo.id) === Number(item.grupo_amostra_id))?.tipo_matriz ?? demanda.matriz_amostra ?? "—",
                  item.codigo_analise,
                  String(item.quantidade_amostras),
                  item.status_custeio === "disponivel" ? "Disponível" : "Pendente",
                ])}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold">Resumo calculado:</span> {orcamentosAnalises.length} orçamento(s), {itensAnalises} item(ns), custo {brl(totalAnalisesCusto)}, preço {brl(totalAnalisesPreco)}.
                </div>
                {completudeDemanda.completa ? (
                  <form action={gerarOrcamentoAnalisesDaDemanda}>
                    <input {...hydrationSafe} type="hidden" name="demanda_id" value={demandaId} />
                    <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500">
                      Gerar orçamento laboratorial
                    </button>
                  </form>
                ) : (
                  <span className="rounded-md border border-amber-200 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-300">
                    Complete a demanda para gerar orçamento
                  </span>
                )}
              </div>
            </>
          )}
        </section>
        )}

        {etapaAtiva === "projeto" && (
        <section id="projeto" className="mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Orçamento de projeto</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Custos próprios, atividades e entregáveis do projeto. Dados cadastrais vêm da demanda.
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClasse(moduloProjeto.status)}`}>
              {exigeProjeto ? `${moduloProjeto.label} · ${moduloProjeto.faltante}% faltante` : "Nao se aplica"}
            </span>
          </div>

          {!exigeProjeto ? (
            <div className="mt-4 rounded-md bg-zinc-50 px-3 py-4 text-sm text-zinc-500 dark:bg-zinc-950/50">
              Esta modalidade não exige orçamento de projeto.
            </div>
          ) : (
            <>
              <ResumoHerdadoDemanda demanda={demanda} demandaId={demandaId} modalidade={MODALIDADES[modalidadeCanonica] ?? demanda.modalidade ?? "—"} />
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Info titulo="Orçamentos" texto={String(orcamentosProjeto.length)} />
                <Info titulo="Itens/justificativas" texto={String(itensProjeto)} />
                <Info titulo="Custos próprios" texto={brl(totalProjetoCustos)} />
                <Info
                  titulo="Análises referenciadas"
                  texto={exigeAnalises ? "custeadas no laboratório" : brl(totalProjetoAnalises)}
                />
              </div>
              <TabelaSimples
                colunas={["Projeto", "Status", "Data", "Custos", "Análises", "Justificativa", "Ação"]}
                vazio="Nenhum orçamento de projeto gerado."
                linhas={orcamentosProjeto.map((orcamento) => [
                  orcamento.titulo || `#${orcamento.id}`,
                  orcamento.status,
                  orcamento.data_orcamento ?? "—",
                  String(orcamento.orcamento_projeto_custos?.length ?? 0),
                  String(orcamento.orcamento_projeto_analises?.length ?? 0),
                  orcamento.projeto_sem_custo_justificativa ? "sim" : "não",
                  <Link key={orcamento.id} href={`/orcamento/projetos/${orcamento.id}`} className="font-medium text-primary hover:underline">
                    Abrir
                  </Link>,
                ])}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/40">
                <span className="text-zinc-600 dark:text-zinc-300">
                  Análises selecionadas no laboratório não são duplicadas como custo de projeto.
                </span>
                {completudeDemanda.completa ? (
                  <form action={gerarOrcamentoProjetoDaDemanda}>
                    <input {...hydrationSafe} type="hidden" name="demanda_id" value={demandaId} />
                    <button className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                      Gerar orçamento de projeto
                    </button>
                  </form>
                ) : (
                  <span className="rounded-md border border-amber-200 px-3 py-2 text-amber-700 dark:border-amber-900 dark:text-amber-300">
                    Complete a demanda
                  </span>
                )}
              </div>
            </>
          )}
        </section>
        )}

        {etapaAtiva === "historico" && (
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Pendências por etapa</h2>
          <TabelaSimples
            colunas={["Etapa", "Obrigatório?", "Status", "Pendência", "Ação"]}
            vazio="Sem pendências operacionais."
            linhas={pendenciasTabela.map((item) => [
              item.etapa,
              item.obrigatoria ? "Sim" : "Não",
              item.status,
              item.pendencia,
              <a key={item.etapa} href={item.acao} className="font-medium text-primary hover:underline">
                Ir para etapa
              </a>,
            ])}
          />
        </section>
        )}

        {etapaAtiva === "final" && (
        <section id="final" className="scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Proposta final</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Parâmetros econômicos, simulação de gross-up e dashboard de decisão da proposta.
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${orcamentoFinal.pronto ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
              {orcamentoFinal.pronto ? "Pronto para emissão" : "Bloqueado"}
            </span>
          </div>

          {erroParametros && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {erroParametros}
            </div>
          )}

          <ResumoPropostaFinal demanda={demanda} modalidade={MODALIDADES[modalidadeCanonica] ?? demanda.modalidade ?? "—"} />

          <ParametrosDemandaGrossUp
            demandaId={demandaId}
            subtotalTecnico={orcamentoFinal.subtotalTecnico ?? 0}
            rubricas={rubricasProposta}
            valores={parametrosEconomicosAtivos}
          />

          <section className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              <h3 className="text-sm font-semibold">Dashboard da proposta</h3>
              <p className="mt-1 text-xs text-zinc-500">Leitura consolidada dos custos, concentração por rubrica e base técnica usada na proposta final.</p>
            </div>
            <div className="space-y-3 p-3">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <IndicadorDashboard titulo="Custo por amostra" valor={brl(custoMedioAmostra(orcamentosAnalises))} detalhe={`${totalAmostras(orcamentosAnalises)} amostra(s)`} />
                <IndicadorDashboard titulo="Custo laboratório" valor={brl(orcamentoFinal.totalLaboratorioCusto)} detalhe={percentualDashboard(orcamentoFinal.totalLaboratorioCusto, orcamentoFinal.subtotalTecnico ?? 0)} />
                <IndicadorDashboard titulo="Custo projeto" valor={brl(orcamentoFinal.totalProjetoCusto)} detalhe={percentualDashboard(orcamentoFinal.totalProjetoCusto, orcamentoFinal.subtotalTecnico ?? 0)} />
                <IndicadorDashboard titulo="Maior rubrica" valor={rubricasProposta[0]?.codigo ?? "—"} detalhe={rubricasProposta[0] ? `${brl(rubricasProposta[0].custo)} · ${percentualDashboard(rubricasProposta[0].custo, orcamentoFinal.subtotalTecnico ?? 0)}` : "sem custo"} />
              </div>

              <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">Laboratório por análise</h4>
                    <span className="text-xs text-zinc-500">Custo e % do laboratório</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {analisesProposta.length > 0 ? analisesProposta.map((analise) => (
                      <BarraDashboard
                        key={analise.codigo}
                        titulo={`${analise.codigo} · ${analise.nome}`}
                        valor={analise.custo}
                        total={orcamentoFinal.totalLaboratorioCusto}
                        detalhe={`${analise.amostras} amostra(s) · ${brl(analise.custoUnitarioMedio)}/amostra`}
                      />
                    )) : <p className="text-xs text-zinc-400">Nenhuma análise laboratorial vinculada.</p>}
                  </div>
                </div>

                <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">Projeto por rubrica</h4>
                    <span className="text-xs text-zinc-500">Custo e % do projeto</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {rubricasProposta.map((rubrica) => (
                      <BarraDashboard
                        key={rubrica.codigo}
                        titulo={`${rubrica.codigo} · ${rubrica.nome}`}
                        valor={rubrica.custo}
                        total={Math.max(orcamentoFinal.totalProjetoCusto, totalProjetoCustos + totalProjetoAnalises)}
                        detalhe={`${rubrica.itens} item(ns)`}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold">Concentração da proposta</h4>
                  <span className="text-xs text-zinc-500">Custo e % do custo direto</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <BarraDashboard titulo="Laboratório" valor={orcamentoFinal.totalLaboratorioCusto} total={orcamentoFinal.subtotalTecnico ?? 0} detalhe="análises e amostras" />
                  <BarraDashboard titulo="Projeto" valor={orcamentoFinal.totalProjetoCusto} total={orcamentoFinal.subtotalTecnico ?? 0} detalhe="rubricas e custos próprios" />
                  <BarraDashboard titulo="Projeto: rubricas" valor={totalProjetoCustos} total={orcamentoFinal.subtotalTecnico ?? 0} detalhe="custos diretos cadastrados" />
                  <BarraDashboard titulo="Projeto: análises" valor={totalProjetoAnalises} total={orcamentoFinal.subtotalTecnico ?? 0} detalhe="análises dentro do projeto" />
                </div>
              </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
                <PainelComposicao
                  titulo="Mapa de custo laboratorial"
                  itens={analisesProposta.map((analise) => ({
                    chave: analise.codigo,
                    label: analise.nome,
                    detalhe: `${analise.amostras} amostra(s)`,
                    valor: analise.custo,
                  }))}
                  total={orcamentoFinal.totalLaboratorioCusto}
                />
                <PainelComposicao
                  titulo="Mapa de custo do projeto"
                  itens={rubricasProposta.map((rubrica) => ({
                    chave: rubrica.codigo,
                    label: rubrica.nome,
                    detalhe: `${rubrica.itens} item(ns)`,
                    valor: rubrica.custo,
                  }))}
                  total={Math.max(orcamentoFinal.totalProjetoCusto, totalProjetoCustos + totalProjetoAnalises)}
                />
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <TabelaSimples
                  colunas={["Análise", "Amostras", "Custo/amostra", "Custo total"]}
                  vazio="Nenhuma análise laboratorial vinculada."
                  linhas={orcamentosAnalises.flatMap((orcamento) => (orcamento.orcamento_itens ?? []).map((item) => [
                    item.codigo_analise ?? `Item #${item.id}`,
                    String(item.n_amostras ?? 0),
                    brl(Number(item.custo_unitario ?? 0)),
                    brl(Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0)),
                  ]))}
                />
                <TabelaSimples
                  colunas={["Custo de projeto", "Rubrica", "Qtd.", "Custo total"]}
                  vazio="Nenhum custo próprio de projeto vinculado."
                  linhas={orcamentosProjeto.flatMap((orcamento) => (orcamento.orcamento_projeto_custos ?? []).map((item) => [
                    `Projeto #${orcamento.id}`,
                    item.rubrica ?? "OU",
                    String(item.quantidade ?? 0),
                    brl(Number(item.custo_unitario ?? 0) * Number(item.quantidade ?? 0)),
                  ]))}
                />
              </div>
            </div>
          </section>

          {orcamentoFinal.pendencias.length > 0 ? (
            <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">Pendências para emissão:</p>
              <ul className="mt-1 list-disc pl-4">
                {orcamentoFinal.pendencias.map((pendencia) => (
                  <li key={pendencia}>{pendencia}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 rounded-md bg-brand-50 px-3 py-2 text-xs leading-5 text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
              Módulos exigidos revisados. A versão final pode ser emitida e preservada no histórico.
            </div>
          )}

          {erroEmissao && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {erroEmissao}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <form action={emitirOrcamentoFinalDaDemanda} className="flex flex-wrap items-end gap-2">
              <input {...hydrationSafe} type="hidden" name="demanda_id" value={demandaId} />
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Validade (dias)</label>
                <input
                  {...hydrationSafe}
                  name="validade_dias"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="30"
                  className={`${inp} mt-1 w-28`}
                  disabled={!orcamentoFinal.pronto}
                />
              </div>
              <button
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800"
                disabled={!orcamentoFinal.pronto}
              >
                Emitir versão final
              </button>
            </form>
          </div>

          <div className="mt-5 rounded-md border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <p className="text-xs font-semibold">Versões emitidas</p>
              <span className="text-xs text-zinc-400">{versoesFinais?.length ?? 0} versão(ões)</span>
            </div>
            <div className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {(versoesFinais ?? []).map((versao) => (
                <div key={versao.id} className="grid gap-2 px-3 py-2 md:grid-cols-5">
                  <Link href={`/orcamento/final/${versao.id}`} className="font-medium text-primary hover:underline">
                    {versao.numero}
                  </Link>
                  <span>v{versao.versao}</span>
                  <span>{versao.status}</span>
                  <span>{versao.valido_ate ?? "sem validade"}</span>
                  <span className="font-semibold tabular-nums md:text-right">{brl(Number(versao.total_final ?? 0))}</span>
                </div>
              ))}
              {(versoesFinais ?? []).length === 0 && (
                <p className="px-3 py-4 text-xs text-zinc-400">Nenhuma versão final emitida.</p>
              )}
            </div>
          </div>
        </section>
        )}

        {etapaAtiva === "historico" && (
        <section id="historico" className="mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Histórico e auditoria</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Linha operacional com os registros preservados desta demanda e seus documentos derivados.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {(versoesFinais?.length ?? 0) + orcamentosAnalises.length + orcamentosProjeto.length} registro(s)
            </span>
          </div>

          <TabelaSimples
            colunas={["Registro", "Tipo", "Status", "Quando", "Valor/Itens"]}
            vazio="Nenhum registro operacional vinculado."
            linhas={[
              [
                `Orçamento #${demanda.id}`,
                "Demanda",
                demanda.status ?? "—",
                formatDateTime(demanda.completude_atualizada_em),
                completudeDemanda.completa ? "completa" : `${completudeDemanda.faltante}% faltante`,
              ],
              ...orcamentosAnalises.map((orcamento) => [
                `Laboratório #${orcamento.id}`,
                "Custos laboratoriais",
                orcamento.status,
                orcamento.data_orcamento ?? "—",
                `${orcamento.orcamento_itens?.length ?? 0} item(ns)`,
              ]),
              ...orcamentosProjeto.map((orcamento) => [
                orcamento.titulo || `Projeto #${orcamento.id}`,
                "Custos de projeto",
                orcamento.status,
                orcamento.data_orcamento ?? "—",
                `${(orcamento.orcamento_projeto_custos?.length ?? 0) + (orcamento.orcamento_projeto_analises?.length ?? 0)} item(ns)`,
              ]),
              ...(versoesFinais ?? []).map((versao) => [
                versao.numero,
                "Orçamento final",
                versao.status,
                formatDateTime(versao.criado_em),
                brl(Number(versao.total_final ?? 0)),
              ]),
            ]}
          />
        </section>
        )}
          </div>
        </div>
      </main>
    </div>
  );
}

function FluxoEtapas({
  etapas,
  demandaId,
  etapaAtiva,
}: {
  etapas: EtapaFluxoDemanda[];
  demandaId: number;
  etapaAtiva: EtapaAtivaDemanda;
}) {
  return (
    <nav className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" aria-label="Etapas da demanda">
      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Fluxo da proposta</p>
      <div className="space-y-1">
        {etapas.filter((etapa) => etapa.id !== "laboratorio" && etapa.id !== "parametros").map((etapa, index) => {
          const ativa = etapa.id === etapaAtiva;
          const classes = `grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition ${
            ativa ? "ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900" : ""
          } ${classeEtapa(etapa.estado)}`;

          if (etapa.estado === "pulado") {
            return (
              <span key={etapa.id} className={`${classes} cursor-not-allowed opacity-70`} aria-disabled="true">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{etapa.label}</span>
                    <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium">{rotuloEstado(etapa.estado)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] opacity-75">{etapa.status} · {etapa.detalhe}</span>
                </span>
              </span>
            );
          }

          return (
            <Link
              key={etapa.id}
              href={`/orcamento/demandas/${demandaId}?etapa=${etapa.id}`}
              className={`${classes} hover:bg-zinc-50 dark:hover:bg-zinc-800`}
              aria-current={ativa ? "step" : undefined}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{etapa.label}</span>
                  <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium">{rotuloEstado(etapa.estado)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] opacity-75">{etapa.status} · {etapa.detalhe}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ResumoHerdadoDemanda({
  demanda,
  demandaId,
  modalidade,
}: {
  demanda: {
    titulo: string | null;
    cliente_nome: string | null;
    cliente_contato: string | null;
    data_solicitacao: string | null;
    prazo_esperado: string | null;
    responsavel_interno: string | null;
    descricao: string | null;
  };
  demandaId: number;
  modalidade: string;
}) {
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Herdado da demanda
          </span>
          <div className="mt-2 grid gap-2 text-xs text-zinc-600 dark:text-zinc-300 md:grid-cols-4">
            <Info titulo="Título" texto={demanda.titulo} />
            <Info titulo="Cliente" texto={demanda.cliente_nome} />
            <Info titulo="Contato" texto={demanda.cliente_contato} />
            <Info titulo="Solicitação" texto={demanda.data_solicitacao} />
            <Info titulo="Modalidade" texto={modalidade} />
            <Info titulo="Prazo esperado" texto={demanda.prazo_esperado} />
            <Info titulo="Responsável" texto={demanda.responsavel_interno} />
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{demanda.descricao || "Sem descrição cadastrada."}</p>
        </div>
        <Link href={`/orcamento/demandas/${demandaId}?etapa=demanda`} className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900">
          Editar na demanda
        </Link>
      </div>
    </div>
  );
}

function ResumoPropostaFinal({
  demanda,
  modalidade,
}: {
  demanda: {
    titulo: string | null;
    cliente_nome: string | null;
    cliente_contato: string | null;
    data_solicitacao: string | null;
    prazo_esperado: string | null;
    responsavel_interno: string | null;
    descricao: string | null;
  };
  modalidade: string;
}) {
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="grid gap-2 text-xs text-zinc-600 dark:text-zinc-300 md:grid-cols-4">
        <Info titulo="Cliente" texto={demanda.cliente_nome} />
        <Info titulo="Contato" texto={demanda.cliente_contato} />
        <Info titulo="Solicitação" texto={demanda.data_solicitacao} />
        <Info titulo="Prazo esperado" texto={demanda.prazo_esperado} />
        <Info titulo="Modalidade" texto={modalidade} />
        <Info titulo="Responsável" texto={demanda.responsavel_interno} />
        <Info titulo="Título" texto={demanda.titulo} />
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{demanda.descricao || "Sem descrição cadastrada."}</p>
    </div>
  );
}

function Info({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/50">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{texto || "—"}</p>
    </div>
  );
}

function classeEtapa(estado: EstadoEtapaDemanda) {
  if (estado === "concluido") return "border-brand-200 bg-brand-50 text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-100";
  if (estado === "ativo") return "border-zinc-900 bg-white text-zinc-950 shadow-sm dark:border-zinc-100 dark:bg-zinc-950 dark:text-zinc-50";
  if (estado === "bloqueado") return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100";
  if (estado === "pulado") return "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40";
  return "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";
}

function rotuloEstado(estado: EstadoEtapaDemanda) {
  if (estado === "concluido") return "Concluído";
  if (estado === "ativo") return "Ativo";
  if (estado === "bloqueado") return "Bloqueado";
  if (estado === "pulado") return "Pulado";
  return "Pendente";
}

function Texto({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{titulo}</h3>
      <p className="mt-1 whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">{texto || "—"}</p>
    </div>
  );
}

function TabelaSimples({
  colunas,
  linhas,
  vazio,
}: {
  colunas: string[];
  linhas: ReactNode[][];
  vazio: string;
}) {
  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/50">
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
              <tr key={index} className="align-top">
                {linha.map((celula, celulaIndex) => (
                  <td key={celulaIndex} className="max-w-sm px-3 py-2 text-zinc-700 dark:text-zinc-200">
                    {celula}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={colunas.length} className="px-3 py-4 text-xs text-zinc-400">
                {vazio}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function IndicadorDashboard({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-zinc-500">{detalhe}</p>
    </div>
  );
}

function BarraDashboard({
  titulo,
  valor,
  total,
  detalhe,
}: {
  titulo: string;
  valor: number;
  total: number;
  detalhe: string;
}) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <div>
          <p className="font-medium text-zinc-800 dark:text-zinc-100">{titulo}</p>
          <p className="text-zinc-500">{detalhe}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{brl(valor)}</p>
          <p className="text-zinc-500">{percentualDashboard(valor, total)}</p>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PainelComposicao({
  titulo,
  itens,
  total,
}: {
  titulo: string;
  itens: Array<{ chave: string; label: string; detalhe: string; valor: number }>;
  total: number;
}) {
  const itensOrdenados = [...itens].sort((a, b) => b.valor - a.valor);
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{titulo}</h4>
        <span className="text-xs font-medium tabular-nums text-zinc-500">{brl(total)}</span>
      </div>
      <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
        {itensOrdenados.length > 0 ? itensOrdenados.map((item) => (
          <div key={item.chave} className="grid items-center gap-2 py-1.5 text-xs md:grid-cols-[minmax(8rem,1fr)_6rem_minmax(8rem,1fr)_4rem]">
            <div>
              <p className="font-medium text-zinc-800 dark:text-zinc-100">{item.chave} · {item.label}</p>
              <p className="text-zinc-500">{item.detalhe}</p>
            </div>
            <span className="text-right font-semibold tabular-nums">{brl(item.valor)}</span>
            <span className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span className="block h-1.5 rounded-full bg-brand-600" style={{ width: `${total > 0 ? Math.min(100, (item.valor / total) * 100) : 0}%` }} />
            </span>
            <span className="text-right tabular-nums text-zinc-500">{percentualDashboard(item.valor, total)}</span>
          </div>
        )) : (
          <p className="py-4 text-xs text-zinc-400">Sem custos classificados.</p>
        )}
      </div>
    </div>
  );
}

function parametrosEconomicosDaProposta(projeto?: OrcamentoProjetoResumo) {
  if (!projeto) return PARAMETROS_INSTITUCIONAIS;
  const valores = {
    impostos_legacy: Number(projeto.impostos_legacy ?? projeto.impostos ?? 0),
    incubacao: Number(projeto.incubacao ?? 0),
    reserva: Number(projeto.reserva ?? 0),
    investimentos: Number(projeto.investimentos ?? 0),
    lucro: Number(projeto.lucro ?? projeto.margem_lucro ?? 0),
  };
  const temValorSalvo = Object.values(valores).some((valor) => Number(valor) > 0);
  return temValorSalvo ? valores : PARAMETROS_INSTITUCIONAIS;
}

function resumirAnalisesLaboratorio({
  itens,
  catalogo,
}: {
  itens: NonNullable<OrcamentoAnalisesResumo["orcamento_itens"]>;
  catalogo: Array<{ codigo: string; nome?: string | null; nome_simplificado?: string | null }>;
}) {
  const nomes = new Map(catalogo.map((analise) => [analise.codigo, analise.nome_simplificado ?? analise.nome ?? analise.codigo]));
  const mapa = new Map<string, { codigo: string; nome: string; amostras: number; custo: number }>();

  for (const item of itens) {
    const codigo = item.codigo_analise ?? `Item #${item.id}`;
    const atual = mapa.get(codigo) ?? { codigo, nome: nomes.get(codigo) ?? codigo, amostras: 0, custo: 0 };
    atual.amostras += Number(item.n_amostras ?? 0);
    atual.custo += Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0);
    mapa.set(codigo, atual);
  }

  return [...mapa.values()]
    .map((item) => ({
      ...item,
      custoUnitarioMedio: item.amostras > 0 ? item.custo / item.amostras : 0,
    }))
    .sort((a, b) => b.custo - a.custo);
}

function resumirRubricasProposta({
  custosProjeto,
  analisesProjeto,
}: {
  custosProjeto: NonNullable<OrcamentoProjetoResumo["orcamento_projeto_custos"]>;
  analisesProjeto: NonNullable<OrcamentoProjetoResumo["orcamento_projeto_analises"]>;
}) {
  const nomes: Record<string, string> = {
    LAB: "Análises laboratoriais",
    PE: "Pessoal",
    MC: "Material de Consumo",
    MP: "Material Permanente",
    ST: "Serviços de Terceiros",
    VD: "Viagens e Diárias",
    OU: "Outros",
  };
  const mapa = new Map<string, { codigo: string; nome: string; itens: number; custo: number }>(
    Object.entries(nomes)
      .filter(([codigo]) => codigo !== "LAB")
      .map(([codigo, nome]) => [codigo, { codigo, nome, itens: 0, custo: 0 }]),
  );
  const adicionar = (codigoBruto: string | null | undefined, itens: number, custo: number) => {
    const codigo = (codigoBruto || "OU").toUpperCase();
    const atual = mapa.get(codigo) ?? { codigo, nome: nomes[codigo] ?? codigo, itens: 0, custo: 0 };
    atual.itens += itens;
    atual.custo += custo;
    mapa.set(codigo, atual);
  };

  for (const item of custosProjeto) {
    adicionar(item.rubrica, 1, Number(item.custo_unitario ?? 0) * Number(item.quantidade ?? 0));
  }
  for (const item of analisesProjeto) {
    adicionar("MC", 1, Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0));
  }

  return [...mapa.values()].sort((a, b) => b.custo - a.custo || a.codigo.localeCompare(b.codigo));
}

function percentualDashboard(valor: number, total: number) {
  if (!total) return "0,00%";
  return `${((valor / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function totalAmostras(orcamentos: OrcamentoAnalisesResumo[]) {
  return orcamentos.reduce(
    (total, orcamento) => total + (orcamento.orcamento_itens ?? []).reduce((subtotal, item) => subtotal + Number(item.n_amostras ?? 0), 0),
    0,
  );
}

function custoMedioAmostra(orcamentos: OrcamentoAnalisesResumo[]) {
  const amostras = totalAmostras(orcamentos);
  if (!amostras) return 0;
  const custo = orcamentos.reduce(
    (total, orcamento) => total + (orcamento.orcamento_itens ?? []).reduce((subtotal, item) => subtotal + Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0), 0),
    0,
  );
  return custo / amostras;
}

function statusClasse(status: ReturnType<typeof avaliarModuloOperacional>["status"]) {
  if (status === "revisado") {
    return "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300";
  }
  if (status === "preenchido") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  }
  if (status === "pendente") {
    return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  }
  return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800";
}
