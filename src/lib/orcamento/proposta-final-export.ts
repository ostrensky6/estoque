// Camada ÚNICA de apresentação/exportação da Proposta final (Fase 10 — exports).
//
// Reusa proposta-final.ts (montarComponentesTecnicos + reconciliarComposicao) para
// NÃO duplicar a composição. Produz uma estrutura exportável consumida por XLSX e
// DOCX, com visão comercial (valor comercial reconciliado) e visão interna (custo
// técnico × preço snapshot) separadas.
//
// Compatibilidade histórica: versões SEM snapshot da nova engine são exportadas em
// MODO LEGADO — o total salvo é preservado e nada é recalculado.
import { modalidadeExigeLaboratorio, modalidadeExigeProjeto } from "./orcamento-economico";
import {
  montarComponentesTecnicos,
  reconciliarComposicao,
  type LinhaComercial,
} from "./proposta-final";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type ParametroExport = { label: string; percentual: number; valorNominal: number };

export type PropostaFinalExport = {
  legado: boolean;
  avisoLegado?: string;
  exigeLaboratorio: boolean;
  exigeProjeto: boolean;
  info: {
    numero: string;
    versao: number;
    status: string;
    emitidoEm: string | null;
    validade: string | null;
    validadeDias: number | null;
    clienteNome: string | null;
    clienteCnpj: string | null;
    clienteContato: string | null;
    demandaTitulo: string | null;
    modalidade: string | null;
    escopo: string | null;
    responsavel: string;
  };
  economico: {
    custoLaboratorioTecnico: number;
    custoDiretoProjeto: number;
    subtotalTecnico: number;
    somaPercentual: number;
    fatorGrossUp: number;
    parametros: ParametroExport[];
    totalParametros: number;
    totalFinal: number;
    formula: string;
  };
  composicaoComercial: LinhaComercial[];
  composicaoReconciliada: boolean;
  detalhamento: {
    laboratorio: Array<{ descricao: string; quantidade: number; custoUnitarioTecnico: number; precoSnapshot: number; custoTotal: number }>;
    projeto: Array<{ rubrica: string; quantidade: number; custoUnitarioTecnico: number; custoTotal: number; observacao?: string }>;
  };
  observacoes: string | null;
};

type VersaoExport = {
  numero: string;
  versao: number;
  status: string;
  criado_em?: string | null;
  valido_ate?: string | null;
  validade_dias?: number | null;
  total_laboratorio_custo?: number | null;
  total_laboratorio_preco?: number | null;
  total_projeto_custo?: number | null;
  total_projeto_final?: number | null;
  total_final?: number | null;
};

type DemandaExport = {
  titulo?: string | null;
  cliente_nome?: string | null;
  cliente_cnpj?: string | null;
  cliente_contato?: string | null;
  modalidade?: string | null;
  escopo_preliminar?: string | null;
  descricao?: string | null;
} | null;

// Leitura defensiva do snapshot (JSON).
type SnapshotLoose = {
  consolidado?: {
    economia?: { politica?: string; subtotal?: number; somaPercentual?: number; fatorGrossUp?: number; totalParametros?: number; totalFinal?: number; formula?: string; parametros?: Array<{ label?: string; percentual?: number; valorNominal?: number }> };
    parametrosProjeto?: Array<{ label?: string; nominalRate?: number; amount?: number }>;
    totalLaboratorioCusto?: number;
    totalProjetoCusto?: number;
  };
  orcamentos_analises?: Array<{ orcamento_itens?: Array<{ codigo_analise?: string | null; n_amostras?: number | null; custo_unitario?: number | null; preco_unitario?: number | null }> }>;
  orcamentos_projeto?: Array<{
    orcamento_projeto_custos?: Array<{ rubrica?: string | null; quantidade?: number | null; custo_unitario?: number | null; meses_selecionados?: number[] | null }>;
    orcamento_projeto_analises?: Array<{ codigo_analise?: string | null; n_amostras?: number | null; custo_unitario?: number | null }>;
  }>;
};

function lerSnapshot(snapshot: unknown): SnapshotLoose {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  return snapshot as SnapshotLoose;
}

