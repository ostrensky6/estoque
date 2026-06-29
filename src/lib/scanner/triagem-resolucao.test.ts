import { describe, expect, it } from "vitest";
import { entidadeTipoParaResolucao, isTipoResolucaoTriagem } from "./triagem-resolucao";

describe("triagem-resolucao", () => {
  it("aceita apenas tipos de resolucao do PR 6", () => {
    expect(isTipoResolucaoTriagem("insumo")).toBe(true);
    expect(isTipoResolucaoTriagem("lote")).toBe(true);
    expect(isTipoResolucaoTriagem("local")).toBe(true);
    expect(isTipoResolucaoTriagem("equipamento")).toBe(false);
  });

  it("mapeia tipo de resolucao para entidade escaneavel", () => {
    expect(entidadeTipoParaResolucao("insumo")).toBe("insumo");
    expect(entidadeTipoParaResolucao("lote")).toBe("lote");
    expect(entidadeTipoParaResolucao("local")).toBe("local");
  });
});
