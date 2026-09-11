import { describe, expect, it } from "vitest";
import {
  EscritaSemEfeitoError,
  conferirEscrita,
  garantirEscrita,
  semLinhasAfetadas,
} from "./escrita";

describe("semLinhasAfetadas", () => {
  it("trata null e undefined como nenhuma linha", () => {
    expect(semLinhasAfetadas(null)).toBe(true);
    expect(semLinhasAfetadas(undefined)).toBe(true);
  });

  it("trata array vazio como nenhuma linha", () => {
    expect(semLinhasAfetadas([])).toBe(true);
  });

  it("reconhece linhas devolvidas", () => {
    expect(semLinhasAfetadas([{ id: 1 }])).toBe(false);
    expect(semLinhasAfetadas({ id: 1 })).toBe(false);
  });
});

describe("garantirEscrita", () => {
  it("propaga o erro do PostgREST quando existe", () => {
    expect(() =>
      garantirEscrita({ message: "permission denied for table x" }, null, "Falhou."),
    ).toThrow("permission denied for table x");
  });

  it("REGRESSÃO P2: negação silenciosa da RLS não passa por sucesso", () => {
    // O caso que motivou a correção: DELETE cujo predicado não alcança
    // nenhuma linha visível volta sem erro e com array vazio.
    expect(() => garantirEscrita(null, [], "Não foi possível remover o item.")).toThrow(
      EscritaSemEfeitoError,
    );
  });

  it("explica ao usuário por que nada aconteceu", () => {
    expect(() => garantirEscrita(null, [], "Não foi possível remover o item.")).toThrow(
      /não atingiu nenhum registro/i,
    );
  });

  it("não lança quando a linha foi devolvida", () => {
    expect(() => garantirEscrita(null, [{ id: 7 }], "Falhou.")).not.toThrow();
  });

  it("prioriza o erro sobre a ausência de linhas", () => {
    expect(() => garantirEscrita({ message: "erro real" }, [], "Falhou.")).toThrow("erro real");
  });
});

describe("conferirEscrita", () => {
  it("devolve ok quando houve efeito", () => {
    expect(conferirEscrita(null, [{ id: 1 }], "Falhou.")).toEqual({ ok: true });
  });

  it("devolve mensagem quando não houve efeito", () => {
    const r = conferirEscrita(null, [], "Não foi possível salvar.");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/nenhum registro/i);
  });
});
