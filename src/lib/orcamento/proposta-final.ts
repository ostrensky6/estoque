// Apresentação e reconciliação da aba "Proposta final" (Fase 10).
//
// A ENGINE econômica autoritativa (Política A) NÃO é alterada aqui. Este módulo
// só PREPARA a apresentação:
//   - reconcilia a composição comercial distribuindo o total final por
//     participação técnica de cada componente (auditável);
//   - detecta custos técnicos <= 0 (bloqueio de emissão);
//   - padroniza o status da etapa final.
import { roundMoney } from "@/lib/costing/pricing";
import { itemProjetoTotal } from "@/lib/project-budget/legacy";

// ---------------------------------------------------------------------
// Status padronizado da etapa final
// ---------------------------------------------------------------------
export type StatusPropostaFinal =
  | "bloqueada"
  | "em_composicao"
  | "aguardando_revisao"
  | "pronta_para_emitir"
  | "emitida"
  | "substituida"
  | "cancelada";

export const LABEL_STATUS_FINAL: Record<StatusPropostaFinal, string> = {
  bloqueada: "Bloqueada",
  em_composicao: "Em composição",
  aguardando_revisao: "Aguardando revisão",
  pronta_para_emitir: "Pronta para emitir",
  emitida: "Emitida",
  substituida: "Substituída",
  cancelada: "Cancelada",
};

export function statusPropostaFinal(args: {
  demandaCompleta: boolean;
  laboratorioExigido: boolean;
  projetoExigido: boolean;
  laboratorioStatus: "pendente" | "preenchido" | "revisado" | "nao_exigido";
  projetoStatus: "pendente" | "preenchido" | "revisado" | "nao_exigido";
  parametrosValidos: boolean;
  temCustoZeroSemJustificativa: boolean;
  versoesEmitidas: number;
  ultimaVersaoStatus?: string | null;
}): StatusPropostaFinal {
  // Uma versão emitida vigente domina a exibição do estado.
  if (args.ultimaVersaoStatus === "emitido") return "emitida";
  if (args.ultimaVersaoStatus === "substituido") return "substituida";
  if (args.ultimaVersaoStatus === "cancelado") return "cancelada";

  if (!args.demandaCompleta) return "bloqueada";

  const labPendente = args.laboratorioExigido && args.laboratorioStatus === "pendente";
  const projPendente = args.projetoExigido && args.projetoStatus === "pendente";
  if (labPendente || projPendente) return "em_composicao";

  const labAguardando = args.laboratorioExigido && args.laboratorioStatus === "preenchido";
  const projAguardando = args.projetoExigido && args.projetoStatus === "preenchido";
  if (labAguardando || projAguardando) return "aguardando_revisao";

  if (!args.parametrosValidos || args.temCustoZeroSemJustificativa) return "bloqueada";

  return "pronta_para_emitir";
}

// ---------------------------------------------------------------------
// Detecção de custo técnico zero (bloqueio de emissão)
// ---------------------------------------------------------------------
export type ItemCustoZero = {
  origem: "laboratorio" | "projeto";
  descricao: string;
  custoUnitario: number;
};

export function detectarCustosZero(args: {
  itensLaboratorio: Array<{ codigo_analise?: string | null; custo_unitario?: number | null; n_amostras?: number | null }>;
  custosProjeto: Array<{ rubrica?: string | null; custo_unitario?: number | null }>;
  analisesProjeto: Array<{ codigo_analise?: string | null; custo_unitario?: number | null }>;
  projetoTemJustificativa: boolean;
}): ItemCustoZero[] {
  const zerados: ItemCustoZero[] = [];
  for (const item of args.itensLaboratorio) {
    if (Number(item.custo_unitario ?? 0) <= 0) {
      zerados.push({ origem: "laboratorio", descricao: item.codigo_analise ?? "Análise laboratorial", custoUnitario: Number(item.custo_unitario ?? 0) });
    }
  }
  // No projeto, uma justificativa explícita de projeto sem custo isenta os zeros.
  if (!args.projetoTemJustificativa) {
    for (const item of args.custosProjeto) {
      if (Number(item.custo_unitario ?? 0) <= 0) {
        zerados.push({ origem: "projeto", descricao: `Custo de projeto (${item.rubrica ?? "OU"})`, custoUnitario: Number(item.custo_unitario ?? 0) });
      }
    }
    for (const item of args.analisesProjeto) {
      if (Number(item.custo_unitario ?? 0) <= 0) {
        zerados.push({ origem: "projeto", descricao: item.codigo_analise ?? "Análise no projeto", custoUnitario: Number(item.custo_unitario ?? 0) });
      }
    }
  }
  return zerados;
}

// ---------------------------------------------------------------------
// Reconciliação da composição comercial com o gross-up único
// ---------------------------------------------------------------------
export type ComponenteTecnico = {
  componente: string;
  descricao: string;
  quantidade: number;
  custoUnitarioTecnico: number;
  subtotalTecnico: number;
  observacao?: string;
};

