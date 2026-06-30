import { describe, expect, it } from "vitest";
import {
  calcularDivergenciaInventario,
  exigeJustificativaInventario,
} from "./contagem";

describe("contagem de inventario", () => {
  it("calcula divergencia positiva", () => {
    expect(calcularDivergenciaInventario(10, 12)).toEqual({
      quantidadeSistema: 10,
      quantidadeContada: 12,
      divergencia: 2,
      temDivergencia: true,
    });
  });

  it("calcula divergencia negativa", () => {
    expect(calcularDivergenciaInventario(10, 7).divergencia).toBe(-3);
  });

  it("nao exige justificativa quando a contagem bate com o sistema", () => {
    expect(exigeJustificativaInventario(5, 5)).toBe(false);
  });

  it("exige justificativa quando ha divergencia", () => {
    expect(exigeJustificativaInventario(5, 4.5)).toBe(true);
  });
});
