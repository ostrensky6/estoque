/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ExportOrcamentoFinalButtons } from "@/components/orcamento/ExportOrcamentoFinalButtons";
import { PrintButton } from "@/components/orcamento/PrintButton";
import { cancelarVersaoFinal, duplicarVersaoFinal } from "@/lib/actions/orcamento-historico";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency as brl, formatDate, formatDateTime } from "@/lib/formatters";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type SnapshotParametro = {
  key?: string;
  label?: string;
  nominalRate?: number;
  amount?: number;
};

type SnapshotConsolidado = {
  totalLaboratorioCusto?: number;
  totalLaboratorioPreco?: number;
  totalProjetoCusto?: number;
  totalProjetoFinal?: number;
  totalFinal?: number;
  parametrosProjeto?: SnapshotParametro[];
  markupProjeto?: number;
  pendencias?: string[];
  origens?: SnapshotOrigem[];
};

type SnapshotOrigem = {
  campo?: string;
  titulo?: string;
  origem?: string;
  regra?: string;
  valor?: number;
};

type SnapshotFinal = {
  demanda?: {
    id?: number;
    titulo?: string | null;
    cliente_nome?: string | null;
    cliente_cnpj?: string | null;
    cliente_contato?: string | null;
    instituicao?: string | null;
    responsavel_interno?: string | null;
    data_solicitacao?: string | null;
    prazo_esperado?: string | null;
    modalidade?: string | null;
    matriz_amostra?: string | null;
    quantidade_amostras_estimada?: number | null;
    prazo_tecnico_dias?: number | null;
    escopo_preliminar?: string | null;
    descricao?: string | null;
    observacoes?: string | null;
  };
  orcamentos_analises?: SnapshotOrcamentoAnalises[];
  orcamentos_projeto?: SnapshotOrcamentoProjeto[];
  consolidado?: SnapshotConsolidado;
};

type SnapshotOrcamentoAnalises = {
  id?: number;
  status?: string | null;
  orcamento_itens?: SnapshotItemAnalise[];
};

type SnapshotItemAnalise = {
  id?: number;
  codigo_analise?: string | null;
  n_amostras?: number | null;
  custo_unitario?: number | null;
  preco_unitario?: number | null;
};

type SnapshotOrcamentoProjeto = {
  id?: number;
  status?: string | null;
  titulo?: string | null;
  orcamento_projeto_analises?: SnapshotItemAnalise[];
  orcamento_projeto_custos?: SnapshotItemProjeto[];
};

type SnapshotItemProjeto = {
  id?: number;
  rubrica?: string | null;
  categoria?: string | null;
  descricao?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  custo_unitario?: number | null;
  preco_unitario?: number | null;
  meses_selecionados?: number[] | null;
};

const STATUS: Record<string, string> = {
  emitido: "Emitido",
  substituido: "Substituído",
  cancelado: "Cancelado",
};

