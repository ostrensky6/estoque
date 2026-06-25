import { describe, expect, it } from "vitest";
import { calcularOrcamentoProjetoLegacy, validarParametrosProjetoGrossUp } from "./legacy";

describe("validarParametrosProjetoGrossUp", () => {
  it("aceita parâmetros acima de 100% quando só lucro, reserva e investimento passam disso", () => {
    expect(
      validarParametrosProjetoGrossUp({
        impostos_legacy: 15,
        incubacao: 5,
        reserva: 50,
        investimentos: 5,
        lucro: 100,
      }),
    ).toEqual({ ok: true, soma: 20, message: "" });
  });

  it("bloqueia apenas impostos e incubação maior ou igual a 100%", () => {
    expect(
      validarParametrosProjetoGrossUp({
        impostos_legacy: 80,
        incubacao: 20,
        reserva: 20,
        investimentos: 10,
        lucro: 100,
      }),
    ).toEqual({
      ok: false,
      soma: 100,
      message: "Impostos e incubação devem somar menos de 100%.",
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

describe("calcularOrcamentoProjetoLegacy", () => {
  it("mantem erro de validacao quando gross-up e invalido", () => {
    const calculo = calcularOrcamentoProjetoLegacy(
      [{ rubrica: "MC", quantidade: 1, preco_unitario: 100 }],
      { impostos_legacy: 100 },
    );

    expect(calculo.validationError).toBe("Impostos e incubação devem somar menos de 100%.");
    expect(calculo.grossTotal).toBe(0);
  });

  it("calcula lucro de 100% como markup sobre custo", () => {
    const calculo = calcularOrcamentoProjetoLegacy(
      [{ rubrica: "MC", quantidade: 1, preco_unitario: 100 }],
      { impostos_legacy: 10, lucro: 100 },
    );

    expect(calculo.validationError).toBe("");
    expect(calculo.profit).toBe(100);
    expect(calculo.grossTotal).toBe(222.22);
  });
});
