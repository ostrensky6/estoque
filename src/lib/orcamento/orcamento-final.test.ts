import { describe, expect, it } from "vitest";
import { consolidarOrcamentoFinal } from "./orcamento-final";

// Política A (DEC-ORC-001): laboratório como custo técnico + projeto como custo
// direto, gross-up único sobre o subtotal técnico.
describe("consolidarOrcamentoFinal (Política A)", () => {
  it("bloqueia emissao quando modulo exigido ainda nao foi revisado", () => {
    const resultado = consolidarOrcamentoFinal({
      laboratorioExigido: true,
      projetoExigido: false,
      laboratorioRevisado: false,
      projetoRevisado: true,
      itensLaboratorio: [{ n_amostras: 2, custo_unitario: 10, preco_unitario: 15 }],
      itensProjeto: [],
      parametrosProjeto: {},
    });

    expect(resultado.pronto).toBe(false);
    expect(resultado.pendencias).toEqual(["revisar custos laboratoriais"]);
    // sem parâmetros → total = subtotal técnico (custo técnico do laboratório)
    expect(resultado.totalLaboratorioCusto).toBe(20);
    expect(resultado.subtotalTecnico).toBe(20);
    expect(resultado.totalFinal).toBe(20);
  });

  it("consolida laboratorio (técnico) e projeto (direto) com gross-up único", () => {
    const resultado = consolidarOrcamentoFinal({
      laboratorioExigido: true,
      projetoExigido: true,
      laboratorioRevisado: true,
      projetoRevisado: true,
      itensLaboratorio: [{ n_amostras: 2, custo_unitario: 10, preco_unitario: 15 }],
      itensProjeto: [{ rubrica: "MC", quantidade: 1, custo_unitario: 70 }],
      parametrosProjeto: { lucro: 30 },
    });

    expect(resultado.pronto).toBe(true);
    expect(resultado.pendencias).toEqual([]);
    expect(resultado.totalLaboratorioCusto).toBe(20); // custo técnico
    expect(resultado.totalLaboratorioPreco).toBe(30); // referência apenas
    expect(resultado.totalProjetoCusto).toBe(70); // custo direto
    expect(resultado.subtotalTecnico).toBe(90); // 20 + 70
    // 90 / (1 - 0,30) = 128,5714… → 128,57
    expect(resultado.totalFinal).toBe(128.57);
    expect(resultado.parametrosProjeto.find((p) => p.key === "lucro")?.amount).toBe(
      Math.round(128.57 * 0.3 * 100) / 100,
    );
    expect(resultado.origens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: "totalLaboratorioCusto", valor: 20 }),
        expect.objectContaining({ campo: "subtotalTecnico", valor: 90 }),
        expect.objectContaining({ campo: "totalFinal", valor: 128.57 }),
      ]),
    );
  });

  it("bloqueia quando a soma dos parâmetros >= 100%", () => {
    const resultado = consolidarOrcamentoFinal({
      laboratorioExigido: false,
      projetoExigido: true,
      laboratorioRevisado: true,
      projetoRevisado: true,
      itensLaboratorio: [],
      itensProjeto: [{ rubrica: "MC", quantidade: 1, custo_unitario: 100 }],
      parametrosProjeto: { impostos_legacy: 60, lucro: 40 },
    });
    expect(resultado.pronto).toBe(false);
    expect(resultado.totalFinal).toBe(0);
    expect(resultado.pendencias.join(" ")).toMatch(/menor que 100%/i);
  });
});
