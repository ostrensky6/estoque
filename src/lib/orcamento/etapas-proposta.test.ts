import { describe, expect, it } from "vitest";
import { montarEtapasProposta } from "./etapas-proposta";

const labels = (modalidade: string) =>
  montarEtapasProposta(modalidade).filter((e) => e.aplicavel).map((e) => e.label);

describe("montarEtapasProposta", () => {
  it("apenas análises: laboratório sim, projeto não", () => {
    expect(labels("analises")).toEqual([
      "Dados da demanda",
      "Orçamento laboratorial",
      "Parâmetros econômicos",
      "Proposta final",
    ]);
  });

  it("apenas projeto: projeto sim, laboratório não", () => {
    expect(labels("projeto")).toEqual([
      "Dados da demanda",
      "Custos do projeto",
      "Parâmetros econômicos",
      "Proposta final",
    ]);
  });

  it("projeto com análises: laboratório e projeto", () => {
    expect(labels("projeto_analises_custos")).toEqual([
      "Dados da demanda",
      "Orçamento laboratorial",
      "Custos do projeto",
      "Parâmetros econômicos",
      "Proposta final",
    ]);
  });

  it("ordem e ids são fixos independentemente da modalidade", () => {
    const ids = montarEtapasProposta("analises").map((e) => e.id);
    expect(ids).toEqual(["demanda", "laboratorio", "projeto", "parametros", "final"]);
  });
});
