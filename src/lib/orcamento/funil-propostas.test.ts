import { describe, expect, it } from "vitest";
import { resumirFunilPropostas } from "./funil-propostas";
import type { OrcamentoFila } from "./orcamentos-listagem";

// Só os campos lidos pela função importam; o resto é preenchido por cast.
function linha(grupo: OrcamentoFila["grupo"], status: string): OrcamentoFila {
  return { grupo, status } as OrcamentoFila;
}

describe("resumirFunilPropostas", () => {
  it("conta por grupo e por status decidido", () => {
    const resumo = resumirFunilPropostas([
      linha("em_elaboracao", "rascunho"),
      linha("em_elaboracao", "rascunho"),
      linha("revisao", "enviado"),
      linha("emitidos", "emitido"),
      linha("decididos", "aprovado"),
      linha("decididos", "recusado"),
      linha("decididos", "cancelado"),
    ]);
    expect(resumo).toEqual({
      emElaboracao: 2,
      revisao: 1,
      emitidas: 1,
      aprovadas: 1,
      recusadas: 1,
      concluidas: 3,
    });
  });

  it("lista vazia zera tudo", () => {
    expect(resumirFunilPropostas([])).toEqual({
      emElaboracao: 0,
      revisao: 0,
      emitidas: 0,
      aprovadas: 0,
      recusadas: 0,
      concluidas: 0,
    });
  });
});
