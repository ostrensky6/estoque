import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { montarEquipamentosAlocados } from "./loader";

const loaderSource = readFileSync(new URL("./loader.ts", import.meta.url), "utf8");

describe("montarEquipamentosAlocados", () => {
  it("inclui no custo apenas equipamentos da analise com peso positivo", () => {
    const custoDiaPorEquip = new Map([
      [1, 100],
      [2, 200],
      [3, 300],
      [4, 400],
    ]);

    const alocados = montarEquipamentosAlocados(
      [
        { codigo_analise: "PCR", equipamento_id: 1, peso_alocacao: 0 },
        { codigo_analise: "PCR", equipamento_id: 2, peso_alocacao: 0.25 },
        { codigo_analise: "PCR", equipamento_id: 3, peso_alocacao: -1 },
        { codigo_analise: "SANGER", equipamento_id: 4, peso_alocacao: 1 },
        { codigo_analise: "PCR", equipamento_id: 5, peso_alocacao: Number.NaN },
      ],
      "PCR",
      custoDiaPorEquip,
    );

    expect(alocados).toEqual([{ peso: 0.25, custoDia: 200 }]);
  });
});

describe("proveniência dimensional do loader", () => {
  it("carrega unidade de estoque, unidade de consumo e fator", () => {
    expect(loaderSource).toContain("unidade_estoque");
    expect(loaderSource).toContain("unidade_consumo");
    expect(loaderSource).toContain("fator_conversao");
  });

  it("preserva fonte e custos bruto e normalizado", () => {
    expect(loaderSource).toContain("fonte_custo");
    expect(loaderSource).toContain("custo_unitario_estoque");
    expect(loaderSource).toContain("custo_unitario_consumo");
    expect(loaderSource).toMatch(/custoUnitarioEstoque\s*\/\s*fatorConversao/);
  });
});
