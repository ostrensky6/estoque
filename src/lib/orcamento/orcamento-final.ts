import type { ProjetoBudgetRates } from "@/lib/project-budget/legacy";
import { roundMoney } from "@/lib/costing/pricing";
import {
  totalLaboratorioCusto as calcularTotalLaboratorioCusto,
  totalLaboratorioPreco as calcularTotalLaboratorioPreco,
  totalProjetoCusto as calcularTotalProjetoCusto,
} from "./parametros-adapter";
import { calcularPropostaEconomica, parametrosDeRates } from "./engine-economica";

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

/**
 * Consolidação da proposta final — usa a engine AUTORITATIVA (Política A,
 * `calcularPropostaEconomica`). Laboratório entra como custo técnico, projeto
 * como custo direto, e o gross-up é único sobre o subtotal técnico.
 *
 * `totalLaboratorioPreco` permanece exposto apenas como REFERÊNCIA/snapshot
 * operacional — não entra no fechamento consolidado (Política A).
 */
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

  const custoLaboratorioTecnico = calcularTotalLaboratorioCusto(args.itensLaboratorio);
  const totalLaboratorioPreco = calcularTotalLaboratorioPreco(args.itensLaboratorio); // referência
  const custoDiretoProjeto = calcularTotalProjetoCusto(args.itensProjeto);

  // Engine única autoritativa (Política A).
  const economia = calcularPropostaEconomica({
    custoLaboratorioTecnico,
    custoDiretoProjeto,
    parametros: parametrosDeRates(args.parametrosProjeto),
  });

  const totalFinal = economia.totalFinal;
  const subtotalTecnico = economia.subtotal;
  // Participação informativa do projeto no total (não é um segundo gross-up).
  const totalProjetoFinal =
    economia.valido && subtotalTecnico > 0
      ? roundMoney(totalFinal * (custoDiretoProjeto / subtotalTecnico))
      : 0;

  // Compat para a etapa de Parâmetros e para o snapshot (formato {key,...}).
  const parametrosProjeto = economia.parametros.map((p) => ({
    key: p.chave,
    label: p.label,
    nominalRate: p.percentual,
    amount: p.valorNominal,
  }));

  const origens: OrigemValorFinal[] = [
    {
      campo: "totalLaboratorioCusto",
      titulo: "Custo laboratório (técnico)",
      origem: "orcamento_itens.custo_unitario × orcamento_itens.n_amostras",
      regra: "Custo técnico laboratorial; base de cálculo da proposta (Política A).",
      valor: custoLaboratorioTecnico,
    },
    {
      campo: "totalLaboratorioPreco",
      titulo: "Preço laboratório (referência)",
      origem: "orcamento_itens.preco_unitario × orcamento_itens.n_amostras",
      regra: "Preço já formado preservado apenas como referência/snapshot; NÃO entra no fechamento da proposta nova.",
      valor: totalLaboratorioPreco,
    },
    {
      campo: "totalProjetoCusto",
      titulo: "Custo projeto (direto)",
      origem: "orcamento_projeto_custos e orcamento_projeto_analises (base de custo)",
      regra: "Custo direto do projeto; base de cálculo da proposta (Política A).",
      valor: custoDiretoProjeto,
    },
    {
      campo: "subtotalTecnico",
      titulo: "Subtotal técnico",
      origem: "custo laboratorial técnico + custo direto de projeto",
      regra: "Base única sobre a qual incide o gross-up dos parâmetros.",
      valor: subtotalTecnico,
    },
    {
      campo: "totalFinal",
      titulo: "Total final",
      origem: "engine-economica.calcularPropostaEconomica (Política A)",
      regra: economia.formula,
      valor: totalFinal,
    },
  ];

  return {
    pronto: pendencias.length === 0 && economia.valido,
    pendencias: economia.valido ? pendencias : [...pendencias, economia.alertas[0]],
    // Bases técnicas
    totalLaboratorioCusto: custoLaboratorioTecnico,
    totalLaboratorioPreco, // referência apenas
    totalProjetoCusto: custoDiretoProjeto,
    subtotalTecnico,
    // Resultado (Política A)
    somaPercentual: economia.somaPercentual,
    fatorGrossUp: economia.fatorGrossUp,
    totalParametros: economia.totalParametros,
    totalProjetoFinal, // participação informativa do projeto
    totalFinal,
    parametros: economia.parametros, // canônico
    parametrosProjeto, // compat (página/snapshot)
    alertas: economia.alertas,
    economia, // snapshot reproduzível da engine autoritativa
    markupProjeto: economia.somaPercentual, // compat de exibição (Σ parâmetros)
    origens,
  };
}
