import { describe, expect, it } from "vitest";
import {
  anosDoProjeto,
  estadoEdicaoProjeto,
  linhasViagemFaltantes,
  normalizarMeses,
  resumirRubricas,
  situacaoQuantidadeViagem,
  subtotalCusto,
} from "./editor";
import { normalizarViagemInputs } from "./travel";

describe("editor de custos de projeto", () => {
  it("calcula PE por meses marcados e as demais rubricas por quantidade", () => {
    expect(subtotalCusto({ rubrica: "PE", quantidade: 1, custo_unitario: 5000, meses_selecionados: [1, 2, 3] })).toBe(15000);
    expect(subtotalCusto({ rubrica: "PE", quantidade: 2, custo_unitario: 5000, meses_selecionados: [] })).toBe(10000);
    expect(subtotalCusto({ rubrica: "MC", quantidade: 2.5, custo_unitario: 10, meses_selecionados: [1] })).toBe(25);
  });

  it("resume as seis rubricas na ordem PE, MC, MP, ST, VD, OU", () => {
    const resumo = resumirRubricas([
      { rubrica: "MC", quantidade: 1, custo_unitario: 500 },
      { rubrica: "MC", quantidade: 2, custo_unitario: 10 },
      { rubrica: "PE", quantidade: 1, custo_unitario: 100, meses_selecionados: [1, 2] },
      { rubrica: null, quantidade: 1, custo_unitario: 7 },
    ]);
    expect(resumo.map((r) => r.codigo)).toEqual(["PE", "MC", "MP", "ST", "VD", "OU"]);
    expect(resumo.find((r) => r.codigo === "MC")).toMatchObject({ total: 520, itens: 2 });
    expect(resumo.find((r) => r.codigo === "PE")).toMatchObject({ total: 200, itens: 1 });
    expect(resumo.find((r) => r.codigo === "OU")).toMatchObject({ total: 7, itens: 1 });
  });

  it("pagina a grade de meses por ano", () => {
    expect(anosDoProjeto(30).map((a) => [a.ano, a.inicio, a.fim])).toEqual([
      [1, 1, 12],
      [2, 13, 24],
      [3, 25, 30],
    ]);
    expect(anosDoProjeto(0)).toHaveLength(1);
  });

  it("normaliza meses: inteiros no prazo, sem repetição, ordenados", () => {
    expect(normalizarMeses(["3", 1, "1", 0, 13, "x", 2.5, 12], 12)).toEqual([1, 3, 12]);
  });

  it("marca quantidade de viagem como calculada, ajustada ou manual", () => {
    const inputs = normalizarViagemInputs({ pessoas: 2, dias_campo: 3 });
    expect(situacaoQuantidadeViagem({ descricao: "Alimentação", quantidade: 6 }, inputs)).toEqual({ situacao: "calculado", calculada: 6 });
    expect(situacaoQuantidadeViagem({ descricao: "Alimentação", quantidade: 8 }, inputs)).toEqual({ situacao: "ajustado", calculada: 6 });
    expect(situacaoQuantidadeViagem({ descricao: "Taxa de embarque especial", quantidade: 1 }, inputs).situacao).toBe("manual");
  });

  it("sugere só as linhas padrão de viagem que faltam e têm quantidade", () => {
    const inputs = normalizarViagemInputs({ pessoas: 2, dias_campo: 3, quartos: 1, diarias_hospedagem: 2 });
    const catalogo = [
      { id: "VD-1", descricao: "Alimentação", categoria: "Alimentação" },
      { id: "VD-2", descricao: "Hospedagem", categoria: "Hospedagem" },
      { id: "VD-3", descricao: "Combustível", categoria: "Deslocamento" },
      { id: "VD-9", descricao: "Brindes", categoria: "Outros" },
    ];
    const faltantes = linhasViagemFaltantes(catalogo, [{ descricao: "Alimentação da equipe", categoria: "deslocamento" }], inputs);
    expect(faltantes.map((f) => [f.item.id, f.quantidade])).toEqual([["VD-2", 2]]);
  });

  it("explica quando a edição está bloqueada e o que o status permite", () => {
    expect(estadoEdicaoProjeto("rascunho")).toMatchObject({ editavel: true, podeConcluir: true, podeReabrir: false });
    expect(estadoEdicaoProjeto("enviado")).toMatchObject({ editavel: false, rotulo: "Revisado", podeReabrir: false });
    expect(estadoEdicaoProjeto("recusado")).toMatchObject({ editavel: false, podeReabrir: true });
    expect(estadoEdicaoProjeto("cancelado").motivo).toContain("cancelado");
  });
});
