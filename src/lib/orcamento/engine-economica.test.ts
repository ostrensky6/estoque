import { describe, expect, it } from "vitest";
import { calcularPropostaEconomica, parametrosDeRates } from "./engine-economica";
import { itemProjetoTotal } from "@/lib/project-budget/legacy";

// Política A (DEC-ORC-001): total = (lab técnico + projeto direto) / (1 - Σ%/100).

function paramsTotais(percentual: number) {
  // distribui um único parâmetro "impostos" para somar `percentual`%
  return [{ chave: "impostos_legacy", label: "Impostos", percentual }];
}

describe("calcularPropostaEconomica — Política A (autoritativa)", () => {
  it("custo 100, impostos 10%, lucro 5% → total 117,65", () => {
    const r = calcularPropostaEconomica({
      custoLaboratorioTecnico: 100,
      custoDiretoProjeto: 0,
      parametros: [
        { chave: "impostos_legacy", label: "Impostos", percentual: 10 },
        { chave: "lucro", label: "Lucro", percentual: 5 },
      ],
    });
    expect(r.subtotal).toBe(100);
    expect(r.somaPercentual).toBe(15);
    expect(r.totalFinal).toBe(117.65);
    expect(r.valido).toBe(true);
  });

  it("custo 200, parâmetros totais 20% → total 250,00", () => {
    const r = calcularPropostaEconomica({
      custoLaboratorioTecnico: 0,
      custoDiretoProjeto: 200,
      parametros: paramsTotais(20),
    });
    expect(r.totalFinal).toBe(250);
  });

  it("laboratório 100 + projeto 200 + parâmetros totais 20% → total 375,00", () => {
    const r = calcularPropostaEconomica({
      custoLaboratorioTecnico: 100,
      custoDiretoProjeto: 200,
      parametros: paramsTotais(20),
    });
    expect(r.subtotal).toBe(300);
    expect(r.totalFinal).toBe(375);
    // valor nominal de cada parâmetro = total_final × percentual
    expect(r.parametros[0].valorNominal).toBe(75); // 375 × 20%
    expect(r.totalParametros).toBe(75); // 375 - 300
  });

  it("soma de parâmetros 100% ou mais → bloqueio", () => {
    const r = calcularPropostaEconomica({
      custoLaboratorioTecnico: 100,
      custoDiretoProjeto: 0,
      parametros: [
        { chave: "impostos_legacy", label: "Impostos", percentual: 60 },
        { chave: "lucro", label: "Lucro", percentual: 40 },
      ],
    });
    expect(r.valido).toBe(false);
    expect(r.totalFinal).toBe(0);
    expect(r.alertas[0]).toMatch(/menor que 100%/i);
  });

  it("apenas laboratório", () => {
    const r = calcularPropostaEconomica({ custoLaboratorioTecnico: 100, custoDiretoProjeto: 0, parametros: paramsTotais(20) });
    expect(r.subtotal).toBe(100);
    expect(r.totalFinal).toBe(125); // 100 / 0,80
  });

  it("apenas projeto", () => {
    const r = calcularPropostaEconomica({ custoLaboratorioTecnico: 0, custoDiretoProjeto: 80, parametros: paramsTotais(20) });
    expect(r.totalFinal).toBe(100); // 80 / 0,80
  });

  it("laboratório + projeto", () => {
    const r = calcularPropostaEconomica({ custoLaboratorioTecnico: 40, custoDiretoProjeto: 60, parametros: paramsTotais(20) });
    expect(r.subtotal).toBe(100);
    expect(r.totalFinal).toBe(125);
  });

  it("rubrica PE com meses selecionados preserva a regra especial (meses × unitário)", () => {
    // PE: total = nº de meses × valor unitário (NÃO quantidade × unitário)
    const pe = itemProjetoTotal({ rubrica: "PE", quantidade: 1, preco_unitario: 1000, meses_selecionados: [1, 2, 3] });
    expect(pe).toBe(3000);
    const r = calcularPropostaEconomica({
      custoLaboratorioTecnico: 0,
      custoDiretoProjeto: pe, // 3000
      parametros: paramsTotais(20),
    });
    expect(r.totalFinal).toBe(3750); // 3000 / 0,80
  });

  it("arredondamento monetário a 2 casas", () => {
    const r = calcularPropostaEconomica({ custoLaboratorioTecnico: 10, custoDiretoProjeto: 0, parametros: paramsTotais(3) });
    expect(r.totalFinal).toBe(10.31); // 10 / 0,97 = 10,3092… → 10,31
  });

  it("snapshot reproduzível: mesmas entradas → mesmo objeto", () => {
    const entrada = {
      custoLaboratorioTecnico: 123.45,
      custoDiretoProjeto: 678.9,
      parametros: parametrosDeRates({ impostos_legacy: 7, lucro: 3, reserva: 2 }),
    };
    const a = calcularPropostaEconomica(entrada);
    const b = calcularPropostaEconomica(entrada);
    expect(b).toEqual(a);
    expect(a.formula).toContain("custo_laboratorial_tecnico");
    expect(a.politica).toBe("A_GROSS_UP_TOTAL");
  });
});