export function montarPropostaFinalExport(args: {
  versao: VersaoExport;
  snapshot: unknown;
  demanda: DemandaExport;
  responsavel?: string;
}): PropostaFinalExport {
  const snap = lerSnapshot(args.snapshot);
  const consolidado = snap.consolidado ?? {};
  const economia = consolidado.economia;
  const legado = economia?.politica !== "A_GROSS_UP_TOTAL";

  const modalidade = args.demanda?.modalidade ?? null;
  const exigeLaboratorio = modalidadeExigeLaboratorio(modalidade);
  const exigeProjeto = modalidadeExigeProjeto(modalidade);

  // Total salvo é SEMPRE preservado (histórico não recalculado).
  const totalFinal = num(args.versao.total_final);

  const itensLaboratorio = (snap.orcamentos_analises ?? []).flatMap((o) => o.orcamento_itens ?? []);
  const custosProjeto = (snap.orcamentos_projeto ?? []).flatMap((o) => o.orcamento_projeto_custos ?? []);
  const analisesProjeto = (snap.orcamentos_projeto ?? []).flatMap((o) => o.orcamento_projeto_analises ?? []);

  const componentes = montarComponentesTecnicos({ itensLaboratorio, custosProjeto, analisesProjeto });

  let composicaoComercial: LinhaComercial[] = [];
  let composicaoReconciliada = false;
  let economico: PropostaFinalExport["economico"];

  if (!legado && economia) {
    // NOVA engine: reconcilia a composição contra o total salvo.
    const reconc = reconciliarComposicao({ componentes, totalFinal });
    composicaoComercial = reconc.linhas;
    composicaoReconciliada = reconc.reconciliaOk;
    economico = {
      custoLaboratorioTecnico: num(consolidado.totalLaboratorioCusto ?? economia.subtotal),
      custoDiretoProjeto: num(consolidado.totalProjetoCusto),
      subtotalTecnico: num(economia.subtotal),
      somaPercentual: num(economia.somaPercentual),
      fatorGrossUp: num(economia.fatorGrossUp),
      parametros: (economia.parametros ?? []).map((p) => ({
        label: p.label ?? "",
        percentual: num(p.percentual),
        valorNominal: num(p.valorNominal),
      })),
      totalParametros: num(economia.totalParametros),
      totalFinal,
      formula: economia.formula ?? "total_final = (custo_laboratorial_tecnico + custo_direto_projeto) / (1 - Σparametros/100)",
    };
  } else {
    // LEGADO: preserva os totais salvos; composição comercial em participação
    // técnica quando há componentes, mas sem alterar o total salvo.
    const reconc = reconciliarComposicao({ componentes, totalFinal });
    composicaoComercial = reconc.linhas;
    composicaoReconciliada = reconc.reconciliaOk;
    const custoLab = num(args.versao.total_laboratorio_custo ?? consolidado.totalLaboratorioCusto);
    const custoProj = num(args.versao.total_projeto_custo ?? consolidado.totalProjetoCusto);
    const subtotal = reconc.subtotalTecnico || custoLab + custoProj;
    economico = {
      custoLaboratorioTecnico: custoLab,
      custoDiretoProjeto: custoProj,
      subtotalTecnico: subtotal,
      somaPercentual: 0,
      fatorGrossUp: 0,
      parametros: (consolidado.parametrosProjeto ?? []).map((p) => ({
        label: p.label ?? "",
        percentual: num(p.nominalRate),
        valorNominal: num(p.amount),
      })),
      totalParametros: Math.max(0, Math.round((totalFinal - subtotal) * 100) / 100),
      totalFinal,
      formula: "Regra econômica anterior (snapshot legado).",
    };
  }

  return {
    legado,
    avisoLegado: legado ? "Versão emitida com regra econômica anterior." : undefined,
    exigeLaboratorio,
    exigeProjeto,
    info: {
      numero: args.versao.numero,
      versao: num(args.versao.versao),
      status: args.versao.status,
      emitidoEm: args.versao.criado_em ?? null,
      validade: args.versao.valido_ate ?? null,
      validadeDias: args.versao.validade_dias ?? null,
      clienteNome: args.demanda?.cliente_nome ?? null,
      clienteCnpj: args.demanda?.cliente_cnpj ?? null,
      clienteContato: args.demanda?.cliente_contato ?? null,
      demandaTitulo: args.demanda?.titulo ?? null,
      modalidade,
      escopo: args.demanda?.escopo_preliminar || args.demanda?.descricao || null,
      responsavel: args.responsavel ?? "ATGC Genética Ambiental",
    },
    economico,
    composicaoComercial,
    composicaoReconciliada,
    detalhamento: {
      laboratorio: exigeLaboratorio
        ? itensLaboratorio.map((item) => ({
            descricao: item.codigo_analise ?? "Análise laboratorial",
            quantidade: num(item.n_amostras),
            custoUnitarioTecnico: num(item.custo_unitario),
            precoSnapshot: num(item.preco_unitario),
            custoTotal: Math.round(num(item.custo_unitario) * num(item.n_amostras) * 100) / 100,
          }))
        : [],
      projeto: exigeProjeto
        ? custosProjeto.map((item) => {
            const ehPE = item.rubrica === "PE" && (item.meses_selecionados?.length ?? 0) > 0;
            const qtd = ehPE ? item.meses_selecionados!.length : num(item.quantidade);
            return {
              rubrica: item.rubrica ?? "OU",
              quantidade: qtd,
              custoUnitarioTecnico: num(item.custo_unitario),
              custoTotal: Math.round(qtd * num(item.custo_unitario) * 100) / 100,
              observacao: ehPE ? "PE: meses × valor" : undefined,
            };
          })
        : [],
    },
    observacoes: args.demanda?.escopo_preliminar || args.demanda?.descricao || null,
  };
}
