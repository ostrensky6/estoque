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

  it("preserva proveniência suficiente para reconstrução sem cadastro vivo", () => {
    const proveniencia = {
      insumo_id: 91,
      unidade_estoque: "frasco",
      unidade_consumo: "reação",
      fator_conversao: 100,
      quantidade_consumo: 20,
      quantidade_estoque: 0.2,
      fonte_custo: "custo_medio_ponderado",
      custo_unitario_estoque: 500,
      custo_unitario_consumo: 5,
    };
    const snapshot = montarSnapshotLaboratorio(
      [{
        codigo_analise: "PCR",
        n_amostras: 10,
        custo_unitario: 10,
        preco_unitario: 10,
        valor_snapshot: { proveniencia_dimensional: [proveniencia] },
      }],
      [{
        codigo: "PCR",
        reagentes: 10,
        equipamento: 0,
        pessoal: 0,
        overhead: 0,
        custoTotal: 10,
        preco: 10,
      }],
    ) as { linhas: Array<Record<string, unknown>> };

    expect(snapshot.linhas[0]).toMatchObject({
      proveniencia_dimensional: [proveniencia],
    });
  });
});
