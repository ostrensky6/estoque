import { describe, expect, it } from "vitest";
import { calcularFluxoDemanda } from "./fluxo-demanda";

const base = {
  demandaCompleta: true,
  demandaFaltante: 0,
  laboratorioStatus: "pendente" as const,
  laboratorioLabel: "Pendente",
  projetoStatus: "pendente" as const,
  projetoLabel: "Pendente",
  parametrosLiberados: false,
  orcamentoFinalPronto: false,
  versoesFinais: 0,
};

function etapa(modalidade: string, id: string) {
  return calcularFluxoDemanda({ ...base, modalidade }).find((item) => item.id === id);
}

describe("calcularFluxoDemanda", () => {
  it("exige laboratório e pula projeto para somente análises laboratoriais", () => {
    expect(etapa("analises", "laboratorio")).toMatchObject({ obrigatoria: true, estado: "ativo" });
    expect(etapa("analises", "projeto")).toMatchObject({ obrigatoria: false, estado: "pulado" });
  });

  it("pula laboratório e exige projeto para projeto sem análises", () => {
    expect(etapa("projeto", "laboratorio")).toMatchObject({ obrigatoria: false, estado: "pulado" });
    expect(etapa("projeto", "projeto")).toMatchObject({ obrigatoria: true, estado: "ativo" });
  });

  it("exige laboratório antes de projeto para projeto com análises", () => {
    const fluxo = calcularFluxoDemanda({ ...base, modalidade: "projeto_com_analises" });

    expect(fluxo.find((item) => item.id === "laboratorio")).toMatchObject({ obrigatoria: true, estado: "ativo" });
    expect(fluxo.find((item) => item.id === "projeto")).toMatchObject({ obrigatoria: true, estado: "bloqueado" });
  });

  it("libera projeto com análises depois que laboratório deixa de estar pendente", () => {
    const fluxo = calcularFluxoDemanda({
      ...base,
      modalidade: "projeto_com_analises",
      laboratorioStatus: "preenchido",
      laboratorioLabel: "Preenchido",
    });

    expect(fluxo.find((item) => item.id === "projeto")).toMatchObject({ obrigatoria: true, estado: "ativo" });
  });

  it("mantém parâmetros econômicos bloqueados antes da composição técnica", () => {
    expect(etapa("projeto_com_analises", "parametros")).toMatchObject({ estado: "bloqueado", status: "Bloqueado" });
  });
});
