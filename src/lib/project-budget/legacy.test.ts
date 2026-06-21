import { describe, expect, it } from "vitest";
import { calcularOrcamentoProjetoLegacy, validarParametrosProjetoGrossUp } from "./legacy";

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

describe("calcularOrcamentoProjetoLegacy", () => {
  it("mantem erro de validacao quando gross-up e invalido", () => {
    const calculo = calcularOrcamentoProjetoLegacy(
      [{ rubrica: "MC", quantidade: 1, preco_unitario: 100 }],
      { impostos_legacy: 100 },
    );

    expect(calculo.validationError).toBe("A soma dos parâmetros econômicos deve ser menor que 100%.");
    expect(calculo.grossTotal).toBe(0);
  });
});
