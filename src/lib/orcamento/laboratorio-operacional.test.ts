import { describe, expect, it, vi } from "vitest";

import {
  montarSnapshotLaboratorio,
  statusOperacionalLaboratorio,
} from "./laboratorio-operacional";

describe("statusOperacionalLaboratorio", () => {
  it("classifica o preenchimento operacional pelo status e itens", () => {
    expect(statusOperacionalLaboratorio({ statusDocumento: "rascunho", quantidadeItens: 0 })).toBe("pendente");
    expect(statusOperacionalLaboratorio({ statusDocumento: "rascunho", quantidadeItens: 1 })).toBe("preenchido");
    expect(statusOperacionalLaboratorio({ statusDocumento: "enviado", quantidadeItens: 1 })).toBe("revisado");
    expect(statusOperacionalLaboratorio({ statusDocumento: "cancelado", quantidadeItens: 1 })).toBe("cancelado");
  });
});

describe("montarSnapshotLaboratorio", () => {
  it("monta totais internos por bloco de custo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T12:00:00.000Z"));

    const snapshot = montarSnapshotLaboratorio(
      [
        {
          codigo_analise: "DNA",
          n_amostras: 2,
          custo_unitario: 20,
          preco_unitario: 30,
        },
      ],
      [
        {
          codigo: "DNA",
          reagentes: 3,
          equipamento: 4,
          pessoal: 5,
          overhead: 2,
          custoTotal: 20,
          preco: 30,
        },
      ],
    ) as {
      gerado_em: string;
      totais: Record<string, number>;
      linhas: Array<Record<string, number | string>>;
    };

    expect(snapshot.gerado_em).toBe("2026-06-20T12:00:00.000Z");
    expect(snapshot.totais).toMatchObject({
      reagentes: 6,
      materiais: 6,
      equipamentos: 8,
      mao_obra: 10,
      overhead: 4,
      custo: 40,
      preco: 60,
      amostras: 2,
    });
    expect(snapshot.linhas[0]).toMatchObject({
      codigo_analise: "DNA",
      quantidade: 2,
      custo: 40,
      preco: 60,
    });

    vi.useRealTimers();
  });

  it("snapshot histórico continua legível sem breakdown atual (lê custo do item)", () => {
    // Quando o cadastro nao esta mais disponivel/recalculavel, o snapshot do
    // item (custo_unitario/preco_unitario gravados) preserva o valor historico.
    const snapshot = montarSnapshotLaboratorio(
      [{ codigo_analise: "ANTIGA", n_amostras: 3, custo_unitario: 15, preco_unitario: 25 }],
      [], // sem breakdown atual (cadastro removido/alterado)
    ) as { totais: Record<string, number>; linhas: Array<Record<string, number | string>> };

    expect(snapshot.totais.custo).toBe(45);
    expect(snapshot.totais.preco).toBe(75);
    expect(snapshot.linhas[0]).toMatchObject({ codigo_analise: "ANTIGA", custo: 45, preco: 75 });
  });
});
