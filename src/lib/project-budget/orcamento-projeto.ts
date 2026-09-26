// Orçamento de projeto: rubricas, base de custo e cálculo.
//
// O cálculo NÃO tem fórmula própria: usa a engine autoritativa da proposta
// (Política A, `engine-economica.ts`), com laboratório = 0 e o subtotal do
// projeto como custo direto. Assim o total do projeto é o mesmo em todas as
// telas e na emissão.
import { roundMoney } from "@/lib/costing/pricing";
import {
  calcularPropostaEconomica,
  parametrosDeRates,
  PARAMETROS_PROPOSTA,
  type RatesProposta,
} from "@/lib/orcamento/engine-economica";

export { roundMoney };

export const RUBRICAS_PROJETO = {
  PE: "Pessoal",
  MC: "Material de Consumo",
  MP: "Material Permanente",
  ST: "Serviços de Terceiros",
  VD: "Viagens e Diárias",
  OU: "Outros",
} as const;

export type RubricaProjeto = keyof typeof RUBRICAS_PROJETO;

export type ProjetoBudgetItem = {
  rubrica?: string | null;
  quantidade?: number | null;
  preco_unitario?: number | null;
  meses_selecionados?: number[] | null;
};

export type ProjetoBudgetRates = RatesProposta;

const PARAMETROS_ECONOMICOS_PROJETO = PARAMETROS_PROPOSTA.map((p) => ({ key: p.chave, label: p.label }));

type ItemCustoProjeto = {
  rubrica?: string | null;
  quantidade?: number | string | null;
  custo_unitario?: number | string | null;
  preco_unitario?: number | string | null;
  meses_selecionados?: number[] | null;
};

type ItemAnaliseProjeto = {
  n_amostras?: number | string | null;
  custo_unitario?: number | string | null;
  preco_unitario?: number | string | null;
};

/**
 * Itens do módulo de projeto na base de custo única (a mesma da emissão):
 * valor unitário = custo (o preço só entra se não houver custo) e análises
 * do projeto como material de consumo (MC).
 */
export function itensProjetoNaBaseDeCusto(args: {
  custos?: ItemCustoProjeto[] | null;
  analises?: ItemAnaliseProjeto[] | null;
}): ProjetoBudgetItem[] {
  return [
    ...(args.custos ?? []).map((item) => ({
      rubrica: item.rubrica ?? null,
      quantidade: Number(item.quantidade ?? 0),
      preco_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
      meses_selecionados: item.meses_selecionados ?? [],
    })),
    ...(args.analises ?? []).map((item) => ({
      rubrica: "MC",
      quantidade: Number(item.n_amostras ?? 0),
      preco_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
      meses_selecionados: [] as number[],
    })),
  ];
}

export function itemProjetoTotal(item: ProjetoBudgetItem) {
  const unitario = Number(item.preco_unitario ?? 0);
  if (item.rubrica === "PE" && item.meses_selecionados?.length) {
    return roundMoney(item.meses_selecionados.length * unitario);
  }
  return roundMoney(Number(item.quantidade ?? 0) * unitario);
}

export function validarParametrosProjetoGrossUp(rates: ProjetoBudgetRates) {
  const invalidos = PARAMETROS_ECONOMICOS_PROJETO.filter((param) => Number(rates[param.key] ?? 0) < 0);
  if (invalidos.length > 0) {
    return {
      ok: false,
      soma: 0,
      message: "Parâmetros econômicos não podem ser negativos.",
    };
  }

  const soma = PARAMETROS_ECONOMICOS_PROJETO.reduce(
    (acc, param) => acc + Math.max(0, Number(rates[param.key] ?? 0)),
    0,
  );

  if (soma >= 100) {
    return {
      ok: false,
      soma,
      message: "A soma dos parâmetros econômicos deve ser menor que 100%.",
    };
  }

  return {
    ok: true,
    soma,
    message: "",
  };
}

export function calcularOrcamentoProjeto(
  itens: ProjetoBudgetItem[],
  rates: ProjetoBudgetRates,
) {
  const summaries = Object.entries(RUBRICAS_PROJETO).map(([code, label]) => {
    const itensRubrica = itens.filter((item) => item.rubrica === code);
    return {
      code,
      label: `${label} (${code})`,
      total: roundMoney(itensRubrica.reduce((acc, item) => acc + itemProjetoTotal(item), 0)),
      count: itensRubrica.length,
      finalShare: 0,
    };
  });
  const subtotal = roundMoney(summaries.reduce((acc, item) => acc + item.total, 0));
  const economia = calcularPropostaEconomica({
    custoLaboratorioTecnico: 0,
    custoDiretoProjeto: subtotal,
    parametros: parametrosDeRates(rates),
  });

  if (!economia.valido) {
    return {
      subtotal,
      grossTotal: 0,
      markupRate: roundMoney(economia.somaPercentual),
      grossUpFactor: 0,
      taxesTotal: 0,
      legalTaxes: 0,
      incubationFee: 0,
      reserveFund: 0,
      investmentFund: 0,
      profit: 0,
      netRevenue: 0,
      preTaxSubtotal: 0,
      summaries,
      economicParameters: economia.parametros.map((param) => ({
        key: param.chave,
        label: param.label,
        nominalRate: param.percentual,
        effectiveRate: 0,
        amount: 0,
      })),
      validationError: economia.alertas[0] ?? "A soma dos parâmetros econômicos deve ser menor que 100%.",
    };
  }

  const grossTotal = economia.totalFinal;
  const params = economia.parametros.map((param) => ({
    key: param.chave,
    label: param.label,
    nominalRate: param.percentual,
    effectiveRate: subtotal > 0 ? (param.valorNominal / subtotal) * 100 : 0,
    amount: param.valorNominal,
  }));
  const amount = (key: string) => params.find((param) => param.key === key)?.amount ?? 0;
  const legalTaxes = amount("impostos_legacy");
  const incubationFee = amount("incubacao");
  const reserveFund = amount("reserva");
  const investmentFund = amount("investimentos");
  const profit = amount("lucro");
  const taxesTotal = roundMoney(legalTaxes + incubationFee);
  const netRevenue = roundMoney(reserveFund + investmentFund + profit);
  const preTaxSubtotal = roundMoney(grossTotal - taxesTotal);

  return {
    subtotal,
    grossTotal,
    markupRate: roundMoney(economia.somaPercentual),
    grossUpFactor: economia.fatorGrossUp,
    taxesTotal,
    legalTaxes,
    incubationFee,
    reserveFund,
    investmentFund,
    profit,
    netRevenue,
    preTaxSubtotal,
    summaries: summaries.map((summary) => ({
      ...summary,
      finalShare: grossTotal > 0 ? (summary.total / grossTotal) * 100 : 0,
    })),
    economicParameters: params,
    validationError: "",
  };
}
