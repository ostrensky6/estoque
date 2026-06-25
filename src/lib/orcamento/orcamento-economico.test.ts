import { describe, expect, it } from "vitest";
import {
  calcularTotalLaboratorioDireto,
  calcularTotalProjetoDireto,
  consolidarEconomiaOrcamento,
  normalizarModalidadeOrcamento,
} from "./orcamento-economico";

describe("orcamento-economico", () => {
  it("trata lucro como valor liquido sobre o custo (markup), nao como gross-up", () => {
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 100,
      custoProjeto: 0,
      parametros: { impostos_legacy: 10, lucro: 5 },
    });

    expect(result.subtotal).toBe(100);
    expect(result.somaPercentual).toBe(15);
    // lucro liquido = 100 x 5% = 5 -> subtotal liquido 105; impostos no gross-up: 105 / (1 - 0,10)
    expect(result.totalFinal).toBe(116.67);
    expect(result.parametros.find((p) => p.key === "impostos_legacy")?.amount).toBe(11.67);
    expect(result.parametros.find((p) => p.key === "lucro")?.amount).toBe(5);
  });

  it("aplica lucro como margem liquida quando nao ha impostos/taxas", () => {
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 0,
      custoProjeto: 200,
      parametros: { lucro: 20 },
    });

    expect(result.subtotal).toBe(200);
    // sem impostos/taxas nao ha gross-up: 200 + 200 x 20% = 240 (e nao 250)
    expect(result.totalFinal).toBe(240);
  });

  it("soma lucro liquido de laboratorio e projeto sem gross-up quando nao ha impostos", () => {
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 100,
      custoProjeto: 200,
      parametros: { lucro: 20 },
    });

    expect(result.subtotal).toBe(300);
    expect(result.totalFinal).toBe(360);
  });

  it("aplica gross-up apenas sobre impostos/taxas, preservando o lucro liquido planejado", () => {
    // Exemplo canonico: custo 90, lucro 30%, impostos/taxas 10%
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 90,
      custoProjeto: 0,
      parametros: { lucro: 30, impostos_legacy: 10 },
    });

    expect(result.subtotal).toBe(90);
    // lucro liquido = 90 x 30% = 27 -> subtotal liquido 117; bruto = 117 / (1 - 0,10) = 130
    expect(result.totalFinal).toBe(130);
    expect(result.parametros.find((p) => p.key === "lucro")?.amount).toBe(27);
    expect(result.parametros.find((p) => p.key === "impostos_legacy")?.amount).toBe(13);
  });

  it("bloqueia quando impostos/taxas (base faturamento) somam 100% ou mais", () => {
    const result = consolidarEconomiaOrcamento({
      custoLaboratorio: 100,
      custoProjeto: 200,
      parametros: { impostos_legacy: 60, incubacao: 50 },
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
