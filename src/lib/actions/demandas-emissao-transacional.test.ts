import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrato da emissão transacional: o TS calcula/valida com a engine autoritativa
// e a persistência é feita por UMA chamada RPC. (Validação integrada da atomicidade
// real exige banco de homologação — ver diagnóstico.)
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/orcamento/governanca", () => ({ exigirPapelOrcamento: vi.fn(async () => {}) }));

type RpcResult = { data: unknown; error: { message: string } | null };
const rpc = vi.fn(
  async (): Promise<RpcResult> => ({ data: { id: 9, numero: "OF-2026-0007-v1", versao: 1 }, error: null }),
);
const rpcCall = (i: number) => rpc.mock.calls[i] as unknown as [string, Record<string, unknown>];
const getUser = vi.fn(async () => ({ data: { user: { id: "u1", email: "a@b.com" } } }));

const state = {
  demanda: {} as Record<string, unknown>,
  orcamentos: [] as unknown[],
  projetos: [] as unknown[],
  inserts: [] as string[],
  updates: [] as string[],
};

const from = vi.fn((table: string) => {
  if (table === "demandas_propostas") {
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: state.demanda, error: null }) }) }),
      update: () => ({ eq: async () => { state.updates.push(table); return { error: null }; } }),
    };
  }
  if (table === "orcamentos") {
    return {
      select: () => ({ eq: () => ({ order: async () => ({ data: state.orcamentos, error: null }) }) }),
      insert: () => { state.inserts.push(table); return { select: () => ({ single: async () => ({ data: { id: 1 } }) }) }; },
    };
  }
  if (table === "orcamento_projetos") {
    return { select: () => ({ eq: () => ({ order: async () => ({ data: state.projetos, error: null }) }) }) };
  }
  if (table === "orcamento_final_versoes") {
    return {
      update: () => ({ eq: () => ({ eq: async () => { state.updates.push(table); return { error: null }; } }) }),
      insert: () => { state.inserts.push(table); return { select: () => ({ single: async () => ({ data: { id: 1 } }) }) }; },
    };
  }
  if (table === "orcamento_parametros_aplicados") {
    return { insert: async () => { state.inserts.push(table); return { error: null }; } };
  }
  return {};
});

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from, rpc, auth: { getUser } })) }));

const demandasActions = await import("./demandas");

const demandaCompleta = {
  id: 7,
  titulo: "Demanda",
  cliente_nome: "Cliente",
  modalidade: "analises",
  status: "em_analise",
  escopo_preliminar: "Escopo",
  matriz_amostra: "Água",
  quantidade_amostras_estimada: 3,
};
const orcamentoRevisado = {
  id: 5,
  status: "aprovado",
  status_operacional: "revisado",
  orcamento_itens: [{ id: 1, n_amostras: 2, custo_unitario: 50, preco_unitario: 80 }],
};

beforeEach(() => {
  redirect.mockClear();
  rpc.mockClear();
  rpc.mockResolvedValue({ data: { id: 9, numero: "OF-2026-0007-v1", versao: 1 }, error: null });
  state.demanda = { ...demandaCompleta };
  state.orcamentos = [{ ...orcamentoRevisado }];
  state.projetos = [];
  state.inserts = [];
  state.updates = [];
});

async function emitir() {
  const fd = new FormData();
  fd.set("demanda_id", "7");
  fd.set("validade_dias", "30");
  return demandasActions.emitirOrcamentoFinalDaDemanda(fd);
}

describe("emissão transacional", () => {
  it("persiste via UMA chamada RPC e NÃO grava versão/parâmetros/status fora dela", async () => {
    await expect(emitir()).rejects.toThrow("NEXT_REDIRECT:/orcamento/demandas/7?etapa=final");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpcCall(0)[0]).toBe("emitir_orcamento_final_transacional");
    // nada gravado fora da RPC:
    expect(state.inserts).not.toContain("orcamento_final_versoes");
    expect(state.inserts).not.toContain("orcamento_parametros_aplicados");
    expect(state.updates).not.toContain("orcamento_final_versoes"); // sem "substituir" fora da RPC
    expect(state.updates).not.toContain("demandas_propostas"); // "orcada" só pela RPC
  });

  it("envia snapshot com engine/fórmula/totais e payload de parâmetros", async () => {
    await expect(emitir()).rejects.toThrow(/NEXT_REDIRECT/);
    const args = rpcCall(0)[1] as Record<string, unknown>;
    const snapshot = args.p_snapshot as { consolidado: { economia: { politica: string } } };
    expect(snapshot.consolidado.economia.politica).toBe("A_GROSS_UP_TOTAL");
    expect(typeof args.p_total_final).toBe("number");
    const params = args.p_parametros as { formula_snapshot: { formula: string } };
    expect(params.formula_snapshot.formula).toMatch(/custo_laboratorial_tecnico/);
  });

  it("cálculo vem da engine autoritativa (total 100 = lab técnico 2×50, sem parâmetros)", async () => {
    await expect(emitir()).rejects.toThrow(/NEXT_REDIRECT/);
    const args = rpcCall(0)[1] as Record<string, unknown>;
    expect(args.p_total_final).toBe(100);
    expect(args.p_total_laboratorio_custo).toBe(100);
  });

  it("falha da RPC retorna erro claro e não confirma emissão", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "lock timeout" } });
    await expect(emitir()).rejects.toThrow(/erro_emissao=/);
  });

  it("custo técnico zero bloqueia ANTES da RPC", async () => {
    state.orcamentos = [{ ...orcamentoRevisado, orcamento_itens: [{ id: 1, n_amostras: 2, custo_unitario: 0, preco_unitario: 0 }] }];
    await expect(emitir()).rejects.toThrow(/erro_emissao=/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("duplicidade ativa bloqueia emissão ANTES da RPC", async () => {
    state.orcamentos = [{ ...orcamentoRevisado, id: 5 }, { ...orcamentoRevisado, id: 6 }];
    await expect(emitir()).rejects.toThrow(/erro_emissao=/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
