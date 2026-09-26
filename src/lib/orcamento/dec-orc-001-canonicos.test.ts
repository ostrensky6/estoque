// Testes canônicos da política econômica (DEC-ORC-001).
//
// DECISÃO APROVADA: Alternativa A (gross-up único sobre lab técnico + projeto
// direto). Os testes ATIVOS validam a Alternativa A pela engine autoritativa.
//
// As alternativas B e C foram removidas do código (2026-09-26): propostas
// antigas são lidas pelo snapshot gravado na emissão, sem recálculo.
import { describe, expect, it } from "vitest";
import { calcularPropostaEconomica } from "./engine-economica";

// =====================================================================
// ATIVO — Alternativa A (autoritativa).
// =====================================================================
describe("DEC-ORC-001 — Alternativa A (autoritativa, novas propostas)", () => {
  const params = (m: Record<string, number>) =>
    Object.entries(m).map(([chave, percentual]) => ({ chave, label: chave, percentual }));

  it("custo 100, impostos 10%, lucro 5% → 117,65", () => {
    expect(
      calcularPropostaEconomica({ custoLaboratorioTecnico: 100, custoDiretoProjeto: 0, parametros: params({ impostos: 10, lucro: 5 }) }).totalFinal,
    ).toBe(117.65);
  });

  it("custo 200, parâmetros totais 20% → 250,00", () => {
    expect(
      calcularPropostaEconomica({ custoLaboratorioTecnico: 0, custoDiretoProjeto: 200, parametros: params({ impostos: 20 }) }).totalFinal,
    ).toBe(250);
  });

  it("laboratório 100 + projeto 200 + parâmetros 20% → 375,00 (lab recebe parâmetros)", () => {
    const r = calcularPropostaEconomica({ custoLaboratorioTecnico: 100, custoDiretoProjeto: 200, parametros: params({ impostos: 20 }) });
    expect(r.totalFinal).toBe(375);
    expect(r.subtotal).toBe(300);
  });

  it("soma de parâmetros >= 100% bloqueia", () => {
    const r = calcularPropostaEconomica({ custoLaboratorioTecnico: 0, custoDiretoProjeto: 100, parametros: params({ impostos: 60, lucro: 40 }) });
    expect(r.valido).toBe(false);
    expect(r.totalFinal).toBe(0);
  });

  it("custo zero e arredondamento", () => {
    expect(calcularPropostaEconomica({ custoLaboratorioTecnico: 0, custoDiretoProjeto: 0, parametros: params({ impostos: 10 }) }).totalFinal).toBe(0);
    expect(calcularPropostaEconomica({ custoLaboratorioTecnico: 10, custoDiretoProjeto: 0, parametros: params({ impostos: 3 }) }).totalFinal).toBe(10.31);
  });
});
