// Testes canônicos preparatórios da Fase 4 (DEC-ORC-001).
//
// IMPORTANTE: estes testes NÃO trocam a engine de produção. Eles:
//   1) caracterizam (lockam) o comportamento ATUAL da engine de produção
//      (Alternativa C — laboratório como preço já formado, gross-up só no projeto);
//   2) documentam, em describe.skip, os valores das políticas CANDIDATAS (A/B/D)
//      ainda NÃO implementadas — pendentes de aprovação explícita.
//
// Ver docs/orcamento/DEC-ORC-001-politica-economica.md.
import { describe, expect, it } from "vitest";
import { aplicarParametrosEconomicos, roundMoney, type ParametroEconomicoAplicavel } from "@/lib/costing/pricing";
import { consolidarOrcamentoFinal } from "./orcamento-final";

function paramsProjeto(map: Record<string, number>): ParametroEconomicoAplicavel[] {
  return Object.entries(map).map(([chave, percentual]) => ({
    chave,
    label: chave,
    base: "APENAS_PROJETO",
    percentual,
  }));
}

function aplicar(labValor: number, projetoCusto: number, params: Record<string, number>) {
  return aplicarParametrosEconomicos({
    metodo: "GROSS_UP",
    laboratorio: { valor: labValor, modo: "PRECO_JA_FORMADO" },
    projeto: { custo: projetoCusto },
    parametros: paramsProjeto(params),
  });
}

// =====================================================================
// 1) Comportamento ATUAL de produção (Alternativa C) — caracterização.
//    Estes DEVEM passar; servem para flagrar qualquer mudança não intencional.
// =====================================================================
describe("DEC-ORC-001 — comportamento ATUAL (Alternativa C, produção)", () => {
  it("custo 100, impostos 10%, lucro 5% (só projeto): gross-up no projeto", () => {
    const r = aplicar(0, 100, { impostos: 10, lucro: 5 });
    // 100 / (1 - 0,15) = 117,6470… → 117,65
    expect(r.projeto.total).toBeCloseTo(117.65, 2);
    expect(r.totalFinal).toBeCloseTo(117.65, 2);
  });

  it("custo 200, parâmetros totais 20% (só projeto)", () => {
    const r = aplicar(0, 200, { impostos: 10, reserva: 3, investimentos: 2, lucro: 5 });
    // 200 / (1 - 0,20) = 250
    expect(r.totalFinal).toBeCloseTo(250, 2);
  });

  it("laboratório 100 + projeto 200 + parâmetros 20%: lab passa direto, gross-up só no projeto", () => {
    const r = aplicar(100, 200, { impostos: 10, reserva: 3, investimentos: 2, lucro: 5 });
    expect(r.laboratorio.total).toBeCloseTo(100, 2); // preço já formado, sem parâmetros
    expect(r.projeto.total).toBeCloseTo(250, 2); // 200 / (1 - 0,20)
    expect(r.totalFinal).toBeCloseTo(350, 2);
  });

  it("soma de parâmetros >= 100% é bloqueada (throw)", () => {
    expect(() => aplicar(0, 100, { impostos: 60, lucro: 40 })).toThrow(/menor que 100%/i);
  });

  it("custo zero: total acompanha apenas o laboratório", () => {
    expect(aplicar(0, 0, { impostos: 10, lucro: 5 }).totalFinal).toBeCloseTo(0, 2);
    expect(aplicar(100, 0, { impostos: 10, lucro: 5 }).totalFinal).toBeCloseTo(100, 2);
  });

  it("arredondamento monetário a 2 casas", () => {
    // 10 / (1 - 0,03) = 10,3092… → 10,31
    expect(aplicar(0, 10, { impostos: 3 }).totalFinal).toBeCloseTo(10.31, 2);
    expect(roundMoney(117.6470588)).toBe(117.65);
  });

  it("consolidarOrcamentoFinal (produção) reproduz o total 350 no cenário canônico", () => {
    const r = consolidarOrcamentoFinal({
      laboratorioExigido: true,
      projetoExigido: true,
      laboratorioRevisado: true,
      projetoRevisado: true,
      itensLaboratorio: [{ n_amostras: 1, custo_unitario: 50, preco_unitario: 100 }],
      itensProjeto: [{ rubrica: "MC", quantidade: 1, custo_unitario: 200, preco_unitario: 200 }],
      parametrosProjeto: { impostos_legacy: 10, reserva: 3, investimentos: 2, lucro: 5 },
    });
    expect(r.totalLaboratorioPreco).toBeCloseTo(100, 2);
    expect(r.totalProjetoFinal).toBeCloseTo(250, 2);
    expect(r.totalFinal).toBeCloseTo(350, 2);
  });
});

// =====================================================================
// 2) Políticas CANDIDATAS (pendentes de decisão) — describe.skip.
//    NÃO rodam na suíte principal. Documentam os valores esperados de cada
//    alternativa no cenário canônico (lab 100 + projeto 200 + Σ 20%).
//    Só viram testes reais APÓS aprovação explícita da política.
// =====================================================================
describe.skip("DEC-ORC-001 — políticas candidatas (NÃO implementadas; pendentes de aprovação)", () => {
  const SUB = 300; // lab 100 + projeto 200
  const SIGMA = 0.2;
  const grossUp = (base: number, s: number) => roundMoney(base / (1 - s));
  const markup = (base: number, s: number) => roundMoney(base * (1 + s));

  it("A) gross-up sobre o total (lab recebe parâmetros) → 375,00", () => {
    expect(grossUp(SUB, SIGMA)).toBeCloseTo(375, 2);
  });

  it("B) tributos gross-up + margem/fundos markup → 366,67", () => {
    // markup de margem/fundos (10%) sobre custo, depois gross-up de tributos (10%)
    const baseComMarkup = markup(SUB, 0.1); // 330
    expect(grossUp(baseComMarkup, 0.1)).toBeCloseTo(366.67, 2);
  });

  it("D) markup no projeto (coerente com o custeio) → 340,00", () => {
    const labPreco = 100; // preço já formado
    const projeto = markup(200, SIGMA); // 240
    expect(roundMoney(labPreco + projeto)).toBeCloseTo(340, 2);
  });
});
