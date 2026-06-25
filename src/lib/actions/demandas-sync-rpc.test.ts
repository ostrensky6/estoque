import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockSupabaseClient,
  getMockSupabaseStore,
  resetMockSupabaseStore,
} from "@/lib/testing/mock-supabase";

const mockSupabase = vi.hoisted(() => ({ client: null as ReturnType<typeof createMockSupabaseClient> | null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase.client),
}));

function prepararDemanda() {
  const store = getMockSupabaseStore();
  store.demandas_propostas = [
    {
      id: 1,
      titulo: "Demanda RPC",
      cliente_id: 1,
      cliente_nome: "Cliente Demo",
      modalidade: "projeto_com_analises",
      projeto_id: 1,
      descricao: "Demanda com análises",
      escopo_preliminar: "Escopo",
      matriz_amostra: "Solo",
      quantidade_amostras_estimada: 12,
      status: "nova",
    },
  ];
  store.orcamentos = [
    {
      id: 2,
      demanda_id: 1,
      tipo: "analises",
      cliente_nome: "Cliente Demo",
      status: "rascunho",
      criado_em: "2026-06-21T10:00:00.000Z",
    },
  ];
  store.demanda_analises = [
    {
      id: 1,
      demanda_id: 1,
      codigo_analise: "TESTE-16S",
      quantidade_amostras: 12,
      origem_quantidade: "padrao",
      status_custeio: "disponivel",
    },
  ];
  store.orcamento_itens = [
    {
      id: 2,
      orcamento_id: 2,
      codigo_analise: "TESTE-16S",
      n_amostras: 12,
      custo_unitario: 45,
      preco_unitario: 90,
    },
  ];
}

function formDemanda(quantidade16s: string, quantidadeQpcr: string) {
  const form = new FormData();
  form.set("demanda_id", "1");
  form.set("cliente_id", "1");
  form.set("projeto_id", "1");
  form.set("titulo", "Demanda RPC");
  form.set("modalidade", "projeto_com_analises");
  form.set("status", "nova");
  form.set("prioridade", "normal");
  form.set("descricao", "Demanda com análises");
  form.set("escopo_preliminar", "Escopo");
  form.set("matriz_amostra", "Solo");
  form.set("quantidade_amostras_estimada", "12");
  form.append("analise_codigo", "TESTE-16S");
  form.append("analise_quantidade", quantidade16s);
  form.append("analise_origem_quantidade", "manual");
  form.append("analise_codigo", "TESTE-QPCR");
  form.append("analise_quantidade", quantidadeQpcr);
  form.append("analise_origem_quantidade", "manual");
  return form;
}

// TODO: feature de sincronização demanda_analises via RPC ainda não implementada.
describe.skip("sincronização de demanda por RPC", () => {
  beforeEach(() => {
    resetMockSupabaseStore();
    mockSupabase.client = createMockSupabaseClient();
    prepararDemanda();
  });

  it("salva duas análises com quantidades diferentes por uma chamada RPC atômica", async () => {
    const { salvarDemanda } = await import("./demandas");

    const result = await salvarDemanda({ ok: false }, formDemanda("10", "7"));

    const store = getMockSupabaseStore();
    expect(result.ok).toBe(true);
    expect(store.demanda_analises).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo_analise: "TESTE-16S", quantidade_amostras: 10 }),
        expect.objectContaining({ codigo_analise: "TESTE-QPCR", quantidade_amostras: 7 }),
      ]),
    );
    expect(store.orcamento_itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo_analise: "TESTE-16S", n_amostras: 10 }),
        expect.objectContaining({ codigo_analise: "TESTE-QPCR", n_amostras: 7 }),
      ]),
    );
  });

  it("bloqueia atualização de orçamento não rascunho e preserva vínculos e itens", async () => {
    const store = getMockSupabaseStore();
    store.orcamentos[0].status = "enviado";
    const antesDemandaAnalises = JSON.stringify(store.demanda_analises);
    const antesItens = JSON.stringify(store.orcamento_itens);
    const { salvarDemanda } = await import("./demandas");

    const result = await salvarDemanda({ ok: false }, formDemanda("99", "8"));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Somente orcamento laboratorial em rascunho/);
    expect(JSON.stringify(store.demanda_analises)).toBe(antesDemandaAnalises);
    expect(JSON.stringify(store.orcamento_itens)).toBe(antesItens);
  });
});
