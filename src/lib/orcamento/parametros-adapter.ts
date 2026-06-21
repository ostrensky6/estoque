import {
  aplicarParametrosEconomicos,
  roundMoney,
  type AplicarParametrosEconomicosArgs,
  type ModoLaboratorioNoOrcamento,
  type ParametroEconomicoAplicavel,
} from "@/lib/costing/pricing";
import { itemProjetoTotal, type ProjetoBudgetRates } from "@/lib/project-budget/legacy";
import type { ItemLaboratorioFinal, ItemProjetoFinal } from "./orcamento-final";

export type EntradaParametros = AplicarParametrosEconomicosArgs;

export type AdaptarOrcamentoParaParametrosArgs = {
  itensLaboratorio: ItemLaboratorioFinal[];
  itensProjeto: ItemProjetoFinal[];
  parametrosProjeto: ProjetoBudgetRates;
  laboratorioModo?: ModoLaboratorioNoOrcamento;
};

const PARAMETROS_PROJETO = [
  { key: "impostos_legacy", label: "Impostos" },
  { key: "incubacao", label: "Incubacao" },
  { key: "reserva", label: "Reserva" },
  { key: "investimentos", label: "Investimentos" },
  { key: "lucro", label: "Lucro" },
] as const;

function percentual(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function totalLaboratorioCusto(itens: ItemLaboratorioFinal[]) {
  return roundMoney(
    itens.reduce(
      (total, item) =>
        total + Number(item.custo_unitario ?? 0) * Number(item.n_amostras ?? 0),
      0,
    ),
  );
}

export function totalLaboratorioPreco(itens: ItemLaboratorioFinal[]) {
  return roundMoney(
    itens.reduce(
      (total, item) =>
        total + Number(item.preco_unitario ?? 0) * Number(item.n_amostras ?? 0),
      0,
    ),
  );
}

export function totalProjetoCusto(itens: ItemProjetoFinal[]) {
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

export function parametrosProjetoParaPricing(
  rates: ProjetoBudgetRates,
): ParametroEconomicoAplicavel[] {
  return PARAMETROS_PROJETO.map((parametro) => ({
    chave: parametro.key,
    label: parametro.label,
    base: "APENAS_PROJETO",
    percentual: percentual(rates[parametro.key]),
  }));
}

export function adaptarOrcamentoParaEntradaParametros(
  args: AdaptarOrcamentoParaParametrosArgs,
): EntradaParametros {
  const laboratorioModo = args.laboratorioModo ?? "PRECO_JA_FORMADO";
  const laboratorioValor =
    laboratorioModo === "CUSTO_TECNICO"
      ? totalLaboratorioCusto(args.itensLaboratorio)
      : totalLaboratorioPreco(args.itensLaboratorio);

  return {
    metodo: "GROSS_UP",
    laboratorio: {
      valor: laboratorioValor,
      modo: laboratorioModo,
    },
    projeto: {
      custo: totalProjetoCusto(args.itensProjeto),
    },
    parametros: parametrosProjetoParaPricing(args.parametrosProjeto),
  };
}

export function aplicarParametrosDoOrcamento(
  args: AdaptarOrcamentoParaParametrosArgs,
) {
  return aplicarParametrosEconomicos(adaptarOrcamentoParaEntradaParametros(args));
}
