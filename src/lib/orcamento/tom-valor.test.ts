import { describe, it, expect } from "vitest";
import { classesValor } from "./tom-valor";

describe("classesValor — convenção visual §8.2 (azul = entrada, neutro = calculado)", () => {
  it("valor de entrada usa o azul institucional (brand)", () => {
    expect(classesValor("entrada")).toMatch(/brand/);
  });

  it("valor calculado NUNCA usa azul/brand", () => {
    expect(classesValor("calculado")).not.toMatch(/brand/);
    expect(classesValor("calculado", "bloqueado")).not.toMatch(/brand/);
    expect(classesValor("calculado", "snapshot")).not.toMatch(/brand/);
    expect(classesValor("calculado", "derivado")).not.toMatch(/brand/);
  });

  it("entrada e calculado produzem estilos distinguíveis", () => {
    expect(classesValor("entrada")).not.toBe(classesValor("calculado"));
  });

  it("valor calculado usa numeração tabular (alinhamento de dígitos)", () => {
    expect(classesValor("calculado")).toMatch(/tabular-nums/);
  });
});
