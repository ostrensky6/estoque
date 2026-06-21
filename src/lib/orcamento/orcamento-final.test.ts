import { describe, expect, it } from "vitest";
import { consolidarOrcamentoFinal } from "./orcamento-final";

describe("consolidarOrcamentoFinal", () => {
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
    expect(resultado.totalFinal).toBe(30);
  });

  it("consolida laboratorio e projeto quando modulos exigidos estao revisados", () => {
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
    expect(resultado.totalLaboratorioCusto).toBe(20);
    expect(resultado.totalLaboratorioPreco).toBe(30);
    expect(resultado.totalProjetoCusto).toBe(70);
    expect(resultado.totalProjetoFinal).toBe(100);
    expect(resultado.totalFinal).toBe(130);
    expect(resultado.origens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campo: "totalLaboratorioPreco",
          valor: 30,
        }),
        expect.objectContaining({
          campo: "totalProjetoFinal",
          valor: 100,
        }),
        expect.objectContaining({
          campo: "totalFinal",
          valor: 130,
        }),
      ]),
    );
  });
});
