import { describe, expect, it } from "vitest";
import { gerarUrlCurtaKontrol, isTipoUrlCurtaKontrol } from "./urls";

describe("urls curtas Kontrol", () => {
  it("gera URLs internas para entidades do PR 3", () => {
    expect(gerarUrlCurtaKontrol("lote", 12)).toBe("/s/lote/12");
    expect(gerarUrlCurtaKontrol("equipamento", 7)).toBe("/s/equipamento/7");
    expect(gerarUrlCurtaKontrol("equipamento_unidade", 44)).toBe("/s/equipamento_unidade/44");
  });

  it("rejeita ids invalidos", () => {
    expect(() => gerarUrlCurtaKontrol("lote", 0)).toThrow("inteiro positivo");
    expect(() => gerarUrlCurtaKontrol("lote", 1.2)).toThrow("inteiro positivo");
  });

  it("identifica tipos cobertos por URL curta neste PR", () => {
    expect(isTipoUrlCurtaKontrol("lote")).toBe(true);
    expect(isTipoUrlCurtaKontrol("equipamento_unidade")).toBe(true);
    expect(isTipoUrlCurtaKontrol("insumo")).toBe(false);
  });
});
