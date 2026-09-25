import { describe, expect, it } from "vitest";

import { responsavelDoProjeto } from "./responsavel";

describe("responsavelDoProjeto", () => {
  it("usa o campo editado no cadastro", () => {
    expect(responsavelDoProjeto({ responsavel: "Ana", coordenador: "Bruno" })).toBe("Ana");
  });

  it("cai para o coordenador antigo quando o responsável está vazio", () => {
    expect(responsavelDoProjeto({ responsavel: "  ", coordenador_nome: null, coordenador: "Bruno" })).toBe("Bruno");
  });

  it("devolve null sem nenhum nome", () => {
    expect(responsavelDoProjeto({})).toBeNull();
  });
});
