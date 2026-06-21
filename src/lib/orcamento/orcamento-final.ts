import { calcularOrcamentoProjetoLegacy, itemProjetoTotal, type ProjetoBudgetRates } from "@/lib/project-budget/legacy";

export type ItemLaboratorioFinal = {
  n_amostras?: number | null;
  custo_unitario?: number | null;
  preco_unitario?: number | null;
};

export type ItemProjetoFinal = {
  rubrica?: string | null;
  quantidade?: number | null;
  custo_unitario?: number | null;
  preco_unitario?: number | null;
  meses_selecionados?: number[] | null;
};

export type OrigemValorFinal = {
  campo: string;
  titulo: string;
  origem: string;
  regra: string;
  valor: number;
};

export function consolidarOrcamentoFinal(args: {
  laboratorioExigido: boolean;
  projetoExigido: boolean;
  laboratorioRevisado: boolean;
  projetoRevisado: boolean;
  itensLaboratorio: ItemLaboratorioFinal[];
  itensProjeto: ItemProjetoFinal[];
  parametrosProjeto: ProjetoBudgetRates;
}) {
  const pendencias = [
    args.laboratorioExigido && !args.laboratorioRevisado ? "revisar custos laboratoriais" : null,
    args.projetoExigido && !args.projetoRevisado ? "revisar custos de projeto" : null,
  ].filter(Boolean) as string[];

  const totalLaboratorioCusto = args.itensLaboratorio.reduce(
    (total, item) => total + Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0),
    0,
  );
  const totalLaboratorioPreco = args.itensLaboratorio.reduce(
    (total, item) => total + Number(item.preco_unitario ?? 0) * Number(item.n_amostras ?? 0),
    0,
  );
  const itensProjetoBase = args.itensProjeto.map((item) => ({
    rubrica: item.rubrica,
    quantidade: item.quantidade,
    preco_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
    meses_selecionados: item.meses_selecionados ?? [],
  }));
  const calculoProjeto = calcularOrcamentoProjetoLegacy(itensProjetoBase, args.parametrosProjeto);
  const totalProjetoCusto = itensProjetoBase.reduce((total, item) => total + itemProjetoTotal(item), 0);
  const totalProjetoFinal = calculoProjeto.grossTotal;
  const totalFinal = totalLaboratorioPreco + totalProjetoFinal;
  const origens: OrigemValorFinal[] = [
    {
      campo: "totalLaboratorioCusto",
      titulo: "Custo laboratório",
      origem: "orcamento_itens.custo_unitario × orcamento_itens.n_amostras",
      regra: "Soma dos custos unitários de análises laboratoriais multiplicados pela quantidade de amostras.",
      valor: totalLaboratorioCusto,
    },
    {
      campo: "totalLaboratorioPreco",
      titulo: "Preço laboratório",
      origem: "orcamento_itens.preco_unitario × orcamento_itens.n_amostras",
      regra: "Soma dos preços unitários preservados no snapshot laboratorial multiplicados pela quantidade de amostras.",
      valor: totalLaboratorioPreco,
    },
    {
      campo: "totalProjetoCusto",
      titulo: "Custo projeto",
      origem: "orcamento_projeto_custos.custo_unitario e orcamento_projeto_analises.custo_unitario",
      regra: "Soma dos custos próprios do projeto e das análises incluídas no projeto, sempre pela base de custo.",
      valor: totalProjetoCusto,
    },
    {
      campo: "totalProjetoFinal",
      titulo: "Projeto final",
      origem: "calcularOrcamentoProjetoLegacy sobre custos de projeto e parâmetros econômicos",
      regra: "Aplica gross-up de impostos, incubação, reserva, investimentos e lucro sobre o subtotal de custos do projeto.",
      valor: totalProjetoFinal,
    },
    {
      campo: "totalFinal",
      titulo: "Total final",
      origem: "totalLaboratorioPreco + totalProjetoFinal",
      regra: "Soma do preço laboratorial preservado com o valor final do projeto após parâmetros econômicos.",
      valor: totalFinal,
    },
  ];

  return {
    pronto: pendencias.length === 0 && !calculoProjeto.validationError,
    pendencias: calculoProjeto.validationError ? [...pendencias, calculoProjeto.validationError] : pendencias,
    totalLaboratorioCusto,
    totalLaboratorioPreco,
    totalProjetoCusto,
    totalProjetoFinal,
    totalFinal,
    parametrosProjeto: calculoProjeto.economicParameters,
    markupProjeto: calculoProjeto.markupRate,
    origens,
  };
}
