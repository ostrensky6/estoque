import { describe, expect, it } from "vitest";
import { montarEquipamentosAlocados } from "./loader";

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
