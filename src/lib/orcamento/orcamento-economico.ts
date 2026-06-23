const MODALIDADES_LABORATORIO = new Set([
  "analises",
  "analises_projeto",
  "projeto_com_analises",
  "projeto_analises_custos",
]);

const MODALIDADES_PROJETO = new Set([
  "projeto",
  "analises_projeto",
  "projeto_com_analises",
  "projeto_analises_custos",
]);

export function normalizarModalidadeOrcamento(modalidade?: string | null) {
  if (modalidade === "analises_projeto") return "projeto_com_analises";
  if (modalidade === "projeto_analises_custos") return "projeto_com_analises";
  if (modalidade === "projeto_com_analises") return "projeto_com_analises";
  if (modalidade === "projeto") return "projeto";
  return "analises";
}

export function modalidadeExigeLaboratorio(modalidade?: string | null) {
  return MODALIDADES_LABORATORIO.has(modalidade ?? "analises");
}

export function modalidadeExigeProjeto(modalidade?: string | null) {
  return MODALIDADES_PROJETO.has(modalidade ?? "analises");
}

type ParametrosEconomicosProjeto = {
  impostos_legacy?: number | null;
  incubacao?: number | null;
  reserva?: number | null;
  investimentos?: number | null;
  lucro?: number | null;
};

const PARAMETROS = [
  { key: "impostos_legacy", label: "Impostos", base: "final" },
  { key: "incubacao", label: "Incubação", base: "final" },
  { key: "reserva", label: "Reserva", base: "custo" },
  { key: "investimentos", label: "Investimentos", base: "custo" },
  { key: "lucro", label: "Lucro", base: "custo" },
] as const;

function dinheiro(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularTotalLaboratorioDireto(
  itens: ReadonlyArray<{ n_amostras?: number | null; custo_unitario?: number | null }>,
) {
  const total = itens.reduce((soma, item) => {
    const amostras = Math.max(0, Number(item.n_amostras) || 0);
    const custo = Math.max(0, Number(item.custo_unitario) || 0);
    return soma + amostras * custo;
  }, 0);
  return dinheiro(total);
}

export function calcularTotalProjetoDireto(
  itens: ReadonlyArray<{ rubrica?: string | null; quantidade?: number | null; custo_unitario?: number | null }>,
) {
  const total = itens.reduce((soma, item) => {
    const quantidade = Math.max(0, Number(item.quantidade) || 0);
    const custo = Math.max(0, Number(item.custo_unitario) || 0);
    return soma + quantidade * custo;
  }, 0);
  return dinheiro(total);
}

export function consolidarEconomiaOrcamento(args: {
  custoLaboratorio: number;
  custoProjeto: number;
  parametros: ParametrosEconomicosProjeto;
}) {
  const subtotal = dinheiro(Math.max(0, Number(args.custoLaboratorio) || 0) + Math.max(0, Number(args.custoProjeto) || 0));
  const parametros = PARAMETROS.map((parametro) => {
    const nominalRate = Number(args.parametros[parametro.key] ?? 0);
    const safeRate = Number.isFinite(nominalRate) ? nominalRate : 0;
    return {
      key: parametro.key,
      label: parametro.label,
      base: parametro.base,
      nominalRate: safeRate,
      effectiveRate: safeRate,
      amount: 0,
    };
  });
  const somaFinal = parametros
    .filter((parametro) => parametro.base === "final")
    .reduce((total, parametro) => total + parametro.nominalRate, 0);
  const somaCusto = parametros
    .filter((parametro) => parametro.base === "custo")
    .reduce((total, parametro) => total + parametro.nominalRate, 0);
  const valido = somaFinal < 100;
  const valorMarkupCusto = dinheiro(subtotal * (somaCusto / 100));
  const baseComMarkup = dinheiro(subtotal + valorMarkupCusto);
  const grossUpFactor = valido ? 1 / (1 - somaFinal / 100) : 1;
  const totalFinal = valido ? dinheiro(baseComMarkup * grossUpFactor) : 0;
  const totalParametros = valido ? dinheiro(Math.max(0, totalFinal - subtotal)) : 0;
  const parametrosComValores = parametros.map((parametro) => ({
    ...parametro,
    amount: !valido
      ? 0
      : parametro.base === "final"
      ? dinheiro(totalFinal * (parametro.nominalRate / 100))
      : dinheiro(subtotal * (parametro.nominalRate / 100)),
  }));

  return {
    valido,
    validationError: valido ? null : "A soma de impostos e incubação deve ser menor que 100%.",
    subtotal,
    parametros: parametrosComValores,
    somaPercentual: somaFinal + somaCusto,
    grossUpFactor,
    totalParametros,
    totalFinal,
    formula: "Total = (custos diretos + reserva + investimentos + lucro) / (1 - impostos - incubação)",
  };
}
