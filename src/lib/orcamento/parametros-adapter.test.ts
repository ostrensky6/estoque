import { describe, expect, it } from "vitest";
import {
  adaptarOrcamentoParaEntradaParametros,
  aplicarParametrosDoOrcamento,
  parametrosProjetoParaPricing,
  totalLaboratorioCusto,
  totalLaboratorioPreco,
  totalProjetoCusto,
} from "./parametros-adapter";

describe("parametros-adapter", () => {
  const itensLaboratorio = [
    { n_amostras: 2, custo_unitario: 10, preco_unitario: 15 },
    { n_amostras: 3, custo_unitario: 20, preco_unitario: 40 },
  ];
  const itensProjeto = [
    { rubrica: "MC", quantidade: 2, custo_unitario: 50 },
    { rubrica: "PE", quantidade: 99, custo_unitario: 100, meses_selecionados: [1, 2, 3] },
  ];

  it("resume custos e precos laboratoriais a partir dos snapshots atuais", () => {
    expect(totalLaboratorioCusto(itensLaboratorio)).toBe(80);
    expect(totalLaboratorioPreco(itensLaboratorio)).toBe(150);
  });

  it("resume custo de projeto preservando a regra de meses da rubrica PE", () => {
    expect(totalProjetoCusto(itensProjeto)).toBe(400);
  });

  it("converte parametros legados de projeto para bases APENAS_PROJETO", () => {
    const parametros = parametrosProjetoParaPricing({
      impostos_legacy: 10,
      incubacao: 5,
      reserva: 2,
      investimentos: 3,
      lucro: 20,
    });

    expect(parametros).toEqual([
      expect.objectContaining({ chave: "impostos_legacy", base: "APENAS_PROJETO", percentual: 10 }),
      expect.objectContaining({ chave: "incubacao", base: "APENAS_PROJETO", percentual: 5 }),
      expect.objectContaining({ chave: "reserva", base: "APENAS_PROJETO", percentual: 2 }),
      expect.objectContaining({ chave: "investimentos", base: "APENAS_PROJETO", percentual: 3 }),
      expect.objectContaining({ chave: "lucro", base: "APENAS_PROJETO", percentual: 20 }),
    ]);
  });

  it("gera EntradaParametros com laboratorio como PRECO_JA_FORMADO por padrao", () => {
    const entrada = adaptarOrcamentoParaEntradaParametros({
      itensLaboratorio,
      itensProjeto,
      parametrosProjeto: { lucro: 20 },
    });

    expect(entrada).toMatchObject({
      metodo: "GROSS_UP",
      laboratorio: { valor: 150, modo: "PRECO_JA_FORMADO" },
      projeto: { custo: 400 },
    });
    expect(entrada.parametros).toContainEqual(
      expect.objectContaining({ chave: "lucro", base: "APENAS_PROJETO", percentual: 20 }),
    );
  });

  it("permite gerar EntradaParametros com laboratorio como CUSTO_TECNICO", () => {
    const entrada = adaptarOrcamentoParaEntradaParametros({
      itensLaboratorio,
      itensProjeto: [],
      parametrosProjeto: {},
      laboratorioModo: "CUSTO_TECNICO",
    });

    expect(entrada.laboratorio).toEqual({ valor: 80, modo: "CUSTO_TECNICO" });
  });

  it("conecta o orcamento atual a engine nova sem reaplicar gross-up no laboratorio precificado", () => {
    const aplicado = aplicarParametrosDoOrcamento({
      itensLaboratorio,
      itensProjeto,
      parametrosProjeto: { lucro: 20 },
    });

    expect(aplicado.laboratorio.total).toBe(150);
    expect(aplicado.projeto.total).toBe(500);
    expect(aplicado.totalFinal).toBe(650);
    expect(aplicado.parametros.find((parametro) => parametro.chave === "lucro")).toMatchObject({
      baseLaboratorio: 0,
      baseProjeto: 500,
      valorCalculado: 100,
    });
  });
});