export type LinhaComercial = ComponenteTecnico & {
  participacao: number; // 0..1 do subtotal técnico
  valorComercial: number; // total_final × participação (com resíduo ajustado)
};

export type ComposicaoReconciliada = {
  linhas: LinhaComercial[];
  subtotalTecnico: number;
  totalFinal: number;
  totalParametros: number;
  reconciliaOk: boolean;
};

/**
 * Distribui o total final por participação técnica de cada componente.
 * valor_comercial_i = total_final × (subtotal_tecnico_i / subtotal_tecnico_total).
 * O resíduo de arredondamento é absorvido na última linha para que a soma dos
 * valores comerciais seja EXATAMENTE o total final.
 */
export function reconciliarComposicao(args: {
  componentes: ComponenteTecnico[];
  totalFinal: number;
}): ComposicaoReconciliada {
  const componentes = args.componentes.filter((c) => c.subtotalTecnico > 0);
  const subtotalTecnico = roundMoney(componentes.reduce((acc, c) => acc + c.subtotalTecnico, 0));
  const totalFinal = roundMoney(Math.max(0, Number(args.totalFinal) || 0));

  if (subtotalTecnico <= 0 || componentes.length === 0) {
    return {
      linhas: [],
      subtotalTecnico,
      totalFinal,
      totalParametros: roundMoney(Math.max(0, totalFinal - subtotalTecnico)),
      reconciliaOk: totalFinal === 0,
    };
  }

  const linhas: LinhaComercial[] = componentes.map((c) => {
    const participacao = c.subtotalTecnico / subtotalTecnico;
    return { ...c, participacao, valorComercial: roundMoney(totalFinal * participacao) };
  });

  // Ajuste de resíduo na última linha para somar exatamente o total final.
  const somaAlocada = roundMoney(linhas.reduce((acc, l) => acc + l.valorComercial, 0));
  const residuo = roundMoney(totalFinal - somaAlocada);
  if (residuo !== 0 && linhas.length > 0) {
    const ultima = linhas[linhas.length - 1];
    ultima.valorComercial = roundMoney(ultima.valorComercial + residuo);
  }

  const somaFinal = roundMoney(linhas.reduce((acc, l) => acc + l.valorComercial, 0));
  return {
    linhas,
    subtotalTecnico,
    totalFinal,
    totalParametros: roundMoney(Math.max(0, totalFinal - subtotalTecnico)),
    reconciliaOk: somaFinal === totalFinal,
  };
}

// ---------------------------------------------------------------------
// Construção dos componentes técnicos a partir dos itens do orçamento
// ---------------------------------------------------------------------
export function montarComponentesTecnicos(args: {
  itensLaboratorio: Array<{ codigo_analise?: string | null; n_amostras?: number | null; custo_unitario?: number | null }>;
  custosProjeto: Array<{ rubrica?: string | null; quantidade?: number | null; custo_unitario?: number | null; meses_selecionados?: number[] | null }>;
  analisesProjeto: Array<{ codigo_analise?: string | null; n_amostras?: number | null; custo_unitario?: number | null }>;
}): ComponenteTecnico[] {
  const componentes: ComponenteTecnico[] = [];

  for (const item of args.itensLaboratorio) {
    const qtd = Number(item.n_amostras ?? 0);
    const custo = Number(item.custo_unitario ?? 0);
    componentes.push({
      componente: "Laboratório",
      descricao: item.codigo_analise ?? "Análise laboratorial",
      quantidade: qtd,
      custoUnitarioTecnico: custo,
      subtotalTecnico: roundMoney(qtd * custo),
    });
  }

  for (const item of args.custosProjeto) {
    const ehPE = item.rubrica === "PE" && (item.meses_selecionados?.length ?? 0) > 0;
    const qtd = ehPE ? item.meses_selecionados!.length : Number(item.quantidade ?? 0);
    const custo = Number(item.custo_unitario ?? 0);
    componentes.push({
      componente: `Projeto · ${item.rubrica ?? "OU"}`,
      descricao: ehPE ? "Pessoal (meses)" : `Custo ${item.rubrica ?? "OU"}`,
      quantidade: qtd,
      custoUnitarioTecnico: custo,
      subtotalTecnico: itemProjetoTotal({
        rubrica: item.rubrica,
        quantidade: item.quantidade,
        preco_unitario: custo,
        meses_selecionados: item.meses_selecionados ?? [],
      }),
      observacao: ehPE ? "rubrica PE: meses × valor" : undefined,
    });
  }

  for (const item of args.analisesProjeto) {
    const qtd = Number(item.n_amostras ?? 0);
    const custo = Number(item.custo_unitario ?? 0);
    componentes.push({
      componente: "Projeto · análise",
      descricao: item.codigo_analise ?? "Análise no projeto",
      quantidade: qtd,
      custoUnitarioTecnico: custo,
      subtotalTecnico: roundMoney(qtd * custo),
    });
  }

  return componentes;
}
