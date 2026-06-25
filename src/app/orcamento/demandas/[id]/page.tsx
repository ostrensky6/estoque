import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import {
  emitirOrcamentoFinalDaDemanda,
  gerarOrcamentoAnalisesDaDemanda,
  gerarOrcamentoProjetoDaDemanda,
  salvarDemandaForm,
} from "@/lib/actions/demandas";
import { planejarModulosProposta, type PlanoModulo } from "@/lib/orcamento/garantir-modulos";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";
import { avaliarModuloOperacional } from "@/lib/orcamento/modulo-status";
import { consolidarOrcamentoFinal } from "@/lib/orcamento/orcamento-final";
import { PainelParametrosEconomicos } from "@/components/orcamento/PainelParametrosEconomicos";
import { formatCurrency as brl, formatDateTime } from "@/lib/formatters";
import { TOM_ENTRADA } from "@/lib/orcamento/tom-valor";
import { montarEtapasProposta, ORDEM_ETAPAS, type EtapaId } from "@/lib/orcamento/etapas-proposta";
import {
  detectarCustosZero,
  montarComponentesTecnicos,
  reconciliarComposicao,
  statusPropostaFinal,
  LABEL_STATUS_FINAL,
  type StatusPropostaFinal,
} from "@/lib/orcamento/proposta-final";
import {
  modalidadeExigeLaboratorio,
  modalidadeExigeProjeto,
  normalizarModalidadeOrcamento,
} from "@/lib/orcamento/orcamento-economico";

export const dynamic = "force-dynamic";

// Rótulos de exibição. As modalidades legadas continuam mapeadas para leitura de
// dados antigos; a forma canônica `projeto_com_analises` é o destino normalizado.
const MODALIDADES: Record<string, string> = {
  analises: "Apenas análises laboratoriais",
  projeto: "Apenas projeto",
  projeto_com_analises: "Projeto com análises laboratoriais",
  analises_projeto: "Análises dentro de projeto",
  projeto_analises_custos: "Projeto com custos próprios e análises laboratoriais",
};

// Opções oferecidas em novos cadastros: apenas as três modalidades canônicas.
const MODALIDADES_SELECIONAVEIS: Array<[string, string]> = [
  ["analises", MODALIDADES.analises],
  ["projeto", MODALIDADES.projeto],
  ["projeto_com_analises", MODALIDADES.projeto_com_analises],
];

const STATUS_FINAL_CLS: Record<StatusPropostaFinal, string> = {
  bloqueada: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  em_composicao: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  aguardando_revisao: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  pronta_para_emitir: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300",
  emitida: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  substituida: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  cancelada: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800",
};