export default async function OrcamentoFinalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const versaoId = Number(id);
  const supabase = await createClient();

  const { data: versao } = await supabase
    .from("orcamento_final_versoes")
    .select("*")
    .eq("id", versaoId)
    .single();
  if (!versao) notFound();

  const snapshot = normalizarSnapshot(versao.snapshot);
  const { data: demandaAtual } = await supabase
    .from("demandas_propostas")
    .select("id, titulo, cliente_nome, cliente_cnpj, cliente_contato, instituicao, responsavel_interno, data_solicitacao, prazo_esperado, modalidade, matriz_amostra, quantidade_amostras_estimada, prazo_tecnico_dias, escopo_preliminar, descricao, observacoes")
    .eq("id", versao.demanda_id)
    .single();

  const demanda = { ...(demandaAtual ?? {}), ...(snapshot.demanda ?? {}) };
  const consolidado = snapshot.consolidado ?? {};
  const origens = normalizarOrigens(consolidado, versao);
  const itensLaboratorio = (snapshot.orcamentos_analises ?? []).flatMap((orcamento) =>
    (orcamento.orcamento_itens ?? []).map((item) => ({
      ...item,
      origem: `Laboratório #${orcamento.id ?? "—"}`,
      status: orcamento.status ?? "—",
    })),
  );
  const custosProjeto = (snapshot.orcamentos_projeto ?? []).flatMap((orcamento) =>
    (orcamento.orcamento_projeto_custos ?? []).map((item) => ({
      ...item,
      origem: `Projeto #${orcamento.id ?? "—"}`,
      status: orcamento.status ?? "—",
    })),
  );
  const analisesProjeto = (snapshot.orcamentos_projeto ?? []).flatMap((orcamento) =>
    (orcamento.orcamento_projeto_analises ?? []).map((item) => ({
      ...item,
      origem: `Projeto #${orcamento.id ?? "—"}`,
      status: orcamento.status ?? "—",
    })),
  );
  type ConfigEmissaoSnapshot = {
    tipo_emissao?: string;
    assinante?: {
      nome?: string;
      cargo?: string;
      instituicao?: string;
      email?: string;
      telefone?: string;
      assinatura_url?: string;
      assinaturaUrl?: string;
    };
    dados_proposta?: {
      codigo?: string;
      data_emissao?: string;
      validade?: string;
      cliente?: string;
      cliente_contato?: string;
      demanda_titulo?: string;
      objeto?: string;
      condicoes?: string;
      prazo?: string;
      forma_pagamento?: string;
      observacoes?: string;
    };
    opcoes_conteudo?: string[];
  };
  const configEmissao = ((versao.snapshot as { config_emissao?: ConfigEmissaoSnapshot } | null)?.config_emissao ?? {}) as ConfigEmissaoSnapshot;
  const tipoEmissao = configEmissao.tipo_emissao ?? "GIA / UFPR";
  const signer = configEmissao.assinante ?? {
    nome: "Antonio Ostrensky Neto",
    cargo: "Coordenador Geral",
    instituicao: tipoEmissao === "GIA / UFPR" ? "Grupo Integrado de Aquicultura e Estudos Ambientais" : "ATGC Genética Ambiental Limitada",
    email: "ostrensky@ufpr.br",
    telefone: "+55 (41) 3360-1234",
  };
  const dadosProposta = configEmissao.dados_proposta ?? {};
  const opcoesSalvas = configEmissao.opcoes_conteudo ?? [
    "resumo_demanda",
    "analises_incluidas",
    "qtd_amostras",
    "condicoes_comerciais",
    "prazo_validade",
    "prazo_execucao",
    "dados_emissor",
  ];
  const opcoes = Object.fromEntries(opcoesSalvas.map((k: string) => [k, true]));

  const isGia = tipoEmissao === "GIA / UFPR";
  const legalName = isGia ? "Grupo Integrado de Aquicultura e Estudos Ambientais" : "ATGC Genética Ambiental Limitada";
  const primaryColor = isGia ? "text-[#1A5292] dark:text-[#5B92D4]" : "text-[#0B8793] dark:text-[#38B2AC]";
  const borderCol = isGia ? "border-[#1A5292]" : "border-[#0B8793]";
  const borderColTable = isGia ? "border-blue-100 dark:border-blue-900/50" : "border-teal-100 dark:border-teal-900/50";
  const tableHeaderBg = isGia ? "bg-blue-50/30 dark:bg-blue-950/10" : "bg-teal-50/30 dark:bg-teal-950/10";
  const finalBoxBg = isGia ? "bg-[#1A5292]" : "bg-[#0B8793]";
  const addressText = "Universidade Federal do Paraná, Rua dos Funcionários, 1540, Juvevê, Curitiba - PR, CEP 80035-050";

  const dadosCodigo = dadosProposta.codigo || versao.numero;
  const dadosDataEmissao = dadosProposta.data_emissao || new Date(versao.criado_em).toISOString().slice(0, 10);
  const dadosValidade = dadosProposta.validade || versao.valido_ate || "";
  const dadosCliente = dadosProposta.cliente || demanda?.cliente_nome || "—";
  const dadosClienteContato = dadosProposta.cliente_contato || demanda?.cliente_contato || "";
  const dadosDemandaTitulo = dadosProposta.demanda_titulo || demanda?.titulo || "—";
  const dadosObjeto = dadosProposta.objeto || demanda?.escopo_preliminar || demanda?.descricao || "—";
  const dadosCondicoes = dadosProposta.condicoes || condicoesComerciais(versao) || "—";
  const dadosPrazo = dadosProposta.prazo || (demanda?.prazo_tecnico_dias ? `${demanda.prazo_tecnico_dias} dias` : "—");
  const dadosFormaPagamento = dadosProposta.forma_pagamento || "—";
  const dadosObservacoes = dadosProposta.observacoes || demanda?.observacoes || "";

  const signerNome = signer.nome || "";
  const signerCargo = signer.cargo || "";
  const signerInstituicao = signer.instituicao || "";
  const signerEmail = signer.email || "";
  const signerTelefone = signer.telefone || "";
  const signerAssinaturaUrl = signer.assinatura_url || signer.assinaturaUrl || "";

  const exportInfo = {
    numero: versao.numero,
    versao: Number(versao.versao),
    status: STATUS[versao.status] ?? versao.status,
    cliente_nome: dadosCliente,
    cliente_cnpj: demanda?.cliente_cnpj ?? null,
    cliente_contato: dadosClienteContato,
    demanda_titulo: dadosDemandaTitulo,
    modalidade: demanda?.modalidade ?? null,
    emitido_em: formatDateTime(versao.criado_em),
    validade: formatDate(versao.valido_ate),
    validade_dias: Number(versao.validade_dias ?? 0),
    escopo: dadosObjeto,
    condicoes: dadosCondicoes,
    responsavel: signerNome,
  };
  const exportResumo = {
    total_laboratorio_custo: Number(versao.total_laboratorio_custo ?? 0),
    total_laboratorio_preco: Number(versao.total_laboratorio_preco ?? 0),
    total_projeto_custo: Number(versao.total_projeto_custo ?? 0),
    total_projeto_final: Number(versao.total_projeto_final ?? 0),
    total_final: Number(versao.total_final ?? 0),
  };
  const exportItens = [
    ...itensLaboratorio.map((item) => ({
      grupo: "Laboratório",
      origem: item.origem,
      descricao: item.codigo_analise ?? "Análise",
      quantidade: Number(item.n_amostras ?? 0),
      unidade: "amostra",
      custo_unitario: Number(item.custo_unitario ?? 0),
      preco_unitario: Number(item.preco_unitario ?? 0),
      subtotal: Number(item.n_amostras ?? 0) * Number(item.preco_unitario ?? 0),
    })),
    ...custosProjeto.map((item) => ({
      grupo: `Projeto ${item.rubrica ?? "OU"}`,
      origem: item.origem,
      descricao: item.descricao ?? "Custo de projeto",
      quantidade: item.rubrica === "PE" && item.meses_selecionados?.length ? item.meses_selecionados.length : Number(item.quantidade ?? 0),
      unidade: item.rubrica === "PE" && item.meses_selecionados?.length ? "mes" : item.unidade,
      custo_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
      preco_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
      subtotal: subtotalProjetoSnapshot(item),
    })),
    ...analisesProjeto.map((item) => ({
      grupo: "Análise em projeto",
      origem: item.origem,
      descricao: item.codigo_analise ?? "Análise",
      quantidade: Number(item.n_amostras ?? 0),
      unidade: "amostra",
      custo_unitario: Number(item.custo_unitario ?? 0),
      preco_unitario: Number(item.custo_unitario ?? 0),
      subtotal: Number(item.n_amostras ?? 0) * Number(item.custo_unitario ?? 0),
    })),
  ];
  const exportOrigens = origens.map((origem) => ({
    titulo: origem.titulo ?? origem.campo ?? "Total",
    campo: origem.campo ?? "",
    origem: origem.origem ?? "Snapshot da emissão",
    regra: origem.regra ?? "Valor preservado na versão final emitida.",
    valor: Number(origem.valor ?? 0),
  }));

  const analisesProposta = exportItens.filter((item) => item.grupo === "Laboratório").map(item => ({
    codigo: item.descricao,
    nome: item.descricao,
    amostras: item.quantidade,
    precoUnitarioMedio: item.preco_unitario,
    preco: item.subtotal,
  }));

  const rubricasProposta = exportItens.filter((item) => item.grupo !== "Laboratório").map(item => ({
    descricao: item.descricao,
    rubrica: item.grupo.replace("Projeto ", "").replace("Análise em projeto", "AP"),
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    custo: item.subtotal,
  }));

  const orcamentoFinal = {
    totalLaboratorioCusto: Number(versao.total_laboratorio_custo ?? 0),
    totalLaboratorioPreco: Number(versao.total_laboratorio_preco ?? 0),
    totalProjetoCusto: Number(versao.total_projeto_custo ?? 0),
    totalProjetoFinal: Number(versao.total_projeto_final ?? 0),
    totalFinal: Number(versao.total_final ?? 0),
    parametrosAplicados: consolidado,
  };

  const modoInternoHref = "#modo-interno";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="print-area mx-auto max-w-6xl px-6 py-10">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Orçamentos não finalizados", href: "/orcamento/demandas" },
              { label: demanda?.titulo ?? `Orçamento #${versao.demanda_id}`, href: `/orcamento/demandas/${versao.demanda_id}` },
              { label: versao.numero },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={modoInternoHref}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Modo interno
            </a>
            <ExportOrcamentoFinalButtons
              info={exportInfo}
              resumo={exportResumo}
              itens={exportItens}
              origens={exportOrigens}
            />
            <Link
              href={`/orcamento/demandas/${versao.demanda_id}`}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Voltar ao orçamento
            </Link>
            <PrintButton />
          </div>
        </div>

        {/* Área da Proposta do Cliente */}
        <section className="mt-4 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 p-8 shadow-md border border-zinc-200 dark:border-zinc-800 rounded-lg min-h-[842px] max-w-[800px] mx-auto text-xs font-sans space-y-6 print:border-0 print:shadow-none print:p-0">

          {/* Header da Proposta */}
          <div className={`flex justify-between items-center border-b pb-6 ${borderCol} page-break-inside-avoid`}>
            <div className="flex items-center gap-4">
              <img
                src={isGia ? "/logos/gia.svg" : "/logos/atgc.svg"}
                alt={tipoEmissao}
                className="h-20 w-auto object-contain"
              />
              <div className="border-l border-zinc-200 pl-4 py-1 dark:border-zinc-800">
                <h2 className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Emissor</h2>
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] leading-tight">{legalName}</p>
              </div>
            </div>
            <div className="text-right text-[10px] text-zinc-500 space-y-1">
              <p className={`font-extrabold text-sm uppercase tracking-wider ${primaryColor}`}>PROPOSTA COMERCIAL</p>
              <p className="font-mono text-zinc-700 dark:text-zinc-300">Nº: <span className="font-bold">{dadosCodigo}</span></p>
              <div className="flex flex-col gap-0.5 text-zinc-400">
                <p>Emissão: <span className="text-zinc-600 dark:text-zinc-350">{new Date(dadosDataEmissao).toLocaleDateString("pt-BR")}</span></p>
                <p>Validade: <span className="text-zinc-600 dark:text-zinc-350">{new Date(dadosValidade).toLocaleDateString("pt-BR")}</span></p>
              </div>
            </div>
          </div>

          {/* Bloco de identificação */}
          <div className="bg-zinc-50/50 dark:bg-zinc-950/20 p-4 rounded-lg border border-zinc-100 dark:border-zinc-850/50 grid grid-cols-2 md:grid-cols-3 gap-4 text-[10px] leading-relaxed page-break-inside-avoid">
            <div>
              <span className="font-bold text-zinc-400 uppercase tracking-wider text-[8px] block">Destinatário / Cliente</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs block mt-0.5">{dadosCliente}</span>
              {dadosClienteContato && <span className="text-zinc-500 block mt-0.5">Contato: {dadosClienteContato}</span>}
            </div>
            <div>
              <span className="font-bold text-zinc-400 uppercase tracking-wider text-[8px] block">Título do Orçamento</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-xs block mt-0.5">{dadosDemandaTitulo}</span>
            </div>
            <div>
              <span className="font-bold text-zinc-400 uppercase tracking-wider text-[8px] block">Modalidade & Enquadramento</span>
              <span className="font-medium text-zinc-600 dark:text-zinc-400 text-xs block mt-0.5">{demanda.modalidade}</span>
            </div>
          </div>

          {/* Seção: Objeto e Escopo */}
          {opcoes.resumo_demanda && (
            <div className="space-y-2 page-break-inside-avoid">
              <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
                1. Objeto e Escopo
              </h3>
              <p className="text-zinc-600 dark:text-zinc-350 leading-relaxed text-[10px] whitespace-pre-wrap">
                {dadosObjeto}
              </p>
            </div>
          )}

          {/* Seção: Análises laboratoriais */}
          {opcoes.analises_incluidas && analisesProposta.length > 0 && (
            <div className="space-y-2 page-break-inside-avoid">
              <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
                2. Análises e Componentes Laboratoriais
              </h3>
              <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-850">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className={`border-b font-bold text-zinc-500 ${tableHeaderBg} ${borderColTable}`}>
                      <th className="py-2 px-3 font-mono">Código</th>
                      <th className="py-2 px-3">Análise / Descrição</th>
                      {opcoes.qtd_amostras && <th className="py-2 px-3 text-center">Amostras</th>}
                      {opcoes.custos_laboratoriais && <th className="py-2 px-3 text-right">Valor Unitário</th>}
                      {opcoes.custos_laboratoriais && <th className="py-2 px-3 text-right">Subtotal</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850/50">
                    {analisesProposta.map((a, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 text-zinc-600 dark:text-zinc-300">
                          <td className="py-2 px-3 font-mono font-medium">{a.codigo}</td>
                          <td className="py-2 px-3">{a.nome}</td>
                          {opcoes.qtd_amostras && <td className="py-2 px-3 text-center font-semibold tabular-nums">{a.amostras}</td>}
                          {opcoes.custos_laboratoriais && <td className="py-2 px-3 text-right tabular-nums">{brl(a.precoUnitarioMedio)}</td>}
                          {opcoes.custos_laboratoriais && <td className="py-2 px-3 text-right font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl(a.preco)}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seção: Custos de Projeto */}
          {opcoes.custos_projeto && rubricasProposta.length > 0 && (
            <div className="space-y-2 page-break-inside-avoid">
              <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
                3. Custos Diretos de Projeto
              </h3>
              <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-850">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className={`border-b font-bold text-zinc-500 ${tableHeaderBg} ${borderColTable}`}>
                      <th className="py-2 px-3">Descrição</th>
                      <th className="py-2 px-3 text-center">Rubrica</th>
                      {opcoes.qtd_amostras && <th className="py-2 px-3 text-center">Qtd.</th>}
                      {opcoes.custos_projeto && <th className="py-2 px-3 text-right">Unitário</th>}
                      {opcoes.custos_projeto && <th className="py-2 px-3 text-right">Subtotal</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850/50">
                    {rubricasProposta.map((r, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 text-zinc-600 dark:text-zinc-300">
                          <td className="py-2 px-3">{r.descricao}</td>
                          <td className="py-2 px-3 text-center font-semibold text-[9px] tabular-nums text-zinc-500">{r.rubrica}</td>
                          {opcoes.qtd_amostras && <td className="py-2 px-3 text-center font-semibold tabular-nums">{r.quantidade}</td>}
                          {opcoes.custos_projeto && <td className="py-2 px-3 text-right tabular-nums">{brl(r.preco_unitario)}</td>}
                          {opcoes.custos_projeto && <td className="py-2 px-3 text-right font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl(r.custo)}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* Subtotais e Destaque Financeiro */}
          <div className="space-y-3 page-break-inside-avoid">
            <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
              Valor e Condições Financeiras
            </h3>

            {(opcoes.subtotais_modulo || opcoes.taxas || opcoes.impostos) && (
              <div className="space-y-1 text-right text-[10px] text-zinc-600 dark:text-zinc-350 pr-2">
                {opcoes.subtotais_modulo && (
                  <>
                    <p>Subtotal Análises Laboratoriais: <span className="font-bold text-zinc-800 dark:text-zinc-100">{brl(orcamentoFinal.totalLaboratorioPreco)}</span></p>
                    <p>Subtotal Custos de Projeto: <span className="font-bold text-zinc-800 dark:text-zinc-100">{brl(orcamentoFinal.totalProjetoFinal)}</span></p>
                  </>
                )}
                {opcoes.impostos && orcamentoFinal.parametrosAplicados && (
                  <p>Impostos e Encargos Fiscais: <span className="font-bold text-zinc-800 dark:text-zinc-100">{brl(orcamentoFinal.totalFinal - (orcamentoFinal.totalLaboratorioPreco + orcamentoFinal.totalProjetoFinal))}</span></p>
                )}
              </div>
            )}

            {/* VALOR FINAL DA PROPOSTA (Sempre exibido e destacado) */}
            <div className={`text-white p-4 rounded-lg flex justify-between items-center shadow-sm ${finalBoxBg}`}>
              <span className="font-bold text-xs uppercase tracking-wider">Valor Total da Proposta</span>
              <span className="text-lg font-bold tabular-nums">{brl(orcamentoFinal.totalFinal)}</span>
            </div>
          </div>

          {/* Detalhes Comerciais e Prazos */}
          <div className="space-y-4 page-break-inside-avoid">
            <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
              Condições de Execução e Pagamento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-zinc-600 dark:text-zinc-350 bg-zinc-50/50 dark:bg-zinc-950/20 p-3 rounded-lg border border-zinc-100 dark:border-zinc-850/50">
              {opcoes.prazo_execucao && (
                <div>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">Prazo de Execução:</p>
                  <p className="mt-0.5">{dadosPrazo}</p>
                </div>
              )}
              {opcoes.prazo_validade && (
                <div>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">Forma de Pagamento:</p>
                  <p className="mt-0.5">{dadosFormaPagamento}</p>
                </div>
              )}
            </div>

            {opcoes.condicoes_comerciais && (
              <div className="text-[10px] text-zinc-500 leading-normal">
                <p className="font-bold text-zinc-700 dark:text-zinc-300">Condições Comerciais:</p>
                <p className="italic bg-zinc-50/30 p-2.5 rounded border border-dashed border-zinc-200 mt-1 dark:border-zinc-800 dark:bg-zinc-900/10">{dadosCondicoes}</p>
              </div>
            )}

            {dadosObservacoes && (
              <div className="text-[10px] text-zinc-500 leading-normal">
                <p className="font-bold text-zinc-700 dark:text-zinc-300">Observações Gerais:</p>
                <p className="whitespace-pre-wrap bg-zinc-50/30 p-2.5 rounded border border-dashed border-zinc-200 mt-1 dark:border-zinc-800 dark:bg-zinc-900/10">{dadosObservacoes}</p>
              </div>
            )}
          </div>

          {/* Assinatura */}
          {opcoes.dados_emissor && (
            <div className="pt-8 flex flex-col items-center text-center text-[10px] text-zinc-600 dark:text-zinc-400 page-break-inside-avoid">
              {signerAssinaturaUrl && (
                <img src={signerAssinaturaUrl} alt="" className="relative z-10 mb-[-0.55rem] h-14 max-w-44 translate-y-3 object-contain" />
              )}
              <div className="w-48 border-t border-zinc-300 pb-2 dark:border-zinc-700"></div>
              <p className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">{signerNome}</p>
              <p className="text-zinc-500">{signerCargo} — {signerInstituicao}</p>
              <p className="text-[9px] text-zinc-400 mt-0.5">{signerEmail} | {signerTelefone}</p>
            </div>
          )}

          {/* Rodapé / Endereço */}
          <div className={`pt-4 mt-6 border-t ${borderColTable} text-center text-[9px] text-zinc-400 leading-relaxed page-break-inside-avoid`}>
            <p className="font-semibold text-zinc-500">
              {legalName}
            </p>
            <p>{addressText}</p>
          </div>

        </section>

        <section id="modo-interno" className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Modo interno
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Custos, parâmetros e auditoria</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Snapshot preservado na emissão. Esta área não precisa entrar no documento enviado ao cliente.
              </p>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              <form action={duplicarVersaoFinal}>
                <input type="hidden" name="versao_id" value={versao.id} />
                <input type="hidden" name="validade_dias" value={versao.validade_dias ?? 30} />
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Duplicar versão
                </button>
              </form>
              {versao.status !== "cancelado" && (
                <form action={cancelarVersaoFinal} className="flex gap-2">
                  <input type="hidden" name="versao_id" value={versao.id} />
                  <input type="hidden" name="motivo" value="Cancelamento a partir do detalhe da versão final." />
                  <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30">
                    Cancelar
                  </button>
                </form>
              )}
            </div>
          </div>

          <dl className="mt-6 grid gap-3 text-sm md:grid-cols-3">
            <Campo titulo="Cliente" valor={demanda?.cliente_nome ?? "—"} />
            <Campo titulo="CNPJ/CPF" valor={demanda?.cliente_cnpj ?? "—"} />
            <Campo titulo="Contato" valor={demanda?.cliente_contato ?? "—"} />
            <Campo titulo="Demanda" valor={demanda?.titulo ?? `#${versao.demanda_id}`} />
            <Campo titulo="Modalidade" valor={demanda?.modalidade ?? "—"} />
            <Campo titulo="Validade" valor={`${versao.validade_dias} dias`} />
          </dl>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            <Resumo titulo="Custo laboratório" valor={versao.total_laboratorio_custo} />
            <Resumo titulo="Preço laboratório" valor={versao.total_laboratorio_preco} />
            <Resumo titulo="Custo projeto" valor={versao.total_projeto_custo} />
            <Resumo titulo="Projeto final" valor={versao.total_projeto_final} />
            <Resumo titulo="Total final" valor={versao.total_final} destaque />
          </div>

          <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Parâmetros econômicos
              </h2>
              <span className="text-xs text-zinc-500">
                Markup projeto: {Number(consolidado.markupProjeto ?? 0).toLocaleString("pt-BR")}%
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {(consolidado.parametrosProjeto ?? []).map((parametro) => (
                <div key={parametro.key ?? parametro.label} className="rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50">
                  <div className="flex items-center justify-between gap-2">
                    <span>{parametro.label ?? parametro.key}</span>
                    <span className="font-medium">{Number(parametro.nominalRate ?? 0).toLocaleString("pt-BR")}%</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{brl(Number(parametro.amount ?? 0))}</p>
                </div>
              ))}
              {(consolidado.parametrosProjeto ?? []).length === 0 && (
                <p className="text-sm text-zinc-400">Sem parâmetros de projeto no snapshot.</p>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Composição detalhada</h2>
            <div className="mt-4 space-y-5">
              <TabelaAnalisesSnapshot titulo="Análises laboratoriais" itens={itensLaboratorio} tipo="laboratorio" />
              <TabelaCustosSnapshot titulo="Custos próprios do projeto" itens={custosProjeto} />
              <TabelaAnalisesSnapshot titulo="Análises dentro de projeto" itens={analisesProjeto} tipo="projeto" />
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Origem e auditoria</h2>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <Campo titulo="Snapshot" valor="Valores preservados na emissão" />
              <Campo titulo="Status da versão" valor={STATUS[versao.status] ?? versao.status} />
              <Campo titulo="Demanda origem" valor={`#${versao.demanda_id}`} />
            </div>
            <div className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {origens.map((origem) => (
                <div key={origem.campo ?? origem.titulo} className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[1fr_1.4fr_1.6fr_auto]">
                  <div>
                    <p className="font-medium">{origem.titulo ?? origem.campo}</p>
                    <p className="text-xs text-zinc-500">{origem.campo}</p>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300">{origem.origem ?? "Snapshot da emissão"}</p>
                  <p className="text-zinc-600 dark:text-zinc-300">{origem.regra ?? "Valor preservado na versão final emitida."}</p>
                  <p className="font-semibold tabular-nums md:text-right">{brl(Number(origem.valor ?? 0))}</p>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function condicoesComerciais(versao: { valido_ate: string | null; validade_dias: number | null }) {
  return `Valores válidos até ${formatDate(versao.valido_ate)}. Alterações de escopo, quantidade de amostras, premissas técnicas ou cronograma podem exigir nova versão da proposta.`;
}

function subtotalProjetoSnapshot(item: SnapshotItemProjeto) {
  const unitario = Number(item.custo_unitario ?? item.preco_unitario ?? 0);
  if (item.rubrica === "PE" && item.meses_selecionados?.length) {
    return item.meses_selecionados.length * unitario;
  }
  return Number(item.quantidade ?? 0) * unitario;
}

function TabelaAnalisesSnapshot({
  titulo,
  itens,
  tipo,
}: {
  titulo: string;
  itens: Array<SnapshotItemAnalise & { origem: string; status: string }>;
  tipo: "laboratorio" | "projeto";
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{titulo}</h3>
      <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-right text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Análise</th>
              <th className="px-3 py-2">Amostras</th>
              <th className="px-3 py-2">{tipo === "laboratorio" ? "Custo unit." : "Custo/amostra"}</th>
              <th className="px-3 py-2">{tipo === "laboratorio" ? "Preço unit." : "Preço snapshot"}</th>
              <th className="px-3 py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {itens.map((item, index) => (
              <tr key={`${item.origem}-${item.id ?? index}`}>
                <td className="px-3 py-2 text-left text-zinc-500">{item.origem} · {item.status}</td>
                <td className="px-3 py-2 text-left font-medium">{item.codigo_analise ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{Number(item.n_amostras ?? 0)}</td>
                <td className="px-3 py-2 tabular-nums">{brl(Number(item.custo_unitario ?? 0))}</td>
                <td className="px-3 py-2 tabular-nums">{brl(Number(item.preco_unitario ?? 0))}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {brl(Number(item.n_amostras ?? 0) * Number((tipo === "laboratorio" ? item.preco_unitario : item.custo_unitario) ?? 0))}
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-5 text-center text-xs text-zinc-400">
                  Nenhum item preservado no snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaCustosSnapshot({
  titulo,
  itens,
}: {
  titulo: string;
  itens: Array<SnapshotItemProjeto & { origem: string; status: string }>;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{titulo}</h3>
      <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-right text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Rubrica</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2">Qtd.</th>
              <th className="px-3 py-2">Custo unit.</th>
              <th className="px-3 py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {itens.map((item, index) => (
              <tr key={`${item.origem}-${item.id ?? index}`}>
                <td className="px-3 py-2 text-left text-zinc-500">{item.origem} · {item.status}</td>
                <td className="px-3 py-2 text-left">{item.rubrica ?? "OU"}</td>
                <td className="px-3 py-2 text-left font-medium">{item.descricao ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{Number(item.quantidade ?? 0)}</td>
                <td className="px-3 py-2 tabular-nums">{brl(Number(item.custo_unitario ?? item.preco_unitario ?? 0))}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {brl(Number(item.quantidade ?? 0) * Number(item.custo_unitario ?? item.preco_unitario ?? 0))}
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-5 text-center text-xs text-zinc-400">
                  Nenhum item preservado no snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function normalizarOrigens(
  consolidado: SnapshotConsolidado,
  versao: {
    total_laboratorio_custo: number;
    total_laboratorio_preco: number;
    total_projeto_custo: number;
    total_projeto_final: number;
    total_final: number;
  },
) {
  if (consolidado.origens?.length) return consolidado.origens;
  return [
    {
      campo: "totalLaboratorioCusto",
      titulo: "Custo laboratório",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_laboratorio_custo ?? 0),
    },
    {
      campo: "totalLaboratorioPreco",
      titulo: "Preço laboratório",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_laboratorio_preco ?? 0),
    },
    {
      campo: "totalProjetoCusto",
      titulo: "Custo projeto",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_projeto_custo ?? 0),
    },
    {
      campo: "totalProjetoFinal",
      titulo: "Projeto final",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_projeto_final ?? 0),
    },
    {
      campo: "totalFinal",
      titulo: "Total final",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_final ?? 0),
    },
  ];
}

function normalizarSnapshot(snapshot: Json): SnapshotFinal {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  return snapshot as SnapshotFinal;
}

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-950/50">
      <dt className="text-xs font-medium text-zinc-500">{titulo}</dt>
      <dd className="mt-1 font-medium">{valor}</dd>
    </div>
  );
}

function Resumo({ titulo, valor, destaque = false }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${destaque ? "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30" : "border-zinc-200 dark:border-zinc-800"}`}>
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${destaque ? "text-brand-700 dark:text-brand-300" : ""}`}>
        {brl(Number(valor ?? 0))}
      </p>
    </div>
  );
}
