import { describe, expect, it } from "vitest";
import { normalizarModalidadeOrcamento, rotuloModalidade } from "./orcamento-economico";

describe("orcamento-economico", () => {
  it("mapeia modalidades antigas para a modalidade canonica", () => {
    expect(normalizarModalidadeOrcamento("analises")).toBe("analises");
    expect(normalizarModalidadeOrcamento("projeto")).toBe("projeto");
    expect(normalizarModalidadeOrcamento("analises_projeto")).toBe("projeto_com_analises");
    expect(normalizarModalidadeOrcamento("projeto_analises_custos")).toBe("projeto_com_analises");
  });

  it("mostra rótulos legíveis de modalidade, inclusive para códigos legados", () => {
    expect(rotuloModalidade("analises")).toBe("Apenas análises laboratoriais");
    expect(rotuloModalidade("projeto_analises_custos")).toBe("Projeto com análises laboratoriais");
    expect(rotuloModalidade(null)).toBe("—");
    expect(rotuloModalidade("outra")).toBe("outra");
  });
});