type OrcamentoAnalisesResumo = {
  id: number;
  status: string;
  data_orcamento: string | null;
  orcamento_itens?: { id: number; codigo_analise: string | null; n_amostras: number; custo_unitario: number; preco_unitario: number }[] | null;
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

export default async function DemandaDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro_emissao?: string; etapa?: string; erro_integridade?: string }>;
}) {
  const { id } = await params;
  const { erro_emissao: erroEmissao, etapa: etapaParam, erro_integridade: erroIntegridade } = await searchParams;
  const demandaId = Number(id);
  const supabase = await createClient();

  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", demandaId)
    .single();
  if (!demanda) notFound();

  const [{ data: clientes }, { data: projetos }, { data: orcamentos }, { data: orcProjetos }, { data: versoesFinais }] =
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
    ]);

  const modalidadeCanonica = normalizarModalidadeOrcamento(demanda.modalidade);
  const exigeAnalises = modalidadeExigeLaboratorio(demanda.modalidade);
  const exigeProjeto = modalidadeExigeProjeto(demanda.modalidade) || Boolean(demanda.projeto_id);
  const completudeDemanda = avaliarCompletudeDemanda(demanda);
  const orcamentosAnalises = ((orcamentos ?? []) as OrcamentoAnalisesResumo[]);
  const orcamentosProjeto = ((orcProjetos ?? []) as OrcamentoProjetoResumo[]);
  const itensAnalises = orcamentosAnalises.reduce((total, orcamento) => total + (orcamento.orcamento_itens?.length ?? 0), 0);
  const itensProjeto = orcamentosProjeto.reduce((total, orcamento) => total + (
    (orcamento.orcamento_projeto_custos?.length ?? 0) +
    (orcamento.orcamento_projeto_analises?.length ?? 0) +
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
  const orcamentoFinal = consolidarOrcamentoFinal({
    laboratorioExigido: exigeAnalises,
    projetoExigido: exigeProjeto,
    laboratorioRevisado: moduloAnalises.status === "revisado" || moduloAnalises.status === "nao_exigido",
    projetoRevisado: moduloProjeto.status === "revisado" || moduloProjeto.status === "nao_exigido",
    itensLaboratorio: orcamentosAnalises.flatMap((orcamento) => orcamento.orcamento_itens ?? []),
    itensProjeto: [
      ...orcamentosProjeto.flatMap((orcamento) => (
        orcamento.orcamento_projeto_custos ?? []
      )),
      ...orcamentosProjeto.flatMap((orcamento) => (
        orcamento.orcamento_projeto_analises ?? []
      )).map((item) => ({
        rubrica: "MC",
        quantidade: Number(item.n_amostras),
        custo_unitario: Number(item.custo_unitario),
        preco_unitario: Number(item.preco_unitario),
        meses_selecionados: [],
      })),
    ],
    parametrosProjeto: {
      impostos_legacy: Number(projetoReferencia?.impostos_legacy ?? projetoReferencia?.impostos ?? 0),
      incubacao: Number(projetoReferencia?.incubacao ?? 0),
      reserva: Number(projetoReferencia?.reserva ?? 0),
      investimentos: Number(projetoReferencia?.investimentos ?? 0),
      lucro: Number(projetoReferencia?.lucro ?? projetoReferencia?.margem_lucro ?? 0),
    },
  });
  const modulosPendentes = [
    moduloAnalises.status === "pendente" ? "preencher custos laboratoriais" : null,
    moduloAnalises.status === "preenchido" ? "revisar custos laboratoriais" : null,
    moduloProjeto.status === "pendente" ? "preencher custos de projeto" : null,
    moduloProjeto.status === "preenchido" ? "revisar custos de projeto" : null,
  ].filter(Boolean) as string[];
  const podeConsolidar = modulosPendentes.length === 0;
  const etapas = montarEtapasProposta({
    demandaId,
    modalidade: demanda.modalidade,
    projetoAssociado: Boolean(demanda.projeto_id),
    demandaCompleta: completudeDemanda.completa,
    demandaFaltante: completudeDemanda.faltante,
    laboratorioStatus: moduloAnalises.status === "nao_exigido" ? "nao_exigido" : moduloAnalises.status,
    laboratorioLabel: moduloAnalises.label,
    projetoStatus: moduloProjeto.status === "nao_exigido" ? "nao_exigido" : moduloProjeto.status,
    projetoLabel: moduloProjeto.label,
    parametrosLiberados: podeConsolidar,
    orcamentoFinalPronto: orcamentoFinal.pronto,
    versoesFinais: versoesFinais?.length ?? 0,
  });
  // §2.7/2.8: a query string ?etapa= controla a etapa exibida, na ordem fixa.
  const etapaSolicitada = ORDEM_ETAPAS.includes(etapaParam as EtapaId) ? (etapaParam as EtapaId) : "demanda";
  const etapaAtiva: EtapaId =
    etapas.find((etapa) => etapa.id === etapaSolicitada && etapa.aplicavel)?.id ?? "demanda";
  // Exibe somente a seção da etapa ativa (Fase 2.7). As demais permanecem no DOM
  // ocultas para preservar âncoras e submissões; o redesenho da etapa final em
  // visão própria é tratado na Fase 10.
  const passo = (id: EtapaId) => (etapaAtiva === id ? "" : "hidden");
  // Oferece as modalidades canônicas; preserva o valor legado atual da demanda
  // como opção selecionável para não forçar reescrita em saves não relacionados.
  const opcoesModalidade: Array<[string, string]> =
    demanda.modalidade && !MODALIDADES_SELECIONAVEIS.some(([value]) => value === demanda.modalidade)
      ? [[demanda.modalidade, MODALIDADES[demanda.modalidade] ?? demanda.modalidade], ...MODALIDADES_SELECIONAVEIS]
      : MODALIDADES_SELECIONAVEIS;

  // --- Proposta final (Fase 10): reconciliação, custo zero e status padronizado ---
  const itensLaboratorioFlat = orcamentosAnalises.flatMap((o) => o.orcamento_itens ?? []);
  const custosProjetoFlat = orcamentosProjeto.flatMap((o) => o.orcamento_projeto_custos ?? []);
  const analisesProjetoFlat = orcamentosProjeto.flatMap((o) => o.orcamento_projeto_analises ?? []);
  const projetoTemJustificativa = orcamentosProjeto.some((o) => Boolean(o.projeto_sem_custo_justificativa));
  const componentesTecnicos = montarComponentesTecnicos({
    itensLaboratorio: itensLaboratorioFlat,
    custosProjeto: custosProjetoFlat,
    analisesProjeto: analisesProjetoFlat,
  });
  const composicaoFinal = reconciliarComposicao({
    componentes: componentesTecnicos,
    totalFinal: orcamentoFinal.totalFinal,
  });
  const custosZero = detectarCustosZero({
    itensLaboratorio: itensLaboratorioFlat,
    custosProjeto: custosProjetoFlat,
    analisesProjeto: analisesProjetoFlat,
    projetoTemJustificativa,
  });
  const temCustoZeroSemJustificativa = custosZero.length > 0;
  const ultimaVersaoFinal = versoesFinais?.[0];
  const statusFinal: StatusPropostaFinal = statusPropostaFinal({
    demandaCompleta: completudeDemanda.completa,
    laboratorioExigido: exigeAnalises,
    projetoExigido: exigeProjeto,
    laboratorioStatus: moduloAnalises.status === "nao_exigido" ? "nao_exigido" : moduloAnalises.status,
    projetoStatus: moduloProjeto.status === "nao_exigido" ? "nao_exigido" : moduloProjeto.status,
    parametrosValidos: orcamentoFinal.economia.valido,
    temCustoZeroSemJustificativa,
    versoesEmitidas: versoesFinais?.length ?? 0,
    ultimaVersaoStatus: ultimaVersaoFinal?.status ?? null,
  });
  const podeEmitir = orcamentoFinal.pronto && !temCustoZeroSemJustificativa;
  const versaoEmitidaVigente = (versoesFinais ?? []).find((v) => v.status === "emitido");

  // --- Idempotência/UI dos módulos (Fase 5) ---
  const planoModulosUi = planejarModulosProposta({
    modalidade: demanda.modalidade,
    projetoAssociado: Boolean(demanda.projeto_id),
    laboratorioAtivos: orcamentosAnalises.filter((o) => o.status !== "cancelado").map((o) => o.id),
    projetoAtivos: orcamentosProjeto.filter((o) => o.status !== "cancelado").map((o) => o.id),
  });
  const pendenciasTabela = [
    {
      etapa: "Demanda",
      obrigatoria: true,
      status: completudeDemanda.completa ? "Completo" : "Pendente",
      pendencia: completudeDemanda.completa ? "concluida" : completudeDemanda.pendencias.join("; "),
      acao: `/orcamento/demandas/${demandaId}?etapa=demanda`,
    },
    {
      etapa: "Laboratorio",
      obrigatoria: exigeAnalises,
      status: moduloAnalises.label,
      pendencia: moduloAnalises.pendencias.join("; "),
      acao: `/orcamento/demandas/${demandaId}?etapa=laboratorio`,
    },
    {
      etapa: "Projeto",
      obrigatoria: exigeProjeto,
      status: moduloProjeto.label,
      pendencia: moduloProjeto.pendencias.join("; "),
      acao: `/orcamento/demandas/${demandaId}?etapa=projeto`,
    },
    {
      etapa: "Parametros",
      obrigatoria: exigeProjeto,
      status: podeConsolidar ? "Liberado" : "Bloqueado",
      pendencia: podeConsolidar ? "custos revisados" : modulosPendentes.join("; "),
      acao: `/orcamento/demandas/${demandaId}?etapa=parametros`,
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

  // §8.2: valor digitado/escolhido pelo usuário aparece em azul (TOM_ENTRADA).
  const inp =
    `rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-950 ${TOM_ENTRADA}`;
  const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";
  const hydrationSafe = { suppressHydrationWarning: true } as const;

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Demandas/Propostas", href: "/orcamento/demandas" },
            { label: demanda.titulo },
          ]}
        />

        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Demanda/Proposta
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{demanda.titulo}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                {MODALIDADES[modalidadeCanonica] ?? MODALIDADES[demanda.modalidade] ?? demanda.modalidade}
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

        <nav className="sticky top-0 z-10 mt-4 overflow-x-auto border-y border-zinc-200 bg-white/95 py-2 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="flex min-w-max gap-2 px-2">
            {etapas.map((etapa, indice) => {
              const ativa = etapa.id === etapaAtiva;
              const desabilitada = !etapa.aplicavel;
              return (
                <a
                  key={etapa.id}
                  href={etapa.href}
                  aria-current={ativa ? "step" : undefined}
                  aria-disabled={desabilitada || undefined}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    ativa
                      ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-200"
                      : desabilitada
                        ? "border-zinc-200 text-zinc-400 dark:border-zinc-800"
                        : "border-zinc-300 text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  }`}
                >
                  <span className="block font-semibold">
                    {indice + 1}. {etapa.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wide">
                    {etapa.aplicavel ? etapa.status : "Não se aplica"}
                  </span>
                </a>
              );
            })}
          </div>
        </nav>

        <section id="acoes" className={`mt-6 scroll-mt-20 grid gap-4 lg:grid-cols-3 ${passo("demanda")}`}>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Próximos módulos</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              A modalidade da demanda controla quais módulos podem ser preenchidos.
            </p>
            {!completudeDemanda.completa && (
              <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Complete a demanda antes de gerar módulos: {completudeDemanda.pendencias.join("; ")}.
              </div>
            )}
            {(planoModulosUi.bloqueadoPorDuplicidade || erroIntegridade) && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <p className="font-medium">Integridade comprometida</p>
                {erroIntegridade && <p>{erroIntegridade}</p>}
                {planoModulosUi.erros.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <ModuloAcao
                plano={planoModulosUi.laboratorio}
                rotulo="laboratorial"
                demandaCompleta={completudeDemanda.completa}
                demandaId={demandaId}
                acaoCriar={gerarOrcamentoAnalisesDaDemanda}
                hrefBase="/orcamento"
              />
              <ModuloAcao
                plano={planoModulosUi.projeto}
                rotulo="de projeto"
                demandaCompleta={completudeDemanda.completa}
                demandaId={demandaId}
                acaoCriar={gerarOrcamentoProjetoDaDemanda}
                hrefBase="/orcamento/projetos"
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Custos vinculados</h2>
            <div className="mt-3 space-y-2 text-sm">
              {orcamentosAnalises.map((o) => (
                <Link key={o.id} href={`/orcamento/${o.id}`} className="block rounded-md bg-zinc-50 px-3 py-2 hover:bg-zinc-100 dark:bg-zinc-950/50 dark:hover:bg-zinc-800">
                  Laboratório #{o.id} · {o.status} · {(o.orcamento_itens?.length ?? 0)} item(ns)
                </Link>
              ))}
              {orcamentosProjeto.map((o) => (
                <Link key={o.id} href={`/orcamento/projetos/${o.id}`} className="block rounded-md bg-zinc-50 px-3 py-2 hover:bg-zinc-100 dark:bg-zinc-950/50 dark:hover:bg-zinc-800">
                  Projeto #{o.id} · {o.status} · {(o.orcamento_projeto_custos?.length ?? 0) + (o.orcamento_projeto_analises?.length ?? 0)} item(ns)
                </Link>
              ))}
              {orcamentosAnalises.length === 0 && orcamentosProjeto.length === 0 && (
                <p className="text-xs text-zinc-400">Nenhum custo gerado a partir desta demanda.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Fluxo recomendado</h2>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-zinc-500">
              <li>1. Registrar demanda.</li>
              <li>2. Confirmar modalidade e projeto.</li>
              <li>3. Gerar o custo correto.</li>
              <li>4. Planejar demanda e reservar estoque quando aprovado.</li>
            </ol>
          </div>
        </section>

        <section id="laboratorio" className={`mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${passo("laboratorio")}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Orçamento laboratorial</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Tabela operacional dos orçamentos de análises gerados a partir desta demanda.
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClasse(moduloAnalises.status)}`}>
              {exigeAnalises ? `${moduloAnalises.label} · ${moduloAnalises.faltante}% faltante` : "Nao se aplica"}
            </span>
          </div>

          {!exigeAnalises ? (
            <div className="mt-4 rounded-md bg-zinc-50 px-3 py-4 text-sm text-zinc-500 dark:bg-zinc-950/50">
              Esta modalidade não exige orçamento laboratorial.
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Info titulo="Orçamentos" texto={String(orcamentosAnalises.length)} />
                <Info titulo="Itens laboratoriais" texto={String(itensAnalises)} />
                <Info titulo="Custo recebido" texto={brl(totalAnalisesCusto)} />
                <Info titulo="Preço recebido" texto={brl(totalAnalisesPreco)} />
              </div>
              <TabelaSimples
                colunas={["Orçamento", "Status", "Data", "Itens", "Custo", "Preço", "Ação"]}
                vazio="Nenhum orçamento laboratorial gerado."
                linhas={orcamentosAnalises.map((orcamento) => {
                  const custo = (orcamento.orcamento_itens ?? []).reduce(
                    (total, item) => total + Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0),
                    0,
                  );
                  const preco = (orcamento.orcamento_itens ?? []).reduce(
                    (total, item) => total + Number(item.preco_unitario ?? 0) * Number(item.n_amostras ?? 0),
                    0,
                  );
                  return [
                    `#${orcamento.id}`,
                    orcamento.status,
                    orcamento.data_orcamento ?? "—",
                    String(orcamento.orcamento_itens?.length ?? 0),
                    brl(custo),
                    brl(preco),
                    <Link key={orcamento.id} href={`/orcamento/${orcamento.id}`} className="font-medium text-primary hover:underline">
                      Abrir
                    </Link>,
                  ];
                })}
              />
            </>
          )}
        </section>

        <section id="projeto" className={`mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${passo("projeto")}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Custos do projeto</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Custos próprios, análises internas do projeto e justificativas de projeto sem custo.
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
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Info titulo="Orçamentos" texto={String(orcamentosProjeto.length)} />
                <Info titulo="Itens/justificativas" texto={String(itensProjeto)} />
                <Info titulo="Custos próprios" texto={brl(totalProjetoCustos)} />
                <Info titulo="Análises no projeto" texto={brl(totalProjetoAnalises)} />
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
            </>
          )}
        </section>

        <section className={`mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${passo("demanda")}`}>
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

        <section id="parametros" className={`mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${passo("parametros")}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Parâmetros econômicos</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Leitura dos custos recebidos e dos percentuais usados na consolidação final.
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${podeConsolidar ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
              {podeConsolidar ? "Liberado" : "Aguardando revisão"}
            </span>
          </div>
          <PainelParametrosEconomicos
            custoLaboratorio={orcamentoFinal.totalLaboratorioCusto}
            precoLaboratorio={orcamentoFinal.totalLaboratorioPreco}
            custoProjeto={orcamentoFinal.totalProjetoCusto}
            subtotalTecnico={orcamentoFinal.subtotalTecnico}
            totalParametros={orcamentoFinal.totalParametros}
            totalFinal={orcamentoFinal.totalFinal}
            parametros={orcamentoFinal.parametrosProjeto}
            alertas={orcamentoFinal.alertas}
          />
          <TabelaSimples
            colunas={["Campo", "Origem", "Regra", "Valor"]}
            vazio="Sem fórmulas calculadas."
            linhas={orcamentoFinal.origens.map((origem) => [
              origem.titulo,
              origem.origem,
              origem.regra,
              brl(origem.valor),
            ])}
          />
        </section>

        <section id="final" className={`mt-6 scroll-mt-20 space-y-4 ${passo("final")}`}>
          {/* A — Cabeçalho da proposta + ações */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                  Proposta final · Nº {demanda.id}
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">{demanda.titulo}</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {demanda.cliente_nome || "Cliente livre"} · {MODALIDADES[modalidadeCanonica] ?? demanda.modalidade}
                  {versaoEmitidaVigente?.valido_ate ? ` · válido até ${versaoEmitidaVigente.valido_ate}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_FINAL_CLS[statusFinal]}`}>
                {LABEL_STATUS_FINAL[statusFinal]}
              </span>
            </div>

            {/* Total final acima da dobra */}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-md border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-900 dark:bg-brand-950/30">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">Total final</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-brand-800 dark:text-brand-200">{brl(orcamentoFinal.totalFinal)}</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {versaoEmitidaVigente && (
                  <Link
                    href={`/orcamento/final/${versaoEmitidaVigente.id}`}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    Abrir versão emitida ({versaoEmitidaVigente.numero})
                  </Link>
                )}
                <form action={emitirOrcamentoFinalDaDemanda} className="flex items-end gap-2">
                  <input {...hydrationSafe} type="hidden" name="demanda_id" value={demandaId} />
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-zinc-500">Validade (dias)</label>
                    <input {...hydrationSafe} name="validade_dias" type="number" min="1" step="1" defaultValue="30" className={`${inp} mt-1 w-24`} disabled={!podeEmitir} />
                  </div>
                  <button
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800"
                    disabled={!podeEmitir}
                  >
                    Emitir versão final
                  </button>
                </form>
              </div>
            </div>
            {erroEmissao && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{erroEmissao}</p>
            )}
          </div>

          {/* B — Resumo executivo */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Resumo executivo</h3>
            <div className={`mt-3 grid gap-3 ${exigeProjeto ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
              <ResumoFinal titulo="Custo laboratório (técnico)" valor={orcamentoFinal.totalLaboratorioCusto} />
              {exigeProjeto && <ResumoFinal titulo="Custo direto projeto" valor={orcamentoFinal.totalProjetoCusto} />}
              <ResumoFinal titulo="Subtotal técnico" valor={orcamentoFinal.subtotalTecnico} />
              <ResumoFinal titulo="Total de parâmetros" valor={orcamentoFinal.totalParametros} />
              <ResumoFinal titulo="Total final" valor={orcamentoFinal.totalFinal} destaque />
            </div>
          </div>

          {/* C — Resumo econômico */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Resumo econômico</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Info titulo="Subtotal técnico" texto={brl(orcamentoFinal.subtotalTecnico)} />
              <Info titulo="Soma dos parâmetros" texto={`${orcamentoFinal.somaPercentual.toLocaleString("pt-BR")}%`} />
              <Info titulo="Fator de gross-up" texto={orcamentoFinal.fatorGrossUp.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} />
            </div>
            {orcamentoFinal.parametrosProjeto.length > 0 && (
              <TabelaSimples
                colunas={["Parâmetro", "Percentual", "Valor nominal"]}
                vazio="Sem parâmetros."
                linhas={orcamentoFinal.parametrosProjeto.map((p) => [
                  p.label,
                  `${p.nominalRate.toLocaleString("pt-BR")}%`,
                  brl(p.amount),
                ])}
              />
            )}
            <p className="mt-3 text-[11px] leading-5 text-zinc-400">{orcamentoFinal.economia.formula}</p>
          </div>

          {/* F — Pendências e bloqueios */}
          {(orcamentoFinal.pendencias.length > 0 || temCustoZeroSemJustificativa || !composicaoFinal.reconciliaOk) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Pendências e bloqueios</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-900 dark:text-amber-200">
                {orcamentoFinal.pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {temCustoZeroSemJustificativa && (
                  <li>
                    Itens com custo técnico zero (sem justificativa de isenção):{" "}
                    {custosZero.map((c) => c.descricao).join(", ")}. Emissão bloqueada.
                  </li>
                )}
                {!composicaoFinal.reconciliaOk && (
                  <li>Divergência de reconciliação entre composição e total final — revisar itens.</li>
                )}
              </ul>
            </div>
          )}

          {/* D — Composição da proposta (reconciliada) */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Composição da proposta</h3>
              <span className="text-[11px] text-zinc-400">
                valor comercial = total final × participação técnica · {composicaoFinal.reconciliaOk ? "reconciliado" : "divergente"}
              </span>
            </div>
            {composicaoFinal.linhas.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-400">Nenhum componente com valor positivo para compor a proposta.</p>
            ) : (
              <TabelaSimples
                colunas={["Componente", "Descrição", "Qtd", "Custo unit. téc.", "Subtotal téc.", "Participação", "Valor comercial", "Obs."]}
                vazio="Sem componentes."
                linhas={composicaoFinal.linhas.map((l) => [
                  l.componente,
                  l.descricao,
                  String(l.quantidade),
                  brl(l.custoUnitarioTecnico),
                  brl(l.subtotalTecnico),
                  `${(l.participacao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
                  brl(l.valorComercial),
                  l.observacao ?? "—",
                ])}
              />
            )}
          </div>

          {/* E — Itens detalhados (custo técnico × preço snapshot), expansível */}
          <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer text-sm font-semibold">Detalhamento interno (custo técnico × preço snapshot)</summary>
            <div className="mt-3 space-y-4">
              {exigeAnalises && (
                <div>
                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Laboratório</p>
                  <TabelaSimples
                    colunas={["Análise", "Amostras", "Custo unit. (técnico)", "Preço unit. (snapshot)", "Custo total"]}
                    vazio="Sem itens laboratoriais."
                    linhas={itensLaboratorioFlat.map((item, i) => [
                      item.codigo_analise ?? `Item ${i + 1}`,
                      String(item.n_amostras ?? 0),
                      brl(Number(item.custo_unitario ?? 0)),
                      brl(Number(item.preco_unitario ?? 0)),
                      brl(Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0)),
                    ])}
                  />
                </div>
              )}
              {exigeProjeto && (
                <div>
                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Projeto</p>
                  <TabelaSimples
                    colunas={["Rubrica", "Quantidade", "Custo unit. (técnico)", "Custo total"]}
                    vazio="Sem custos de projeto."
                    linhas={custosProjetoFlat.map((item, i) => [
                      item.rubrica ?? `Item ${i + 1}`,
                      String(
                        item.rubrica === "PE" && (item.meses_selecionados?.length ?? 0) > 0
                          ? item.meses_selecionados!.length
                          : item.quantidade ?? 0,
                      ),
                      brl(Number(item.custo_unitario ?? 0)),
                      brl(
                        (item.rubrica === "PE" && (item.meses_selecionados?.length ?? 0) > 0
                          ? item.meses_selecionados!.length
                          : Number(item.quantidade ?? 0)) * Number(item.custo_unitario ?? 0),
                      ),
                    ])}
                  />
                </div>
              )}
              <p className="text-[11px] text-zinc-400">
                O preço laboratorial (snapshot) é apenas referência operacional e NÃO entra no fechamento da proposta (Política A).
              </p>
            </div>
          </details>

          {/* G — Histórico resumido */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Histórico de versões</h3>
              <span className="text-xs text-zinc-400">{versoesFinais?.length ?? 0} versão(ões)</span>
            </div>
            <div className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {(versoesFinais ?? []).map((versao) => (
                <div key={versao.id} className="grid items-center gap-2 px-1 py-2 md:grid-cols-5">
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
                <p className="px-1 py-4 text-xs text-zinc-400">Nenhuma versão final emitida.</p>
              )}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Versões emitidas antes da engine atual mantêm seus snapshots originais (modo legado) e não são recalculadas.
            </p>
          </div>
        </section>

        <section id="demanda" className={`mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${passo("demanda")}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Dados da demanda</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Identificação, classificação e escopo inicial que liberam os módulos seguintes.
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${completudeDemanda.completa ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
              {completudeDemanda.completa ? "Completa" : `${completudeDemanda.faltante}% faltante`}
            </span>
          </div>
          <form action={salvarDemandaForm} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input {...hydrationSafe} type="hidden" name="demanda_id" value={demandaId} />
            <div className="sm:col-span-2">
              <label className={lbl}>Título</label>
              <input {...hydrationSafe} name="titulo" defaultValue={demanda.titulo ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Cliente cadastrado</label>
              <select {...hydrationSafe} name="cliente_id" defaultValue={demanda.cliente_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">— cliente livre —</option>
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Projeto</label>
              <select {...hydrationSafe} name="projeto_id" defaultValue={demanda.projeto_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">—</option>
                {(projetos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Cliente livre</label>
              <input {...hydrationSafe} name="cliente_nome" defaultValue={demanda.cliente_nome ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>CNPJ/CPF</label>
              <input {...hydrationSafe} name="cliente_cnpj" defaultValue={demanda.cliente_cnpj ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Contato</label>
              <input {...hydrationSafe} name="cliente_contato" defaultValue={demanda.cliente_contato ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Instituição</label>
              <input {...hydrationSafe} name="instituicao" defaultValue={demanda.instituicao ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Responsável interno</label>
              <input {...hydrationSafe} name="responsavel_interno" defaultValue={demanda.responsavel_interno ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Origem</label>
              <input {...hydrationSafe} name="origem" defaultValue={demanda.origem ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Data da solicitação</label>
              <input {...hydrationSafe} name="data_solicitacao" type="date" defaultValue={demanda.data_solicitacao ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Prazo esperado</label>
              <input {...hydrationSafe} name="prazo_esperado" type="date" defaultValue={demanda.prazo_esperado ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Matriz ou tipo de amostra</label>
              <input {...hydrationSafe} name="matriz_amostra" defaultValue={demanda.matriz_amostra ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Quantidade estimada de amostras</label>
              <input {...hydrationSafe} name="quantidade_amostras_estimada" type="number" min="1" step="1" defaultValue={demanda.quantidade_amostras_estimada ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Prazo técnico estimado (dias)</label>
              <input {...hydrationSafe} name="prazo_tecnico_dias" type="number" min="1" step="1" defaultValue={demanda.prazo_tecnico_dias ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Modalidade</label>
              <select {...hydrationSafe} name="modalidade" defaultValue={demanda.modalidade ?? "analises"} className={`${inp} mt-1 w-full`}>
                {opcoesModalidade.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select {...hydrationSafe} name="status" defaultValue={demanda.status ?? "nova"} className={`${inp} mt-1 w-full`}>
                <option value="nova">Nova</option>
                <option value="em_analise">Em análise</option>
                <option value="orcada">Orçada</option>
                <option value="aprovada">Aprovada</option>
                <option value="recusada">Recusada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Prioridade</label>
              <select {...hydrationSafe} name="prioridade" defaultValue={demanda.prioridade ?? "normal"} className={`${inp} mt-1 w-full`}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Descrição da demanda</label>
              <textarea {...hydrationSafe} name="descricao" rows={4} defaultValue={demanda.descricao ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Escopo preliminar</label>
              <textarea {...hydrationSafe} name="escopo_preliminar" rows={4} defaultValue={demanda.escopo_preliminar ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Observações</label>
              <textarea {...hydrationSafe} name="observacoes" rows={3} defaultValue={demanda.observacoes ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                Salvar demanda
              </button>
            </div>
          </form>
        </section>

        <section id="historico" className={`mt-6 scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${passo("historico")}`}>
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
                `Demanda #${demanda.id}`,
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
      </main>
    </div>
  );
}

function ModuloAcao({
  plano,
  rotulo,
  demandaCompleta,
  demandaId,
  acaoCriar,
  hrefBase,
}: {
  plano: PlanoModulo;
  rotulo: string;
  demandaCompleta: boolean;
  demandaId: number;
  acaoCriar: (formData: FormData) => void | Promise<void>;
  hrefBase: string;
}) {
  if (!plano.aplicavel) {
    return (
      <span className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-800">
        {rotulo === "laboratorial" ? "Laboratório" : "Projeto"} não se aplica
      </span>
    );
  }
  if (plano.acao === "bloqueado") {
    return (
      <span className="rounded-md border border-red-200 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:text-red-300">
        Orçamento {rotulo}: saneamento necessário
      </span>
    );
  }
  if (!demandaCompleta) {
    return (
      <span className="rounded-md border border-amber-200 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-300">
        Complete a demanda
      </span>
    );
  }
  if (plano.acao === "abrir" && plano.moduloId) {
    return (
      <Link
        href={`${hrefBase}/${plano.moduloId}`}
        className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Abrir orçamento {rotulo}
      </Link>
    );
  }
  return (
    <form action={acaoCriar}>
      <input suppressHydrationWarning type="hidden" name="demanda_id" value={demandaId} />
      <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500">
        Criar orçamento {rotulo}
      </button>
    </form>
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

function Texto({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{titulo}</h3>
      <p className="mt-1 whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">{texto || "—"}</p>
    </div>
  );
}

function ResumoFinal({ titulo, valor, destaque = false }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${destaque ? "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30" : "border-zinc-200 dark:border-zinc-800"}`}>
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${destaque ? "text-brand-700 dark:text-brand-300" : ""}`}>
        {brl(valor)}
      </p>
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
    <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
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
