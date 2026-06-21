import { describe, expect, it } from "vitest";
import { avaliarModuloOperacional } from "./modulo-status";

describe("avaliarModuloOperacional", () => {
  it("marca modulo nao exigido sem pendencia", () => {
    expect(
      avaliarModuloOperacional({
        exigido: false,
        quantidadeItens: 0,
        pendenciaSemItens: "adicionar itens",
      }),
    ).toMatchObject({
      status: "nao_exigido",
      faltante: 0,
    });
  });

  it("marca modulo exigido sem itens como pendente", () => {
    expect(
      avaliarModuloOperacional({
        exigido: true,
        quantidadeItens: 0,
        pendenciaSemItens: "adicionar itens",
      }),
    ).toEqual({
      status: "pendente",
      label: "Pendente",
      faltante: 100,
      pendencias: ["adicionar itens"],
    });
  });

  it("marca modulo com itens em rascunho como preenchido", () => {
    expect(
      avaliarModuloOperacional({
        exigido: true,
        quantidadeItens: 2,
        statusDocumento: "rascunho",
        pendenciaSemItens: "adicionar itens",
      }),
    ).toMatchObject({
      status: "preenchido",
      faltante: 50,
    });
  });

  it("marca modulo enviado ou aprovado como revisado", () => {
    expect(
      avaliarModuloOperacional({
        exigido: true,
        quantidadeItens: 1,
        statusDocumento: "enviado",
        pendenciaSemItens: "adicionar itens",
      }),
    ).toMatchObject({
      status: "revisado",
      faltante: 0,
    });
  });
});
