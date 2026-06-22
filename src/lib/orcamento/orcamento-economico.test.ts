import { describe, expect, it } from "vitest";
import {
  calcularTotalLaboratorioDireto,
  calcularTotalProjetoDireto,
  consolidarEconomiaOrcamento,
  normalizarModalidadeOrcamento,
} from "./orcamento-economico";

describe("orcamento-economico", () => {
  it("consolida somente laboratorio sem usar preco laboratorial previamente acrescido", () => {
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 100,
      custoProjeto: 0,
      parametros: { impostos_legacy: 10, lucro: 5 },
    });

    expect(result.subtotal).toBe(100);
    expect(result.somaPercentual).toBe(15);
    expect(result.totalFinal).toBe(117.65);
    expect(result.parametros.find((p) => p.key === "impostos_legacy")?.amount).toBe(11.77);
    expect(result.parametros.find((p) => p.key === "lucro")?.amount).toBe(5.88);
  });

  it("consolida somente projeto pelo gross-up compativel com o app antigo", () => {
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 0,
      custoProjeto: 200,
      parametros: { lucro: 20 },
    });

    expect(result.subtotal).toBe(200);
    expect(result.totalFinal).toBe(250);
  });

  it("consolida projeto com laboratorio com uma unica aplicacao de gross-up", () => {
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 100,
      custoProjeto: 200,
      parametros: { lucro: 20 },
    });

    expect(result.subtotal).toBe(300);
    expect(result.totalFinal).toBe(375);
  });

  it("bloqueia parametros invalidos com soma maior ou igual a 100%", () => {
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 100,
      custoProjeto: 200,
      parametros: { impostos_legacy: 60, lucro: 40 },
    });

    expect(result.valido).toBe(false);
    expect(result.totalFinal).toBe(0);
    expect(result.validationError).toContain("menor que 100%");
  });

  it("calcula subtotal laboratorial e de projeto com arredondamento monetario", () => {
    expect(calcularTotalLaboratorioDireto([{ n_amostras: 3, custo_unitario: 10.105 }])).toBe(30.32);
    expect(calcularTotalProjetoDireto([{ rubrica: "MC", quantidade: 2, custo_unitario: 12.335 }])).toBe(24.67);
  });

  it("mapeia modalidades antigas para a modalidade canonica", () => {
    expect(normalizarModalidadeOrcamento("analises")).toBe("analises");
    expect(normalizarModalidadeOrcamento("projeto")).toBe("projeto");
    expect(normalizarModalidadeOrcamento("analises_projeto")).toBe("projeto_com_analises");
    expect(normalizarModalidadeOrcamento("projeto_analises_custos")).toBe("projeto_com_analises");
  });
});
