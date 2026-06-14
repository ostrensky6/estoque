import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const insert = vi.fn();
const select = vi.fn();
const single = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/costing/loader", () => ({
  calcularTodas: vi.fn(async () => ({ breakdowns: [] })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({ insert, select, single })),
  })),
}));

describe("actions de orcamentos", () => {
  beforeEach(() => {
    redirect.mockClear();
    insert.mockClear();
    select.mockClear();
    single.mockClear();
    insert.mockReturnValue({ select });
    select.mockReturnValue({ single });
    single.mockResolvedValue({ data: { id: 42 }, error: null });
  });

  it("cria orcamento de analises usando cliente da sessao/RLS e redireciona para edicao", async () => {
    const { criarOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("tipo", "analises");
    formData.set("cliente_nome", "Cliente Teste");

    await expect(criarOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/42");

    expect(insert).toHaveBeenCalledWith({
      cliente_nome: "Cliente Teste",
      projeto_id: null,
      tipo: "analises",
    });
    expect(redirect).toHaveBeenCalledWith("/orcamento/42");
  });

  it("cria orcamento de projeto na tabela unificada de projetos", async () => {
    const { criarOrcamento } = await import("./orcamentos");
    const formData = new FormData();
    formData.set("tipo", "analises_projeto");
    formData.set("cliente_nome", "Cliente Projeto");
    formData.set("projeto_id", "5");
    formData.set("titulo", "Proposta Completa");

    await expect(criarOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/projetos/42");

    expect(insert).toHaveBeenCalledWith({
      projeto_id: 5,
      titulo: "Proposta Completa",
      cliente_nome: "Cliente Projeto",
    });
    expect(redirect).toHaveBeenCalledWith("/orcamento/projetos/42");
  });
});
