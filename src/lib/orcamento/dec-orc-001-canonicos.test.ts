// Testes canônicos da política econômica (DEC-ORC-001).
//
// DECISÃO APROVADA: Alternativa A (gross-up único sobre lab técnico + projeto
// direto). Os testes ATIVOS validam a Alternativa A pela engine autoritativa.
//
// A Alternativa C permanece apenas como COMPATIBILIDADE HISTÓRICA (leitura de
// propostas antigas) — caracterizada aqui pela engine flexível legada
// `aplicarParametrosEconomicos` (que segue existindo para esse fim), sem ser a
// regra de fechamento de novas propostas.
import { describe, expect, it } from "vitest";
import { aplicarParametrosEconomicos, type ParametroEconomicoAplicavel } from "@/lib/costing/pricing";
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

// =====================================================================
// LEGADO — Alternativa C (compat. histórica; NÃO é a regra de fechamento).
// Documenta o comportamento da engine flexível `aplicarParametrosEconomicos`
// quando o laboratório entra como preço já formado e o gross-up incide só no
// projeto. Mantido apenas para leitura de propostas antigas.
// =====================================================================
describe("DEC-ORC-001 — Alternativa C (LEGADA, compatibilidade histórica)", () => {
  function paramsProjeto(map: Record<string, number>): ParametroEconomicoAplicavel[] {
    return Object.entries(map).map(([chave, percentual]) => ({ chave, label: chave, base: "APENAS_PROJETO", percentual }));
  }
  const aplicarC = (lab: number, projeto: number, m: Record<string, number>) =>
    aplicarParametrosEconomicos({
      metodo: "GROSS_UP",
      laboratorio: { valor: lab, modo: "PRECO_JA_FORMADO" },
      projeto: { custo: projeto },
      parametros: paramsProjeto(m),
    });

  it("(legado C) lab 100 + projeto 200 + 20% → 350 (lab passa direto)", () => {
    expect(aplicarC(100, 200, { impostos: 10, reserva: 3, investimentos: 2, lucro: 5 }).totalFinal).toBeCloseTo(350, 2);
  });

  it("(legado C) soma de parâmetros >= 100% lança erro", () => {
    expect(() => aplicarC(0, 100, { impostos: 60, lucro: 40 })).toThrow(/menor que 100%/i);
  });
});
