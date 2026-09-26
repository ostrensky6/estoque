// Bases de custo da proposta (Política A, DEC-ORC-001): custo técnico do
// laboratório, preço de tabela do laboratório (só referência) e custo direto
// do projeto. O gross-up fica só em `engine-economica.ts`.
import { roundMoney } from "@/lib/costing/pricing";
import { itemProjetoTotal } from "@/lib/project-budget/orcamento-projeto";
import type { ItemLaboratorioFinal, ItemProjetoFinal } from "./orcamento-final";

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
