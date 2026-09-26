import { describe, expect, it } from "vitest";
import { calcularPropostaEconomica, parametrosDeRates } from "@/lib/orcamento/engine-economica";
import { consolidarOrcamentoFinal } from "@/lib/orcamento/orcamento-final";
import {
  calcularOrcamentoProjeto,
  itensProjetoNaBaseDeCusto,
  validarParametrosProjetoGrossUp,
} from "./orcamento-projeto";

describe("validarParametrosProjetoGrossUp", () => {
  it("aceita soma menor que 100%", () => {
    expect(
      validarParametrosProjetoGrossUp({
        impostos_legacy: 15,
        incubacao: 5,
        reserva: 5,
        investimentos: 5,
        lucro: 20,
      }),
    ).toEqual({ ok: true, soma: 50, message: "" });
  });

  it("bloqueia soma maior ou igual a 100%", () => {
    expect(
      validarParametrosProjetoGrossUp({
        impostos_legacy: 40,
        incubacao: 20,
        reserva: 20,
        investimentos: 10,
        lucro: 10,
      }),
    ).toEqual({
      ok: false,
      soma: 100,
      message: "A soma dos parâmetros econômicos deve ser menor que 100%.",
    });
  });

  it("bloqueia parametro negativo", () => {
    expect(
      validarParametrosProjetoGrossUp({
        impostos_legacy: -1,
      }),
    ).toEqual({
      ok: false,
      soma: 0,
      message: "Parâmetros econômicos não podem ser negativos.",
    });
  });
});

describe("calcularOrcamentoProjeto", () => {
  const rates = { impostos_legacy: 10, incubacao: 2, reserva: 5, investimentos: 3, lucro: 10 };
  const itens = [
    { rubrica: "MC", quantidade: 2, preco_unitario: 150 },
    { rubrica: "PE", quantidade: 0, preco_unitario: 1000, meses_selecionados: [1, 2, 3] },
  ];

  it("mantem erro de validacao quando gross-up e invalido", () => {
    const calculo = calcularOrcamentoProjeto(
      [{ rubrica: "MC", quantidade: 1, preco_unitario: 100 }],
      { impostos_legacy: 100 },
    );

    expect(calculo.validationError).toBe("A soma dos parâmetros econômicos deve ser menor que 100%.");
    expect(calculo.grossTotal).toBe(0);
  });

  it("usa a engine unica da proposta (Politica A), inclusive a incubacao sem impostos", () => {
    const calculo = calcularOrcamentoProjeto(itens, rates);
    const economia = calcularPropostaEconomica({
      custoLaboratorioTecnico: 0,
      custoDiretoProjeto: 3300,
      parametros: parametrosDeRates(rates),
    });

    expect(calculo.subtotal).toBe(3300);
    expect(calculo.grossTotal).toBe(economia.totalFinal);
    expect(calculo.grossUpFactor).toBe(economia.fatorGrossUp);
    expect(calculo.markupRate).toBeCloseTo(economia.somaPercentual, 10);
    // incubacao efetiva = 2% x (1 - 10%) = 1,8% -> valor menor que 2% do total
    const incubacao = calculo.economicParameters.find((p) => p.key === "incubacao");
    expect(incubacao?.nominalRate).toBe(2);
    expect(incubacao?.amount).toBe(economia.parametros.find((p) => p.chave === "incubacao")?.valorNominal);
    expect(incubacao?.amount).toBeLessThan(Math.round(calculo.grossTotal * 0.02 * 100) / 100);
  });

  it("da o mesmo total que a emissao da proposta para um projeto sem laboratorio", () => {
    const custos = [
      { rubrica: "MC", quantidade: 2, custo_unitario: 150, preco_unitario: 999 },
      { rubrica: "PE", quantidade: 0, custo_unitario: 1000, preco_unitario: 999, meses_selecionados: [1, 2, 3] },
    ];
    const analises = [{ n_amostras: 4, custo_unitario: 80, preco_unitario: 500 }];
    const calculo = calcularOrcamentoProjeto(itensProjetoNaBaseDeCusto({ custos, analises }), rates);
    const emissao = consolidarOrcamentoFinal({
      laboratorioExigido: false,
      projetoExigido: true,
      laboratorioRevisado: true,
      projetoRevisado: true,
      itensLaboratorio: [],
      itensProjeto: [
        ...custos,
        ...analises.map((a) => ({
          rubrica: "MC",
          quantidade: a.n_amostras,
          custo_unitario: a.custo_unitario,
          preco_unitario: a.preco_unitario,
          meses_selecionados: [],
        })),
      ],
      parametrosProjeto: rates,
    });

    expect(calculo.subtotal).toBe(emissao.totalProjetoCusto);
    expect(calculo.grossTotal).toBe(emissao.totalFinal);
  });
});

describe("itensProjetoNaBaseDeCusto", () => {
  it("usa o custo (nao o preco) e trata analises como material de consumo", () => {
    expect(
      itensProjetoNaBaseDeCusto({
        custos: [{ rubrica: "ST", quantidade: 1, custo_unitario: 40, preco_unitario: 90 }],
        analises: [{ n_amostras: 3, custo_unitario: 10, preco_unitario: 50 }],
      }),
    ).toEqual([
      { rubrica: "ST", quantidade: 1, preco_unitario: 40, meses_selecionados: [] },
      { rubrica: "MC", quantidade: 3, preco_unitario: 10, meses_selecionados: [] },
    ]);
  });
});
