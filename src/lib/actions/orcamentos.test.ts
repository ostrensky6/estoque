import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const revalidatePath = vi.fn();
const from = vi.fn();
const insert = vi.fn();
const select = vi.fn();
const single = vi.fn();
const eq = vi.fn();
const deleteRow = vi.fn();
const update = vi.fn();
const registrarEvento = vi.fn();
const exigirPapelOrcamento = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/costing/loader", () => ({
  calcularTodas: vi.fn(async () => ({ breakdowns: [] })),
}));
vi.mock("./eventos", () => ({ registrarEvento }));
vi.mock("@/lib/orcamento/governanca", () => ({ exigirPapelOrcamento }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from,
  })),
}));

describe("actions de orcamentos", () => {
  beforeEach(() => {
    redirect.mockClear();
    revalidatePath.mockClear();
    from.mockReset();
    insert.mockClear();
    select.mockClear();
    single.mockClear();
    eq.mockReset();
    deleteRow.mockReset();
    update.mockReset();
    registrarEvento.mockReset();
    exigirPapelOrcamento.mockReset();
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
    eq.mockReturnValueOnce({ single }).mockResolvedValueOnce({ error: null });

    await expect(cancelarOrcamento(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/42");

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("cancelar_documento");
    expect(update).toHaveBeenCalledWith({ status: "cancelado" });
    expect(registrarEvento).toHaveBeenCalledWith(
      "orcamento",
      42,
      "aprovado",
      "cancelado",
      "Cliente pediu cancelamento",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/42");
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento");
  });
});
