import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockSupabaseClient,
  getMockSupabaseStore,
  resetMockSupabaseStore,
} from "@/lib/testing/mock-supabase";

vi.mock("server-only", () => ({}));

import { computarDemandaPlano } from "./demanda";

describe("demanda liquida do planejamento", () => {
  beforeEach(() => resetMockSupabaseStore());

  it("contabiliza parcial com lote e ignora shortfall parcial sem lote", async () => {
    const store = getMockSupabaseStore();
    store.planejamento_itens = [{
      planejamento_id: 7,
      codigo_analise: "E2-DEMANDA",
      n_amostras: 10,
      n_controles: 0,
      repeticoes: 1,
      perda_percentual: 0,
    }];
    store.etapas = [];
    store.insumo_analise = [{
      codigo_analise: "E2-DEMANDA",
      nome_etapa: "Preparo",
      nome_atividade: "Consumo",
      especificacao_insumo: "Insumo E2",
      grupo_escolha: null,
      quantidade_por_amostra: 1,
      modo_cobranca: "por_amostra",
      insumo_id: 42,
      insumos: { custo_unitario: 1 },
    }];
    store.v_estoque_saldo = [{
      insumo_id: 42,
      unidade: "mL",
      disponivel: 6,
    }];
    store.insumos = [{
      id: 42,
      fator_conversao: 1,
      custo_unitario: 1,
      quantidade_minima_compra: null,
      quantidade_embalagem: null,
    }];
    store.reservas_estoque = [
      {
        planejamento_id: 7,
        insumo_id: 42,
        lote_id: 101,
        quantidade: 3,
        quantidade_consumida: 1,
        status: "parcial",
      },
      {
        planejamento_id: 7,
        insumo_id: 42,
        lote_id: null,
        quantidade: 3,
        quantidade_consumida: 0,
        status: "parcial",
      },
    ];

    const [demanda] = await computarDemandaPlano(createMockSupabaseClient() as never, 7);

    expect(demanda).toMatchObject({ demanda: 10, disponivel: 6, falta: 2 });
  });
});
