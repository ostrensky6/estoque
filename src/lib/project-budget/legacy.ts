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

export type ProjetoBudgetRates = {
  impostos_legacy?: number | null;
  incubacao?: number | null;
  reserva?: number | null;
  investimentos?: number | null;
  lucro?: number | null;
};

const PARAMETROS_ECONOMICOS_PROJETO = [
  { key: "impostos_legacy", label: "Impostos", base: "final" },
  { key: "incubacao", label: "Incubação", base: "final" },
  { key: "reserva", label: "Reserva", base: "custo" },
  { key: "investimentos", label: "Investimentos", base: "custo" },
  { key: "lucro", label: "Lucro", base: "custo" },
] as const;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

  const soma = PARAMETROS_ECONOMICOS_PROJETO.filter((param) => param.base === "final").reduce(
    (acc, param) => acc + Math.max(0, Number(rates[param.key] ?? 0)),
    0,
  );

  if (soma >= 100) {
    return {
      ok: false,
      soma,
      message: "Impostos e incubação devem somar menos de 100%.",
    };
  }

  return {
    ok: true,
    soma,
    message: "",
  };
}

export function calcularOrcamentoProjetoLegacy(
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
  const economicParameters = PARAMETROS_ECONOMICOS_PROJETO;
  const finalRateSum =
    economicParameters
      .filter((param) => param.base === "final")
      .reduce((acc, param) => acc + Math.max(0, Number(rates[param.key] ?? 0)), 0) /
    100;
  const costRateSum =
    economicParameters
      .filter((param) => param.base === "custo")
      .reduce((acc, param) => acc + Math.max(0, Number(rates[param.key] ?? 0)), 0) /
    100;

  if (finalRateSum >= 1) {
    return {
      subtotal,
      grossTotal: 0,
      markupRate: roundMoney((finalRateSum + costRateSum) * 100),
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
      economicParameters: economicParameters.map((param) => ({
        key: param.key,
        label: param.label,
        nominalRate: Math.max(0, Number(rates[param.key] ?? 0)),
        effectiveRate: 0,
        amount: 0,
      })),
      validationError: "Impostos e incubação devem somar menos de 100%.",
    };
  }

  const subtotalComMarkup = roundMoney(subtotal * (1 + costRateSum));
  const grossUpFactor = finalRateSum > 0 ? 1 / (1 - finalRateSum) : 1;
  const grossTotal = roundMoney(subtotalComMarkup * grossUpFactor);
  const params = economicParameters.map((param) => {
    const nominalRate = Math.max(0, Number(rates[param.key] ?? 0));
    const amount = roundMoney((nominalRate / 100) * (param.base === "final" ? grossTotal : subtotal));
    return {
      key: param.key,
      label: param.label,
      nominalRate,
      effectiveRate: subtotal > 0 ? (amount / subtotal) * 100 : 0,
      amount,
    };
  });
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
    markupRate: roundMoney((finalRateSum + costRateSum) * 100),
    grossUpFactor,
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
