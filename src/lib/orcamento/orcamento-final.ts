import { type ProjetoBudgetRates } from "@/lib/project-budget/legacy";
import {
  totalLaboratorioCusto as calcularTotalLaboratorioCusto,
  totalLaboratorioPreco as calcularTotalLaboratorioPreco,
  totalProjetoCusto as calcularTotalProjetoCusto,
} from "./parametros-adapter";
import { consolidarEconomiaOrcamento } from "./orcamento-economico";

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
  const totalProjetoCusto = calcularTotalProjetoCusto(args.itensProjeto);
  const calculoEconomico = consolidarEconomiaOrcamento({
    custoLaboratorio: totalLaboratorioCusto,
    custoProjeto: totalProjetoCusto,
    parametros: args.parametrosProjeto,
  });
  const parametrosAplicados = calculoEconomico.valido
    ? {
        metodo: "GROSS_UP" as const,
        laboratorio: {
          valorEntrada: totalLaboratorioCusto,
          modo: "CUSTO_TECNICO" as const,
          baseIncidencia: totalLaboratorioCusto,
          total: totalLaboratorioCusto,
        },
        projeto: {
          custoEntrada: totalProjetoCusto,
          baseIncidencia: totalProjetoCusto,
          total: totalProjetoCusto,
        },
        subtotalCustos: calculoEconomico.subtotal,
        totalParametros: calculoEconomico.totalParametros,
        totalFinal: calculoEconomico.totalFinal,
        parametros: calculoEconomico.parametros.map((parametro) => ({
          chave: String(parametro.key),
          label: parametro.label,
          base: "TODOS_COMPONENTES" as const,
          percentual: parametro.nominalRate,
          valorInformado: 0,
          valorCalculado: parametro.amount,
          baseLaboratorio: totalLaboratorioCusto,
          baseProjeto: totalProjetoCusto,
          aplicado: true,
        })),
        alertas: [] as string[],
        snapshot: {
          metodo: "GROSS_UP" as const,
          laboratorio: {
            valorEntrada: totalLaboratorioCusto,
            modo: "CUSTO_TECNICO" as const,
            baseIncidencia: totalLaboratorioCusto,
            total: totalLaboratorioCusto,
          },
          projeto: {
            custoEntrada: totalProjetoCusto,
            baseIncidencia: totalProjetoCusto,
            total: totalProjetoCusto,
          },
          subtotalCustos: calculoEconomico.subtotal,
          totalParametros: calculoEconomico.totalParametros,
          totalFinal: calculoEconomico.totalFinal,
          parametros: [],
          alertas: [] as string[],
        },
      }
    : null;
  const totalProjetoFinal = totalProjetoCusto;
  const totalFinal = calculoEconomico.totalFinal;
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
      regra: "Valor histórico preservado para visualização. Não entra na base padrão do orçamento final consolidado.",
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
      titulo: "Projeto direto",
      origem: "orcamento_projeto_custos.custo_unitario",
      regra: "Custos próprios do projeto entram como custo direto antes do gross-up único.",
      valor: totalProjetoFinal,
    },
    {
      campo: "totalFinal",
      titulo: "Total final",
      origem: "consolidarEconomiaOrcamento",
      regra: "Aplica gross-up único sobre custo laboratorial técnico + custo direto do projeto.",
      valor: totalFinal,
    },
  ];

  return {
    pronto: pendencias.length === 0 && calculoEconomico.valido,
    pendencias: calculoEconomico.validationError ? [...pendencias, calculoEconomico.validationError] : pendencias,
    totalLaboratorioCusto,
    totalLaboratorioPreco,
    totalProjetoCusto,
    totalProjetoFinal,
    totalFinal,
    parametrosProjeto: calculoEconomico.parametros.map((parametro) => ({
      key: parametro.key,
      label: parametro.label,
      nominalRate: parametro.nominalRate,
      effectiveRate: parametro.effectiveRate,
      amount: parametro.amount,
    })),
    entradaParametros: {
      metodo: "GROSS_UP" as const,
      laboratorio: { valor: totalLaboratorioCusto, modo: "CUSTO_TECNICO" as const },
      projeto: { custo: totalProjetoCusto },
      parametros: calculoEconomico.parametros.map((parametro) => ({
        chave: String(parametro.key),
        label: parametro.label,
        base: "TODOS_COMPONENTES" as const,
        percentual: parametro.nominalRate,
      })),
    },
    parametrosAplicados,
    markupProjeto: calculoEconomico.somaPercentual,
    fatorGrossUp: calculoEconomico.grossUpFactor,
    subtotalTecnico: calculoEconomico.subtotal,
    formula: calculoEconomico.formula,
    origens,
  };
}
