import { itemProjetoTotal, type ProjetoBudgetRates } from "@/lib/project-budget/legacy";

export type ModalidadeCanonica = "analises" | "projeto" | "projeto_com_analises";

export type ParametroEconomicoFinal = {
  key: keyof ProjetoBudgetRates;
  label: string;
  nominalRate: number;
  amount: number;
  effectiveRate: number;
};

export type ConsolidacaoEconomicaArgs = {
  custoLaboratorio: number;
  custoProjeto: number;
  parametros: ProjetoBudgetRates;
};

const PARAMETROS = [
  { key: "impostos_legacy", label: "Impostos" },
  { key: "incubacao", label: "Incubação" },
  { key: "reserva", label: "Reserva" },
  { key: "investimentos", label: "Investimentos" },
  { key: "lucro", label: "Lucro" },
] as const;

export function normalizarModalidadeOrcamento(modalidade: string | null | undefined): ModalidadeCanonica {
  if (modalidade === "projeto") return "projeto";
  if (modalidade === "analises_projeto" || modalidade === "projeto_analises_custos" || modalidade === "projeto_com_analises") {
    return "projeto_com_analises";
  }
  return "analises";
}

export function modalidadeExigeLaboratorio(modalidade: string | null | undefined) {
  const canonica = normalizarModalidadeOrcamento(modalidade);
  return canonica === "analises" || canonica === "projeto_com_analises";
}

export function modalidadeExigeProjeto(modalidade: string | null | undefined) {
  const canonica = normalizarModalidadeOrcamento(modalidade);
  return canonica === "projeto" || canonica === "projeto_com_analises";
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizarNumero(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function calcularTotalProjetoDireto(
  itens: Array<{
    rubrica?: string | null;
    quantidade?: number | null;
    custo_unitario?: number | null;
    preco_unitario?: number | null;
    meses_selecionados?: number[] | null;
  }>,
) {
  return roundMoney(
    itens
      .map((item) => ({
        rubrica: item.rubrica,
        quantidade: item.quantidade,
        preco_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
        meses_selecionados: item.meses_selecionados ?? [],
      }))
      .reduce((total, item) => total + itemProjetoTotal(item), 0),
  );
}

export function calcularTotalLaboratorioDireto(
  itens: Array<{ n_amostras?: number | null; custo_unitario?: number | null }>,
) {
  return roundMoney(
    itens.reduce(
      (total, item) => total + normalizarNumero(item.custo_unitario) * normalizarNumero(item.n_amostras),
      0,
    ),
  );
}

export function consolidarEconomiaOrcamento(args: ConsolidacaoEconomicaArgs) {
  const custoLaboratorio = Math.max(0, normalizarNumero(args.custoLaboratorio));
  const custoProjeto = Math.max(0, normalizarNumero(args.custoProjeto));
  const subtotal = roundMoney(custoLaboratorio + custoProjeto);
  const somaPercentual = PARAMETROS.reduce(
    (total, parametro) => total + Math.max(0, normalizarNumero(args.parametros[parametro.key])),
    0,
  );

  const parametrosBase = PARAMETROS.map((parametro) => ({
    key: parametro.key,
    label: parametro.label,
    nominalRate: Math.max(0, normalizarNumero(args.parametros[parametro.key])),
  }));

  if (somaPercentual >= 100) {
    return {
      valido: false,
      validationError: "A soma dos parâmetros econômicos deve ser menor que 100%.",
      subtotal,
      custoLaboratorio: roundMoney(custoLaboratorio),
      custoProjeto: roundMoney(custoProjeto),
      somaPercentual,
      grossUpFactor: 0,
      totalFinal: 0,
      totalParametros: 0,
      parametros: parametrosBase.map((parametro) => ({
        ...parametro,
        amount: 0,
        effectiveRate: 0,
      })) satisfies ParametroEconomicoFinal[],
      formula: {
        metodo: "GROSS_UP" as const,
        taxa_total: somaPercentual / 100,
        expressao: "total_final = (custo_laboratorio + custo_projeto) / (1 - taxa_total)",
      },
    };
  }

  const taxaTotal = somaPercentual / 100;
  const grossUpFactor = taxaTotal > 0 ? 1 / (1 - taxaTotal) : 1;
  const totalFinal = roundMoney(subtotal * grossUpFactor);
  const parametros = parametrosBase.map((parametro) => {
    const amount = roundMoney((totalFinal * parametro.nominalRate) / 100);
    return {
      ...parametro,
      amount,
      effectiveRate: subtotal > 0 ? (amount / subtotal) * 100 : 0,
    };
  }) satisfies ParametroEconomicoFinal[];
  const totalParametros = roundMoney(parametros.reduce((total, parametro) => total + parametro.amount, 0));

  return {
    valido: true,
    validationError: "",
    subtotal,
    custoLaboratorio: roundMoney(custoLaboratorio),
    custoProjeto: roundMoney(custoProjeto),
    somaPercentual,
    grossUpFactor,
    totalFinal,
    totalParametros,
    parametros,
    formula: {
      metodo: "GROSS_UP" as const,
      taxa_total: taxaTotal,
      expressao: "total_final = (custo_laboratorio + custo_projeto) / (1 - taxa_total)",
    },
  };
}
