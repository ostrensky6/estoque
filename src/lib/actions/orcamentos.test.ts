import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Breakdown } from "@/lib/costing/engine";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const revalidatePath = vi.fn();
const from = vi.fn();
const rpc = vi.fn();
const insert = vi.fn();
const select = vi.fn();
const single = vi.fn();
const eq = vi.fn();
const deleteRow = vi.fn();
const update = vi.fn();
const registrarEvento = vi.fn();
const exigirPapelOrcamento = vi.fn();
const calcularTodas = vi.fn(async (): Promise<{ breakdowns: Breakdown[] }> => ({ breakdowns: [] }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/costing/loader", () => ({
  calcularTodas,
}));
vi.mock("./eventos", () => ({ registrarEvento }));
vi.mock("@/lib/orcamento/governanca", () => ({ exigirPapelOrcamento }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from,
    rpc,
  })),
}));

describe("actions de orcamentos", () => {
  beforeEach(() => {
    redirect.mockClear();
    revalidatePath.mockClear();
    from.mockReset();
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    insert.mockClear();
    select.mockClear();
    single.mockClear();
    eq.mockReset();
    deleteRow.mockReset();
    update.mockReset();
    registrarEvento.mockReset();
    exigirPapelOrcamento.mockReset();
    calcularTodas.mockReset();
    calcularTodas.mockResolvedValue({ breakdowns: [] });
    from.mockReturnValue({ insert, select, delete: deleteRow, update });
    insert.mockReturnValue({ select });
    select.mockReturnValue({ single, eq });
    eq.mockReturnValue({ single });
    deleteRow.mockReturnValue({ eq });
    update.mockReturnValue({ eq });
    single.mockResolvedValue({ data: { id: 42 }, error: null });
  });

  it("cria orcamento de analises usando cliente da sessao/RLS e redireciona para edicao", async () => {
    const { criarOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("demanda_id", "7");
    formData.set("tipo", "analises");
    formData.set("cliente_nome", "Cliente Teste");

    await expect(criarOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/42");

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("preencher_custos");
    expect(insert).toHaveBeenCalledWith({
      demanda_id: 7,
      cliente_nome: "Cliente Teste",
      projeto_id: null,
      tipo: "analises",
    });
    expect(redirect).toHaveBeenCalledWith("/orcamento/42");
  });

  it("cria orcamento de projeto na tabela unificada de projetos", async () => {
    const { criarOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("demanda_id", "9");
    formData.set("tipo", "analises_projeto");
    formData.set("cliente_nome", "Cliente Projeto");
    formData.set("projeto_id", "5");
    formData.set("titulo", "Proposta Completa");

    await expect(criarOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/demandas/9?etapa=projeto");

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("preencher_custos");
    expect(insert).toHaveBeenCalledWith({
      demanda_id: 9,
      projeto_id: 5,
      titulo: "Proposta Completa",
      cliente_nome: "Cliente Projeto",
    });
    expect(redirect).toHaveBeenCalledWith("/orcamento/demandas/9?etapa=projeto");
  });

  it("bloqueia criacao direta sem demanda vinculada", async () => {
    const { criarOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("tipo", "analises");

    await expect(criarOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/demandas");

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("preencher_custos");
    expect(insert).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/orcamento/demandas");
  });

  it("bloqueia exclusao de orcamento enviado", async () => {
    const { excluirOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("orcamento_id", "42");
    single.mockResolvedValue({ data: { status: "enviado" }, error: null });

    await expect(excluirOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/42?erro_exclusao=");

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("cancelar_documento");
    expect(deleteRow).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("/orcamento/42?erro_exclusao="));
  });

  it("permite exclusao de orcamento em rascunho", async () => {
    const { excluirOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("orcamento_id", "42");
    single.mockResolvedValue({ data: { status: "rascunho" }, error: null });

    await expect(excluirOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento");

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("cancelar_documento");
    expect(deleteRow).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", 42);
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento");
    expect(redirect).toHaveBeenCalledWith("/orcamento");
  });

  it("cancela orcamento preservando historico", async () => {
    const { cancelarOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("orcamento_id", "42");
    formData.set("motivo", "Cliente pediu cancelamento");
    single.mockResolvedValue({ data: { status: "aprovado" }, error: null });
    await expect(cancelarOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/42");

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("cancelar_documento");
    expect(rpc).toHaveBeenCalledWith("transicionar_orcamento", expect.objectContaining({
      p_orcamento_id: 42,
      p_status_destino: "cancelado",
      p_observacao: "Cliente pediu cancelamento",
    }));
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/42");
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento");
  });

  it("persiste snapshot dimensional completo ao adicionar uma analise", async () => {
    const provenienciaDimensional = {
      insumo_id: 9,
      unidade_estoque: "frasco",
      unidade_consumo: "reacao",
      fator_conversao: 100,
      quantidade_consumo: 20,
      quantidade_estoque: 0.2,
      fonte_custo: "custo_medio_ponderado",
      custo_unitario_estoque: 500,
      custo_unitario_consumo: 5,
      referencia_custo: "lotes_estoque_liberados",
    };
    calcularTodas.mockResolvedValue({
      breakdowns: [{
        codigo: "A1",
        lote: 10,
        reagentes: 5,
        equipamento: 0,
        pessoal: 0,
        custoAnalitico: 5,
        overhead: 0,
        custoTotal: 5,
        fatores: 0,
        preco: 5,
        provenienciaDimensional: [provenienciaDimensional],
      }],
    });

    const insertItem = vi.fn(async () => ({ error: null }));
    const updateOrcamento = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));
    let leituraOrcamento = 0;
    let leituraItens = 0;
    from.mockImplementation((table: string) => {
      if (table === "analises") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { ativo: true, ofertavel: true }, error: null }),
            }),
          }),
        };
      }
      if (table === "orcamentos") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: leituraOrcamento++ === 0
                  ? { fonte_custo_insumos: "custo_medio_ponderado" }
                  : { status: "rascunho", status_operacional: "pendente" },
                error: null,
              }),
            }),
          }),
          update: updateOrcamento,
        };
      }
      if (table === "orcamento_itens") {
        return {
          select: () => {
            if (leituraItens++ === 0) {
              return {
                eq: () => ({
                  eq: () => ({
                    order: async () => ({ data: [], error: null }),
                  }),
                }),
              };
            }
            return { eq: async () => ({ data: [{ id: 1 }], error: null }) };
          },
          insert: insertItem,
        };
      }
      throw new Error(`Tabela inesperada no teste: ${table}`);
    });

    const { adicionarItemOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("orcamento_id", "42");
    formData.set("codigo_analise", "A1");
    formData.set("n_amostras", "10");

    await adicionarItemOrcamento(formData);

    expect.soft(insertItem).toHaveBeenCalledWith(expect.objectContaining({
      valor_snapshot: expect.objectContaining({
        proveniencia_dimensional: [provenienciaDimensional],
      }),
    }));
    expect.soft(updateOrcamento).toHaveBeenCalledWith(expect.objectContaining({
      custo_snapshot: expect.objectContaining({
        linhas: expect.arrayContaining([
          expect.objectContaining({
            proveniencia_dimensional: [provenienciaDimensional],
          }),
        ]),
      }),
    }));
  });

  it("recalcula com operacao fornecida e nao atualiza status depois da RPC", async () => {
    const operacaoId = "11111111-1111-4111-8111-111111111111";
    calcularTodas.mockResolvedValue({
      breakdowns: [{
        codigo: "A1",
        lote: 10,
        reagentes: 5,
        equipamento: 0,
        pessoal: 0,
        custoAnalitico: 5,
        overhead: 0,
        custoTotal: 5,
        fatores: 0,
        preco: 5,
        provenienciaDimensional: [],
      }],
    });
    const updateOrcamento = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));
    let leituraOrcamento = 0;
    let leituraItens = 0;
    from.mockImplementation((table: string) => {
      if (table === "orcamentos") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: leituraOrcamento++ === 0
                  ? {
                      status: "rascunho",
                      fonte_custo_insumos: "custo_padrao",
                      custo_revisao: 3,
                    }
                  : { status: "rascunho" },
                error: null,
              }),
            }),
          }),
          update: updateOrcamento,
        };
      }
      if (table === "orcamento_itens") {
        return {
          select: () => ({
            eq: async () => ({
              data: leituraItens++ === 0
                ? [{
                    id: 7,
                    codigo_analise: "A1",
                    n_amostras: 10,
                    custo_unitario: 4,
                    preco_unitario: 4,
                    valor_snapshot: null,
                  }]
                : [{ id: 7 }],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Tabela inesperada no teste: ${table}`);
    });

    const { recalcularOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("orcamento_id", "42");
    formData.set("motivo", "Atualização controlada");
    formData.set("fonte_custo_insumos", "custo_padrao");
    formData.set("operacao_id", operacaoId);

    const resultado = await recalcularOrcamento(formData);

    expect.soft(rpc).toHaveBeenCalledWith(
      "recalcular_orcamento_transacional",
      expect.objectContaining({ p_operacao_id: operacaoId }),
    );
    expect.soft(updateOrcamento).not.toHaveBeenCalled();
    expect.soft(resultado).toEqual({
      ok: true,
      message: "Orçamento recalculado com sucesso.",
    });
  });

  it("retorna falha explicita quando o id do orcamento e invalido", async () => {
    const { recalcularOrcamento } = await import("./orcamentos");

    const resultado = await recalcularOrcamento(new FormData());

    expect(resultado).toEqual({
      ok: false,
      message: "Informe um orçamento válido para recalcular.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("retorna falha explicita quando o orcamento nao existe", async () => {
    from.mockImplementation((table: string) => {
      if (table === "orcamentos") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Tabela inesperada no teste: ${table}`);
    });
    const { recalcularOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("orcamento_id", "42");
    formData.set("operacao_id", "55555555-5555-4555-8555-555555555555");

    const resultado = await recalcularOrcamento(formData);

    expect(resultado).toEqual({
      ok: false,
      message: "Orçamento não encontrado para recálculo.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
