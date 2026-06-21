import { calcularOrcamentoProjetoLegacy, type ProjetoBudgetRates } from "@/lib/project-budget/legacy";
import {
  adaptarOrcamentoParaEntradaParametros,
  aplicarParametrosDoOrcamento,
  totalLaboratorioCusto as calcularTotalLaboratorioCusto,
  totalLaboratorioPreco as calcularTotalLaboratorioPreco,
  totalProjetoCusto as calcularTotalProjetoCusto,
} from "./parametros-adapter";

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

  const totalLaboratorioCusto = calcularTotalLaboratorioCusto(args.itensLaboratorio);
  const totalLaboratorioPreco = calcularTotalLaboratorioPreco(args.itensLaboratorio);
  const itensProjetoBase = args.itensProjeto.map((item) => ({
    rubrica: item.rubrica,
    quantidade: item.quantidade,
    preco_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
    meses_selecionados: item.meses_selecionados ?? [],
  }));
  const calculoProjeto = calcularOrcamentoProjetoLegacy(itensProjetoBase, args.parametrosProjeto);
  const entradaParametros = adaptarOrcamentoParaEntradaParametros(args);
  const parametrosAplicados = calculoProjeto.validationError
    ? null
    : aplicarParametrosDoOrcamento(args);
  const totalProjetoCusto = calcularTotalProjetoCusto(args.itensProjeto);
  const totalProjetoFinal = parametrosAplicados?.projeto.total ?? calculoProjeto.grossTotal;
  const totalFinal = parametrosAplicados?.totalFinal ?? totalLaboratorioPreco + totalProjetoFinal;
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
      origem: "aplicarParametrosEconomicos via adaptarOrcamentoParaEntradaParametros",
      regra: "Aplica gross-up explícito sobre os custos próprios do projeto, sem reaplicar parâmetros sobre laboratório já precificado.",
      valor: totalProjetoFinal,
    },
    {
      campo: "totalFinal",
      titulo: "Total final",
      origem: "snapshot autoritativo de parametros aplicados",
      regra: "Soma o laboratório como preço já formado com o projeto após parâmetros econômicos aplicados pela engine unificada.",
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
    entradaParametros,
    parametrosAplicados,
    markupProjeto: calculoProjeto.markupRate,
    origens,
  };
}
